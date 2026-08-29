#!/usr/bin/env node
/**
 * PUBLIC-SURFACE-CENSUS-PARITY-0 — is the ownership census's public denominator
 * actually exhaustive?
 *
 * ⚠️ WHY THIS EXISTS. `DevToolsConfig` is a public declaration in `lib/types.ts`
 * with ZERO rows in the public-type census, while its sibling `BatchingConfig`
 * has one. Exactly one of these is true, and the burn-down's authorization
 * depends on knowing which:
 *
 *     A. it belongs to an explicitly excluded subject class
 *     B. the public-type discovery family missed a public subject
 *
 * Adding the row by hand would answer neither.
 *
 *     A CENSUS THAT DISCOVERS A SUBJECT BUT DOES NOT GATE IT HAS NOT CLOSED IT.
 *
 * The independent denominator is `tools/api-baseline.json`, produced by the
 * api-inventory gate from the BUILT surface — a different mechanism from the
 * census's source parsing, which is what makes it a control rather than a
 * restatement.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

execSync(`node ${ROOT}/tools/kernel-ownership-census.mjs`, { stdio: 'pipe' });
const census = JSON.parse(readFileSync(`${ROOT}/tools/kernel-ownership-census.json`, 'utf8'));
const base = JSON.parse(readFileSync(`${ROOT}/tools/api-baseline.json`, 'utf8'));

const censused = new Set([
  ...(census.publicSurface?.rootValueExports ?? []),
  ...(census.publicSurface?.rootTypeExports ?? []),
]);

/**
 * Documented exclusions. Each needs a REASON, not just a name — an unexplained
 * exclusion list is how a denominator quietly stops being exhaustive.
 */
const EXCLUSIONS = new Map([]);

const missing = [];
for (const s of base.core.symbols) {
  if (censused.has(s.name)) continue;
  if (EXCLUSIONS.has(s.name)) continue;
  missing.push(s);
}

console.log(`api-baseline public symbols: ${base.core.symbols.length}`);
console.log(`ownership census public rows: ${censused.size}`);
console.log(`documented exclusions:        ${EXCLUSIONS.size}`);
console.log(`\nPUBLIC SYMBOLS WITH NO OWNERSHIP ROW: ${missing.length}`);
for (const m of missing) console.log(`  ${m.name.padEnd(32)} ${m.kind.padEnd(11)} ${m.declFile.replace('packages/kernel/src/', '')}`);

// known-positive control: the census must contain something the baseline does
const sample = base.core.symbols.find((s) => censused.has(s.name));
if (!sample) {
  console.error('\n❌ control failed: the two denominators share NO symbol — they are not comparable.');
  process.exit(1);
}
console.log(`\ncontrol: both denominators contain "${sample.name}" — comparable.`);
if (missing.length) { console.error(`\n❌ ${missing.length} public symbol(s) outside the ownership denominator.`); process.exit(1); }
console.log('✅ public-surface parity: every public symbol has an ownership row.');
