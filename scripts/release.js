#!/usr/bin/env node
// Usage: node scripts/release.js
// Orchestrates the full release flow:
// 1. bump-version (version + nativeVersion auto-detection)
// 2. generate-changelog (from previous tag)
// 3. Write RELEASE_NOTES.md (edit before confirming)
// 4. Prompt to continue → commit, tag, push

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_NOTES_PATH = path.join(ROOT, 'RELEASE_NOTES.md');

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

  const enChangelog = fs.readFileSync(path.join(ROOT, '.changelog', 'en.txt'), 'utf8').trim();

  // Step 4: Write RELEASE_NOTES.md for editing
  fs.writeFileSync(RELEASE_NOTES_PATH, enChangelog + '\n');
  console.log(`\nRelease notes written to RELEASE_NOTES.md`);
  console.log('Edit the file before confirming if needed.\n');
  console.log('--- RELEASE_NOTES.md ---');
  console.log(enChangelog);
  console.log();

  // Step 5: Confirm
  const answer = await ask('Commit, tag, and push? [y/N] ');
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted. Version files have been modified — revert with `git checkout .` if needed.');
    process.exit(0);
  }

  // Re-read in case user edited the file
  const finalNotes = fs.readFileSync(RELEASE_NOTES_PATH, 'utf8').trim();

  // Step 6: Commit
  console.log('\n=== Committing ===');
  run('git add -A');
  const commitMsg = `chore: bump version to ${newVersion}\n\nChangelog:\n${finalNotes}`;
  spawnSync('git', ['commit', '-m', commitMsg], { cwd: ROOT, stdio: 'inherit' });

  // Step 7: Tag and push
  console.log('\n=== Tagging and pushing ===');
  run(`git tag v${newVersion}`);
  run('git push && git push --tags');

  console.log(`\n✓ Released v${newVersion}`);
  console.log('  → GitHub release workflow triggered');
  console.log('  → RELEASE_NOTES.md will be used for GitHub Release notes');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
