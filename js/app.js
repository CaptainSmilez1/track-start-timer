(function(){
  "use strict";

  /* ---------- settings ---------- */
  const DEFAULTS = {
    volume: 1, theme: "track", sound: "bang",
    marksMin: 4, marksMax: 7,
    setMin: 1.5, setMax: 2.6,
    headStart: false, headGap: 3,
    customAccent: "#c8451f",
    proRedeemed: false,
    hazardRedeemed: false
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

  /* ---------- audio engine ----------
     Two different Web Audio API approaches (AudioBufferSourceNode, both a
     naive version and a resume-then-play-sequenced version) both turned out
     to silently fail on real iOS Safari despite working in every automated
     test available here. Plain <audio> elements are what's actually been
     confirmed, on the real device, to produce sound in the browser/PWA — so
     that stays as the web fallback, untouched, no more retrying Web Audio
     there. Note: a phone's hardware silent/ringer switch is an OS-level
     thing Safari respects for web audio — no purely web-based trick
     bypasses that reliably.

     When actually running inside the native app shell (Capacitor), we use
     real native audio via @capacitor-community/native-audio instead — a
     native AVAudioPlayer/SoundPool call has none of the web <audio>
     element's startup latency, and isn't subject to Safari's web-audio
     quirks at all since it isn't going through the WebView's audio stack. */
  const SOUND_FILES = {
    bang: "sounds/bang.wav",
    horn: "sounds/horn.wav",
    buzzer: "sounds/buzzer.wav",
    whistle: "sounds/whistle.wav",
    quack: "sounds/quack.wav",
    boing: "sounds/boing.wav",
    goat: "sounds/goat.wav"
  };
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const NativeAudio = isNative && window.Capacitor.Plugins ? window.Capacitor.Plugins.NativeAudio : null;

  /* perceptual (roughly logarithmic) taper — a mid slider position should
     sound meaningfully louder than "half", not barely audible */
  function vol(){ return Math.pow(S.volume, 0.55); }

  /* volume is pushed to the native player ahead of time (on preload and
     whenever the slider changes), never at the moment of play() — that
     used to fire setVolume() and play() as two separate native bridge
     calls back-to-back right when the "Go" signal needed to fire, adding
     a second round-trip of latency at exactly the worst possible moment */
  function applyNativeVolumes(){
    if(!NativeAudio) return;
    Object.keys(SOUND_FILES).forEach(function(key){
      NativeAudio.setVolume({ assetId: key, volume: Math.max(0, Math.min(1, vol())) }).catch(function(){});
    });
  }

  const audioEls = {};
  if(NativeAudio){
    Object.keys(SOUND_FILES).forEach(function(key){
      /* on iOS the plugin looks the file up at the TOP LEVEL of the app
         bundle (Bundle.main.path(forResource:ofType:)), so assetPath is the
         bare filename — and the .wav files must be in the Xcode project as
         a regular group, not a blue folder reference (that would copy them
         into a subfolder the plugin never searches) */
      NativeAudio.preload({
        assetId: key, assetPath: key + ".wav",
        audioChannelNum: 1, isUrl: false
      }).catch(function(){});
    });
    NativeAudio.preload({
      assetId: "primer", assetPath: "primer.wav",
      audioChannelNum: 1, isUrl: false
    }).catch(function(){});
    NativeAudio.setVolume({ assetId: "primer", volume: 0.05 }).catch(function(){});
    applyNativeVolumes();
  }else{
    Object.keys(SOUND_FILES).forEach(function(key){
      const a = new Audio(SOUND_FILES[key]);
      a.preload = "auto";
      a.setAttribute("playsinline", "");
      audioEls[key] = a;
    });
  }

  let unlocked = false;
  function unlockAudio(skipKey){
    if(NativeAudio || unlocked) return; /* native playback needs no browser-gesture unlock */
    unlocked = true;
    Object.keys(audioEls).forEach(function(key){
      if(key === skipKey) return; /* about to be played for real — let that be its own unlock */
      const a = audioEls[key];
      a.muted = true; /* priming plays briefly before pause() lands — mute so it's silent */
      const p = a.play();
      const restore = function(){ a.pause(); a.currentTime = 0; a.muted = false; };
      if(p && p.then) p.then(restore).catch(restore);
      else restore();
    });
  }

  function playFile(key){
    if(NativeAudio){
      /* volume is already set ahead of time via applyNativeVolumes() — a
         single play() call here, not a setVolume()+play() pair, matters
         right at this exact moment: this fires the instant "Go" appears */
      NativeAudio.play({ assetId: key }).catch(function(){});
      return;
    }
    const a = audioEls[key]; if(!a) return;
    a.muted = false; /* clears any leftover mute from unlockAudio()'s priming pass */
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
    bang:    { label: "Starter gun", play: function(){ playFile("bang"); } },
    horn:    { label: "Air horn", play: function(){ playFile("horn"); } },
    buzzer:  { label: "Buzzer", play: function(){ playFile("buzzer"); } },
    whistle: { label: "Whistle", play: function(){ playFile("whistle"); } },
    quack:   { label: "Duck quack", play: function(){ playFile("quack"); } },
    boing:   { label: "Cartoon boing", play: function(){ playFile("boing"); } },
    goat:    { label: "Goat bleat", play: function(){ playFile("goat"); } }
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
    if(NativeAudio && S.volume > 0){
      /* wake the speaker amp now, several seconds before the real starter
         sound fires — on real devices the first sound played after an idle
         gap can come out muffled/quiet because the hardware ramps up mid-
         playback instead of before it */
      NativeAudio.play({ assetId: "primer" }).catch(function(){});
    }
    setRunningUI(true);
    setPhase("On your marks", "Take your positions");
    speak("On your marks");
    schedule(function(){
      setPhase("Set", "");
      speak("Set");
      schedule(fire, rand(S.setMin, S.setMax) * 1000);
    }, rand(S.marksMin, S.marksMax) * 1000);
  }

  /* fire() plays the exact same way the Test button does — no primer, no
     session reactivation, no extra volume call right before playing.
     Every one of those "fixes" added complexity around this call without
     reliably solving anything, while Test (which has always just been
     this one line) has been reliable the whole time. If the real sound
     still isn't consistent with this exact path, the difference isn't
     anything code can see or control from here. */
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
    replayLaunchAnimation(); /* same full pop/ring animation as startup and closing settings */
  }

  startBtn.addEventListener("click", startSequence);
  cancelBtn.addEventListener("click", cancelSequence);

  /* ---------- settings UI ---------- */
  const overlay = el("overlay"), panel = el("panel");
  const launchRing = el("launchRing");

  const LAUNCH_ELS = [launchRing, eyebrow, phaseEl, subEl, startBtn, configLine, settingsBtn];

  /* dropping the inline animation falls back to each element's static
     opacity:0, so the screen goes genuinely blank instead of showing
     whatever fully-opaque state the last animation finished on */
  function blankLaunchElements(){
    LAUNCH_ELS.forEach(function(elm){ if(elm) elm.style.animation = "none"; });
  }
  /* restart the launch pop/ring animation (normally a one-time thing on
     page load) — clearing the inline animation and forcing a reflow before
     restoring it is what actually makes a CSS animation replay, just
     toggling a class does nothing once the animation has already finished */
  function replayLaunchAnimation(){
    blankLaunchElements();
    void panel.offsetWidth; /* force reflow */
    LAUNCH_ELS.forEach(function(elm){ if(elm) elm.style.animation = ""; });
  }

  function openPanel(){ body.classList.add("settings-open"); }
  function closePanel(){
    cancelPromoRemoval();
    body.classList.remove("settings-open");
    blankLaunchElements(); /* blank immediately so the screen the panel reveals as it slides away is empty */
    setTimeout(replayLaunchAnimation, 320); /* then replay once the panel's finished sliding away */
  }
  settingsBtn.addEventListener("click", openPanel);
  el("closeBtn").addEventListener("click", closePanel);
  overlay.addEventListener("click", closePanel);

  /* self-driven scroll animation — deliberately not scrollIntoView's
     behavior:"smooth", which was verified earlier to silently no-op
     depending on the browser engine. A manual rAF tween always runs. */
  function animateScrollTo(elToScroll, targetTop, duration, onDone){
    const start = elToScroll.scrollTop;
    const change = targetTop - start;
    if(Math.abs(change) < 1){ if(onDone) onDone(); return; }
    const t0 = performance.now();
    function step(now){
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
      elToScroll.scrollTop = start + change * eased;
      if(t < 1) requestAnimationFrame(step);
      else if(onDone) onDone();
    }
    requestAnimationFrame(step);
  }

  /* opens the panel at the top, then scrolls down to center a given
     setting (no motion at all if it's already at/near the top) — shared by
     the config-summary chips and by tapping a locked Pro theme/sound */
  function openPanelAndScrollTo(dest){
    if(!dest) return;
    /* only snap to top before the animated scroll if the panel was closed
       (a fresh open always starts at the top anyway) — if it's already
       open, snapping to 0 first makes it visibly jump to the top before
       scrolling back down to the target, instead of one smooth motion
       from wherever it already was */
    const alreadyOpen = body.classList.contains("settings-open");
    if(!alreadyOpen) panel.scrollTop = 0;
    openPanel();
    const desired = Math.max(0, dest.offsetTop - (panel.clientHeight - dest.offsetHeight) / 2);
    setTimeout(function(){
      animateScrollTo(panel, desired, 420, function(){
        dest.classList.add("settings-highlight");
        setTimeout(function(){ dest.classList.remove("settings-highlight"); }, 900);
      });
    }, alreadyOpen ? 0 : 320); /* let the panel finish sliding in first, unless it already was */
  }

  /* tapping a config-summary chip opens the panel at the top, then
     scrolls down to center that setting (no motion at all if it's
     already at/near the top, e.g. the Sound section). */
  configLine.addEventListener("click", function(e){
    const target = e.target.closest("[data-target]");
    if(!target) return;
    openPanelAndScrollTo(el(target.dataset.target));
  });

  /* swipe right anywhere on the panel to dismiss it, same as tapping the
     close button or the overlay — a plain gesture check, not a live
     finger-follow drag, so it can't fight the panel's normal scrolling */
  (function(){
    let startX = 0, startY = 0, startT = 0;
    panel.addEventListener("touchstart", function(e){
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; startT = Date.now();
    }, { passive: true });
    panel.addEventListener("touchend", function(e){
      const t = e.changedTouches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if(dx > 70 && Math.abs(dy) < 60 && Date.now() - startT < 600) closePanel();
    }, { passive: true });
  })();

  /* sound select */
  const soundSel = el("soundSel");
  Object.keys(SOUNDS).forEach(function(key){
    const o = document.createElement("option");
    o.value = key; o.textContent = SOUNDS[key].label;
    soundSel.appendChild(o);
  });
  soundSel.addEventListener("change", function(){
    if(isSoundLocked(soundSel.value)){
      soundSel.value = S.sound; /* revert the native select's own selection */
      presentPaywall();
      return;
    }
    S.sound = soundSel.value; saveSettings(); updateConfigLine();
    unlockAudio(S.sound); SOUNDS[S.sound].play();
  });
  el("testBtn").addEventListener("click", function(){
    unlockAudio(S.sound); SOUNDS[S.sound].play();
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
      renderVol(); saveSettings(); applyNativeVolumes();
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

  /* ---------- Starta Pro (in-app purchase) ----------
     A single non-consumable unlock (all themes + custom color + the full
     sound pack) via RevenueCat wrapping native StoreKit — native-only, the
     free web version never gates anything since StoreKit doesn't exist in
     a browser and this app has always been free there. Apple requires any
     purchase that unlocks content/features used inside the app to go
     through their own purchase system (App Store Review Guideline 3.1.1);
     Stripe or any other processor isn't allowed for this. */
  const FREE_THEMES = ["track"];
  const FREE_SOUNDS = ["bang", "buzzer"];
  const PRO_ENTITLEMENT_ID = "pro";
  const REVENUECAT_API_KEY_IOS = "YOUR_REVENUECAT_PUBLIC_IOS_API_KEY"; /* set from the RevenueCat dashboard before shipping */
  /* RevenueCat isn't configured yet (placeholder key above) — rather than
     ship a purchase button that silently can't work, this release unlocks
     Pro via a redemption code instead. Once RevenueCat is set up for real,
     flip this to true and the purchase UI (already built below) takes
     over automatically — nothing else to change. */
  const PAYMENTS_ENABLED = false;
  const PRO_REDEEM_CODE = "STARTAPRO";
  /* Hazard is its own separate secret, independent of Starta Pro entirely —
     hidden from the theme grid until its own distinct code is redeemed,
     not just locked-and-visible like the rest of the Pro bundle */
  const HAZARD_REDEEM_CODE = "CHUCK";
  const Purchases = isNative && window.Capacitor.Plugins ? window.Capacitor.Plugins.Purchases : null;
  const ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  let isPro = false;
  let proPackage = null; /* cached purchasable package, for price display + purchasing */
  if(isNative) body.classList.add("native");

  /* hazard is never part of the Starta Pro lock/paywall — it's excluded
     here because by the time its swatch exists in the DOM at all, it's
     already been unlocked via its own separate secret code */
  function isThemeLocked(name){ return name !== "hazard" && isNative && !isPro && FREE_THEMES.indexOf(name) === -1; }
  function isSoundLocked(key){ return isNative && !isPro && FREE_SOUNDS.indexOf(key) === -1; }
  function presentPaywall(){ if(isNative) openPanelAndScrollTo(el("proSection")); }

  function lockBadge(container){
    let badge = container.querySelector(".lock-badge");
    if(!badge){
      badge = document.createElement("span");
      badge.className = "lock-badge"; badge.innerHTML = ICON_LOCK;
      container.appendChild(badge);
    }
    return badge;
  }

  function renderProGates(){
    themesWrap.querySelectorAll(".theme-option").forEach(function(opt){
      const locked = isThemeLocked(opt.dataset.theme);
      opt.classList.toggle("locked", locked);
      const swatch = opt.querySelector(".swatch");
      if(locked) lockBadge(swatch);
      else{ const b = swatch.querySelector(".lock-badge"); if(b) b.remove(); }
    });
    const customLocked = isNative && !isPro;
    customColorRow.classList.toggle("locked", customLocked);
    const swatchEl = el("customColorSwatch");
    if(customLocked) lockBadge(swatchEl);
    else{ const b = swatchEl.querySelector(".lock-badge"); if(b) b.remove(); }

    Array.prototype.forEach.call(soundSel.options, function(o){
      o.textContent = SOUNDS[o.value].label + (isSoundLocked(o.value) ? " (Pro)" : "");
    });

    el("proStatus").hidden = !isPro;
    el("proUnlockBtn").hidden = !PAYMENTS_ENABLED || isPro;
    el("proRestoreBtn").hidden = !PAYMENTS_ENABLED || isPro;
    el("proCodeRow").hidden = PAYMENTS_ENABLED || isPro;
    syncPromoRemoveBtn();
  }

  const proCodeInput = el("proCodeInput");
  el("proRedeemBtn").addEventListener("click", function(){
    const entered = (proCodeInput.value || "").trim().toUpperCase();
    const codeError = el("proCodeError");
    if(entered && entered === PRO_REDEEM_CODE){
      isPro = true; S.proRedeemed = true; saveSettings();
      codeError.hidden = true;
      proCodeInput.value = "";
      renderProGates();
    }else{
      codeError.hidden = false;
    }
  });

  /* Hazard's own separate secret — a distinct code from Starta Pro's,
     unlocking just this one theme rather than the whole bundle */
  const hazardCodeInput = el("hazardCodeInput");
  el("hazardRedeemBtn").addEventListener("click", function(){
    const entered = (hazardCodeInput.value || "").trim().toUpperCase();
    const codeError = el("hazardCodeError");
    if(entered && entered === HAZARD_REDEEM_CODE){
      S.hazardRedeemed = true; saveSettings();
      addThemeSwatch("hazard");
      codeError.hidden = true;
      hazardCodeInput.value = "";
      el("hazardStatus").hidden = false;
      el("hazardCodeRow").hidden = true;
      syncPromoRemoveBtn();
    }else{
      codeError.hidden = false;
    }
  });

  function initPurchases(){
    if(!PAYMENTS_ENABLED || !Purchases) return;
    Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS })
      .then(function(){ return Purchases.getCustomerInfo(); })
      .then(function(res){
        const info = res && res.customerInfo;
        isPro = !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[PRO_ENTITLEMENT_ID]);
        renderProGates();
      })
      .catch(function(){ /* offline or not yet configured — stays locked, no crash */ });
    Purchases.getOfferings().then(function(res){
      const offering = res && res.offerings && res.offerings.current;
      const pkg = offering && offering.availablePackages && offering.availablePackages[0];
      if(pkg){
        proPackage = pkg;
        el("proPrice").textContent = (pkg.product && pkg.product.priceString) || "";
      }
    }).catch(function(){});
  }

  el("proUnlockBtn").addEventListener("click", function(){
    if(!Purchases || !proPackage) return;
    Purchases.purchasePackage({
      packageIdentifier: proPackage.identifier,
      offeringIdentifier: proPackage.offeringIdentifier
    }).then(function(res){
      const info = res && res.customerInfo;
      isPro = !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[PRO_ENTITLEMENT_ID]);
      renderProGates();
    }).catch(function(){ /* user cancelled, or purchase failed — nothing to do */ });
  });
  el("proRestoreBtn").addEventListener("click", function(){
    if(!Purchases) return;
    Purchases.restorePurchases().then(function(res){
      const info = res && res.customerInfo;
      isPro = !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[PRO_ENTITLEMENT_ID]);
      renderProGates();
    }).catch(function(){});
  });

  /* themes */
  const THEMES = {
    track:    { color: "#c8451f", label: "Track" },
    red:      { color: "#e5262c", label: "Red" },
    ocean:    { color: "#38bdf8", label: "Ocean" },
    field:    { color: "#34d399", label: "Field" },
    sunset:   { color: "#fb923c", label: "Sunset" },
    daylight: { color: "#f4f6fb", label: "Daylight" },
    hazard:   { color: "#f4c81a", label: "TRACKCLUB" }
  };
  const themesWrap = el("themes");
  function addThemeSwatch(name){
    if(themesWrap.querySelector('[data-theme="' + name + '"]')) return; /* already added */
    const t = THEMES[name];
    const opt = document.createElement("button");
    opt.className = "theme-option"; opt.dataset.theme = name;
    opt.setAttribute("aria-label", t.label + " theme");
    opt.innerHTML = '<span class="swatch" style="background:' + t.color + '"></span><span class="theme-name">' + t.label + "</span>";
    opt.addEventListener("click", function(){
      if(isThemeLocked(name)){ presentPaywall(); return; }
      S.theme = name; applyTheme(); saveSettings();
    });
    themesWrap.appendChild(opt);
    return opt;
  }
  Object.keys(THEMES).forEach(function(name){
    if(name === "hazard") return; /* settings haven't loaded yet here — added later in init if already redeemed */
    addThemeSwatch(name);
  });
  /* readable text color for a given background — plain luminance heuristic,
     no need for full sRGB gamma correction at this scale */
  function contrastInk(hex){
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? "#101418" : "#ffffff";
  }

  const customColorInput = el("customColorInput");
  const customColorRow = el("customColorRow");
  const customColorHex = el("customColorHex");
  const customColorSwatch = el("customColorSwatch");
  /* the label's default action opens the native color picker — intercept
     that with preventDefault() while locked, same idea as the theme/sound
     gates, instead of letting it open then having to undo a color pick */
  customColorSwatch.addEventListener("click", function(e){
    if(isNative && !isPro){ e.preventDefault(); presentPaywall(); }
  });
  customColorInput.addEventListener("input", function(){
    S.theme = "custom"; S.customAccent = customColorInput.value;
    applyTheme(); saveSettings();
  });

  function applyTheme(){
    body.dataset.theme = S.theme;
    if(S.theme === "custom"){
      body.style.setProperty("--accent", S.customAccent);
      body.style.setProperty("--accent-ink", contrastInk(S.customAccent));
    }else{
      body.style.removeProperty("--accent");
      body.style.removeProperty("--accent-ink");
    }
    themesWrap.querySelectorAll(".theme-option").forEach(function(s){
      s.classList.toggle("active", s.dataset.theme === S.theme);
    });
    customColorInput.value = S.customAccent;
    customColorHex.textContent = S.customAccent.toUpperCase();
    customColorRow.classList.toggle("active", S.theme === "custom");
  }

  /* reset */
  /* reset only touches settings — redeemed promo codes are kept; removing
     those is its own deliberate action below */
  el("resetBtn").addEventListener("click", function(){
    S = Object.assign({}, DEFAULTS, { proRedeemed: S.proRedeemed, hazardRedeemed: S.hazardRedeemed });
    syncInputs(); applyTheme(); updateConfigLine(); renderProGates(); saveSettings();
  });

  /* remove promos — deliberately slow: a 3 second wait, then typing "delete" */
  const PROMO_WAIT_SECONDS = 3;
  let promoTimer = null;
  function hasPromos(){ return !!(S.proRedeemed || S.hazardRedeemed); }
  function syncPromoRemoveBtn(){
    el("removePromosBtn").hidden = !el("removePromosConfirm").hidden || !hasPromos();
  }
  function cancelPromoRemoval(){
    clearInterval(promoTimer); promoTimer = null;
    el("removePromosConfirm").hidden = true;
    el("removePromosInput").value = "";
    el("removePromosInput").disabled = true;
    el("removePromosConfirmBtn").disabled = true;
    syncPromoRemoveBtn();
  }
  function startPromoRemoval(){
    const input = el("removePromosInput"), hint = el("removePromosHint");
    const base = "This removes any redeemed promo codes — Starta Pro and the hidden theme lock again until you re-enter the codes. ";
    let left = PROMO_WAIT_SECONDS;
    input.value = ""; input.disabled = true;
    el("removePromosConfirmBtn").disabled = true;
    el("removePromosConfirm").hidden = false;
    syncPromoRemoveBtn();
    hint.textContent = base + "Please wait " + left + "…";
    promoTimer = setInterval(function(){
      left--;
      if(left > 0){ hint.textContent = base + "Please wait " + left + "…"; return; }
      clearInterval(promoTimer); promoTimer = null;
      hint.textContent = base + 'Type "delete" to confirm.';
      input.disabled = false; input.focus();
    }, 1000);
  }
  function removePromos(){
    S.proRedeemed = false; S.hazardRedeemed = false;
    isPro = false;
    const hazardSwatch = themesWrap.querySelector('[data-theme="hazard"]');
    if(hazardSwatch) hazardSwatch.remove();
    el("hazardCodeRow").hidden = false;
    el("hazardStatus").hidden = true;
    /* don't leave a now-locked theme or sound selected */
    if(S.theme === "hazard" || isThemeLocked(S.theme)) S.theme = DEFAULTS.theme;
    if(isSoundLocked(S.sound)) S.sound = DEFAULTS.sound;
    cancelPromoRemoval();
    syncInputs(); applyTheme(); updateConfigLine(); renderProGates(); saveSettings();
  }
  el("removePromosBtn").addEventListener("click", startPromoRemoval);
  el("removePromosCancelBtn").addEventListener("click", cancelPromoRemoval);
  el("removePromosInput").addEventListener("input", function(){
    el("removePromosConfirmBtn").disabled = el("removePromosInput").value.trim().toLowerCase() !== "delete";
  });
  el("removePromosConfirmBtn").addEventListener("click", removePromos);

  /* config summary on the main screen — compact icon chips instead of a sentence */
  /* each icon's artwork is nudged via an inner <g transform> so its inked
     shape sits centered in the 24x24 viewBox — several of these (flag and
     sound especially) were drawn well off-center, which threw off the
     already-symmetric chip padding around them */
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0,0.5)"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></g></svg>';
  const ICON_SIGNAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(0.5,0)"><polygon points="4 8 8 8 13 4 13 20 8 16 4 16 4 8"/><path d="M17 8a5 5 0 0 1 0 8"/></g></svg>';
  const ICON_FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(1.5,0)"><path d="M5 3v18"/><path d="M5 4h11l-2.5 4L16 12H5"/></g></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(-1.14,0)"><polygon points="4 8 8 8 13 4 13 20 8 16 4 16 4 8"/><path d="M17 8a5 5 0 0 1 0 8"/><path d="M19.5 5.5a9 9 0 0 1 0 13"/></g></svg>';
  /* icon + text as one tight group — there's no icon on the right side of
     these chips, so the pill is padded evenly around the icon+text group
     itself rather than carrying dead space held open for a phantom mirror */
  function chip(target, icon, text){
    return '<span class="config-chip" data-target="' + target + '">' + icon +
      '<span class="chip-text">' + text + '</span></span>';
  }
  function updateConfigLine(){
    let html = '<div class="config-chips">' +
      chip("marksBlock", ICON_CLOCK, fmtRange(S.marksMin, S.marksMax)) +
      chip("setBlock", ICON_SIGNAL, fmtRange(S.setMin, S.setMax));
    if(S.headStart) html += chip("headStartSection", ICON_FLAG, "+" + fmtNum(S.headGap) + "s");
    html += '</div><div class="config-chips">' +
      chip("soundSection", ICON_SOUND, SOUNDS[S.sound].label) +
      '</div>';
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
    if(!SOUNDS[S.sound]) S.sound = DEFAULTS.sound; /* a saved sound that's since been removed (e.g. Yeehaw, Voice "Go!") */
    if(S.hazardRedeemed){
      addThemeSwatch("hazard"); /* before applyTheme, so its active state renders correctly */
      el("hazardCodeRow").hidden = true;
      el("hazardStatus").hidden = false;
    }
    syncInputs(); applyTheme(); updateConfigLine();
    applyNativeVolumes(); /* the initial call above ran before settings loaded, so the real saved volume wasn't applied yet */
    if(S.proRedeemed) isPro = true; /* code-redeemed unlock persists across launches */
    renderProGates(); /* dims locked themes/sounds immediately, before the purchase check returns */
    initPurchases();
  });

  /* ---------- PWA service worker ---------- */
  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("sw.js").catch(function(){ /* offline install just won't be available */ });
    });
  }
})();
