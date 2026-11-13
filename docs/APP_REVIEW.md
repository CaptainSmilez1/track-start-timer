# Starta — App Review Information

Answers for the App Store Connect **App Review Information** questions.

**Status:** build 1.0 (7) was rejected on October 15, 2026 under Guideline 3.1.1 because Starta Pro (`STARTAPRO`) and the yellow bonus theme (`CHUCK`, now named Hazard) were unlocked with codes. The next build fixes this. Both codes, the Starta Pro section, the "Got a code?" box, the lock icons, and the RevenueCat purchase SDK are gone, and every theme and sound is free for everyone. The reply to Apple is in **Reply to App Review** at the bottom.

---

## 1. Screen recording guide

**Before you record**
- Use your iPhone (a real phone, not the simulator) updated to the latest iOS.
- Install the build you're submitting, from TestFlight or Xcode.
- If you've used the app before, delete it and reinstall so it starts fresh.
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
8. **Themes.** Open Settings again. Tap a couple of color themes (including Hazard) and try the custom color picker.
9. **Finish.** Tap Reset to defaults, close Settings, and stop the recording.

**After recording**
- The video saves to your Photos app. Trim the start and end if you want, but don't cut anything out of the middle.
- Watch it once to check that the sounds came through.
- Upload it in App Store Connect under App Review Information (or share a link to it in the Notes).

The app has no accounts, no posts or chat between users, and no purchases. So there's no sign-up, login, account deletion, reporting or paid content to show.

---

## App Store screenshot guide

**What Apple needs**
- **iPhone 6.9" screenshots are required:** 1320 × 2868 or 1290 × 2796 pixels, portrait. App Store Connect scales them down for smaller iPhones.
- **No iPad screenshots needed.** The app is set to iPhone only.
- Upload 3 to 10 per device, as PNG or JPG. They must show the real app in use, not just the launch screen.

**How to take them**
- If your phone is a Pro Max or Plus model, take them on the phone (Side button + Volume Up).
- If not, use the Xcode Simulator on an **iPhone 17 Pro Max**. Press Cmd-S to save a full-size screenshot to your Desktop. The physical-device rule only applies to the review recording, not store screenshots.
- Before you start, charge the phone or set the Simulator to a clean status bar, and pick the theme you want people to see first.

**Shot list**
1. **Ready screen.** The main screen with the big START button.
2. **On your marks.** Tap START and take it while "On your marks" is showing.
3. **GO!** Take it during the "GO!" flash. This one takes a few tries, so let the start run and press right as it fires.
4. **Timing settings.** Settings open on the Timing section, showing the presets and Min/Max numbers.
5. **Sound settings.** The Sound section with the start-signal list open.
6. **Head start.** Head start on, taken while it shows "Second start in …".
7. **Themes.** The Appearance section with a non-default theme selected (Hazard or Ocean looks good), or the main screen in that theme.

**Tips**
- Keep everything English and the same theme across shots 1–6 so they look like a set. Use a different theme for the last one to show it off.
- No text overlays or device frames are required. Plain screenshots are fine.
- Upload them in App Store Connect → your app → the version → **Previews and Screenshots**.

---

## 2–6. Answers (copy everything in the box)

```
PURPOSE AND TARGET AUDIENCE

Starta is a starting gun for track practice. You hit Start, it calls "On your marks" and "Set" out loud, and then it fires. The catch is that the pauses between those calls are random every time, so you can't guess when the gun is coming.

I built it because practice starts are usually called by a coach or a teammate, and after a few reps everyone falls into their rhythm. You end up training to anticipate the gun instead of reacting to it. If you're training alone, there's nobody to start you at all, and a real starter pistol isn't something most people own (or are allowed to bring to practice).

It's made for sprinters, hurdlers, relay runners, and the coaches, parents, and volunteers who run their practices. You can set it to match real meet timing or speed it up for quick drills. There's also a head-start mode that fires a second, delayed signal for handicap or chase starts. It works fully offline, so it's fine at a track with bad signal.

HOW TO USE THE APP

No account, login, or sample files needed. Just open the app.

Tap START and the app runs a start for you: "On your marks", "Set", then the gun. Tap Cancel if you want to stop partway through. Please make sure the ringer switch is on and the volume is up, or you won't hear anything.

Everything else is behind the gear icon in the top right. From there you can change the volume, pick a different start sound (the Test button lets you hear it), adjust the timing or tap one of the presets, turn on Head start, and pick a color theme.

Everything in the app is free. There are no purchases, no locked features, and no codes to enter.

There are no user accounts and nothing users can post or share, so the app has no sign-up, login, account deletion, or reporting/blocking features.

EXTERNAL SERVICES

Starta doesn't use any outside services. Everything runs on the phone. The app is built with Capacitor, the sounds play through a native audio plugin, and the "On your marks" and "Set" calls use the iPhone's built-in text-to-speech voice. All of the start sounds are generated by a script in my project (no recordings, samples, or licensed audio), and they come bundled with the app.

There's no analytics, no ads, no login service, no payments, and no AI. Settings are only saved on the device, and the app works without an internet connection.

REGIONAL DIFFERENCES

Starta works the same everywhere. Nothing changes by country or region, and it doesn't use location. The app is in English and is free in every country.

REGULATED INDUSTRY / THIRD-PARTY MATERIAL

This doesn't apply to Starta. It isn't a health, finance, gambling, or other regulated app, and it doesn't use anyone else's copyrighted or trademarked material. I made all the sounds myself, and the artwork is my own.
```

---

## Reply to App Review (build 1.0 (7) rejection)

```
Hello,

Thank you for the review. I've fixed the Guideline 3.1.1 issue in the new build.

Starta Pro and the yellow bonus theme were never sold. They were unlocked with free codes that I shared with friends and our local track team. I understand that unlocking content with my own codes isn't allowed, even when it's free, so I removed both. The new build has no codes, no code entry fields, no locked content, and no purchase code of any kind. Every theme, sound, and feature is now available to everyone for free.

Answers to your questions:

1. Who are the users that will use the paid features in the app? There are no paid features. Every feature is free for every user.
2. Where can users purchase the features that can be accessed in the app? Nowhere. Nothing in the app is sold, inside or outside the app.
3. What specific types of previously purchased features can a user access in the app? None. Nothing has ever been sold, so there are no previously purchased features.
4. What paid content, subscriptions, or features are unlocked within the app that do not use In-App Purchase? None. The free code unlocks were removed in this build, and all content is open to everyone.
5. How do users obtain the "Starta Pro" redeem code? The code was never sold. I shared it for free with friends and our local track team. It has been removed from the app, and the app no longer accepts any codes.

Thank you!
```
