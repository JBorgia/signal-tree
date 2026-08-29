#!/usr/bin/env node
/**
 * Executable mutation proof for EVERY discovery family.
 *
 * ⚠️ THE PROSE ONCE CLAIMED "each family carries its own positives, negatives and
 * killing mutation" while the `FAMILIES` objects held only positives and
 * negatives — the mutations existed as shell commands I had typed by hand, for
 * six of thirteen families. A claim that lives in a comment and not in a runner
 * drifts the moment a family is added.
 *
 * For each family: patch its detector in a temp copy of the module, import that
 * copy, run THAT family's controls, and require at least one to die. Then
 * confirm the unpatched module still passes, so a "death" cannot be an import
 * failure.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SRC = `${ROOT}/tools/census-detectors.mjs`;
const source = readFileSync(SRC, 'utf8');
// ⚠️ NEXT TO THE ORIGINAL, not in tmp: the detector imports `typescript`, and a
// temp directory cannot resolve it. A copy that fails to import would report
// every control as "dead" and every family as mutation-proven.
const dir = mkdtempSync(join(ROOT, 'tools', '.census-mut-'));

const load = async (text, tag) => {
  const f = join(dir, `d-${tag}.mjs`);
  writeFileSync(f, text, 'utf8');
  return import(pathToFileURL(f).href);
};

const runFamily = (fam) => {
  const dead = [];
  for (const [label, run, anchor] of fam.positives) {
    let ok = false;
    try {
      ok = run().includes(anchor);
    } catch {
      ok = false;
    }
    if (!ok) dead.push(`+${label}`);
  }
  for (const [label, run, forbidden] of fam.negatives) {
    let ok = false;
    try {
      ok = !run().includes(forbidden);
    } catch {
      ok = false;
    }
    if (!ok) dead.push(`-${label}`);
  }
  return dead;
};

const base = await load(source, 'base');
let failures = 0;

// Baseline: nothing may be dead before any mutation.
for (const fam of base.FAMILIES) {
  const dead = runFamily(fam);
  if (dead.length) {
    failures++;
    console.log(`  ❌ ${fam.family}: ${dead.length} control(s) already failing at baseline`);
  }
}

for (const fam of base.FAMILIES) {
  if (!fam.mutate) {
    failures++;
    console.log(`  ❌ ${fam.family}: NO MUTATION DECLARED — the family is unproven`);
    continue;
  }
  const { find, replace } = fam.mutate;
  // ⚠️ REFUSE TO PATCH THE DECLARATION ITSELF. A first pass wrote its patterns
  // with doubled backslashes, so `find` did not occur in the detector — but it
  // DID occur inside its own `mutate:` line, so the mutation rewrote its own
  // declaration, left the detector untouched, and every control survived. The
  // runner reported "killed NOTHING", which was true and completely misleading
  // about why. A mutation must apply outside the FAMILIES table.
  const detectorOnly = source.slice(0, source.indexOf('export const FAMILIES'));
  const occurrences = detectorOnly.split(find).length - 1;
  if (occurrences === 0) {
    failures++;
    console.log(`  ❌ ${fam.family}: pattern not found in the DETECTOR source (only in its own declaration?)`);
    continue;
  }
  if (occurrences > 1) {
    failures++;
    console.log(`  ❌ ${fam.family}: pattern is ambiguous — ${occurrences} occurrences`);
    continue;
  }
  const cut = source.indexOf('export const FAMILIES');
  const mutated = await load(
    source.slice(0, cut).replace(find, replace) + source.slice(cut),
    fam.family
  );
  const target = mutated.FAMILIES.find((f) => f.family === fam.family);
  const dead = runFamily(target);
  if (dead.length === 0) {
    failures++;
    console.log(`  ❌ ${fam.family}: mutation killed NOTHING — the controls are decorative`);
  } else {
    console.log(`  ✅ ${fam.family}: ${dead.length} control(s) died — ${dead.slice(0, 2).join(', ')}`);
  }
}

// Restore check: the unpatched module must still be clean, so a death above
// cannot have been a module-level import failure.
for (const fam of base.FAMILIES) {
  if (runFamily(fam).length) {
    failures++;
    console.log(`  ❌ ${fam.family}: not clean after the sweep`);
  }
}

// ── The 13th family: bare reachability ──────────────────────────────────────
// Not a source-text detector, so it is not in FAMILIES and cannot be proven by
// patching a regex. Its arm breaks the reachability lister itself and requires
// the census self-test to refuse. Stated as its own arm rather than counted
// silently among the twelve.
{
  const LISTER = `${ROOT}/tools/bare-module-list.mjs`;
  const original = readFileSync(LISTER, 'utf8');
  const broken = original.replace(
    '.filter(([, v]) => v.bytesInOutput > 0)',
    '.filter(() => false)'
  );
  if (broken === original) {
    failures++;
    console.log('  ❌ bareReachability: mutation pattern not found in the lister');
  } else {
    // ⚠️ RESTORE IN `finally`, AND ON SIGNALS. This arm patches a TRACKED file,
    // and the gate now runs it automatically — so a throw, a failed spawn or a
    // Ctrl-C between the write and the restore would leave a deliberately
    // broken lister committed in the working tree.
    //
    //     A GATE MUTATION MUST NOT RELY ON NORMAL COMPLETION TO RESTORE TRACKED
    //     SOURCE.
    let refused = false;
    const restore = () => writeFileSync(LISTER, original, 'utf8');
    const onSignal = () => {
      restore();
      process.exit(130);
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    try {
      writeFileSync(LISTER, broken, 'utf8');
      try {
        execSync(`node ${ROOT}/tools/kernel-ownership-census.mjs --self-test`, { stdio: 'pipe' });
      } catch {
        refused = true;
      }
    } finally {
      restore();
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
    }
    if (refused) console.log('  ✅ bareReachability: the self-test refused an empty module list');
    else {
      failures++;
      console.log('  ❌ bareReachability: an EMPTY module list still passed — the control is vacuous');
    }
  }
}

console.log(
  failures
    ? `\n❌ ${failures} family mutation problem(s) across ${base.FAMILIES.length + 1} families.`
    : `\n✅ all ${base.FAMILIES.length + 1} discovery families are mutation-proven.`
);
rmSync(dir, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
