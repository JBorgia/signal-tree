#!/usr/bin/env node
/**
 * C6 RATCHET — Angular runtime coupling may shrink, never grow.
 *
 * The eventual closure target is zero `@angular/core` VALUE imports in
 * kernel-owned modules. That cannot be asserted today because `@signal-tree/kernel`
 * IS the Angular adapter for this release — the packaging split has not
 * happened. Asserting zero now would mean either a permanently red gate or a
 * gate switched off, and a gate that is normally red teaches people to ignore
 * it.
 *
 * So this ratchets instead, exactly like `check-lint-budget`: the recorded set
 * is the current one, a module leaving it is celebrated and locked in, and a
 * module JOINING it fails.
 *
 *     IMPORT STATEMENT KIND DOES NOT ESTABLISH RUNTIME COUPLING.
 *     VALUE-POSITION USE DOES.
 *
 * Coupling is read from VALUE-POSITION use (tools/angular-service-census.mjs),
 * not from import syntax — three modules were once counted as coupled purely
 * because `Signal`/`WritableSignal` shared a statement with a runtime symbol.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const BUDGET = `${ROOT}/tools/angular-coupling-budget.json`;

const use = JSON.parse(
  execSync(`node ${ROOT}/tools/angular-service-census.mjs --json`, { encoding: 'utf8' })
);
const current = Object.entries(use)
  .filter(([, v]) => v.value.length > 0)
  .map(([file, v]) => ({ file, symbols: v.value.sort() }))
  .sort((a, b) => a.file.localeCompare(b.file));

if (!existsSync(BUDGET) || process.argv.includes('--update')) {
  writeFileSync(BUDGET, JSON.stringify({ modules: current }, null, 2));
  console.log(`recorded ${current.length} runtime-coupled module(s) -> tools/angular-coupling-budget.json`);
  for (const m of current) console.log(`  ${m.file.padEnd(52)} ${m.symbols.join(',')}`);
  process.exit(0);
}

const recorded = JSON.parse(readFileSync(BUDGET, 'utf8'));
const was = new Map(recorded.modules.map((m) => [m.file, m.symbols]));
const now = new Map(current.map((m) => [m.file, m.symbols]));

const added = [...now.keys()].filter((f) => !was.has(f));
const removed = [...was.keys()].filter((f) => !now.has(f));
const grew = [...now.entries()].filter(([f, s]) => was.has(f) && s.some((x) => !was.get(f).includes(x)));

console.log(`Angular runtime coupling — ${now.size} module(s) now, ${was.size} recorded.`);
for (const f of removed) console.log(`  ↓ ${f} — NEUTRALIZED. Run --update to lock this in.`);
for (const [f, s] of grew) console.log(`  ✗ ${f} — new symbol(s): ${s.filter((x) => !was.get(f).includes(x)).join(',')}`);
for (const f of added) console.log(`  ✗ ${f} — NEW runtime coupling: ${now.get(f).join(',')}`);

if (added.length || grew.length) {
  console.error(`\n❌ Angular runtime coupling GREW. C6 moves this number down, never up.`);
  process.exit(1);
}
if (removed.length) console.log(`\n${removed.length} module(s) below budget — \`--update\` to tighten the ratchet.`);
console.log('✅ no new Angular runtime coupling.');
