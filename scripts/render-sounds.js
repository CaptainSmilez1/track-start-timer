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
const TARGET_RMS = 0.30;
function finish(samples){
  fadeEdges(samples, 1, 8);
  normalizeRMS(samples, TARGET_RMS);
  softClip(samples, 1.5);
  return samples;
}

/* ================= sound designs ================= */

function renderBang(){
  const dur = 0.55;
  const buf = zeros(secToSamples(dur));

  // main noise crack, fast lowpass sweep from bright to dull
  const crack = whiteNoise(0.42);
  filterInPlace(crack, t => 9500 * Math.pow(250 / 9500, t / 0.42), "lowpass", 0.9);
  multiply(crack, decayEnv(crack.length, 2.1));
  mixInto(buf, crack, 1.0, 0);

  // very short high transient for the "snap"
  const snap = whiteNoise(0.05);
  filterInPlace(snap, t => 11000 * Math.pow(3500 / 11000, t / 0.05), "lowpass", 0.9);
  multiply(snap, decayEnv(snap.length, 5));
  mixInto(buf, snap, 0.7, 0);

  // low thump
  const thump = osc("sine", t => 150 * Math.pow(38 / 150, t / 0.3), 0.32, 0);
  multiply(thump, attackDecayEnv(thump.length, 0.003));
  mixInto(buf, thump, 0.85, 0);

  const sub = osc("sine", () => 85, 0.2, 0);
  multiply(sub, decayEnv(sub.length, 2.4));
  mixInto(buf, sub, 0.45, 0.005);

  return finish(buf);
}

function renderHorn(){
  const dur = 0.7;
  const buf = zeros(secToSamples(dur));
  const vib = t => 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t);

  const a = osc("sawtooth", t => 400 * vib(t), dur, 0);
  multiply(a, attackDecayEnv(a.length, 0.015));
  filterInPlace(a, () => 1500, "lowpass", 0.85);
  mixInto(buf, a, 0.55, 0);

  const b = osc("sawtooth", t => 402.5 * vib(t + 0.3), dur, 0.13);
  multiply(b, attackDecayEnv(b.length, 0.015));
  filterInPlace(b, () => 1500, "lowpass", 0.85);
  mixInto(buf, b, 0.42, 0);

  const sub = osc("square", t => 200 * vib(t), dur, 0);
  multiply(sub, attackDecayEnv(sub.length, 0.02));
  mixInto(buf, sub, 0.22, 0);

  const shimmer = osc("sine", () => 800, dur, 0);
  multiply(shimmer, attackDecayEnv(shimmer.length, 0.02));
  mixInto(buf, shimmer, 0.12, 0);

  return finish(buf);
}

function renderQuack(){
  const dur = 0.42;
  const buf = zeros(secToSamples(dur));
  function blip(startSec){
    const d = 0.15;
    const s = osc("sawtooth", t => 320 * Math.pow(190 / 320, t / d), d, 0);
    multiply(s, attackDecayEnv(s.length, 0.008));
    filterInPlace(s, () => 1100, "bandpass", 4.5);
    mixInto(buf, s, 0.9, startSec);
  }
  blip(0);
  blip(0.19);
  return finish(buf);
}

function renderBoing(){
  const dur = 0.85;
  const buf = zeros(secToSamples(dur));
  const s = osc("sine", t => 620 * Math.pow(65 / 620, t / dur) * (1 + 0.05 * Math.sin(2 * Math.PI * 13 * t)), dur, 0);
  multiply(s, attackDecayEnv(s.length, 0.01));
  mixInto(buf, s, 0.95, 0);
  return finish(buf);
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

function renderBuzzer(){
  const dur = 0.5;
  const buf = zeros(secToSamples(dur));
  const s = osc("square", () => 320, dur, 0);
  multiply(s, attackDecayEnv(s.length, 0.01));
  filterInPlace(s, () => 1800, "lowpass", 0.7);
  mixInto(buf, s, 0.9, 0);
  const s2 = osc("square", () => 322, dur, 0.05);
  multiply(s2, attackDecayEnv(s2.length, 0.01));
  filterInPlace(s2, () => 1800, "lowpass", 0.7);
  mixInto(buf, s2, 0.6, 0);
  return finish(buf);
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

const outDir = path.join(__dirname, "..", "sounds");
fs.mkdirSync(outDir, { recursive: true });
const sounds = {
  bang: renderBang, horn: renderHorn, quack: renderQuack,
  boing: renderBoing, goat: renderGoat, buzzer: renderBuzzer, whistle: renderWhistle
};
for(const [name, fn] of Object.entries(sounds)){
  writeWav(path.join(outDir, name + ".wav"), fn());
  console.log("wrote", name + ".wav");
}
