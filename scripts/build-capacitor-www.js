// Copies the static site into www/ for Capacitor to bundle into the native
// apps. Kept separate from the repo root (which GitHub Pages serves as-is)
// so this build step can't affect the deployed web app.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "www");

const FILES = ["index.html", "manifest.webmanifest", "sw.js"];
const DIRS = ["css", "js", "sounds", "icons"];

function copyDir(src, dst){
  fs.mkdirSync(dst, { recursive: true });
  for(const entry of fs.readdirSync(src, { withFileTypes: true })){
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if(entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for(const f of FILES) fs.copyFileSync(path.join(root, f), path.join(dest, f));
for(const d of DIRS) copyDir(path.join(root, d), path.join(dest, d));

console.log("built www/ for Capacitor");

/* @capacitor-community/native-audio expects sound files in these
   platform-specific asset folders (separate from the web bundle) so the
   native side can preload them without going through the WebView. Only
   copied if the native projects already exist (`cap add ios`/`android`
   run once); harmless no-op on a plain web checkout. */
const soundsSrc = path.join(root, "sounds");
const androidAssets = path.join(root, "android", "app", "src", "main", "assets", "sounds");
const iosAssets = path.join(root, "ios", "App", "App", "sounds");

if(fs.existsSync(path.join(root, "android"))){
  copyDir(soundsSrc, androidAssets);
  console.log("staged sounds/ into android/app/src/main/assets/sounds");
}
if(fs.existsSync(path.join(root, "ios"))){
  copyDir(soundsSrc, iosAssets);
  console.log("staged sounds/ into ios/App/App/sounds");
}
