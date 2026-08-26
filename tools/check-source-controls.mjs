#!/usr/bin/env node
/**
 * No raw NUL or unexpected C0 control characters in tracked sources.
 *
 * ## Earned by a real incident
 *
 * An invisible NUL byte reached committed source, propagated into the very
 * script written to fix it, and was found only because Python refused to parse
 * that script. Every correctness gate we own was blind to it: TypeScript
 * tolerated it, ESLint tolerated it, the tests passed, and the bytes shipped.
 *
 * That is the whole argument for a SYNTACTIC gate. A defect no semantic tool can
 * see needs a check that reads bytes rather than meaning.
 *
 * ## What counts as unexpected
 *
 * C0 is U+0000–U+001F. Three of those are ordinary in text files and are allowed
 * everywhere: TAB, LF, CR. Everything else in the range is rejected, as is DEL
 * (U+007F). The set is deliberately not configurable per-file: an exception
 * mechanism is how the next NUL gets waved through.
 *
 * Usage:
 *   node tools/check-source-controls.mjs
 *   node tools/check-source-controls.mjs --self-test
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** TAB, LF, CR are expected in text. Everything else in C0, plus DEL, is not. */
const ALLOWED = new Set([0x09, 0x0a, 0x0d]);
const isBad = (b) => (b < 0x20 && !ALLOWED.has(b)) || b === 0x7f;

const NAMES = {
  0x00: 'NUL', 0x01: 'SOH', 0x02: 'STX', 0x03: 'ETX', 0x04: 'EOT', 0x05: 'ENQ',
  0x06: 'ACK', 0x07: 'BEL', 0x08: 'BS', 0x0b: 'VT', 0x0c: 'FF', 0x0e: 'SO',
  0x0f: 'SI', 0x1a: 'SUB', 0x1b: 'ESC', 0x7f: 'DEL',
};
const name = (b) => NAMES[b] ?? `0x${b.toString(16).padStart(2, '0')}`;

/**
 * ⚠️ TRACKED TEXT ONLY, and the list comes from git rather than a glob.
 * A glob would need an ignore list that drifts; `git ls-files` is by definition
 * exactly what a commit can carry, which is the thing being protected.
 */
function trackedTextFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  const files = out.toString('utf8').split('\0').filter(Boolean);
  // Binary formats legitimately contain C0 bytes; they are not "sources".
  const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|eot|zip|gz|docx?|xlsx?|pptx?|mp4|webm|wasm)$/i;
  return files.filter((f) => !BINARY.test(f));
}

function scan(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return []; // deleted-but-tracked during a rebase, etc.
  }
  const hits = [];
  let line = 1;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x0a) { line++; continue; }
    if (isBad(b)) hits.push({ line, byte: b });
  }
  return hits;
}

const selfTest = process.argv.includes('--self-test');
const problems = [];
for (const file of trackedTextFiles()) {
  for (const hit of scan(file)) problems.push({ file, ...hit });
}

if (selfTest) {
  // ⚠️ THE GATE'S OWN POSITIVE CONTROL. A checker whose only evidence is "it
  // found nothing" is indistinguishable from a checker that cannot find
  // anything — the exact failure this repository has now hit twice, in a
  // mutation filtering a field that did not exist and in a reachability grep
  // that called `entityMap` unreachable. So the detector is run against a
  // synthetic buffer containing the byte it exists to catch.
  const control = Buffer.from('const a = 1;\nconst b = \0;\n', 'utf8');
  let found = 0;
  for (const b of control) if (isBad(b)) found++;
  if (found !== 1) {
    console.error(`✗ SELF-TEST FAILED: detector found ${found} control bytes in a buffer containing exactly one NUL.`);
    process.exit(1);
  }
  const clean = Buffer.from('const a = 1;\n\tconst b = 2;\r\n', 'utf8');
  for (const b of clean) {
    if (isBad(b)) {
      console.error('✗ SELF-TEST FAILED: detector rejected TAB/LF/CR, which are expected in text.');
      process.exit(1);
    }
  }
  console.log('✓ self-test: the detector finds a planted NUL and accepts TAB/LF/CR.');
  process.exit(0);
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} unexpected control character(s) in tracked sources:\n`);
  for (const p of problems.slice(0, 40)) {
    console.error(`  ${p.file}:${p.line}  ${name(p.byte)}`);
  }
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
  console.error(
    `\n  These are INVISIBLE in an editor and pass every semantic gate we own.\n` +
      `  One reached committed source, propagated into the script written to fix\n` +
      `  it, and was caught only because Python refused to parse that script.\n`
  );
  process.exit(1);
}

console.log(
  `✓ no unexpected control characters in ${trackedTextFiles().length} tracked files.`
);
