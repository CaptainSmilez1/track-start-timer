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

  /* ---------- audio engine (Web Audio API: real bundled files, decoded once) ----------
     A previous attempt used AudioBufferSourceNode too, but scheduled it as
     soon as .resume() was *called* rather than once it had actually
     finished resuming — on iOS Safari, audio scheduled against a context
     that's still technically "suspended" can be silently dropped instead of
     queued, which is what made GO/Test produce no sound at all. Fixed here
     by never calling start() until both the resume() promise and the
     decode have actually settled. In the steady state (the very common
     case: context already running, buffer already decoded) that resolves
     on the next microtask — no perceptible delay — while still being
     correct the first time, when either one might not be ready yet. */
  const SOUND_FILES = {
    bang: "sounds/bang.wav",
    horn: "sounds/horn.wav",
    buzzer: "sounds/buzzer.wav",
    whistle: "sounds/whistle.wav",
    quack: "sounds/quack.wav",
    boing: "sounds/boing.wav",
    goat: "sounds/goat.wav"
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null, master = null, limiter = null;
  function ensureContext(){
    if(actx || !AC) return actx;
    actx = new AC();
    master = actx.createGain();
    /* safety limiter — lets us push master gain past unity for real extra
       loudness at high volume settings without harsh clipping */
    limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(actx.destination);
    return actx;
  }
  const bufferPromises = {};
  (function loadBuffers(){
    const c = ensureContext(); if(!c) return;
    Object.keys(SOUND_FILES).forEach(function(key){
      bufferPromises[key] = fetch(SOUND_FILES[key])
        .then(function(res){ return res.arrayBuffer(); })
        .then(function(arr){ return c.decodeAudioData(arr); });
    });
  })();

  /* perceptual taper through the low/mid range, plus real headroom at the
     top — gain can go past 1 near full volume; the limiter above keeps
     that safe from clipping instead of just quietly capping at unity */
  function vol(){ return Math.pow(S.volume, 0.55) * 1.6; }

  function unlockAudio(){
    const c = ensureContext(); if(!c) return;
    if(c.state === "suspended") c.resume();
  }

  function playFile(key){
    const c = ensureContext(); if(!c) return;
    const bufferReady = bufferPromises[key]; if(!bufferReady) return;
    const resumeReady = c.state === "running" ? Promise.resolve() : c.resume().catch(function(){});
    Promise.all([resumeReady, bufferReady]).then(function(results){
      const buf = results[1]; if(!buf) return;
      master.gain.value = vol();
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(master);
      src.start();
    }).catch(function(){});
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
    bang:    { label: "Starter gun", play: function(){ playFile("bang"); } },
    horn:    { label: "Air horn", play: function(){ playFile("horn"); } },
    buzzer:  { label: "Buzzer", play: function(){ playFile("buzzer"); } },
    whistle: { label: "Whistle", play: function(){ playFile("whistle"); } },
    voice:   { label: "Voice: “Go!”", play: function(){ speak("Go!", { pitch: 1.15, rate: 1 }); } },
    quack:   { label: "Duck quack", play: function(){ playFile("quack"); } },
    boing:   { label: "Cartoon boing", play: function(){ playFile("boing"); } },
    goat:    { label: "Goat bleat", play: function(){ playFile("goat"); } },
    yeehaw:  { label: "Voice: “Yeehaw!”", play: function(){ speak("Yeehaw!", { pitch: 1.9, rate: 1.15 }); } }
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
    SOUNDS[S.sound].play();
    flash();
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
        SOUNDS[S.sound].play();
        flash();
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

  /* tapping a config-summary chip/caption jumps straight to that setting.
     Uses instant scrollIntoView rather than behavior:"smooth" — verified
     that smooth scrolling can silently no-op depending on the browser
     engine, while instant scrollTop assignment always actually moves it;
     the highlight-flash animation supplies the "landed here" feedback
     that smooth scrolling would otherwise have provided. */
  configLine.addEventListener("click", function(e){
    const target = e.target.closest("[data-target]");
    if(!target) return;
    const dest = el(target.dataset.target);
    if(!dest) return;
    openPanel();
    setTimeout(function(){
      dest.scrollIntoView({ behavior: "auto", block: "start" });
      dest.classList.add("settings-highlight");
      setTimeout(function(){ dest.classList.remove("settings-highlight"); }, 900);
    }, 260); /* wait for the panel slide-in so scrollIntoView measures the final layout */
  });

  /* sound select */
  const soundSel = el("soundSel");
  Object.keys(SOUNDS).forEach(function(key){
    const o = document.createElement("option");
    o.value = key; o.textContent = SOUNDS[key].label;
    soundSel.appendChild(o);
  });
  soundSel.addEventListener("change", function(){
    S.sound = soundSel.value; saveSettings(); updateConfigLine();
    unlockAudio(); SOUNDS[S.sound].play();
  });
  el("testBtn").addEventListener("click", function(){
    unlockAudio(); SOUNDS[S.sound].play();
  });

  /* ---------- stepper controls (replace fiddly sliders with tap +/-) ---------- */
  function roundStep(v){ return Math.round(v * 10) / 10; }
  function clamp(v, lo, hi){ return roundStep(Math.min(hi, Math.max(lo, v))); }
  function fmtNum(n){ return roundStep(n).toString(); }
  function fmtRange(a, b){
    a = +a; b = +b;
    return a === b ? a + "s" : a + "–" + b + "s";
  }

  /* volume */
  const volStepper = el("volStepper"), volVal = el("volVal");
  function renderVol(){ volVal.textContent = Math.round(S.volume * 100); }
  volStepper.querySelectorAll(".stepper-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      const v = Math.min(100, Math.max(0, Math.round(S.volume * 100) + (+btn.dataset.dir) * 5));
      S.volume = v / 100;
      renderVol(); saveSettings();
    });
  });

  /* a min/max stepper pair with cross-clamping + optional preset chips */
  function bindRangePair(prefix, keyMin, keyMax, chipsId){
    const minC = el(prefix + "MinStepper"), maxC = el(prefix + "MaxStepper");
    const minVal = el(prefix + "MinVal"), maxVal = el(prefix + "MaxVal");
    const step = +minC.dataset.step, lo = +minC.dataset.min, hi = +minC.dataset.max;
    const chips = chipsId ? el(chipsId) : null;

    function render(){
      minVal.textContent = fmtNum(S[keyMin]);
      maxVal.textContent = fmtNum(S[keyMax]);
      if(chips){
        chips.querySelectorAll(".chip").forEach(function(c){
          c.classList.toggle("active", +c.dataset.min === S[keyMin] && +c.dataset.max === S[keyMax]);
        });
      }
    }
    minC.querySelectorAll(".stepper-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        S[keyMin] = clamp(S[keyMin] + (+btn.dataset.dir) * step, lo, hi);
        if(S[keyMin] > S[keyMax]) S[keyMax] = S[keyMin];
        render(); updateConfigLine(); saveSettings();
      });
    });
    maxC.querySelectorAll(".stepper-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        S[keyMax] = clamp(S[keyMax] + (+btn.dataset.dir) * step, lo, hi);
        if(S[keyMax] < S[keyMin]) S[keyMin] = S[keyMax];
        render(); updateConfigLine(); saveSettings();
      });
    });
    if(chips){
      chips.querySelectorAll(".chip").forEach(function(c){
        c.addEventListener("click", function(){
          S[keyMin] = +c.dataset.min; S[keyMax] = +c.dataset.max;
          render(); updateConfigLine(); saveSettings();
        });
      });
    }
    render();
    return render;
  }
  const renderMarks = bindRangePair("marks", "marksMin", "marksMax", "marksPresets");
  const renderSet = bindRangePair("set", "setMin", "setMax", "setPresets");

  /* head start */
  const hsToggle = el("hsToggle"), hsGapRow = el("hsGapRow");
  const hsGapStepper = el("hsGapStepper"), hsVal = el("hsVal");
  function renderHsGap(){ hsVal.textContent = fmtNum(S.headGap); }
  hsGapStepper.querySelectorAll(".stepper-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      S.headGap = clamp(S.headGap + (+btn.dataset.dir) * 0.5, 0.5, 30);
      renderHsGap(); updateConfigLine(); saveSettings();
    });
  });
  hsToggle.addEventListener("change", function(){
    S.headStart = hsToggle.checked;
    hsGapRow.style.opacity = S.headStart ? 1 : .4;
    updateConfigLine(); saveSettings();
  });

  /* themes */
  const THEMES = {
    track:    { color: "#c8451f", label: "Track" },
    red:      { color: "#e5262c", label: "Red" },
    ocean:    { color: "#38bdf8", label: "Ocean" },
    field:    { color: "#34d399", label: "Field" },
    sunset:   { color: "#fb923c", label: "Sunset" },
    daylight: { color: "#f4f6fb", label: "Daylight" }
  };
  const themesWrap = el("themes");
  Object.keys(THEMES).forEach(function(name){
    const t = THEMES[name];
    const opt = document.createElement("button");
    opt.className = "theme-option"; opt.dataset.theme = name;
    opt.setAttribute("aria-label", t.label + " theme");
    opt.innerHTML = '<span class="swatch" style="background:' + t.color + '"></span><span class="theme-name">' + t.label + "</span>";
    opt.addEventListener("click", function(){
      S.theme = name; applyTheme(); saveSettings();
    });
    themesWrap.appendChild(opt);
  });
  function applyTheme(){
    body.dataset.theme = S.theme;
    themesWrap.querySelectorAll(".theme-option").forEach(function(s){
      s.classList.toggle("active", s.dataset.theme === S.theme);
    });
  }

  /* reset */
  el("resetBtn").addEventListener("click", function(){
    S = Object.assign({}, DEFAULTS);
    syncInputs(); applyTheme(); updateConfigLine(); saveSettings();
  });

  /* config summary on the main screen — compact icon chips instead of a sentence */
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>';
  const ICON_SIGNAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 8 8 8 13 4 13 20 8 16 4 16 4 8"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>';
  const ICON_FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"/><path d="M5 4h11l-2.5 4L16 12H5"/></svg>';
  function updateConfigLine(){
    let html = '<div class="config-chips">' +
      '<span class="config-chip" data-target="marksBlock">' + ICON_CLOCK + fmtRange(S.marksMin, S.marksMax) + '</span>' +
      '<span class="config-chip" data-target="setBlock">' + ICON_SIGNAL + fmtRange(S.setMin, S.setMax) + '</span>';
    if(S.headStart) html += '<span class="config-chip" data-target="headStartSection">' + ICON_FLAG + '+' + fmtNum(S.headGap) + 's</span>';
    html += '</div><div class="config-caption" data-target="soundSection">' + SOUNDS[S.sound].label + '</div>';
    configLine.innerHTML = html;
  }

  function syncInputs(){
    renderVol();
    soundSel.value = S.sound;
    renderMarks();
    renderSet();
    hsToggle.checked = S.headStart;
    renderHsGap();
    hsGapRow.style.opacity = S.headStart ? 1 : .4;
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
