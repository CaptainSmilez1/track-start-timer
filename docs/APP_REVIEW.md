# Starta — App Review Information

Answers for the App Store Connect **App Review Information** questions, written against the current build (`js/app.js` with `PAYMENTS_ENABLED = false`). Read **Before you submit** first. Two things in this build will probably get it rejected as it stands.

---

## Before you submit (open issues)

1. **Pro is unlocked by a code typed into the app, not by In-App Purchase.** With `PAYMENTS_ENABLED = false`, the Pro section shows a "Enter code" field that unlocks paid content with the hardcoded code `STARTAPRO`. Guideline 3.1.1 says apps may not use their own mechanisms to unlock content or functionality, such as license keys or QR codes. Any code-based unlock has to go through App Store **offer codes**, which redeem through StoreKit. Pick one before you submit:
   - **(Recommended)** Set up the non-consumable in App Store Connect and RevenueCat, put the real public key in `REVENUECAT_API_KEY_IOS`, and set `PAYMENTS_ENABLED = true`. The Unlock and Restore Purchases buttons are already built.
   - Or ship v1 with every feature free: remove the Pro gating and the code field, and add the purchase in a later update.
2. **The privacy policy doesn't match the build if purchases are turned on.** `privacy.html` says no third-party services are used. RevenueCat (and Apple StoreKit) handle purchase and anonymous customer IDs. If you enable payments, update the policy and the App Privacy "nutrition label" (Purchases → Purchase History, not linked to identity, not used for tracking).
3. **"Got a code?" / GSTC theme.** The `CHUCK` code unlocks a hidden cosmetic theme. Because it isn't paid content it's less risky, but App Review flags hidden features (2.3.1) unless you disclose them. The notes below disclose it. If "GSTC" is a real club's name or mark, see section 6.
4. `UIRequiredDeviceCapabilities` in `ios/App/App/Info.plist` lists `armv7`, which is a Capacitor template leftover. Change it to `arm64` (or delete the key) so App Store Connect doesn't flag or restrict the build.

The answers below assume you take option 1 above, the real In-App Purchase. Notes in brackets show where the wording changes if you pick the other option.

---

## 1. Screen recording (shot list)

Record on a physical iPhone running the latest iOS with **Settings → Control Center → Screen Recording**. Turn the ringer switch on and volume up so the start signals can be heard. Then record in this order, in one take:

1. **Launch:** start on the Home Screen and tap the Starta icon. The launch animation plays and the START screen appears.
2. **Typical flow:** tap **START**. The screen shows and speaks "On your marks" and then "Set", then plays the starter-gun sound with a "GO!" flash. Run it a second time and tap **Cancel** midway to show cancelling.
3. **Settings:** tap the gear icon.
   - Change volume, pick a start signal and tap **Test**.
   - Tap a timing preset (e.g. *Quick*, *Official*) and adjust a Min/Max stepper.
   - Turn on **Head start**, close Settings, and run START once to show both signals.
   - Tap the free *Track* theme. Then tap a locked theme or a "(Pro)" sound to show the paywall scrolling to **Starta Pro**.
4. **Paid content:** in **Starta Pro**, tap **Unlock Starta Pro** and complete the purchase with a Sandbox account. Show the locks disappearing. Pick a Pro theme, the custom color, and a Pro sound (e.g. Air horn) and **Test** it. Then show **Restore Purchases**. If you test on a fresh install, it's the cleanest place to show it.
5. **Hidden theme:** in **Got a code?**, enter `CHUCK`, tap Redeem, and select the GSTC theme.
6. Optionally, tap **Reset to defaults**.

You don't need account registration, login, account deletion, or UGC reporting/blocking, because the app has no accounts and no user-generated content. Mention this in the notes (see below).

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
> At the bottom of Settings there's a "Got a code?" box. Typing CHUCK unlocks a free bonus theme called GSTC that I made for our local team. It's just a color, and it's free.
>
> There are no user accounts and nothing users can post or share, so the app has no sign-up, login, account deletion, or reporting/blocking features.

## 4. External services

> Starta doesn't use any outside services. Everything runs on the phone. The app is built with Capacitor, the sounds play through a native audio plugin, and the "On your marks" and "Set" calls use the iPhone's built-in text-to-speech voice. I made all of the start sounds myself with my own script, and they come bundled with the app.
>
> There's no analytics, no ads, no login service, no payments, and no AI. Settings are only saved on the device, and the app works without an internet connection.

## 5. Regional differences

> Starta works the same everywhere. Nothing changes by country or region, and it doesn't use location. The app is in English and is free in every country.

## 6. Regulated industry / third-party material

> This doesn't apply to Starta. It isn't a health, finance, gambling, or other regulated app, and it doesn't use anyone else's copyrighted or trademarked material. I made all the sounds myself, and the artwork is my own.

**Check before you paste this:** if "GSTC" is the name of a real club, school, or organization, get their okay first, or rename the theme to something generic. Otherwise the answer above isn't true.
