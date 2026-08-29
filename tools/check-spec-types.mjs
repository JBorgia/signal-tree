#!/usr/bin/env node
/**
 * Gate: spec files are typechecked, ratcheted per file.
 *
 * ## The hole this closes
 *
 * `tsconfig.typecheck-all.json` excludes `**\/*.spec.ts`, and core's
 * `tsconfig.typecheck.json` includes only `src/**\/*.typing.spec.ts`. So ordinary
 * spec files were typechecked by NOTHING, and Vitest transpiles via esbuild, which
 * strips types without checking them.
 *
 * What that permitted, found in 14.1.1:
 *
 *     const mk = (history: boolean) =>
 *       signalTree({ rows: entityMap({ selectId: r => r.id, history }) })
 *
 * `history` was renamed to `recordHistory` in 14.1.1 and `EntityConfig` no longer
 * declares it. The test claimed to pin "the flag must not reach serialize()", but
 * both of its arms built an identical default-configured tree, so its equality
 * assertion held vacuously. The suite stayed green while the premise of the test
 * had evaporated. Mutation-testing caught it; that is far too expensive to rely on.
 *
 * ## Why a ratchet rather than a clean gate
 *
 * Turning the check on cold reports 238 errors across 43 files, nearly all
 * test-idiom noise: implicit-any callback params, deliberately loose casts,
 * generic-constraint probes in typing specs. Fixing those is worthwhile and is a
 * separate job. Blocking the release on it would mean either doing all 238 now or
 * shipping with no check at all — and the second is how the vacuous test survived.
 *
 * So: per-file counts are frozen. A file may not get worse, and a file with no
 * baseline entry must be clean. Renaming a public config option now fails here
 * instead of passing silently.
 *
 * ## Why not a hand-rolled AST scan instead
 *
 * Tried first, and discarded: a scanner that mapped each marker to one config type
 * produced 151 findings of which nearly all were false. `entityMap({ load })` is
 * legal via an INTERSECTION in an overload signature
 * (`EntityConfig<E,K> & { load: LoaderFeature<E,P> }`), not via `EntityConfig`; and
 * `signalTree({ count })` is the state argument, not the config, which is the
 * second parameter. Any hand-modelled version of the type system drifts from the
 * real one. tsc is the source of truth, so use tsc.
 *
 * ## Re-baselining
 *
 * Fix errors, then `node tools/check-spec-types.mjs --update` to ratchet down.
 * The count may only ever decrease.
 *
 * ## 15.0 re-baseline: 166 -> 383, and why that is a tightening
 *
 * The recorded baseline said 166 across 43 files while the real count was 723
 * across 70. It predated the causal-runtime kernel and the declarative
 * construction change, so the gate could not go green no matter what was fixed —
 * and a ratchet that can only be red detects nothing new, which is the same
 * place as switched off.
 *
 * 723 -> 383 came from three systematic fixes, all of them stale artifacts of
 * decisions already taken, none of them a loosening:
 *
 *   -  5  dead `import { form }` lines. FORM-DEL (b57ba293) deleted the module;
 *         esbuild drops unused imports, so the specs kept running and only tsc
 *         could see it.
 *   - 55  `) as ISignalTree<{ realized shape }>` casts. `ISignalTree<T>` puts T
 *         through `TreeNode<T>` for `$`, so feeding it an ALREADY-realized shape
 *         re-wrapped it and typed `byIdOrFail(...)` as `void`. One file carried
 *         185 errors from this alone. Now `as unknown as { $: {...} }`.
 *   - 102  direct `.__subjectIds` / `.__positionIds` reads, rerouted through
 *         `getOwnedSubjectIds()` / `getOwnedPositionIds()`. This one is also a
 *         CORRECTNESS fix: the direct property is only populated under the
 *         'property' metadata layout, so those assertions would silently read
 *         `undefined` under 'sidecar' — the layout the deferred A/B intends to
 *         test.
 *
 * The remaining 383 is debt, recorded as such. The top entries are
 * causal-runtime.contract (27), events/mock-event-bus (26), entity-signal (22),
 * time-travel (21) and subject-reclamation-coordinator (20); the rest is a long
 * tail of implicit-any callback params and deliberately loose casts. Nothing in
 * it is known to be a vacuous test, but nothing in it has been checked either —
 * that is what the number means.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const BASELINE = new URL('./spec-type-baseline.json', import.meta.url);
const PROJECT = 'tsconfig.typecheck-specs.json';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function run() {
  try {
    execFileSync('npx', ['tsc', '--noEmit', '-p', PROJECT], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return '';
  } catch (e) {
    // tsc exits non-zero when it reports diagnostics; that is the normal path.
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

/** file -> error count, from tsc's `path(line,col): error TSxxxx:` lines. */
function countsFrom(output) {
  const counts = {};
  for (const line of output.split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error TS\d+:/.exec(line);
    if (!m) continue;
    const file = m[1].replace(`${ROOT}/`, '');
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
}

const output = run();
if (/error TS(5\d{3}|6\d{3})/.test(output) && !/error TS\d+:/.test(output)) {
  console.error('check-spec-types: tsc could not load the project.\n' + output);
  process.exit(2);
}

const actual = countsFrom(output);
const actualTotal = Object.values(actual).reduce((a, b) => a + b, 0);

if (process.argv.includes('--update')) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        total: actualTotal,
        files: Object.fromEntries(Object.entries(actual).sort()),
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    `check-spec-types: baseline written — ${actualTotal} error(s) across ${
      Object.keys(actual).length
    } file(s).`
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error(
    'check-spec-types: no baseline. Run `node tools/check-spec-types.mjs --update`.'
  );
  process.exit(2);
}

/**
 * SPEC-TYPE-BASELINE-HYGIENE — every permanent baseline entry must address a
 * SURVIVING subject.
 *
 * A baseline entry for a deleted spec is not protection: nothing can regress
 * against it, so it can only ever report a phantom "improvement". Left alone it
 * accumulates — 13 such entries had built up from earlier deletions
 * (`stored.spec.ts`, `compared.spec.ts`, `linked.spec.ts`, the `atomic-state/**`
 * prototypes) and made the improvement list unreadable, which is where a REAL
 * improvement goes unnoticed.
 *
 * This is the baseline analogue of the carrier rule that governed
 * ATOMIC-STATE-RETIREMENT: A BOUND ATTACHED TO NO SURVIVING SUBJECT IS NOT
 * PROTECTION.
 *
 * ⚠️ PRUNE, NEVER REBASELINE. Removing a dead entry preserves every surviving
 * bound exactly. Running `--update` to "clean up" instead would silently convert
 * every current improvement into the new allowed ceiling and discard the ratchet.
 */
function deadBaselineEntries(files) {
  return Object.keys(files).filter((file) => !existsSync(`${ROOT}/${file}`));
}

if (process.argv.includes('--self-test')) {
  // POSITIVE CONTROL: a checker that only ever reports "no dead entries" is
  // indistinguishable from one that cannot detect them. Inject a subject that
  // certainly does not exist and require the detector to name it.
  const fake = 'packages/kernel/src/lib/__no_such_spec__.spec.ts';
  const found = deadBaselineEntries({ ...baseline.files, [fake]: 1 });
  if (!found.includes(fake)) {
    console.error(
      `✗ SELF-TEST FAILED: dead-entry detector did not flag ${fake}, which does not exist.`
    );
    process.exit(1);
  }
  const real = deadBaselineEntries(baseline.files);
  if (real.length > 0) {
    console.error(
      `✗ SELF-TEST FAILED: ${real.length} dead entry/entries in the committed baseline.`
    );
    process.exit(1);
  }
  console.log(
    '✓ self-test: dead-entry detector flags an injected phantom subject and the committed baseline is clean.'
  );
  process.exit(0);
}

const dead = deadBaselineEntries(baseline.files);
if (dead.length > 0) {
  console.error(
    `check-spec-types: ${dead.length} baseline entry/entries address a spec that no longer exists.\n` +
      `A bound attached to no surviving subject is not protection — nothing can\n` +
      `regress against it. PRUNE these entries by hand; do NOT run --update, which\n` +
      `would rebaseline every surviving file and discard the ratchet.\n`
  );
  for (const file of dead) console.error(`  ${file}: ${baseline.files[file]}`);
  process.exit(1);
}

const regressions = [];
const improvements = [];
for (const [file, count] of Object.entries(actual)) {
  const allowed = baseline.files[file] ?? 0;
  if (count > allowed) regressions.push({ file, count, allowed });
}
for (const [file, allowed] of Object.entries(baseline.files)) {
  const count = actual[file] ?? 0;
  if (count < allowed) improvements.push({ file, count, allowed });
}

if (regressions.length) {
  console.error(
    `check-spec-types: ${regressions.length} spec file(s) got WORSE.\n` +
      `A new type error in a spec usually means the spec's premise no longer\n` +
      `compiles as written — the shape that let a renamed config option pass\n` +
      `silently and made an assertion vacuous.\n`
  );
  for (const r of regressions) {
    console.error(
      `  ${r.file}: ${r.count} error(s), baseline allows ${r.allowed}`
    );
  }
  console.error('\nFull tsc output:\n');
  console.error(
    output
      .split('\n')
      .filter((l) => regressions.some((r) => l.includes(r.file)))
      .join('\n')
  );
  process.exit(1);
}

if (improvements.length) {
  console.log(
    `check-spec-types: OK — and ${improvements.length} file(s) improved. ` +
      `Ratchet down with \`node tools/check-spec-types.mjs --update\`:`
  );
  for (const i of improvements) {
    console.log(`  ${i.file}: ${i.count} now, baseline ${i.allowed}`);
  }
  process.exit(0);
}

console.log(
  `check-spec-types: OK — ${actualTotal} known error(s) across ` +
    `${Object.keys(actual).length} file(s), none worse than baseline. ` +
    `Spec files ARE typechecked; a renamed public config option fails here.`
);
process.exit(0);
