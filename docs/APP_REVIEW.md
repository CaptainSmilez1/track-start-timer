# Starta — App Review Information

Answers for the App Store Connect **App Review Information** questions, written against the current build (`js/app.js` with `PAYMENTS_ENABLED = false`). Read **Before you submit** first. Two things in this build will probably get it rejected as it stands.

---

## Before you submit (open issues)

1. **Pro is unlocked by a code typed into the app, not by In-App Purchase.** With `PAYMENTS_ENABLED = false`, the Pro section shows a "Enter code" field that unlocks paid content with the hardcoded code `STARTAPRO`. Guideline 3.1.1 says apps may not use their own mechanisms to unlock content or functionality, such as license keys or QR codes. Any code-based unlock has to go through App Store **offer codes**, which redeem through StoreKit. Pick one before you submit:
   - **(Recommended)** Set up the non-consumable in App Store Connect and RevenueCat, put the real public key in `REVENUECAT_API_KEY_IOS`, and set `PAYMENTS_ENABLED = true`. The Unlock and Restore Purchases buttons are already built.
   - Or ship v1 with every feature free: remove the Pro gating and the code field, and add the purchase in a later update.
2. **The privacy policy doesn't match the build if purchases are turned on.** `privacy.html` says no third-party services are used. RevenueCat (and Apple StoreKit) handle purchase and anonymous customer IDs. If you enable payments, update the policy and the App Privacy "nutrition label" (Purchases → Purchase History, not linked to identity, not used for tracking).
3. **"Got a code?" / TRACKCLUB theme.** The `CHUCK` code unlocks a hidden cosmetic theme. Because it isn't paid content it's less risky, but App Review flags hidden features (2.3.1) unless you disclose them. The notes below disclose it.
4. `UIRequiredDeviceCapabilities` in `ios/App/App/Info.plist` lists `armv7`, which is a Capacitor template leftover. Change it to `arm64` (or delete the key) so App Store Connect doesn't flag or restrict the build.

The answers below assume you take option 1 above, the real In-App Purchase. Notes in brackets show where the wording changes if you pick the other option.

---

## 1. Screen recording guide

**Before you record**
- Use your iPhone (a real phone, not the simulator) updated to the latest iOS.
- Install the build you're submitting, from TestFlight or Xcode. - If you've used the app before, delete it and reinstall so it starts fresh.
- Turn the ringer switch on and turn the volume up so the sounds are in the video.
- Turn on Do Not Disturb so no notifications pop up.
- Add Screen Recording to Control Center if it isn't there already: Settings > Control Center > Screen Recording.
- To record sound, long-press the record button in Control Center and check that the microphone is on. iOS records the app's own audio either way, but turning the mic on is a backup.

**What to record (one take, about 1–2 minutes)**
1. **Start on the Home Screen.** Start recording from Control Center, go back to the Home Screen, and tap the Starta icon. The recording has to begin with launching the app.
2. **Run a start.** Tap START. Let it say "On your marks", then "Set", then fire with the "GO!" flash.
3. **Show Cancel.** Tap START again and tap Cancel before it fires.
4. **Open Settings.** Tap the gear icon in the top right.
5. **Sound.** Tap + or – on the volume. Pick a different start sound (Air horn, for example) and tap Test.
6. **Timing.** Tap a preset like Quick or Official, then tap + or – on one of the Min/Max numbers.
7. **Head start.** Turn on Head start. Close Settings with the X and tap START to show the two signals.
8. **Themes.** Open Settings again. Tap a couple of color themes and try the custom color picker.
9. **Starta Pro code.** Tap a locked theme so Settings jumps to Starta Pro. Type STARTAPRO, tap Redeem, and show the locks disappearing. Pick an unlocked sound and tap Test.
10. **Bonus theme.** Scroll to "Got a code?", type CHUCK, tap Redeem, and pick the TRACKCLUB theme.
11. **Finish.** Tap Reset to defaults, close Settings, and stop the recording.

**After recording**
- The video saves to your Photos app. Trim the start and end if you want, but don't cut anything out of the middle.
- Watch it once to check that the sounds came through.
- Upload it in App Store Connect under App Review Information (or share a link to it in the Notes).

The app has no accounts, no posts or chat between users, and no purchases. So there's no sign-up, login, account deletion, reporting or paid content to show.

---

## 2. Purpose and target audience

> Starta is a starting gun for track practice. You hit Start, it calls "On your marks" and "Set" out loud, and then it fires. The catch is that the pauses between those calls are random every time, so you can't guess when the gun is coming.
>
> I built it because practice starts are usually called by a coach or a teammate, and after a few reps everyone falls into their rhythm. You end up training to anticipate the gun instead of reacting to it. If you're training alone, there's nobody to start you at all, and a real starter pistol isn't something most people own (or are allowed to bring to practice).
>
> It's made for sprinters, hurdlers, relay runners, and the coaches, parents, and volunteers who run their practices. You can set it to match real meet timing or speed it up for quick drills. There's also a head-start mode that fires a second, delayed signal for handicap or chase starts. It works fully offline, so it's fine at a track with bad signal.

## 3. How to use the app (paste into "Notes")

> No account, login, or sample files needed. Just open the app.
>
> Tap START and the app runs a start for you: "On your marks", "Set", then the gun. Tap Cancel if you want to stop partway through. Please make sure the ringer switch is on and the volume is up, or you won't hear anything.
>
> Everything else is behind the gear icon in the top right. From there you can change the volume, pick a different start sound (the Test button lets you hear it), adjust the timing or tap one of the presets, turn on Head start, and pick a color theme.
>
> Some themes and sounds have a lock on them. That's Starta Pro, and it isn't paid. There's no purchase anywhere in the app, and the code is never sold. Pro is just unlocked with a free code: in Settings, go to the Starta Pro section, type STARTAPRO, and tap Redeem. That unlocks all the color themes, the custom color picker, and the extra start sounds (air horn, whistle, duck quack, cartoon boing, goat bleat, and two voice signals).
>
> At the bottom of Settings there's a separate "Got a code?" box. Typing CHUCK unlocks a free bonus theme called TRACKCLUB that I made for our local team. It's just a color, and it's free.
>
> There are no user accounts and nothing users can post or share, so the app has no sign-up, login, account deletion, or reporting/blocking features.

## 4. External services

> Starta doesn't use any outside services. Everything runs on the phone. The app is built with Capacitor, the sounds play through a native audio plugin, and the "On your marks" and "Set" calls use the iPhone's built-in text-to-speech voice. All of the start sounds are generated by a script in my project (no recordings, samples, or licensed audio), and they come bundled with the app.
>
> There's no analytics, no ads, no login service, no payments, and no AI. Settings are only saved on the device, and the app works without an internet connection.

## 5. Regional differences

> Starta works the same everywhere. Nothing changes by country or region, and it doesn't use location. The app is in English and is free in every country.

## 6. Regulated industry / third-party material

> This doesn't apply to Starta. It isn't a health, finance, gambling, or other regulated app, and it doesn't use anyone else's copyrighted or trademarked material. I made all the sounds myself, and the artwork is my own.
