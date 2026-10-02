// Offline sound-effect renderer. Builds real 16-bit PCM WAV files instead of
// synthesizing tones live in the browser (which was unreliable on mobile).
// No deps — hand-rolled oscillators/noise/biquad filters, mixed to a buffer,
// then encoded to .wav.
"use strict";
const fs = require("fs");
const path = require("path");

const SR = 44100;

function zeros(n){ return new Float64Array(n); }
function secToSamples(s){ return Math.max(0, Math.round(s * SR)); }

/* ---------- biquad (RBJ cookbook), recomputed per-sample for sweeps ---------- */
function biquadCoeffs(type, freq, Q){
  freq = Math.min(Math.max(freq, 20), SR / 2 - 100);
  const w0 = 2 * Math.PI * freq / SR;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);
  let b0, b1, b2, a0, a1, a2;
  if(type === "lowpass"){
    b0 = (1 - cosw0) / 2; b1 = 1 - cosw0; b2 = (1 - cosw0) / 2;
    a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
  } else if(type === "highpass"){
    b0 = (1 + cosw0) / 2; b1 = -(1 + cosw0); b2 = (1 + cosw0) / 2;
    a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
  } else { // bandpass, constant 0dB peak gain
    b0 = alpha; b1 = 0; b2 = -alpha;
    a0 = 1 + alpha; a1 = -2 * cosw0; a2 = 1 - alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/* applies a (possibly time-varying) filter in place; freqFn(t) in Hz, t in seconds */
function filterInPlace(samples, freqFn, type, Q){
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for(let i = 0; i < samples.length; i++){
    const t = i / SR;
    const c = biquadCoeffs(type, freqFn(t), Q);
    const x0 = samples[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    samples[i] = y0;
  }
}

/* ---------- oscillators (2x oversampled + averaged for cheap anti-aliasing) ---------- */
function osc(type, freqFn, durSec, phase0){
  const n = secToSamples(durSec);
  const out = zeros(n);
  const os = 2;
  let phase = phase0 || 0;
  for(let i = 0; i < n; i++){
    let acc = 0;
    for(let k = 0; k < os; k++){
      const t = (i + k / os) / SR;
      const f = freqFn(t);
      phase += f / SR / os;
      const ph = phase % 1;
      let v;
      if(type === "sine") v = Math.sin(2 * Math.PI * ph);
      else if(type === "square") v = ph < 0.5 ? 1 : -1;
      else if(type === "sawtooth") v = 2 * ph - 1;
      else v = Math.sin(2 * Math.PI * ph);
      acc += v;
    }
    out[i] = acc / os;
  }
  return out;
}

function whiteNoise(durSec){
  const n = secToSamples(durSec);
  const out = zeros(n);
  for(let i = 0; i < n; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

/* exponential-ish decay envelope, 0..1 down to ~0 by the end */
function decayEnv(n, decayPow){
  const out = zeros(n);
  for(let i = 0; i < n; i++) out[i] = Math.pow(1 - i / n, decayPow);
  return out;
}
/* quick attack then decay across the whole duration */
function attackDecayEnv(n, attackSec){
  const out = zeros(n);
  const a = secToSamples(attackSec);
  for(let i = 0; i < n; i++){
    if(i < a) out[i] = i / a;
    else out[i] = Math.pow(1 - (i - a) / (n - a || 1), 1.6);
  }
  return out;
}
/* like attackDecayEnv but holds its level longer (pow < 1) — more energy
   in the opening moment without taller peaks, so it sounds louder */
function heldEnv(n, attackSec, pow){
  const out = zeros(n);
  const a = secToSamples(attackSec);
  for(let i = 0; i < n; i++){
    if(i < a) out[i] = i / a;
    else out[i] = Math.pow(1 - (i - a) / (n - a || 1), pow);
  }
  return out;
}
function multiply(samples, env){
  for(let i = 0; i < samples.length; i++) samples[i] *= env[i] ?? 0;
  return samples;
}
/* NOTE: deliberately NOT dividing by Math.tanh(drive) to "unity-gain-calibrate"
   the curve — tanh(x) alone has a hard mathematical ceiling of exactly 1, which
   is what we want from a safety limiter. Dividing by tanh(drive) < 1 raises
   that ceiling above 1 for any sample already near full scale, which then
   hard-clips (real digital distortion) when quantized to 16-bit in writeWav. */
function softClip(samples, drive){
  for(let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i] * drive);
  return samples;
}
function mixInto(dest, src, gain, startSec){
  const off = secToSamples(startSec || 0);
  for(let i = 0; i < src.length; i++){
    const j = off + i;
    if(j >= 0 && j < dest.length) dest[j] += src[i] * gain;
  }
}
function fadeEdges(samples, msIn, msOut){
  const nIn = secToSamples(msIn / 1000), nOut = secToSamples(msOut / 1000);
  for(let i = 0; i < nIn && i < samples.length; i++) samples[i] *= i / nIn;
  for(let i = 0; i < nOut && i < samples.length; i++) samples[samples.length - 1 - i] *= i / nOut;
  return samples;
}

/* ---------- WAV encode (16-bit PCM mono) ---------- */
function writeWav(filePath, samples){
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for(let i = 0; i < samples.length; i++){
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function rms(samples){
  let sum = 0;
  for(let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
function normalizeRMS(samples, targetRMS){
  const r = rms(samples);
  if(r <= 0) return samples;
  const g = targetRMS / r;
  for(let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

/* RMS-normalize (not peak-normalize) so every sound lands at roughly the
   same perceived loudness regardless of how transient vs. sustained its
   waveform is — a short percussive "bang" and a sustained "horn" peak-
   normalized to the same value can still sound very different in volume.
   softClip afterwards catches any peaks RMS-matching pushes over 0dBFS. */
const TARGET_RMS = 0.7; /* pushed louder again — needs to carry outdoors from a distance, not just sound clear up close */
/* Real devices need a moment after any prior audio-session activity (the
   On your marks/Set speech, or even our own priming blip) before playback
   actually engages — without a cushion, the first ~50-100ms of the real
   sound can get truncated/skipped instead of just played quietly. A short
   true-silence lead-in absorbs that instead of eating the sound's onset. */
const LEAD_IN_SEC = 0.09;
function finish(samples){
  fadeEdges(samples, 1, 8);
  normalizeRMS(samples, TARGET_RMS);
  softClip(samples, 1.5);
  const lead = zeros(secToSamples(LEAD_IN_SEC));
  const out = new Float64Array(lead.length + samples.length);
  out.set(lead, 0);
  out.set(samples, lead.length);
  return out;
}

/* Master for the start sounds matched to the gun's loudness: strip what a
   phone speaker can't play so the loudness budget goes to frequencies you
   actually hear, then saturate only gently. Pushing harder (RMS 0.95 /
   drive 2.5 was tried on the gun) squares the waveform off and sounds
   audibly distorted on a phone.
   Each sound passes its own RMS: chosen so it lands at the gun's loudness
   (about -7.4dB A-weighted over its first 300ms) while keeping clipped
   samples within the range the original sounds already had (<=1500).
   Re-measure if a design changes — these numbers are specific to it. */
const LOUD_TARGET_RMS = 0.6;
function finishLoud(samples, rms = LOUD_TARGET_RMS){
  filterInPlace(samples, () => 250, "highpass", 0.7);
  fadeEdges(samples, 1, 12);
  normalizeRMS(samples, rms);
  softClip(samples, 1.3);
  const lead = zeros(secToSamples(LEAD_IN_SEC));
  const out = new Float64Array(lead.length + samples.length);
  out.set(lead, 0);
  out.set(samples, lead.length);
  return out;
}

/* ================= sound designs ================= */

/* Built for a phone speaker, not headphones: phone speakers can't reproduce
   much below ~300Hz, so a deep "thump" spends the file's loudness budget on
   sound nobody hears. All the energy here sits in the 400Hz–8kHz range a
   phone speaker plays loudest (and the ear is most sensitive to), with a
   longer crack so it reads like a real starter
   pistol from across a track instead of a polite click. */
function renderBang(){
  const dur = 0.9;
  const buf = zeros(secToSamples(dur));

  // main crack: bright broadband noise, slower decay = more energy = louder
  const crack = whiteNoise(0.65);
  filterInPlace(crack, t => 12000 * Math.pow(1800 / 12000, t / 0.65), "lowpass", 0.8);
  filterInPlace(crack, () => 400, "highpass", 0.7);
  multiply(crack, decayEnv(crack.length, 1.4));
  mixInto(buf, crack, 1.0, 0);

  // instant high "snap" on the very first milliseconds
  const snap = whiteNoise(0.04);
  filterInPlace(snap, () => 2500, "highpass", 0.7);
  multiply(snap, decayEnv(snap.length, 4));
  mixInto(buf, snap, 0.9, 0);

  // punchy body in the mids instead of an inaudible sub-bass thump
  const body = whiteNoise(0.35);
  filterInPlace(body, () => 700, "bandpass", 0.8);
  multiply(body, decayEnv(body.length, 2));
  mixInto(buf, body, 1.4, 0);

  // short outdoor-style echo tail
  const echo = whiteNoise(0.5);
  filterInPlace(echo, () => 2600, "lowpass", 0.7);
  filterInPlace(echo, () => 350, "highpass", 0.7);
  multiply(echo, decayEnv(echo.length, 2.2));
  mixInto(buf, echo, 0.35, 0.12);

  return finishLoud(buf);
}

/* brighter (3kHz lowpass instead of 1.5kHz) and held longer than before; the
   200Hz sub-square is gone since a phone speaker can't play it anyway */
function renderHorn(){
  const dur = 0.7;
  const buf = zeros(secToSamples(dur));
  const vib = t => 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t);

  const a = osc("sawtooth", t => 400 * vib(t), dur, 0);
  multiply(a, heldEnv(a.length, 0.015, 0.8));
  filterInPlace(a, () => 3000, "lowpass", 0.85);
  mixInto(buf, a, 0.55, 0);

  const b = osc("sawtooth", t => 402.5 * vib(t + 0.3), dur, 0.13);
  multiply(b, heldEnv(b.length, 0.015, 0.8));
  filterInPlace(b, () => 3000, "lowpass", 0.85);
  mixInto(buf, b, 0.42, 0);

  const shimmer = osc("sine", () => 800, dur, 0);
  multiply(shimmer, heldEnv(shimmer.length, 0.015, 0.8));
  mixInto(buf, shimmer, 0.12, 0);

  return finishLoud(buf, 0.95);
}

function renderQuack(){
  const dur = 0.42;
  const buf = zeros(secToSamples(dur));
  function blip(startSec){
    const d = 0.15;
    const s = osc("sawtooth", t => 320 * Math.pow(190 / 320, t / d), d, 0);
    multiply(s, attackDecayEnv(s.length, 0.008));
    filterInPlace(s, () => 1250, "bandpass", 3);
    mixInto(buf, s, 0.9, startSec);
  }
  blip(0);
  blip(0.19);
  return finishLoud(buf, 1.37);
}

/* sweeps down to 180Hz instead of an inaudible 65Hz, with a little 2nd/3rd
   harmonic so a phone speaker has something to play through the whole sweep */
function renderBoing(){
  const dur = 0.85;
  const buf = zeros(secToSamples(dur));
  const f = t => 620 * Math.pow(180 / 620, t / dur) * (1 + 0.05 * Math.sin(2 * Math.PI * 13 * t));
  const s = osc("sine", f, dur, 0);
  const s2 = osc("sine", t => 2 * f(t), dur, 0);
  const s3 = osc("sine", t => 3 * f(t), dur, 0);
  for(let i = 0; i < s.length; i++) s[i] = s[i] + 0.35 * s2[i] + 0.18 * s3[i];
  multiply(s, attackDecayEnv(s.length, 0.01));
  mixInto(buf, s, 0.95, 0);
  return finishLoud(buf, 0.73);
}

function renderGoat(){
  const dur = 0.9;
  const buf = zeros(secToSamples(dur));
  const s = osc("sawtooth", t => 560 * (1 + 0.22 * Math.sign(Math.sin(2 * Math.PI * 27 * t))), dur, 0);
  multiply(s, attackDecayEnv(s.length, 0.02));
  filterInPlace(s, () => 900, "bandpass", 2.2);
  mixInto(buf, s, 0.95, 0);
  return finish(buf);
}

/* pitched at 480Hz (was 320Hz): at 320Hz a phone speaker and the ear are both
   so insensitive that it couldn't reach the gun's loudness even fully
   saturated. Held envelope and a 5kHz lowpass let the buzz's harmonics through */
function renderBuzzer(){
  const dur = 0.5;
  const buf = zeros(secToSamples(dur));
  const s = osc("square", () => 480, dur, 0);
  multiply(s, heldEnv(s.length, 0.008, 0.5));
  filterInPlace(s, () => 5000, "lowpass", 0.7);
  mixInto(buf, s, 0.9, 0);
  const s2 = osc("square", () => 483, dur, 0.05);
  multiply(s2, heldEnv(s2.length, 0.008, 0.5));
  filterInPlace(s2, () => 5000, "lowpass", 0.7);
  mixInto(buf, s2, 0.6, 0);
  return finishLoud(buf, 1.06);
}

function renderWhistle(){
  const dur = 0.6;
  const buf = zeros(secToSamples(dur));
  const s = osc("sine", t => 2800 + 60 * Math.sin(2 * Math.PI * 22 * t), dur, 0);
  multiply(s, attackDecayEnv(s.length, 0.03));
  mixInto(buf, s, 0.8, 0);
  const breath = whiteNoise(dur);
  filterInPlace(breath, () => 3200, "bandpass", 3);
  multiply(breath, attackDecayEnv(breath.length, 0.03));
  mixInto(buf, breath, 0.12, 0);
  return finish(buf);
}

/* Real iOS devices often play the very first native sound after an idle
   gap "muffled"/quiet — the speaker amp hasn't been woken up yet, and it
   ramps up mid-playback instead of before it. Playing this silent-ish blip
   a few seconds ahead of the real starter sound (as soon as the sequence
   begins) wakes the audio hardware early, so by the time the real sound
   fires the amp is already warm. Deliberately NOT run through finish()'s
   loud RMS normalization — this should be as close to inaudible as
   possible while still being real audio output. */
function renderPrimer(){
  const dur = 0.12;
  const buf = whiteNoise(dur);
  multiply(buf, attackDecayEnv(buf.length, 0.01));
  for(let i = 0; i < buf.length; i++) buf[i] *= 0.03;
  fadeEdges(buf, 5, 30);
  return buf;
}

const outDir = path.join(__dirname, "..", "sounds");
fs.mkdirSync(outDir, { recursive: true });
const sounds = {
  bang: renderBang, horn: renderHorn, quack: renderQuack,
  boing: renderBoing, goat: renderGoat, buzzer: renderBuzzer, whistle: renderWhistle,
  primer: renderPrimer
};
for(const [name, fn] of Object.entries(sounds)){
  writeWav(path.join(outDir, name + ".wav"), fn());
  console.log("wrote", name + ".wav");
}
