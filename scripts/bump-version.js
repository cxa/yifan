#!/usr/bin/env node
// Usage: node scripts/bump-version.js
// Bumps version to today's date in yymm.dd format.
// If a version for today already exists, appends .1, .2, etc.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function getNextVersion() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yy}${mm}.${dd}`;

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const current = pkg.version;

  if (current === today) {
    return `${today}.1`;
  }
  const suffixMatch = current.match(/^(\d{4}\.\d{2})\.(\d+)$/);
  if (suffixMatch && suffixMatch[1] === today) {
    return `${today}.${parseInt(suffixMatch[2], 10) + 1}`;
  }
  return today;
}

function versionToCode(version) {
  // yymm.dd        → yymmdd     (e.g. 260331)
  // yymm.dd.n      → yymmdd0n   (e.g. 26033101)
  const parts = version.split('.');
  const base = parts[0] + parts[1]; // "2603" + "31" = "260331"
  if (parts.length === 3) {
    return parseInt(base, 10) * 100 + parseInt(parts[2], 10);
  }
  return parseInt(base, 10);
}

function updateFile(filePath, replacer) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = replacer(content);
  if (updated === content) {
    throw new Error(`No replacement made in ${filePath}`);
  }
  fs.writeFileSync(filePath, updated, 'utf8');
}

function hasNativeChanges() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const nativeVersion = pkg.nativeVersion;
  const tag = `v${nativeVersion}`;
  try {
    // Check if the tag exists
    execSync(`git rev-parse --verify ${tag}`, { cwd: ROOT, stdio: 'pipe' });
  } catch {
    // Tag doesn't exist — assume native changes needed
    return true;
  }
  try {
    const diff = execSync(
      `git diff --name-only ${tag}..HEAD -- ios/ android/ *.podspec`,
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    return diff.length > 0;
  } catch {
    return true;
  }
}

const version = getNextVersion();
const versionCode = versionToCode(version);
const bumpNative = hasNativeChanges();

console.log(`Bumping to ${version} (versionCode ${versionCode})`);
if (bumpNative) {
  console.log(`Native changes detected since v${JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).nativeVersion} — updating nativeVersion`);
} else {
  console.log('No native changes — nativeVersion unchanged (JS-only / OTA release)');
}

// package.json
updateFile(path.join(ROOT, 'package.json'), c => {
  let updated = c.replace(/"version": "[^"]+"/, `"version": "${version}"`);
  if (bumpNative) {
    updated = updated.replace(/"nativeVersion": "[^"]+"/, `"nativeVersion": "${version}"`);
  }
  return updated;
});

// android/app/build.gradle
updateFile(path.join(ROOT, 'android/app/build.gradle'), c =>
  c
    .replace(/versionCode \d+/, `versionCode ${versionCode}`)
    .replace(/versionName "[^"]+"/, `versionName "${version}"`),
);

// ios/yifan.xcodeproj/project.pbxproj (two occurrences: Debug + Release)
updateFile(path.join(ROOT, 'ios/yifan.xcodeproj/project.pbxproj'), c =>
  c.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`),
);

console.log('Done.');
