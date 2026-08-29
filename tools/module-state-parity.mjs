#!/usr/bin/env node
/**
 * Exact SUBJECT-SET parity between the census's module-binding discovery and the
 * evidence collector, plus a module-resolution integrity check.
 *
 *     COUNT PARITY IS NOT SUBJECT PARITY.
 *
 * Both instruments reported 126 while one recursed into destructuring patterns
 * and the other silently skipped them — under a comment claiming otherwise. Two
 * different sets can have the same size. The next operation is deletion
 * authority, so the control compares KEYS.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { relative, join } from 'node:path';
import ts from 'typescript';
import { detectTopLevelBindings } from './census-detectors.mjs';
import {
  analyseProgram,
  productionProjectConfig,
  productionSourceFiles,
  walk,
} from './module-state-evidence.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CORE = `${ROOT}/packages/kernel/src`;
const FILES = productionSourceFiles();
const rel = (p) => relative(ROOT, p).replace('packages/kernel/src/', '');

// ⚠️ THIS CONTROL IS CURRENTLY VACUOUS FOR ONE OF ITS TWO PURPOSES, and saying
// so is the point. Production has ZERO top-level destructured bindings today, so
// removing the collector's BindingPattern traversal does NOT make these two sets
// diverge — the parity check cannot be mutation-killed that way against the real
// codebase. It kills 5 evidence controls instead, on a fixture that does have
// them.
//
// The parity check therefore earns its place as a FUTURE tripwire: the moment a
// destructured module binding is introduced, the two instruments diverge here
// rather than silently describing different sets. A control that cannot fire
// today is still worth having when the thing it guards is "the two tools that
// both claim to enumerate the subjects we are about to delete from".

// ── census side ──────────────────────────────────────────────────────────────
const censusKeys = new Set();
for (const f of FILES)
  for (const b of detectTopLevelBindings(readFileSync(f, 'utf8'), f))
    censusKeys.add(`${rel(f)}:${b.name}`);

// ── evidence side ────────────────────────────────────────────────────────────
const { subjects, program } = analyseProgram(FILES);
const evidenceKeys = new Set([...subjects.values()].map((s) => `${rel(s.file)}:${s.name}`));

const missing = [...censusKeys].filter((k) => !evidenceKeys.has(k)).sort();
const extra = [...evidenceKeys].filter((k) => !censusKeys.has(k)).sort();

let bad = 0;
const show = (label, list) => {
  if (!list.length) return;
  bad++;
  console.log(`  ❌ ${label} (${list.length})`);
  for (const k of list.slice(0, 12)) console.log(`       ${k}`);
  if (list.length > 12) console.log(`       ... and ${list.length - 12} more`);
};
console.log(`subject-set parity: census ${censusKeys.size}, evidence ${evidenceKeys.size}`);
show('in census but MISSING from evidence', missing);
show('in evidence but EXTRA vs census', extra);
if (!missing.length && !extra.length)
  console.log('  ✅ identical subject sets — not merely identical counts');

// ── PROJECT-INPUT parity ────────────────────────────────────────────────────
// ⚠️ AGREEING ABOUT SUBJECTS IS NOT AGREEING ABOUT THE RIGHT SUBJECTS. Both
// instruments previously built their universe with a directory walk while
// loading the real compiler OPTIONS — and the walk included `src/test-setup.ts`,
// which the project excludes. It happens to contain zero top-level bindings, so
// today's count was unaffected; that is luck, not correctness.
{
  const projectFiles = new Set(productionSourceFiles());
  const walked = walk(CORE).filter((f) => !f.includes('.spec.'));
  const notCompiled = walked.filter((f) => !projectFiles.has(f)).map(rel);
  const analysed = new Set(FILES);
  const compiledButUnanalysed = [...projectFiles].filter((f) => !analysed.has(f)).map(rel);
  console.log(`project-input parity: tsconfig ${projectFiles.size}, analysed ${analysed.size}`);
  show('COMPILED but not analysed', compiledButUnanalysed);
  if (!compiledButUnanalysed.length)
    console.log('  ✅ every production input is analysed');
  if (notCompiled.length)
    console.log(
      `  ℹ️  ${notCompiled.length} file(s) on disk are NOT in the production ` +
        `compilation and are correctly excluded: ${notCompiled.join(', ')}`
    );
}

// ── module-resolution integrity ─────────────────────────────────────────────
// ⚠️ A LEGITIMATE CONSUMER THAT FAILS TO RESOLVE LOOKS LIKE NO CONSUMER. The
// package declares `paths` mappings; a program without them silently drops
// those edges. This asserts the analysed program resolves what production does.
const opts = productionProjectConfig().options;
if (!opts.paths || !Object.keys(opts.paths).length) {
  bad++;
  console.log('  ❌ production compiler options carry no `paths` — wrong tsconfig?');
} else {
  console.log(`  ✅ production compiler options loaded (${Object.keys(opts.paths).length} path mappings)`);
}
const unresolved = [];
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !FILES.includes(sf.fileName)) continue;
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    if (!spec.startsWith('.') && !spec.startsWith('@signaltree')) continue; // externals are fine
    const r = ts.resolveModuleName(spec, sf.fileName, opts, ts.sys);
    if (!r.resolvedModule) unresolved.push(`${rel(sf.fileName)} -> ${spec}`);
  }
}
show('UNRESOLVED first-party imports in the analysed program', unresolved);
if (!unresolved.length) console.log('  ✅ every first-party import in the analysed set resolves');

// ── EXCLUDED-FILE CONTROL ───────────────────────────────────────────────────
// ⚠️ "EVERY PRODUCTION INPUT IS ANALYSED" IS ONE DIRECTION. It passes trivially
// if the authority returned every file on disk. This builds a real temporary
// project whose tsconfig EXCLUDES one file that contains top-level state, and
// requires the authority to omit exactly that file and keep the other.
{
  const dir = mkdtempSync(join(ROOT, 'tools', '.proj-'));
  try {
    writeFileSync(join(dir, 'included.ts'), 'export let includedState = 0;\n', 'utf8');
    writeFileSync(join(dir, 'excluded.ts'), 'export let excludedState = 0;\n', 'utf8');
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'ESNext' }, exclude: ['excluded.ts'] }),
      'utf8'
    );
    const files = productionSourceFiles(join(dir, 'tsconfig.json')).map((f) => f.split('/').pop());
    const hasIncluded = files.includes('included.ts');
    const hasExcluded = files.includes('excluded.ts');
    if (!hasIncluded) { bad++; console.log('  ❌ excluded-file control: an INCLUDED file was dropped'); }
    else console.log('  ✅ an included file with top-level state is a production input');
    if (hasExcluded) { bad++; console.log('  ❌ excluded-file control: a tsconfig-EXCLUDED file was treated as production'); }
    else console.log('  ✅ a tsconfig-excluded file with top-level state is NOT a production input');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(bad ? `\n❌ ${bad} parity/resolution problem(s).` : '\n✅ project-input parity, subject-set parity and module resolution all clean.');
process.exit(bad ? 1 : 0);
