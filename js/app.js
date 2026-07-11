(function(){
  "use strict";

  /* ---------- settings ---------- */
  const DEFAULTS = {
    volume: 0.85, theme: "track", sound: "bang",
    marksMin: 4, marksMax: 7,
    setMin: 1.5, setMax: 2.6,
    headStart: false, headGap: 3
  };
  let S = Object.assign({}, DEFAULTS);

  const STORAGE_KEY = "track-timer-settings";
  function loadSettings(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) Object.assign(S, JSON.parse(raw));
    }catch(e){ /* first run or storage unavailable — in-memory defaults are fine */ }
    return Promise.resolve();
  }
  let saveT = null;
  function saveSettings(){
    clearTimeout(saveT);
    saveT = setTimeout(function(){
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }
      catch(e){ /* ignore — settings still work for this session */ }
    }, 400);
  }

  /* ---------- audio engine (all sounds synthesized, no files) ---------- */
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  function audio(){
    if(!actx && AC) actx = new AC();
    if(actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  function vol(){ return S.volume; }

  function tone(opt){
    const c = audio(); if(!c) return;
    const t = c.currentTime + (opt.when || 0);
    const dur = opt.dur || 0.5;
    const o = c.createOscillator();
    o.type = opt.type || "sine";
    o.frequency.setValueAtTime(opt.freq || 440, t);
    if(opt.glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(opt.glideTo, 1), t + dur * 0.9);
    const g = c.createGain();
    const peak = Math.max((opt.peak || 1) * vol(), 0.0001);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if(opt.filter){
      const f = c.createBiquadFilter();
      f.type = opt.filter.type; f.frequency.value = opt.filter.freq;
      if(opt.filter.q) f.Q.value = opt.filter.q;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(c.destination);
    if(opt.lfo){
      const l = c.createOscillator();
      l.type = opt.lfo.type || "sine"; l.frequency.value = opt.lfo.rate;
      const lg = c.createGain(); lg.gain.value = opt.lfo.depth;
      l.connect(lg); lg.connect(o.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noiseBurst(opt){
    const c = audio(); if(!c) return;
    const t = c.currentTime;
    const dur = opt.dur || 0.4;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for(let i = 0; i < d.length; i++){
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, opt.decayPow || 2.5);
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(opt.filterFrom || 8000, t);
    f.frequency.exponentialRampToValueAtTime(opt.filterTo || 400, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime((opt.peak || 1) * vol(), t);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  function speak(text, opt){
    opt = opt || {};
    if(!("speechSynthesis" in window)) return;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opt.rate || 1; u.pitch = opt.pitch || 1; u.volume = vol();
      speechSynthesis.speak(u);
    }catch(e){}
  }

  const SOUNDS = {
    bang:    { label: "🔫 Gun bang", play: function(){
                 audio(); noiseBurst({ dur: .45, peak: 1, filterFrom: 9000, filterTo: 300, decayPow: 2.6 });
                 tone({ freq: 160, glideTo: 45, dur: .3, type: "sine", peak: .9, attack: .005 });
               } },
    horn:    { label: "📢 Loud horn", play: function(){
                 tone({ freq: 850, dur: .6, type: "square", peak: .6, attack: .005 });
                 tone({ freq: 1700, dur: .6, type: "sine", peak: .15, attack: .005 });
               } },
    voice:   { label: "🗣️ “Go!”", play: function(){ speak("Go!", { pitch: 1.15, rate: 1 }); } },
    airhorn: { label: "🎉 Air horn", play: function(){
                 [233, 466, 699].forEach(function(f, i){
                   tone({ freq: f * 1.003, dur: 1.1, type: "sawtooth", peak: .3, attack: .06,
                          filter: { type: "lowpass", freq: 2500 },
                          lfo: i === 1 ? { rate: 6, depth: 4 } : null });
                 });
               } },
    quack:   { label: "🦆 Duck quack", play: function(){
                 tone({ freq: 320, glideTo: 190, dur: .14, type: "sawtooth", peak: .9,
                        filter: { type: "bandpass", freq: 1100, q: 6 } });
                 tone({ freq: 320, glideTo: 190, dur: .14, type: "sawtooth", peak: .9, when: .18,
                        filter: { type: "bandpass", freq: 1100, q: 6 } });
               } },
    boing:   { label: "🤪 Cartoon boing", play: function(){
                 tone({ freq: 620, glideTo: 65, dur: .8, type: "sine", peak: .8,
                        lfo: { rate: 12, depth: 35 } });
               } },
    goat:    { label: "🐐 Goat bleat", play: function(){
                 tone({ freq: 560, dur: .9, type: "sawtooth", peak: .65,
                        filter: { type: "bandpass", freq: 900, q: 2 },
                        lfo: { type: "square", rate: 26, depth: 130 } });
               } },
    yeehaw:  { label: "🤠 “Yeehaw!”", play: function(){ speak("Yeehaw!", { pitch: 1.9, rate: 1.15 }); } }
  };

  /* ---------- sequence ---------- */
  let running = false;
  let timeouts = [];
  let intervals = [];
  function schedule(fn, ms){ timeouts.push(setTimeout(fn, ms)); }
  function clearAllTimers(){
    timeouts.forEach(clearTimeout); timeouts = [];
    intervals.forEach(clearInterval); intervals = [];
    if("speechSynthesis" in window){ try{ speechSynthesis.cancel(); }catch(e){} }
  }
  function rand(min, max){ return min + Math.random() * (max - min); }

  const body = document.body;
  const el = function(id){ return document.getElementById(id); };
  const eyebrow = el("eyebrow"), phaseEl = el("phase"), subEl = el("sub");
  const startBtn = el("startBtn"), cancelBtn = el("cancelBtn"), settingsBtn = el("settingsBtn");
  const configLine = el("configLine");

  function setPhase(text, sub, isGo){
    phaseEl.textContent = text;
    phaseEl.classList.toggle("go", !!isGo);
    subEl.textContent = sub || "";
  }
  function flash(){
    body.classList.remove("flash");
    void body.offsetWidth; /* restart animation */
    body.classList.add("flash");
  }
  function setRunningUI(on){
    running = on;
    body.classList.toggle("running", on);
    settingsBtn.disabled = on;
    eyebrow.textContent = on ? "Sequence running" : "Starter · Ready";
    if(!on) setPhase("", "");
  }

  function startSequence(){
    if(running) return;
    audio(); /* unlock sound on this user tap */
    setRunningUI(true);
    setPhase("On your marks", "Take your positions");
    speak("On your marks");
    schedule(function(){
      setPhase("Set", "");
      speak("Set");
      schedule(fire, rand(S.setMin, S.setMax) * 1000);
    }, rand(S.marksMin, S.marksMax) * 1000);
  }

  function fire(){
    flash();
    SOUNDS[S.sound].play();
    if(S.headStart){
      setPhase("GO!", "", true);
      const gap = S.headGap * 1000;
      const t0 = performance.now();
      const iv = setInterval(function(){
        const remain = Math.max(0, gap - (performance.now() - t0)) / 1000;
        subEl.textContent = "Second start in " + remain.toFixed(1) + " s";
      }, 50);
      intervals.push(iv);
      schedule(function(){
        clearInterval(iv);
        flash();
        SOUNDS[S.sound].play();
        setPhase("GO!", "Second runner away", true);
        schedule(function(){ setRunningUI(false); }, 1800);
      }, gap);
    }else{
      setPhase("GO!", "", true);
      schedule(function(){ setRunningUI(false); }, 1800);
    }
  }

  function cancelSequence(){
    clearAllTimers();
    setRunningUI(false);
  }

  startBtn.addEventListener("click", startSequence);
  cancelBtn.addEventListener("click", cancelSequence);

  /* ---------- settings UI ---------- */
  const overlay = el("overlay"), panel = el("panel");
  function openPanel(){ body.classList.add("settings-open"); }
  function closePanel(){ body.classList.remove("settings-open"); }
  settingsBtn.addEventListener("click", openPanel);
  el("closeBtn").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  /* sound select */
  const soundSel = el("soundSel");
  Object.keys(SOUNDS).forEach(function(key){
    const o = document.createElement("option");
    o.value = key; o.textContent = SOUNDS[key].label;
    soundSel.appendChild(o);
  });
  soundSel.addEventListener("change", function(){
    S.sound = soundSel.value; saveSettings(); updateConfigLine();
  });
  el("testBtn").addEventListener("click", function(){
    audio(); SOUNDS[S.sound].play();
  });

  /* volume */
  const volIn = el("vol"), volVal = el("volVal");
  volIn.addEventListener("input", function(){
    S.volume = volIn.value / 100;
    volVal.textContent = volIn.value + "%";
    saveSettings();
  });

  /* timing ranges */
  const marksMinIn = el("marksMin"), marksMaxIn = el("marksMax"), marksVal = el("marksVal");
  const setMinIn = el("setMin"), setMaxIn = el("setMax"), setVal = el("setVal");

  function fmtRange(a, b){
    a = +a; b = +b;
    return a === b ? a + " s (fixed)" : a + "–" + b + " s";
  }
  function refreshTimingLabels(){
    marksVal.textContent = fmtRange(S.marksMin, S.marksMax);
    setVal.textContent = fmtRange(S.setMin, S.setMax);
  }
  function bindPair(minIn, maxIn, keyMin, keyMax){
    minIn.addEventListener("input", function(){
      S[keyMin] = +minIn.value;
      if(S[keyMin] > S[keyMax]){ S[keyMax] = S[keyMin]; maxIn.value = S[keyMax]; }
      refreshTimingLabels(); updateConfigLine(); saveSettings();
    });
    maxIn.addEventListener("input", function(){
      S[keyMax] = +maxIn.value;
      if(S[keyMax] < S[keyMin]){ S[keyMin] = S[keyMax]; minIn.value = S[keyMin]; }
      refreshTimingLabels(); updateConfigLine(); saveSettings();
    });
  }
  bindPair(marksMinIn, marksMaxIn, "marksMin", "marksMax");
  bindPair(setMinIn, setMaxIn, "setMin", "setMax");

  /* head start */
  const hsToggle = el("hsToggle"), hsGapIn = el("hsGap"), hsVal = el("hsVal"), hsGapRow = el("hsGapRow");
  hsToggle.addEventListener("change", function(){
    S.headStart = hsToggle.checked;
    hsGapRow.style.opacity = S.headStart ? 1 : .4;
    updateConfigLine(); saveSettings();
  });
  hsGapIn.addEventListener("input", function(){
    S.headGap = +hsGapIn.value;
    hsVal.textContent = S.headGap.toFixed(1) + " s";
    updateConfigLine(); saveSettings();
  });

  /* themes */
  const THEMES = {
    track:    "#ff3b30",
    ocean:    "#38bdf8",
    field:    "#34d399",
    sunset:   "#fb923c",
    daylight: "#f4f6fb"
  };
  const themesWrap = el("themes");
  Object.keys(THEMES).forEach(function(name){
    const b = document.createElement("button");
    b.className = "swatch"; b.dataset.theme = name;
    b.setAttribute("aria-label", name + " theme");
    b.style.background = THEMES[name];
    if(name === "daylight") b.style.boxShadow = "inset 0 0 0 2px #c3c9d6";
    b.addEventListener("click", function(){
      S.theme = name; applyTheme(); saveSettings();
    });
    themesWrap.appendChild(b);
  });
  function applyTheme(){
    body.dataset.theme = S.theme;
    themesWrap.querySelectorAll(".swatch").forEach(function(s){
      s.classList.toggle("active", s.dataset.theme === S.theme);
    });
  }

  /* reset */
  el("resetBtn").addEventListener("click", function(){
    S = Object.assign({}, DEFAULTS);
    syncInputs(); applyTheme(); updateConfigLine(); saveSettings();
  });

  /* config summary on the main screen */
  function updateConfigLine(){
    let txt = "Marks → Set: " + fmtRange(S.marksMin, S.marksMax) +
              "  ·  Set → " + SOUNDS[S.sound].label.replace(/^[^ ]+ /, "") + ": " + fmtRange(S.setMin, S.setMax);
    if(S.headStart) txt += "  ·  2nd signal +" + S.headGap.toFixed(1) + " s";
    configLine.textContent = txt;
  }

  function syncInputs(){
    volIn.value = Math.round(S.volume * 100);
    volVal.textContent = volIn.value + "%";
    soundSel.value = S.sound;
    marksMinIn.value = S.marksMin; marksMaxIn.value = S.marksMax;
    setMinIn.value = S.setMin;     setMaxIn.value = S.setMax;
    hsToggle.checked = S.headStart;
    hsGapIn.value = S.headGap;
    hsVal.textContent = S.headGap.toFixed(1) + " s";
    hsGapRow.style.opacity = S.headStart ? 1 : .4;
    refreshTimingLabels();
  }

  /* ---------- init ---------- */
  loadSettings().then(function(){
    syncInputs(); applyTheme(); updateConfigLine();
  });

  /* ---------- PWA service worker ---------- */
  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").catch(function(){ /* offline install just won't be available */ });
    });
  }
})();
