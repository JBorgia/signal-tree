#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

function run(cmd, args = []) {
  const res = child_process.spawnSync(cmd, args, { stdio: 'inherit' });
  return res.status === 0;
}

const argv = process.argv.slice(2);
const doJsdoc = argv.includes('--jsdoc');
const doSizes = argv.includes('--sizes');

if (!doJsdoc && !doSizes) {
  console.log('\u2139\ufe0f Usage: node scripts/ci-checks.js --jsdoc --sizes');
  process.exit(0);
}

if (doJsdoc) {
  console.log('\n\ud83d\udd0d Running JSDoc stripping validation...');
  const jsdocScript = path.join(__dirname, 'verify-jsdoc-stripping.js');
  if (!fs.existsSync(jsdocScript)) {
    console.warn('   \u26a0 verify-jsdoc-stripping.js not found, skipping');
  } else {
    const ok = run('node', [jsdocScript]);
    if (!ok) {
      console.error('   \u274c JSDoc validation failed');
      process.exit(1);
    }
  }
  const declarationDocs = path.join(
    __dirname,
    '../tools/check-declaration-docs.mjs'
  );
  if (!fs.existsSync(declarationDocs)) {
    console.error('   \u274c check-declaration-docs.mjs not found');
    process.exit(1);
  }
  if (!run('node', [declarationDocs])) {
    console.error('   \u274c Declaration documentation validation failed');
    process.exit(1);
  }
}

if (doSizes) {
  console.log('\n\ud83d\udcca Running consumer bundle size budget...');
  const sizeScript = path.join(__dirname, '../tools/check-bundle-budget.mjs');
  if (!fs.existsSync(sizeScript)) {
    console.error('   \u274c check-bundle-budget.mjs not found');
    process.exit(1);
  } else {
    const ok = run('node', [sizeScript]);
    if (!ok) {
      console.error('   \u274c Bundle size validation failed');
      process.exit(1);
    }
  }
}

console.log('\n\u2705 CI checks completed successfully');
