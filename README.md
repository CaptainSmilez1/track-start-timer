# Starta

A randomized "on your marks, set, go" starter timer for track practice — runs entirely in the browser, installable as an app on phones (PWA).

## Project layout

- `index.html` — page structure
- `css/style.css` — styles/themes
- `js/app.js` — app logic, settings, sound playback (web `<audio>` or native, see below)
- `manifest.webmanifest` + `sw.js` — makes the web version installable and work offline
- `icons/` — app icons
- `sounds/` — bundled start-signal audio files (rendered by `scripts/render-sounds.js`)
- `track-start-timer.html` — original single-file version, kept for reference
- `ios/`, `android/`, `capacitor.config.json` — native app wrapper (see "Native app" below); `www/` is a gitignored build artifact, never hand-edited

## Run it locally

Any static file server works, e.g.:

```
npx serve .
```

Then open the printed `http://127.0.0.1:<port>/index.html` (use `127.0.0.1`, not `localhost`, if `localhost` doesn't resolve in your setup).

## Deploy to GitHub Pages (free hosting for your team)

1. Create a new **public** repo on GitHub (e.g. `track-start-timer`) — don't add a README/gitignore, this project already has them.
2. From this folder:
   ```
   git remote add origin https://github.com/<your-username>/track-start-timer.git
   git push -u origin main
   ```
3. On GitHub: repo → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
4. After a minute, your team can open `https://<your-username>.github.io/track-start-timer/` on any phone or computer.
5. On a phone, opening that link and choosing **"Add to Home Screen"** (iOS Safari) or the **Install** prompt (Android Chrome) installs it like an app.

## Native app (Capacitor) — for the App Store / Play Store

The project is already wrapped with [Capacitor](https://capacitorjs.com/) (`ios/` and `android/` folders, `capacitor.config.json`). The web PWA at the repo root is completely independent of this and keeps working the same regardless.

The native build plays sound through `@capacitor-community/native-audio` (real native `AVAudioPlayer`/`SoundPool`) instead of the browser's `<audio>` element — no web audio startup latency, and immune to the Safari-specific quirks that caused the web version's sound bugs. `js/app.js` detects at runtime whether it's running inside the native shell (`Capacitor.isNativePlatform()`) and switches engines automatically; nothing to configure.

**Before your first build, or any time you change `index.html`/`css`/`js`/`sounds`/`icons`:**
```
npm install
npm run cap:sync
```
This copies the web app into `www/` (gitignored, regenerated every time — never hand-edit it) and syncs it plus the native-audio plugin into both native projects. Also stages the `sounds/*.wav` files into `android/app/src/main/assets/sounds/` and `ios/App/App/sounds/` — the plugin needs them there, not in the web bundle.

### Android (works on Windows)
1. Install [Android Studio](https://developer.android.com/studio).
2. `npm run cap:android` — builds and opens the project in Android Studio.
3. Run on an emulator or a plugged-in device from there.

### iOS (needs a Mac)
1. On the Mac, `git pull` this repo, then `npm install && npm run cap:sync`.
2. **One-time step**: the `sounds` folder placed at `ios/App/App/sounds/` is on disk but Xcode won't know about it until you add it — open `ios/App/App.xcworkspace` in Xcode, right-click the **App** group → **Add Files to "App"...** → select the `sounds` folder → check **"Create folder references"** (blue folder icon, not a yellow group) and **"Copy items if needed"** is fine either way since the files are already in place.
3. Set your own bundle identifier in `capacitor.config.json` (`appId`, currently a placeholder: `com.captainsmilez1.tracktimer`) to match what you register in your Apple Developer account, then `npm run cap:sync` again.
4. Build/run from Xcode. You'll need a paid Apple Developer account ($99/yr) to run on a physical device or submit to the App Store.

I can't build or test the iOS side myself (no Mac/Xcode here) — steps above are as far as I can verify without one. Play Console listing is a one-time $25 fee, separate from the $99/yr Apple fee.
