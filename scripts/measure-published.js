#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const pkgs = [
  '@signaltree/core',
  '@signaltree/batching',
  '@signaltree/middleware',
  '@signaltree/devtools',
];

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch (e) {
    return null;
  }
}

for (const pkg of pkgs) {
  console.log('\n⏳ Processing', pkg);
  try {
    const out = run(`npm pack ${pkg}@latest --pack-destination /tmp`);
    const tgzName = out.split('\n').pop().trim();
    const tgzPath = path.posix.join('/tmp', tgzName);
    if (!fs.existsSync(tgzPath)) {
      console.error('  ✖ Tarball not found at', tgzPath);
      continue;
    }

    // Extract package.json from tarball
    const pkgJsonRaw = tryRun(
      `tar -xOzf ${JSON.stringify(tgzPath)} package/package.json`
    );
    if (!pkgJsonRaw) {
      console.error('  ✖ Failed to extract package.json from', tgzPath);
      continue;
    }
    const pj = JSON.parse(pkgJsonRaw);

    // Prefer module, then exports.import/default, then main
    let entry = null;
    if (pj.module) entry = pj.module;
    else if (pj.exports) {
      const exp = pj.exports['.'] || pj.exports;
      if (typeof exp === 'string') entry = exp;
      else if (exp && typeof exp === 'object') {
        entry = exp.import || exp.default || exp.node || exp.browser || null;
        if (!entry) {
          // try nested conditions
          const keys = Object.keys(exp);
          for (const k of keys) {
            if (typeof exp[k] === 'string' && exp[k].endsWith('.mjs')) {
              entry = exp[k];
              break;
            }
            if (exp[k] && typeof exp[k] === 'object') {
              entry = exp[k].import || exp[k].default || entry;
            }
          }
        }
      }
    }
    if (!entry && pj['jsnext:main']) entry = pj['jsnext:main'];
    if (!entry && pj.main) entry = pj.main;

    // Normalize and fallback to searching for .mjs under fesm2022 or esm
    let entryPath = null;
    if (entry) {
      entryPath = 'package/' + entry.replace(/^\.\//, '');
    } else {
      const list = run(`tar -tf ${JSON.stringify(tgzPath)}`)
        .split(/\r?\n/)
        .filter(Boolean);
      entryPath =
        list.find((p) => /fesm2022\/.*\.mjs$/.test(p)) ||
        list.find((p) => /dist\/esm\/.*\.js$/.test(p)) ||
        list.find((p) => /\.mjs$/.test(p)) ||
        null;
      if (entryPath)
        entryPath = 'package/' + entryPath.replace(/^package\//, '');
    }

    if (!entryPath) {
      console.error('  ✖ Could not locate runtime entry inside', tgzPath);
      continue;
    }

    // Extract the entry file as buffer
    const buf = execSync(
      `tar -xOzf ${JSON.stringify(tgzPath)} ${JSON.stringify(entryPath)}`,
      { encoding: null }
    );
    const gz = zlib.gzipSync(buf);
    console.log(`  ✔ Tarball: ${tgzName}`);
    console.log(`  ✔ Entry:  ${entryPath}`);
    console.log(`  ✔ Raw bytes: ${buf.length} bytes`);
    console.log(`  ✔ Gzipped: ${gz.length} bytes`);
  } catch (err) {
    console.error(
      '  ✖ Error processing',
      pkg,
      err && err.message ? err.message : err
    );
  }
}

console.log('\nDone.');
