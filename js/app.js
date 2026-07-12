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

  /* ---------- audio engine (real bundled files, plain <audio> playback) ----------
     Live Web Audio oscillators turned out to be unreliable across mobile
     browsers (autoplay/AudioContext quirks). Pre-rendered files + a plain
     <audio> element play far more consistently. Note: a phone's hardware
     silent/ringer switch is an OS-level thing Safari respects for web
     audio — no purely web-based trick bypasses that reliably. */
  const SOUND_FILES = {
    bang: "sounds/bang.wav",
    horn: "sounds/horn.wav",
    buzzer: "sounds/buzzer.wav",
    whistle: "sounds/whistle.wav",
    quack: "sounds/quack.wav",
    boing: "sounds/boing.wav",
    goat: "sounds/goat.wav"
  };
  const audioEls = {};
  Object.keys(SOUND_FILES).forEach(function(key){
    const a = new Audio(SOUND_FILES[key]);
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    audioEls[key] = a;
  });

  /* perceptual (roughly logarithmic) taper — a mid slider position should
     sound meaningfully louder than "half", not barely audible */
  function vol(){ return Math.pow(S.volume, 0.55); }

  let unlocked = false;
  function unlockAudio(){
    if(unlocked) return;
    unlocked = true;
    Object.values(audioEls).forEach(function(a){
      const p = a.play();
      if(p && p.then) p.then(function(){ a.pause(); a.currentTime = 0; }).catch(function(){});
    });
  }

  function playFile(key){
    const a = audioEls[key]; if(!a) return;
    a.currentTime = 0;
    a.volume = vol();
    a.play().catch(function(){});
  }

  function speak(text, opt){
    opt = opt || {};
    if(!("speechSynthesis" in window)) return;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opt.rate || 1; u.pitch = opt.pitch || 1; u.volume = S.volume;
      speechSynthesis.speak(u);
    }catch(e){}
  }

  const SOUNDS = {
    bang:    { label: "🔫 Starter gun", play: function(){ playFile("bang"); } },
    horn:    { label: "📢 Air horn", play: function(){ playFile("horn"); } },
    buzzer:  { label: "🔔 Buzzer", play: function(){ playFile("buzzer"); } },
    whistle: { label: "🎵 Whistle", play: function(){ playFile("whistle"); } },
    voice:   { label: "🗣️ “Go!”", play: function(){ speak("Go!", { pitch: 1.15, rate: 1 }); } },
    quack:   { label: "🦆 Duck quack", play: function(){ playFile("quack"); } },
    boing:   { label: "🤪 Cartoon boing", play: function(){ playFile("boing"); } },
    goat:    { label: "🐐 Goat bleat", play: function(){ playFile("goat"); } },
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
    unlockAudio(); /* unlock sound on this user tap */
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
    unlockAudio(); SOUNDS[S.sound].play();
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
