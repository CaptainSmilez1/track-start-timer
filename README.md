# Track Start Timer

A randomized "on your marks, set, go" starter timer for track practice — runs entirely in the browser, installable as an app on phones (PWA).

## Project layout

- `index.html` — page structure
- `css/style.css` — styles/themes
- `js/app.js` — app logic, settings, synthesized start sounds
- `manifest.webmanifest` + `sw.js` — makes it installable and work offline
- `icons/` — app icons
- `track-start-timer.html` — original single-file version, kept for reference

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

## Later: real App Store / Play Store listing

This PWA can be wrapped with [Capacitor](https://capacitorjs.com/) to produce a native iOS/Android project for store submission. That step needs:
- A Mac + Xcode for iOS, plus a paid Apple Developer account ($99/yr)
- Android Studio for Android, plus a one-time $25 Play Console fee

Ask when you're ready to do that step — it's a separate project wrapping this same code, not a rewrite.
