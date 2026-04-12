#!/usr/bin/env node
// Usage: node scripts/release.js
// Orchestrates the full release flow:
// 1. bump-version (version + nativeVersion auto-detection)
// 2. generate-changelog (from previous tag)
// 3. Print changelog for review
// 4. Prompt to continue → commit, tag, push

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', ...opts });
}


function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  // Step 1: Determine previous version for changelog
  const pkgBefore = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const prevTag = `v${pkgBefore.version}`;
  console.log(`Current version: ${pkgBefore.version}\n`);

  // Step 2: Bump version
  console.log('=== Bumping version ===');
  run('node scripts/bump-version.js');

  const pkgAfter = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const newVersion = pkgAfter.version;
  console.log();

  // Step 3: Generate changelog
  console.log('=== Generating changelog ===');
  run(`node scripts/generate-changelog.js --from ${prevTag}`);

  const zhChangelog = fs.readFileSync(path.join(ROOT, '.changelog', 'zh-Hans.txt'), 'utf8').trim();
  const enChangelog = fs.readFileSync(path.join(ROOT, '.changelog', 'en.txt'), 'utf8').trim();

  console.log('\n--- Changelog (zh-Hans) ---');
  console.log(zhChangelog);
  console.log('\n--- Changelog (en) ---');
  console.log(enChangelog);
  console.log();

  // Step 4: Confirm
  const answer = await ask('Commit, tag, and push? [y/N] ');
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted. Version files have been modified — revert with `git checkout .` if needed.');
    process.exit(0);
  }

  // Step 5: Commit
  console.log('\n=== Committing ===');
  run('git add -A');
  const commitMsg = `chore: bump version to ${newVersion}\n\nChangelog:\n${enChangelog}`;
  spawnSync('git', ['commit', '-m', commitMsg], { cwd: ROOT, stdio: 'inherit' });

  // Step 6: Tag and push
  console.log('\n=== Tagging and pushing ===');
  run(`git tag v${newVersion}`);
  run('git push && git push --tags');

  console.log(`\n✓ Released v${newVersion}`);
  console.log('  → GitHub release workflow triggered');
  console.log('  → Edit .changelog/zh-Hans.txt for App Store release notes');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
