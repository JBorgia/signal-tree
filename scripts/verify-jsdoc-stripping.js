#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Try to load gzip-size, fallback gracefully if not available
let gzipSize;
try {
  gzipSize = require('gzip-size');
} catch {
  console.log('ℹ️  gzip-size not installed, showing raw file sizes only\n');
}

const packages = JSON.parse(
  execFileSync('node', ['scripts/release-plan.mjs', '--json'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  })
).map((name) => ({ name, public: true }));

function collectFiles(dir, extension, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, extension, out);
    else if (entry.isFile() && entry.name.endsWith(extension)) out.push(full);
  }
  return out;
}

console.log('🔍 Verifying JSDoc Stripping and Bundle Sizes\n');

let allPassed = true;

packages.forEach((pkg) => {
  console.log(`📦 ${pkg.name}:`);

  const packageRoot = path.join(__dirname, `../dist/packages/${pkg.name}`);
  const jsFiles = collectFiles(packageRoot, '.js');
  const dtsFiles = collectFiles(packageRoot, '.d.ts');

  let jsHasJSDoc = false;
  let dtsHasJSDoc = false;
  let jsSize = 0;
  let gzippedSize = 0;

  try {
    for (const jsFile of jsFiles) {
      const jsContent = fs.readFileSync(jsFile, 'utf8');
      jsHasJSDoc ||= jsContent.includes('/**') && jsContent.includes('*/');
      jsSize += jsContent.length;
      gzippedSize += gzipSize ? gzipSize.sync(jsContent) : jsContent.length;
    }
  } catch (e) {
    console.log(`   ⚠️  Could not read JS files: ${e.message}`);
  }

  try {
    for (const dtsFile of dtsFiles) {
      const dtsContent = fs.readFileSync(dtsFile, 'utf8');
      dtsHasJSDoc ||= dtsContent.includes('/**') && dtsContent.includes('*/');
    }
  } catch (e) {
    console.log(`   ⚠️  Could not read .d.ts files: ${e.message}`);
  }

  if (jsFiles.length > 0) {
    const gzipInfo = gzipSize
      ? `, ${(gzippedSize / 1024).toFixed(2)}KB gzipped`
      : '';
    console.log(
      `   runtime files (${jsFiles.length}): ${
        jsHasJSDoc ? '❌ Contains JSDoc' : '✅ No JSDoc'
      } (${(jsSize / 1024).toFixed(2)}KB raw${gzipInfo})`
    );
  } else {
    console.log(`   runtime files: ❌ Not found`);
    allPassed = false;
  }

  if (pkg.public && dtsFiles.length > 0) {
    console.log(
      `   declaration files (${dtsFiles.length}): ${
        dtsHasJSDoc ? '✅ Has JSDoc' : '❌ Missing JSDoc'
      }`
    );
  } else if (pkg.public) {
    console.log(`   declaration files: ❌ Not found`);
    allPassed = false;
  }

  if (jsHasJSDoc) {
    console.log(`   🚨 ERROR: JSDoc found in runtime bundle!`);
    allPassed = false;
  }

  if (pkg.public && !dtsHasJSDoc) {
    console.log(`   🚨 ERROR: No JSDoc in public type definitions`);
    allPassed = false;
  }

  console.log('');
});

if (!allPassed) {
  console.log('❌ JSDoc stripping validation FAILED!');
  process.exit(1);
} else {
  console.log('✅ JSDoc stripping validation PASSED!');
}

console.log('\n🎯 Bundle size improvements from JSDoc stripping:');
console.log(
  '   - Runtime bundles: Significantly smaller (no documentation overhead)'
);
console.log(
  '   - Type definitions: Documentation remains available to consumers'
);
