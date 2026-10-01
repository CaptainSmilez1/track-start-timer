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

**Starta** is a starter's-pistol simulator for track and field practice. It runs the "On your marks… Set… GO!" start sequence with spoken commands and a starter sound. The gaps between commands are randomised within ranges the user sets.

- **Problem it solves:** in practice, a coach or teammate calling starts out loud gets predictable, so sprinters learn the rhythm and anticipate the gun instead of reacting to it. Solo athletes have no one to start them at all. Real starter pistols and electronic start systems are expensive and often restricted.
- **Value:** you get an unpredictable start, like a race, from a phone. You can tune it to official timing ("Set" → gun of about 1.5–2.5 s) or to quick, long or fixed drills. A head-start mode fires a second, delayed signal for handicap or chase starts. It works fully offline.
- **Target audience:** sprinters, hurdlers and relay athletes. Also high-school, college and club track coaches, and parents or volunteers running practice. It also works for any sport that drills reaction starts, such as swimming or football sprints.

---

## 3. Setup and access instructions (paste into "Notes")

> Starta needs no account, login, or sample files. All features are on one screen plus a Settings panel.
>
> - Tap **START** to run a randomised "On your marks / Set / GO!" start sequence. Tap **Cancel** to stop it. Please turn the ringer switch on and raise the volume to hear the signals.
> - Tap the **gear icon** (top right) for Settings: volume, start-signal sound (**Test** previews it), timing ranges and presets, Head start (a second delayed signal), and colour themes.
> - **Paid content:** "Starta Pro" is a one-time non-consumable In-App Purchase. It unlocks all colour themes, a custom accent colour, and the extra start sounds (air horn, whistle, duck quack, cartoon boing, goat bleat, and two voice signals). Tapping any locked item opens the Starta Pro section. Purchase with a Sandbox account, and use **Restore Purchases** to restore it.
> - **Got a code?** (bottom of Settings): entering **CHUCK** unlocks a free hidden colour theme ("GSTC") we share with our local team. It's cosmetic only, has no monetary value, and isn't part of Starta Pro.
> - The app has no user accounts and no user-generated content, so it has no registration, login, account deletion, or reporting/blocking flows.

*[If you choose to ship everything free instead: remove the "Paid content" bullet.]*

---

## 4. External services, tools, and platforms

| Service | Used for | Notes |
|---|---|---|
| Apple StoreKit (via App Store) | Starta Pro In-App Purchase and restore | Only when payments are enabled |
| RevenueCat (`@revenuecat/purchases-capacitor`) | Wraps StoreKit and checks the "pro" entitlement | Anonymous app user ID; only when payments are enabled |
| Capacitor (`@capacitor/core`, `/ios`) | Native app shell around the web UI | On-device and open source; not a network service |
| `@capacitor-community/native-audio` | Low-latency playback of the bundled start sounds | On-device |
| iOS speech synthesis (`speechSynthesis`) | Speaks "On your marks", "Set", and the voice signals | On-device system voices |

The app doesn't use any data providers, authentication services, analytics, advertising, or AI services. The start sounds are synthesised by the project's own script (`scripts/render-sounds.js`) and bundled with the app, so no stock or licensed audio is used. Settings are stored only on the device.

---

## 5. Regional differences

> Starta works the same way in every region. It doesn't use location, region-specific content, or region-locked features. The interface is in English. The only regional difference is the Starta Pro price, which the App Store sets per storefront from the selected price tier.

---

## 6. Regulated industry / third-party material

> Not applicable. Starta isn't in a regulated industry (it isn't health, finance, gambling, or similar). It doesn't use third-party copyrighted or trademarked material. All sounds are generated by the developer's own code, and all artwork is original.

**Check before you paste this:** if "GSTC" (the hidden theme name) is a real club's, school's, or organisation's name or logo colours, you'll need their written permission to use it. If you can't get that, rename the theme to something generic so the answer above stays true.
