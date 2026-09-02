#!/usr/bin/env node
/**
 * Runs every gate — and, with `--self-test`, PROVES each one can fail.
 *
 * ## Why this exists
 *
 * Seven times in this repo a gate passed while covering nothing:
 *
 *   1. `grep "Failed tasks"` exited 0 because grep finding nothing IS exit 1,
 *      inverted by a pipeline;
 *   2. pre-publish validation passed having checked 5 of 7 packages;
 *   3. `typecheck` passed reading only the typing specs, never the sources;
 *   4. a property test passed while the code under it dropped data;
 *   5. a benchmark published SignalTree as 20x faster than elf while SignalTree
 *      was idle and doing no work at all;
 *   6. a granularity timing "measured" granularity with a loop that forced every
 *      consumer to re-read, which flatters the LEAST granular store;
 *   7. `verify-publish-artifacts` exits 1 with a usage message when given no
 *      arguments — indistinguishable, to a shell `&&` chain, from a real failure,
 *      and equally indistinguishable from success had the polarity been reversed.
 *
 * Every one of those was green. The lesson is not "write better gates", it is
 * that **a passing gate is evidence of nothing unless it is known to be capable
 * of failing.** So this harness does not ask a gate whether it passed. It breaks
 * the exact thing the gate claims to watch, runs it, and requires a non-zero
 * exit. A gate that stays green against its own mutation is reported as BROKEN
 * even though it "passed".
 *
 * ## Honest coverage
 *
 * Realisation 15 in design-thesis-and-benchmarking-rules.md: a gate must report
 * what it COVERED, not just that it passed. So the summary counts proven gates
 * against total gates and names every unproven one. A gate with no mutation
 * defined is not a silent gap — it is printed, every run, as UNPROVEN.
 *
 * ## Usage
 *
 *   node tools/verify-gates.mjs               # run every gate, fail on any failure
 *   node tools/verify-gates.mjs --self-test   # prove each gate can fail
 *   node tools/verify-gates.mjs --fast        # skip gates marked slow
 *   node tools/verify-gates.mjs --release     # include the measurement harnesses
 *   node tools/verify-gates.mjs --only=name,name
 *   node tools/verify-gates.mjs --list
 *
 * Mutations are applied to a file, then restored in a `finally` and verified
 * byte-for-byte against a hash taken before the mutation. If any file cannot be
 * restored the harness aborts loudly rather than leaving a mutated tree behind.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// A stray `NX_WORKSPACE_ROOT_PATH` silently redirects EVERY nx command to
// another checkout, and nothing warns.
//
// Found during the 15.0 pristine rehearsal. A fresh worktree reported a build
// cache hit it could not possibly have, `nx build` printed "created
// ../../dist/packages/kernel" while that directory did not exist, the build wrote
// into a different clone entirely, and 19 gates failed for reasons that looked
// like a broken repository. The variable was set in the operator's shell.
//
// Refusing to run beats producing a release from the wrong tree.
if (process.env['NX_WORKSPACE_ROOT_PATH']) {
  const declared = resolve(process.env['NX_WORKSPACE_ROOT_PATH']);
  if (declared !== ROOT) {
    console.error(
      `❌ NX_WORKSPACE_ROOT_PATH points somewhere else.\n\n` +
        `   this checkout : ${ROOT}\n` +
        `   the variable  : ${declared}\n\n` +
        `   Every nx command would operate on that other tree: builds land there,\n` +
        `   its cache answers for this one, and the gates below would report on a\n` +
        `   repository you are not testing. Unset it:\n\n` +
        `     env -u NX_WORKSPACE_ROOT_PATH npm run gates\n`
    );
    process.exit(1);
  }
}

/**
 * `needsBuild` marks a gate that reads `dist/`. Its mutation therefore targets a
 * BUILT file, not a source file — mutating the source would leave the gate
 * reading a stale artifact and passing, which would make the self-test itself
 * the eighth entry on the list above. Built files are regenerable, so mutating
 * them is safe; sources are restored by hash regardless.
 */
const GATES = [
  {
    name: 'typecheck',
    covers:
      'core sources AND typing specs compile (both projects, not just one)',
    cmd: ['npm', 'run', 'typecheck'],
    slow: true,
    mutation: {
      file: 'packages/kernel/src/lib/utils.ts',
      append: '\nconst __gateMutation: number = "not a number";\n',
    },
  },
  {
    name: 'test:all',
    covers: 'behaviour across all published packages AND the demo app',
    // Was `nx test kernel`. The gate's own name said "core" and its summary line
    // said "core behaviour", so it was honest about what it covered — and what
    // it covered was one package of eight. The other seven have real suites
    // (ng-forms alone has 44) and nothing in the gate suite ran them.
    cmd: [
      'npx',
      'nx',
      'run-many',
      '-t',
      'test',
      // The demo has 27 suites and 191 tests that ran only if someone typed
      // `nx test demo` by hand. It is also the app the demo-coverage gate holds
      // up as proof every export is demonstrated — so it breaking silently would
      // undermine that gate too.
      '--projects=kernel,angular,react,demo,react-reference',
      '--parallel=1',
      '--skip-nx-cache',
    ],
    slow: true,
    // Break a React assertion to prove the all-project runner includes that
    // package rather than merely compiling kernel.
    mutation: {
      file: 'packages/react/src/use-signal-tree.spec.tsx',
      find: 'expect(renders).toBe(initialRenders);',
      replace: 'expect(renders).toBe(initialRenders + 1);',
    },
  },
  {
    name: 'lint:budget',
    covers: 'eslint errors across all 10 projects, AND warnings never grow',
    // Replaces a bare `npm run lint:all`, which this harness caught passing
    // while an unused `any`-typed function sat in core: lint reported it as a
    // warning and exited 0, because nothing passes --max-warnings. Warnings
    // exist in the hundreds, so --max-warnings 0 is not available; the budget
    // ratchets instead. The live count is printed by the gate itself and is
    // deliberately NOT repeated here — a number duplicated into a comment is a
    // number that goes stale, and this one already did (it said 577 against an
    // actual 746, while check-lint-budget.mjs's own comment said 684).
    cmd: ['node', 'tools/check-lint-budget.mjs'],
    slow: true,
    // A `debugger` statement, because it is an eslint ERROR and errors fail this
    // gate regardless of the warning budget.
    //
    // The mutation was `export function __gateMutation(x: any)`, which adds
    // exactly one `no-explicit-any` WARNING — and a ratchet only fails when a
    // project EXCEEDS its baseline. Two warnings had been paid down without
    // running `--update`, leaving 540 recorded against 538 live, so the single
    // added warning landed inside that headroom and the gate passed while
    // broken. An audit caught it.
    //
    // `no-debugger` does the job: 0 errors/10 warnings becomes 1 error/10.
    //
    // Dropping `export` — the obvious fix — appeared not to work, and the
    // reason is worth more than the fix. Measured:
    //
    //     function __gateMutation(x: any) { … }   0 errors, 11 warnings
    //     function gateMutation(x: any)   { … }   1 ERROR,  11 warnings
    //     const    gateBloat: any = 1;            1 ERROR,  11 warnings
    //
    // `no-unused-vars` is severity 2 and fires perfectly well. It ignored the
    // mutation because this harness names its mutations `__gate*` and the rule
    // is configured with `varsIgnorePattern: '^_'`. THE MUTATION NAMING
    // CONVENTION SILENTLY DISABLED THE RULE THAT WOULD HAVE CAUGHT IT. A first
    // pass concluded from that "the rule does not fire for unused declarations"
    // — a general claim drawn from a fixture carrying an invisible confound,
    // which is the same defect this harness exists to catch, committed while
    // fixing this harness. Corrected by the independent auditor.
    //
    // `debugger` is still the better mutation, but for a different reason than
    // first stated: it is NAME-INDEPENDENT, so no ignore-pattern can absorb it.
    // `check-lint-budget.mjs`'s own header already said "a `debugger` statement
    // in utils.ts does fail it"; the mutation just never used it.
    //
    // The general rule, and the reason this was blind for two days: a proof
    // that depends on a RECORDED NUMBER staying current is only as good as the
    // discipline of whoever last paid a warning down. An error-based mutation
    // cannot be absorbed by slack.
    mutation: {
      file: 'packages/kernel/src/lib/utils.ts',
      append: '\nfunction __gateMutation() {\n  debugger;\n}\n',
    },
  },
  {
    name: 'built-barrels',
    covers: 'every source export survives into the built barrel',
    cmd: ['node', 'tools/verify-built-barrels.mjs'],
    needsBuild: true,
    mutation: {
      file: 'dist/packages/kernel/dist/index.js',
      find: 'export { signalTree }',
      replace: 'export { signalTree as signalTreeRenamedByGateSelfTest }',
    },
  },
  {
    name: 'devmode-foldable',
    covers: 'diagnostics fold away when a consumer defines ngDevMode=false',
    cmd: ['node', 'tools/check-devmode-foldable.mjs'],
    needsBuild: true,
    // No mutation: the gate builds its own fixtures with esbuild and asserts on
    // the OUTPUT, so there is no single input file whose corruption it must
    // catch. Proving it would mean shipping a deliberately unfoldable fixture
    // through the same pipeline — worth doing, not yet done.
    // Proven by its own --self-test gate below: if a tool builds its own
    // inputs, the self-test builds a BAD one.
    provenBy: 'devmode-foldable:self',
  },
  {
    name: 'devmode-foldable:self',
    covers:
      'the foldability checker detects a surviving literal AND a non-shrinking bundle',
    cmd: ['node', 'tools/check-devmode-foldable.mjs', '--self-test'],
    needsBuild: true,
    mutation: {
      file: 'tools/check-devmode-foldable.mjs',
      find: "const WARN_ONLY_CODES = ['ST2001', 'ST2002', 'ST2003', 'ST2007'];",
      replace: 'const WARN_ONLY_CODES = [];',
    },
  },
  // REMOVED WITH THE PACKAGE: 'angular-compat'.
  //
  // Its whole subject was `@signaltree/ng-forms/signals`, which required
  // Angular 22 while the main ng-forms entry had to stay importable on Angular
  // 20 — the gate checked that the main entry could not transitively reach
  // Signal Forms. NGF-DEL deleted both entries, so `ENTRY_FLOORS` is empty and
  // its mutation target no longer exists: the gate could no longer fail, which
  // is the blind condition this suite rejects.
  //
  // The INVARIANT is still real and still general — an entry point must not
  // reach an API above its own Angular floor. It has no subject today because
  // no shipped entry declares a floor above its package's peer range. Re-add
  // it, with the same transitive-reachability check, the moment one does.
  {
    name: 'version-claims',
    covers: 'every documented Angular-version claim matches peerDependencies',
    cmd: ['node', 'scripts/verify-version-claims.js'],
    mutation: {
      file: 'packages/angular/package.json',
      find: '"@angular/core": "^20.0.0 || ^21.0.0 || ^22.0.0"',
      replace: '"@angular/core": "^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0"',
    },
  },
  {
    name: 'exports-importable',
    covers: 'every package export can actually be imported',
    cmd: ['node', 'scripts/verify-exports.js'],
    needsBuild: true,
    // Ran nowhere: an npm script nothing invoked, absent from CI. It passed the
    // whole time, which is the only reason that was survivable.
    mutation: {
      file: 'dist/packages/kernel/package.json',
      find: '"import": "./dist/index.js"',
      replace: '"import": "./dist/does-not-exist.js"',
    },
  },
  {
    name: 'tree-shaking',
    covers: 'an unused enhancer does not survive into a consumer bundle',
    cmd: ['node', 'scripts/test-tree-shaking.js'],
    needsBuild: true,
    provenBy: 'tree-shaking:self',
  },
  {
    name: 'tree-shaking:self',
    covers:
      'the tree-shaking checker detects code pulling in a forbidden module',
    cmd: ['node', 'scripts/test-tree-shaking.js', '--self-test'],
    needsBuild: true,
    // Targets the DETECTION, not the reporting. A first attempt replaced the
    // exit code with a constant 0, which is tautological — breaking how a check
    // reports proves nothing about whether it can see anything. Emptying the
    // forbidden list means the planted case no longer trips detection, which is
    // the failure that matters.
    mutation: {
      file: 'scripts/test-tree-shaking.js',
      find: "  shouldNotInclude: ['devtools'],\n};",
      replace: '  shouldNotInclude: [],\n};',
    },
  },
  {
    name: 'sanity',
    covers: 'workspace smoke/parity checks',
    cmd: ['node', 'scripts/sanity-checks.js'],
    needsBuild: true,
    // Four file-exists/contains greps. Largely redundant — if signal-tree.ts
    // went missing, typecheck, build and 1,500 tests would all fail long before
    // a string grep did — but it costs ~0.2s and it can now prove itself.
    // Retargeted when @signaltree/enterprise was removed in 14.0.0 — the file
    // this used to mutate no longer exists, and a missing anchor is a hard error
    // rather than a silent skip, which is how it surfaced immediately.
    mutation: {
      file: 'packages/kernel/src/enhancers/batching/batching.ts',
      generate: (original) =>
        original.replace(/batching/g, 'renamedByGateSelfTest'),
    },
  },
  {
    name: 'package-hygiene',
    covers: 'no junk in any tarball, and every declared entry is present',
    cmd: ['node', 'scripts/verify-package-hygiene.js'],
    needsBuild: true,
    provenBy: 'package-hygiene:self',
  },
  {
    name: 'package-hygiene:self',
    covers: 'the hygiene checker flags junk and a missing required entry',
    cmd: ['node', 'scripts/verify-package-hygiene.js', '--self-test'],
    needsBuild: true,
    mutation: {
      file: 'scripts/verify-package-hygiene.js',
      find: "  { re: /\\.spec\\./, why: 'test spec' },",
      replace: '',
    },
  },
  {
    name: 'api-baseline',
    covers:
      'the committed public API baseline matches the built surface — no ' +
      'undeclared export added or removed',
    cmd: ['node', 'tools/api-inventory.mjs', '--check'],
    needsBuild: true,
    // ⚠️ THE CHECK EXISTED AND RAN NOWHERE. `--check` has been in the tool the
    // whole time, wired to no gate and no CI job — so the baseline drifted
    // silently: it still recorded `./security` and `./storage` entrypoints long
    // after those subpaths stopped shipping, and 71 symbols against a real 69.
    // A baseline nothing verifies is a memo, not a gate.
    mutation: {
      file: 'packages/kernel/src/index.ts',
      append: '\nexport const __surfaceDrift = 1;\n',
    },
  },
  {
    name: 'source-controls',
    covers:
      'no raw NUL or unexpected C0 control character in any tracked source',
    cmd: ['node', 'tools/check-source-controls.mjs'],
    // Earned by a real incident: an invisible NUL reached committed source,
    // propagated into the script written to fix it, and was found only because
    // Python refused to parse that script. TypeScript, ESLint and the tests were
    // all blind to it — which is the argument for a gate that reads BYTES.
    mutation: {
      file: 'packages/kernel/src/lib/constants.ts',
      find: 'export',
      replace: '\u0000export',
    },
  },
  {
    name: 'spec-types:hygiene',
    covers:
      'every spec-type baseline entry addresses a SURVIVING spec — a bound ' +
      'attached to no surviving subject is not protection',
    cmd: ['node', 'tools/check-spec-types.mjs', '--self-test'],
    // 13 entries for deleted specs had accumulated, each reporting a phantom
    // "improvement" that buried the three real ones. Prune, never --update:
    // rebaselining would convert every current improvement into the new ceiling.
    mutation: {
      file: 'tools/spec-type-baseline.json',
      find: '  "files": {',
      replace:
        '  "files": {\n    "packages/kernel/src/lib/__gone__.spec.ts": 1,',
    },
  },
  {
    name: 'kernel-neutrality',
    covers:
      'every declared-neutral kernel root has an Angular-free TRANSITIVE TYPE ' +
      'closure — type-only edges included',
    cmd: ['node', 'tools/check-kernel-neutrality.mjs'],
    // The spike found the kernel's own file Angular-free while its 27-file type
    // closure carried six tainted members, through two single-symbol imports
    // that named a re-exporting hub instead of the defining module. Runtime
    // probes cannot see this: the RUNTIME closure was already clean. Public
    // contracts are types, so the type closure is the property worth gating.
    mutation: {
      file: 'packages/kernel/src/lib/internals/physical-commit-clock.ts',
      find: "import { isTraversableNode } from './node-shape';",
      replace: "import { isTraversableNode } from '../utils';",
    },
  },
  {
    name: 'kernel-neutrality:self',
    covers:
      'the closure walker itself — pointed at the known-tainted Angular ' +
      'runtime, it must report taint',
    cmd: ['node', 'tools/check-kernel-neutrality.mjs', '--self-test'],
    mutation: {
      file: 'tools/check-kernel-neutrality.mjs',
      find: 'const FRAMEWORK_IMPORT =',
      replace:
        'const FRAMEWORK_IMPORT = /(?!)/g; const __unusedFrameworkImport =',
    },
  },
  {
    name: 'source-controls:self',
    covers:
      "the NUL detector itself — a checker whose only evidence is 'found " +
      "nothing' is indistinguishable from one that cannot find anything",
    cmd: ['node', 'tools/check-source-controls.mjs', '--self-test'],
    mutation: {
      file: 'tools/check-source-controls.mjs',
      find: 'const ALLOWED = new Set([0x09, 0x0a, 0x0d]);',
      replace: 'const ALLOWED = new Set([0x09, 0x0a, 0x0d, 0x00]);',
    },
  },
  {
    name: 'readme-apis:teaching',
    covers:
      'the retired-API half of the doc gate — proven separately because one ' +
      'mutation cannot exercise two independent checks',
    cmd: ['node', 'scripts/lint-readme-apis.mjs'],
    needsBuild: true,
    // ⚠️ THE IMPORT CHECK WAS NOT THE WHOLE GATE, and for a long time it was
    // the only half that existed. `readme-apis` already ran in CI and passed
    // while docs/ai/LLM.md taught `stored(key, default)` in a marker table,
    // taught the retired `status<E>()` beside it, and named `serialization()`
    // as the persistence enhancer — because a table teaches without importing.
    //
    // So the gate grew a second check, and a second check needs its own proof:
    // this mutation re-teaches a deleted API in the AI-facing document, which is
    // the file an agent reads first.
    mutation: {
      file: 'docs/ai/LLM.md',
      append: '\n```ts\nconst theme = stored("theme", "light");\n```\n',
    },
  },
  {
    name: 'readme-apis',
    covers:
      'every @signaltree symbol named in a shipped README or live doc exists, ' +
      'and no live doc EXAMPLE teaches a retired API',
    cmd: ['node', 'scripts/lint-readme-apis.mjs'],
    needsBuild: true,
    // READMEs ship inside the tarball. A user's first action is copying an
    // import out of one, and nothing checked that the symbol existed: the first
    // run found 13 dead references across four packages.
    mutation: {
      file: 'packages/kernel/README.md',
      append:
        "\n```ts\nimport { thisSymbolDoesNotExist } from '@signal-tree/kernel';\n```\n",
    },
  },
  {
    name: 'dead-exports',
    covers:
      'no NEW export is unreachable from every entry point and every import',
    // BACK TO ZERO, and the 110 is gone rather than lowered.
    //
    // That budget was parked under noise. The scanner asked "is this reachable
    // from the public barrel?" of `internals/` modules, which are by design not
    // public, so 126 of its 134 leads were the declared option/result types of
    // functions the module itself uses — false positives a number cannot fix.
    // Rule 4 (referenced elsewhere in its own file) removed them, leaving 8 real
    // orphans, and all 8 were deleted: five from the materialized-projection
    // removal, an uncalled test hook, an unused alias, and `isSignalTree`, which
    // tested `'with' in value` and had therefore returned false for every tree
    // since 223b355a.
    //
    // Zero is the honest number now. A new unreachable export is a regression,
    // not one more on a pile — which is what the ratchet said before the pile
    // grew back.
    cmd: ['node', 'tools/find-dead-exports.mjs', '--max=0'],
    mutation: {
      file: 'packages/kernel/src/lib/utils.ts',
      append: '\nexport const __gateUnreachableExport = 1;\n',
    },
  },
  {
    name: 'angular-coupling-budget',
    covers:
      'Angular RUNTIME coupling (value-position use) never grows — the C6 ratchet',
    // Zero is the eventual target and is deliberately NOT asserted yet: core IS
    // the Angular adapter for this release, so a zero assertion would be a
    // permanently red gate, and a normally-red gate teaches people to ignore it.
    // The ratchet is honest today and tightens as C6 lands.
    cmd: ['node', 'tools/check-angular-coupling-budget.mjs'],
    mutation: {
      file: 'packages/kernel/src/lib/internals/tracking-suppression.ts',
      append:
        "\nimport { untracked } from '@angular/core';\nexport const __gateCoupling = () => untracked(() => 1);\n",
    },
  },
  {
    name: 'c6-neutrality-invariants',
    covers:
      'an ordinary Angular leaf stays the framework cell itself — no wrapper, no second reactive graph, no per-read allocation',
    // The DETERMINISTIC half of the C6 performance requirement. Wall-clock lives
    // in tools/bench-c6-baseline.mjs, which records and does not gate, because
    // timings move with the machine and these facts do not.
    cmd: [
      'npx',
      'vitest',
      'run',
      '--root',
      'packages/angular',
      'src/lib/angular-realization-invariants.spec.ts',
    ],
    mutation: {
      file: 'packages/angular/src/lib/angular-realization.ts',
      find: '      signal(initial, equal ? { equal } : undefined),',
      replace: '      ((() => initial) as any),',
    },
  },
  {
    name: 'numeric-claims',
    covers:
      'every measured figure on a live surface names a tool that produces it — ratcheted, so new ungenerated numbers cannot land',
    cmd: ['node', 'tools/check-numeric-claims.mjs'],
    provenBy: 'numeric-claims:self',
  },
  {
    name: 'numeric-claims:self',
    covers:
      'the numeric-claims scanner detects a figure in a section that names no generator, and clears it once one is named',
    cmd: ['node', 'tools/check-numeric-claims.mjs', '--self-test'],
    // Every other `:self` gate mutates its own CHECKER; this one shipped with no
    // mutation at all, so the harness marked it `unproven` and SKIPPED it — and
    // then credited `numeric-claims` as "proven via numeric-claims:self", a
    // proof by a gate that never ran. Blinding the CLAIM pattern makes the
    // scanner see no figures, so its self-test can no longer detect the
    // ungenerated one it plants.
    mutation: {
      file: 'tools/check-numeric-claims.mjs',
      find: 'const CLAIM =',
      replace: 'const CLAIM = /(?!)/g; const __unusedClaim =',
    },
  },
  {
    name: 'release-claims',
    covers:
      'every symbol/code ADDED since the last release tag reaches every surface that claims to describe the library',
    // The one gate that runs API -> claim. Every other one runs claim -> API,
    // which cannot see a capability that shipped and was never written up:
    // you can grep for a symbol a doc names, not for one it fails to name.
    // Two things got through that blind spot in this release alone — the
    // AI-priming surfaces (`49dd9ffb`, found by hand) and the capability
    // matrix, which still carried ❌ for five capabilities the same release
    // shipped and had been edited TWICE after they landed.
    cmd: ['node', 'tools/check-release-claims.mjs'],
    // Deleting a shipped capability from a live claim surface must fail. Chosen
    // over a synthetic export because it reproduces the ACTUAL defect: the API
    // is fine, the claim surface is the thing that went stale.
    // The mutation must name a symbol that is IN THE CURRENT DELTA, or it proves
    // nothing: the gate only inspects what this release added, so blanking a
    // symbol from an older release is invisible to it. `prependOne` shipped in
    // 14.0.0, which sat outside the window, so the previous mutation targeted
    // a symbol outside the window and the harness correctly reported this gate
    // BLIND. runInvalidationGroup is in the RC1-to-v15 delta and appears once
    // in the kernel README. The production gate's base advances with each RC,
    // so its proof pins that historical delta.
    mutationCmd: [
      'node',
      'tools/check-release-claims.mjs',
      '--base=v15.0.0-rc.1',
    ],
    mutation: {
      file: 'packages/kernel/README.md',
      find: 'runInvalidationGroup',
      replace: '__gateRemovedFromPriming',
    },
  },
  {
    name: 'rc-public-dispositions',
    covers:
      'every RC public symbol has release authority; settled negative dispositions are absent from tarballs',
    cmd: ['node', 'tools/check-rc-public-dispositions.mjs'],
    provenBy: 'rc-public-dispositions:self',
  },
  {
    name: 'rc-public-dispositions:self',
    covers:
      'the RC public-disposition checker catches blocked symbols and permits allowed symbols',
    cmd: ['node', 'tools/check-rc-public-dispositions.mjs', '--self-test'],
    mutation: {
      file: 'tools/check-rc-public-dispositions.mjs',
      find: "symbol: 'asyncSource',",
      replace: "symbol: '__gateMissedAsyncSource',",
    },
  },
  {
    name: 'demo-coverage',
    covers:
      'every ROOT-barrel export is demonstrated in the demo app — not node methods or type-only declarations',
    cmd: ['node', 'tools/check-demo-coverage.mjs'],
    needsBuild: true,
    // Adding a root export with no demo must fail. This is the stronger of the
    // two reachability checks: dead-exports asks whether anything IMPORTS a
    // symbol, this asks whether anything SHOWS it to a person.
    mutation: {
      file: 'dist/packages/kernel/dist/index.js',
      append: '\nexport const __gateUndemoedExport = 1;\n',
    },
  },
  {
    name: 'dead-exports:self',
    covers: 'the reachability scan itself is neither too narrow nor too broad',
    cmd: ['node', 'tools/find-dead-exports.mjs', '--self-test'],
    // Removing package source from the scan makes public API discovery and the
    // planted-dead-export probe fail. This catches the checker becoming too
    // narrow without depending on now-deleted package subpaths.
    mutation: {
      file: 'tools/find-dead-exports.mjs',
      find: "const SCAN_ROOTS = ['packages', 'apps', 'tools', 'scripts'];",
      replace: "const SCAN_ROOTS = ['apps', 'tools', 'scripts'];",
    },
  },
  // ── Measurement harnesses ────────────────────────────────────────────────
  // These gate on the HARNESS still working, not on its numbers. Timings move
  // with the machine, so asserting them would make the suite flaky and teach
  // people to ignore it; what rots silently is the harness itself — an arm that
  // stops constructing, a postcondition whose API moved. Run at smoke sizes
  // (1.5s rather than minutes); the published numbers come from a full run.
  {
    name: 'bench-harness',
    releaseOnly: true,
    covers:
      'all 4 benchmark arms construct, run, and satisfy their postconditions',
    cmd: ['node', '--expose-gc', 'tools/bench-compare.mjs', '--n', '200'],
    needsBuild: true,
    // The postconditions live in the child. Breaking the undo call makes the
    // signaltree arm restore nothing — exactly the idle-arm bug that was
    // published once as "20x faster than elf".
    mutation: {
      file: 'tools/bench-compare.mjs',
      find: '      impl.undo();',
      replace: '      void impl;',
    },
  },
  {
    name: 'history-ownership-bench',
    releaseOnly: true,
    covers:
      'the 6 Phase 0A ownership arms construct, run, keep owner-path postconditions honest, and preserve the current decision-20 verdict contract',
    cmd: [
      'node',
      '--expose-gc',
      'tools/bench-history-ownership.mjs',
      '--smoke',
      '--require-verdict',
      'INCONCLUSIVE',
    ],
    needsBuild: true,
    mutation: {
      file: 'tools/bench-history-ownership.mjs',
      find: "    ownerPath = 'rows';",
      replace: "    ownerPath = '__gateWrongOwner';",
    },
  },
  {
    name: 'memory-harness',
    releaseOnly: true,
    covers:
      'every memory scenario runs under forced GC and reports collectability',
    cmd: ['node', '--expose-gc', 'tools/memory-report.mjs'],
    needsBuild: true,
    // Removing --expose-gc from the child would measure allocation instead of
    // retention — the error already on record at 8x.
    mutation: {
      file: 'tools/memory-report.mjs',
      find: "    ['--expose-gc', new URL(import.meta.url).pathname, '--scenario', name],",
      replace: "    [new URL(import.meta.url).pathname, '--scenario', name],",
    },
  },
  {
    name: 'memory-compare',
    releaseOnly: true,
    covers:
      'all 4 cross-library memory arms construct and measure a marginal slope',
    cmd: ['node', '--expose-gc', 'tools/memory-compare.mjs', '--n', '1000'],
    needsBuild: true,
    // Anchored on the child's dispatch, NOT on its unknown-arm branch: the
    // first attempt injected a throw into `if (!build)`, which never executes
    // for a valid arm, so the mutation ran nothing and the gate looked blind
    // when it was the mutation that was inert.
    mutation: {
      file: 'tools/memory-compare.mjs',
      find: '  const build = ARMS[name];',
      replace: "  const build = name === 'elf' ? null : ARMS[name];",
    },
  },
  {
    name: 'update-matrix',
    covers:
      'every arm of the cross-library update matrix constructs, runs and satisfies its postconditions',
    // NOT a performance budget and must not become one — timings move with
    // machine load far more than with code. What this proves is that all four
    // arms still BUILD and that every operation's postcondition fires, so a
    // silently dropped write cannot be reported as the fastest arm in the
    // table. The numbers are read by a human from
    // docs/architecture/v15-update-matrix-baseline.md.
    cmd: [
      'node',
      '--expose-gc',
      'tools/bench-update-matrix.mjs',
      '--axis',
      'consumers',
      '--samples',
      '1',
    ],
    slow: true,
    needsBuild: true,
    mutation: {
      // Break the write so it lands nowhere. Every arm's postcondition reads
      // back what it wrote, so this must fail; a harness that timed a no-op
      // would report the broken arm as the fastest one here.
      file: 'tools/bench-update-matrix.mjs',
      find: '      updateOne: (id, changes) => tree.$.rows.updateOne(id, changes),',
      replace: '      updateOne: () => undefined,',
    },
  },
  {
    name: 'bounded-history-retention',
    covers:
      'a tree with a BOUNDED restoration() does not retain retired subjects without bound',
    // WAS REGISTERED RED, and closed by Step 8. Kept as a live gate rather than
    // deleted: it is the only check that a bounded `restoration()` tree has
    // bounded retained memory, which is a property two separate mechanisms have
    // to keep working — claim release at the eviction boundary, and the
    // per-subject prune of the realization descriptors. Either one silently
    // regressing puts the slope straight back.
    //
    // Its threshold was also too weak once and briefly reported a false green
    // over a run that grew 6.8 -> 54 MB; see the note in the probe.
    cmd: ['node', '--expose-gc', 'tools/probe-bounded-history-retention.mjs'],
    slow: true,
    needsBuild: true,
    provenBy: 'bounded-history-retention:self',
  },
  {
    name: 'bounded-history-retention:self',
    covers:
      'the retention verdict rejects the pre-fix table AND the 8.1x table its first threshold accepted',
    // This row exists because the gate above was briefly WRONG rather than
    // merely absent. Its threshold was `ratio < roundRatio / 2`, which at 16x
    // the rounds accepts anything under 8x; a run growing 6.8 -> 54 MB measured
    // 8.1x and reported BOUNDED. A gate that can bless an eight-fold increase
    // is not a weaker gate, it is a false witness, and the only durable defence
    // is a fixture of the exact table it accepted.
    cmd: ['node', 'tools/probe-bounded-history-retention.mjs', '--self-test'],
    // Blind the VERDICT rather than one fixture — same reason recorded on
    // `retired-subject-slope:self`.
    mutation: {
      file: 'tools/probe-bounded-history-retention.mjs',
      find: '  return ratio < 2;',
      replace: '  return ratio < 999;',
    },
  },
  {
    name: 'retired-subject-slope',
    covers:
      'retention does not grow with the number of subjects that have retired — the asymptotic claim a byte budget cannot express',
    // 117 B/retired passes any budget stable enough to keep, and 117 B/retired
    // is unbounded growth. So this measures the same workload at 50 and 150
    // rounds and fails if the total scales with the retirements rather than
    // sitting flat. It regressed once already, when a step inside the retirement
    // re-interned the forgotten subject by id and turned 6 B into 79 B.
    cmd: ['node', '--expose-gc', 'tools/check-retired-subject-slope.mjs'],
    slow: true,
    needsBuild: true,
    provenBy: 'retired-subject-slope:self',
  },
  {
    name: 'retired-subject-slope:self',
    covers:
      'the slope checker rejects the pre-fix linear table and accepts the measured flat one',
    cmd: ['node', 'tools/check-retired-subject-slope.mjs', '--self-test'],
    // Blind the VERDICT, not one input to it.
    //
    // Registered blind on the first attempt by widening MAX_BYTES_PER_RETIRED
    // alone: the ratio condition still caught the linear fixture, so the
    // self-test kept passing while its target was broken. Two conditions means a
    // single-input mutation proves nothing — same trap recorded on
    // `signal-identity-durability:self` above.
    mutation: {
      file: 'tools/check-retired-subject-slope.mjs',
      find: '  return problems;',
      replace: '  return [];',
    },
  },
  {
    name: 'restoration-turn-capacity',
    covers:
      'maxHistorySize retains completed designated turns exactly: omitted defaults, zero retains none, and positive N retains N',
    cmd: ['node', 'tools/verify-restoration-capacity.mjs'],
    needsBuild: true,
    mutation: {
      file: 'tools/verify-restoration-capacity.mjs',
      find: '  { capacity: 5, expected: 5 },',
      replace: '  { capacity: 5, expected: 4 },',
    },
  },
  {
    name: 'signal-identity-durability',
    covers:
      'a live consumer keeps receiving updates across garbage collection — the property the test suite structurally cannot check',
    // The suite has no forced GC, so it cannot observe this. That is not
    // theoretical: holding entitySignals weakly (the policy nodeCache already
    // uses) passed all 1,791 core tests, cut post-read residue from 1,054 to
    // 498 B/entity and cut churn from 798 to 249 B/retired -- while silently
    // leaving live consumers serving stale values. A computed re-fetches its
    // signal per read rather than holding it, so its dependency edge does not
    // reliably keep the signal reachable; the write then finds a cleared
    // WeakRef and skips.
    //
    // This gate is the acceptance criterion for any change to signal retention.
    // Note the mutation below (never intern) is ALSO caught by the suite -- it
    // proves the gate can fail, not that the gate is uniquely necessary. The
    // failure it uniquely caught, weak interning, is a multi-line change and
    // cannot be expressed as a one-line mutation here.
    cmd: ['node', '--expose-gc', 'tools/check-signal-identity-durability.mjs'],
    slow: true,
    needsBuild: true,
    provenBy: 'signal-identity-durability:self',
  },
  {
    name: 'signal-identity-durability:self',
    covers:
      'the durability checker detects a non-durable identity map and accepts a durable one',
    cmd: [
      'node',
      '--expose-gc',
      'tools/check-signal-identity-durability.mjs',
      '--self-test',
    ],
    // Break the DURABLE side of the fixture so the checker can no longer tell
    // durable from non-durable and its own assertions stop holding. Forcing
    // `detectsLeak = true` instead left the self-test still passing, which is
    // how this mutation was first registered BLIND.
    mutation: {
      file: 'tools/check-signal-identity-durability.mjs',
      find: 'if (m === durable) m.set(k, s);',
      replace: 'void m;',
    },
  },
  {
    name: 'memory-consistency',
    covers:
      'the retained-heap table is internally possible — no scenario measures less than a scenario it strictly contains',
    // The defect this replaces was not a wrong number, it was an IMPOSSIBLE
    // pair: `entityMap 10k` published 59.95 MB while the same collection plus a
    // materialised node for all 10,000 rows published 18.03 MB. That is an
    // ablation in which doing strictly more work retains 42 MB less, and it was
    // read as evidence for weeks. Its cause was a `yieldBeforeMeasure` flag set
    // on one scenario, so two arms were read at different points on the
    // reclamation curve.
    //
    // `memory-harness` above already ran this exact report and passed the
    // whole time the impossible pair was in it. It proves the tool REFUSES to
    // run without --expose-gc; it never reads what the tool printed. That is
    // the gap — a harness gate that checks the harness starts, not that its
    // output could be true.
    //
    // Deliberately an ORDERING check and not a budget: pinning the absolute MB
    // would fail on every legitimate improvement, and would not have caught
    // this — both numbers were individually plausible. It is also deliberately
    // blind to a protocol that is uniformly wrong, because a uniform protocol
    // still produces a self-consistent table; what it catches is asymmetry
    // between arms, which is the defect class that shipped.
    cmd: ['node', '--expose-gc', 'tools/check-memory-harness.mjs'],
    slow: true,
    releaseOnly: true,
    needsBuild: true,
    provenBy: 'memory-consistency:self',
  },
  {
    name: 'memory-consistency:self',
    covers:
      'the containment checker rejects the exact 59.95/18.03 table that shipped, and accepts a consistent one',
    cmd: [
      'node',
      '--expose-gc',
      'tools/check-memory-harness.mjs',
      '--self-test',
    ],
    // Emptying CONTAINMENTS is the honest mutation: a checker with no pairs
    // passes everything, which is precisely the state the repo was in before
    // this gate existed — the lesson was written in memory-report.mjs's header
    // ("strictly more data cannot retain less") and enforced by nothing.
    mutation: {
      file: 'tools/check-memory-harness.mjs',
      find: 'const CONTAINMENTS = [',
      replace: 'const CONTAINMENTS = []; const __unusedContainments = [',
    },
  },
  {
    name: 'historical-ab-isolation:self',
    covers:
      'the historical-A/B isolation checker rejects a comparison whose two arms are the same build (NOT full proof of a historical comparison — see the file header)',
    // There is no unconditional live form of this gate: it needs a historical
    // build to exist, which only happens during an A/B. What it protects is
    // real and already bit once — NX_WORKSPACE_ROOT_PATH is set in this
    // environment, so `nx build` from a worktree (or from a detached
    // `git archive` extract with its own node_modules) silently compiles the
    // MAIN tree's source into the MAIN tree's dist. The "historical" arm is then
    // HEAD, the ratio is fiction, and the main dist has been overwritten
    // underneath whatever else is measuring against it.
    //
    // That happened twice while attributing the setAll regression and was
    // caught only because the two captured artifacts were byte-identical.
    // Run the live form during any historical comparison:
    //   node tools/check-historical-ab-isolation.mjs --old <barrel> --new <barrel> \
    //     --marker lib/internals/production-substrate-stats.js --expect-marker new
    cmd: ['node', 'tools/check-historical-ab-isolation.mjs', '--self-test'],
    // Make the identical-build detection unreachable: the checker then passes
    // an A/B comparing a build with itself, which is precisely the state it
    // exists to refuse.
    mutation: {
      file: 'tools/check-historical-ab-isolation.mjs',
      find: '  if (a.digest === b.digest) {',
      replace: '  if (false && a.digest === b.digest) {',
    },
  },
  {
    name: 'state-scale',
    releaseOnly: true,
    covers:
      'the O(1)-write thesis, measured against @ngrx/signals and elf on both axes',
    cmd: ['node', 'tools/bench-state-scale.mjs', '--quick'],
    needsBuild: true,
    // Every arm asserts its write landed. Breaking the signaltree write makes
    // the postcondition fire — the check that the benchmark is not measuring an
    // idle arm, which this repo has published once already.
    mutation: {
      file: 'tools/bench-state-scale.mjs',
      find: '    for (let w = 0; w < WRITES; w++) tree.$.k0.v.set(w);\n  });\n\n  const store = createStore({ name: `flat${size}` }',
      replace:
        '    for (let w = 0; w < WRITES; w++) void w;\n  });\n\n  const store = createStore({ name: `flat${size}` }',
    },
  },
  {
    name: 'raw-signals',
    releaseOnly: true,
    covers:
      'the "why not raw signals" arms construct, interleave, and their postconditions fire',
    cmd: [
      'node',
      'tools/bench-raw-signals.mjs',
      '--writes',
      '5000',
      '--consumers',
      '10',
    ],
    needsBuild: true,
    // Every arm asserts its write landed (SENTINEL). Breaking the raw write
    // makes the postcondition fire — the guardrail against an idle arm, and
    // against the arm-order contamination this tool's first draft shipped.
    mutation: {
      file: 'tools/bench-raw-signals.mjs',
      find: '  for (let i = 0; i < WRITES; i++) field.set(i + round * WRITES);\n  const ns = Number(process.hrtime.bigint() - t) / WRITES;\n  sink += field();',
      replace:
        '  for (let i = 0; i < WRITES; i++) void (i + round * WRITES);\n  const ns = Number(process.hrtime.bigint() - t) / WRITES;\n  sink += field();',
    },
  },
  {
    name: 'size-compare',
    releaseOnly: true,
    covers: 'cross-library gzip cost is measurable for both libraries',
    cmd: ['node', 'tools/size-compare.mjs'],
    needsBuild: true,
    // It printed ERROR for a failed build and exited 0 until now — the same
    // defect bench-compare and memory-compare had. A size claim published from
    // a table with the inconvenient row silently missing is the risk.
    mutation: {
      file: 'tools/size-compare.mjs',
      find: "  import { createStore, withProps, select } from '@ngneat/elf';",
      replace:
        "  import { nothing } from '@ngneat/this-package-does-not-exist';",
    },
  },
  {
    name: 'size-report',
    releaseOnly: true,
    covers:
      'every published package builds and its tree-shaken size is measurable',
    cmd: ['node', 'tools/size-report.mjs'],
    needsBuild: true,
    // It refuses to report against a missing build rather than printing zeros,
    // which is the failure mode that matters for a REPORTER: a size table built
    // from nothing looks like a very good result.
    mutation: {
      file: 'dist/packages/kernel/dist/index.js',
      generate: () => '',
    },
  },
  {
    name: 'spec-types',
    covers:
      'spec files are typechecked (they were covered by NOTHING) — ratcheted per file, so a renamed public config option cannot silently void a test',
    cmd: ['node', 'tools/check-spec-types.mjs'],
    slow: true,
    // The concrete escape this closes: `entityMap({ selectId, history })` in
    // restoration-scoped-capture.spec.ts, where `history` had been renamed to
    // `recordHistory` in 14.1.1. tsconfig.typecheck-all.json excludes
    // `**/*.spec.ts` and core's typecheck config covers only *.typing.spec.ts,
    // so nothing typechecked it; esbuild strips types without checking. Both
    // arms of the test built an identical default tree and its equality
    // assertion passed vacuously.
    //
    // ⚠️ ANCHOR MOVED TWICE, and both moves are worth knowing.
    //   1. The 15.0 declarative-construction codemod reformatted the original
    //      call site across lines and the single-line anchor stopped matching.
    //      The self-test reported ERROR rather than silently passing, which is
    //      the behaviour to preserve if it happens again.
    //   2. 15.0 then DELETED `recordHistory` itself, taking the anchored call
    //      site with it. Re-anchored on a surviving `entityMap` config literal —
    //      the mechanism under test is "an unknown option in a spec's entityMap
    //      config is a type error", which never depended on that option existing.
    mutation: {
      file: 'packages/kernel/src/enhancers/restoration/turn-effect-composition.spec.ts',
      find: '    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },',
      replace:
        '    { rows: entityMap<Row, string>({ selectId: (r) => r.id, bogusOption: 1 }) },',
    },
  },
  {
    name: 'retention-gc',
    covers:
      'the GC-requiring retention proofs: a diagnostic journal releases the values it described once its bounded record is evicted, and a persistence() tree is released by destroy() (both three-armed: control dies -> held lives -> released dies)',
    // Runs outside `nx test kernel` because it needs --expose-gc, and it FAILS
    // rather than skips without it: a WeakRef that is merely eligible for
    // collection proves nothing, and a skipped retention test reads as evidence.
    cmd: [
      'npx',
      'vitest',
      'run',
      '--root',
      'packages/kernel',
      '--config',
      'vitest.retention.config.ts',
    ],
    env: { NODE_OPTIONS: '--expose-gc' },
    mutation: {
      file: 'packages/kernel/src/enhancers/serialization/a2-5-lifetime.spec.ts',
      find: "    if (mode === 'destroyed') (tree as Persisted).destroy?.();",
      replace: "    if (mode === 'destroyed') void tree;",
    },
  },
  {
    name: 'documented-imports',
    covers:
      'every import specifier a LIVE document teaches resolves against the published export map — the documented -> publishable edge no other gate checks',
    cmd: ['node', 'tools/check-documented-imports.mjs'],
    // Earned by RELEASE-RESIDUE-0: the shipped core README taught
    // `@signaltree/ng-forms` (deleted in 41373050) and
    // `@signal-tree/kernel/enhancers/batching` (never an export), while the root
    // README taught three subpaths that resolve to nothing. lint-readme-apis
    // could not see any of it — a specifier for a path that is not an entry
    // point is checked against nothing.
    mutation: {
      file: 'packages/kernel/README.md',
      append:
        "\n```ts\nimport { missing } from '@signal-tree/kernel/not-exported';\n```\n",
    },
  },
  {
    name: 'documented-symbols',
    covers:
      "a package barrel's own API-SUMMARY list does not advertise a symbol the barrel fails to export — the symbol-level complement to documented-imports' specifier-level check",
    cmd: ['node', 'tools/check-documented-symbols.mjs'],
    // Earned by A2-REOPEN. `c53aa416` ("remove stored marker from public rc
    // surface") swept the READMEs, guides and demo but left
    // "- `stored(key, default)`" in core's own API summary, and `serialization`
    // stopped being exported before Candidate A while still being advertised
    // there. Every gate stayed green: lint-readme-apis does not read source
    // files, and documented-imports checks paths rather than names.
    provenBy: 'documented-symbols:self',
  },
  {
    name: 'documented-symbols:self',
    covers:
      'the barrel-summary checker rejects an advertised-but-unexported symbol, accepts an exported one, and skips `.method` entries',
    cmd: ['node', 'tools/check-documented-symbols.mjs', '--self-test'],
    mutation: {
      file: 'tools/check-documented-symbols.mjs',
      find: '  if (!scope) return claims;',
      replace: '  return claims;',
    },
  },
  {
    name: 'documented-imports:self',
    covers:
      'the documented-import checker accepts a real entry point and rejects both a bogus subpath and a bogus package',
    cmd: ['node', 'tools/check-documented-imports.mjs', '--self-test'],
    mutation: {
      file: 'tools/check-documented-imports.mjs',
      find: 'const PACKAGES = packageDirsByName();',
      replace: 'const PACKAGES = new Map();',
    },
  },
  {
    name: 'error-codes',
    covers:
      'every diagnostic code the packages can emit is in docs/errors/README.md, and the catalogue invents none',
    cmd: ['node', 'tools/check-error-codes.mjs'],
    // Was short by two when written: ST1031 and ST1032 were emittable and
    // documented nowhere. The earlier sweep missed them because it compared
    // COUNTS on the ST2xxx series (27 vs 27) instead of comparing the sets.
    // Mutate a LIVE code, not a retired one. This pointed at ST1031, which
    // SEC-DEL then marked "Retired in 15.0" — and the checker exempts retired
    // rows, so renaming one exempt row to another exempt row changed nothing
    // and the gate registered BLIND. A mutation is only a proof while its
    // target is still something the checker can object to.
    mutation: {
      file: 'docs/errors/README.md',
      find: '| ST1001 |',
      replace: '| ST9999 |',
    },
  },
  {
    name: 'error-codes:self',
    covers:
      'the catalogue checker detects a removed code AND reports the catalogue in sync without the probe',
    cmd: ['node', 'tools/check-error-codes.mjs', '--self-test'],
    // Blind the code pattern. The scanner then finds no codes at all, so its
    // self-test cannot notice the one it deletes from the catalogue — a
    // `:self` gate with no mutation is skipped, and the harness would credit
    // `error-codes` as "proven via error-codes:self" on a proof that never ran.
    mutation: {
      file: 'tools/check-error-codes.mjs',
      find: 'const CODE =',
      replace: 'const CODE = /(?!)/g; const __unusedCode =',
    },
  },
  {
    name: 'declaration-docs',
    covers:
      'a package whose source carries JSDoc ships JSDoc in its shipped .d.ts',
    cmd: ['node', 'tools/check-declaration-docs.mjs'],
    needsBuild: true,
    // Five of seven packages shipped declarations with ZERO JSDoc, because
    // `removeComments: true` is the only TS switch for keeping comments out of
    // emitted JS and it strips `.d.ts` too. core/src/lib/types.ts carried 476
    // JSDoc lines and its shipped types.d.ts carried 0, so a consumer hovering
    // `maxHistorySize` got no description and no `@default 50`. Nothing caught
    // it: bundle-budget measures bundled JS, api-surface compares symbol names,
    // package-hygiene checks presence. Comments now stay in both outputs and the
    // strip plugin in tools/build/create-rollup-config.mjs removes them from JS.
    //
    // Kernel declarations are bundled to the public entry surface, so their
    // source ratio intentionally excludes private docs. Raise the measured
    // public-doc ratchet by one to prove the aggregate gate catches any loss.
    mutation: {
      file: 'tools/check-declaration-docs.mjs',
      find: 'kernel: 243,',
      replace: 'kernel: 244,',
    },
  },
  {
    name: 'declaration-docs:self',
    covers:
      'the declaration-docs checker flags a stripped declaration set AND reports clean at the real ratio',
    cmd: ['node', 'tools/check-declaration-docs.mjs', '--self-test'],
    needsBuild: true,
    // Blind the JSDoc counter. Every package then reports zero source blocks, so
    // the self-test has no documented package to probe with and must refuse to
    // run rather than pass vacuously — otherwise `declaration-docs` gets
    // credited on a proof that never happened.
    mutation: {
      file: 'tools/check-declaration-docs.mjs',
      find: '(text.match(/\\/\\*\\*/g) ?? []).length',
      replace: '0',
    },
  },
  {
    name: 'doc-links',
    covers:
      'every relative link resolves AND every install instruction names a publishable package (archive/CHANGELOG excluded as point-in-time)',
    cmd: ['node', 'tools/check-doc-links.mjs'],
    // A link is a claim about the repository. 28 were broken when this landed,
    // five of them in files that ship inside the npm tarballs — where a README
    // is immutable for the life of a published version. `readme-apis` checks
    // that every SYMBOL a README names exists; nothing checked that a PATH did.
    mutation: {
      file: 'docs/README.md',
      generate: (original) =>
        `${original}\n\n[gate mutation](./__no_such_doc_4b1e__.md)\n`,
    },
  },
  {
    name: 'doc-links:self',
    covers:
      'the link checker flags a missing target AND reports the repo clean without one',
    cmd: ['node', 'tools/check-doc-links.mjs', '--self-test'],
    // Make every target look resolvable. The self-test then plants a link to a
    // missing file and sees nothing wrong, which is exactly the failure a
    // `:self` gate exists to rule out.
    mutation: {
      file: 'tools/check-doc-links.mjs',
      find: 'ok: existsSync(resolved),',
      replace: 'ok: true,',
    },
  },
  {
    name: 'publish-manifests',
    covers:
      'the BUILT manifests are installable off this machine — no workspace/file/link protocols, internal ranges admit the versions shipping beside them',
    // Found by the 15.0 release rehearsal, not by any existing check. Every
    // internal dependency was `"@signal-tree/kernel": "workspace:*"`, and whether
    // that reached the registry depended on which command was run:
    // `npm pack` from dist ships it SILENTLY, `pnpm pack` from dist refuses,
    // and `nx release version` rewrites only `version`. A manifest defect fails
    // no build, no test and no import in this repository — it fails once, for
    // every consumer, after publish.
    cmd: ['node', 'tools/check-publish-manifests.mjs'],
    needsBuild: true,
    provenBy: 'publish-manifests:self',
  },
  {
    name: 'publish-manifests:self',
    covers:
      'the manifest checker rejects `workspace:*` and a range that admits nothing, and its comparator handles prereleases',
    // Registered BLIND on the first attempt, by blinding BAD_PROTOCOLS while
    // the repository was already clean: with nothing left to catch, the
    // mutation passed. A checker on a clean tree can only prove itself against
    // FIXTURES of the defects it exists to stop.
    cmd: ['node', 'tools/check-publish-manifests.mjs', '--self-test'],
    // Blind the SHARED inspection, which is the code the real run and the
    // fixtures both execute. Two earlier attempts registered blind: blinding
    // `failures.length > 0` changed nothing on a clean tree, and blinding
    // `BAD_PROTOCOLS` alone was still caught by the unparsable-range path — the
    // checker was not actually blind, so the self-test was right to pass.
    mutation: {
      file: 'tools/check-publish-manifests.mjs',
      find: '  return found;\n}',
      replace: '  return [];\n}',
    },
  },
  {
    name: 'publish-artifacts',
    covers: 'every declared `files` entry of every package resolves in dist',
    cmd: ['node', 'scripts/prepare-publish-artifacts.mjs'],
    needsBuild: true,
    // npm does NOT warn when a `files` glob matches nothing — the tarball just
    // ships light. Removing a real entry's source must fail here, because
    // nothing downstream will notice.
    mutation: {
      file: 'dist/packages/kernel/package.json',
      find: '"files": [',
      replace: '"files": [\n    "this-entry-matches-nothing/**/*",',
    },
  },
  {
    name: 'consumer-types',
    covers:
      'packed kernel and framework declarations compile with skipLibCheck=false under bundler and node16 resolution',
    cmd: ['node', 'tools/verify-consumer-typecheck.mjs'],
    needsBuild: true,
    mutation: {
      file: 'dist/packages/angular/src/index.d.ts',
      find: "import './lib/carrier.js';",
      replace: "import './lib/carrier';",
    },
  },
  {
    name: 'bundle-budget',
    covers: 'built package sizes stay inside their budgets',
    cmd: ['node', 'tools/check-bundle-budget.mjs'],
    needsBuild: true,
    // Appends statically-reachable, incompressible code to a SOURCE file that
    // every measured entry pulls in transitively.
    //
    // It targeted the BUILT barrel (`dist/.../index.js`) and was BLIND: the gate
    // gained an `ensureBuilt()` that rebuilds `dist/` before measuring, so it
    // erased its own mutation and then measured a clean bundle. The gate passed
    // while its target was broken — found by an independent audit.
    //
    // Three properties, and the mutation needs all three. MEASURED, each shape
    // run against the real gate:
    //
    //   (globalThis as any).__gateBloat = [...]   exit 1, BUDGET  13.69/5.9KB  ✅
    //   export const __gateBloat = [...]          exit 0, tree-shaken away     ❌
    //   globalThis.__gateBloat = [...]            exit 1, BUILD fails (TS7017) ❌
    //
    // - SIDE-EFFECTING, not an export: esbuild keeps a top-level assignment and
    //   drops an unreferenced export entirely.
    // - INCOMPRESSIBLE: gzip flattens a repeated string and the budget would not
    //   move.
    // - VALID TYPESCRIPT: `globalThis.__gateBloat` is TS7017 in a `.ts` file, so
    //   the bare form fails the BUILD instead of the BUDGET. That still exits 1,
    //   and this harness counts any non-zero exit as proven — which would have
    //   left the gate "proven" by a check of the compiler, not of the budget.
    //   The cast is what makes the proof mean what it says.
    mutation: {
      file: 'packages/kernel/src/lib/utils.ts',
      generate: (original) => {
        const parts = [];
        for (let i = 0; i < 900; i++) {
          parts.push(`gateBloat_${i.toString(36)}_${(i * 2654435761) % 1e9}`);
        }
        return `${original}\n(globalThis as any).__gateBloat = ${JSON.stringify(
          parts
        )};\n`;
      },
    },
  },
  {
    name: 'publish-architecture',
    covers:
      'every shell and CI registry path delegates to the canonical candidate publisher',
    cmd: ['node', 'scripts/verify-publish-architecture.mjs'],
    mutation: {
      file: '.github/workflows/publish.yml',
      find: "if: github.repository == 'JBorgia/signal-tree'",
      replace: "if: github.repository == 'JBorgia/signaltree'",
    },
  },
  {
    name: 'publish-authorization',
    covers:
      'the canonical publisher retains its managed npm credential fallback',
    cmd: ['node', 'scripts/verify-publish-architecture.mjs'],
    mutation: {
      file: '.github/workflows/publish.yml',
      find: 'NPM_TOKEN: ${{ secrets.NPM_TOKEN }}',
      replace: 'NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}',
    },
  },
  {
    name: 'release-plan',
    covers:
      'the canonical release set matches publishable manifests and orders kernel before adapters',
    cmd: ['node', 'scripts/release-plan.mjs', '--json'],
    mutation: {
      file: 'scripts/release-plan.mjs',
      find: "['kernel', 'angular', 'react']",
      replace: "['angular', 'kernel', 'react']",
    },
  },
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');

if (has('--list')) {
  for (const g of GATES) {
    console.log(
      `${g.name.padEnd(20)} ${g.mutation ? 'provable' : 'UNPROVEN'}  ${
        g.covers
      }`
    );
  }
  process.exit(0);
}

/**
 * `releaseOnly` gates are skipped by default.
 *
 * Every gate here answers one question: would a USER be hurt if this broke? For
 * most of them the answer is yes — a missing export, a bundle regression, dev
 * code shipping to production, a tarball that will not install.
 *
 * The seven measurement harnesses answer no. They verify that BENCHMARKS RUN —
 * that the arms construct and produce a number. Nobody consuming this library
 * is harmed if `bench-compare.mjs` stops working; the harm is that a published
 * figure becomes unregenerable, which matters at release and not before. They
 * cost 7s of every run to protect against that, so they now run with
 * `--release` and are skipped otherwise.
 *
 * Read the same way if you are tempted to add a gate: a gate that cannot name
 * the user it protects is overhead, and overhead in a checking system is worse
 * than overhead elsewhere, because it dilutes the meaning of a green board.
 */
const selected = GATES.filter(
  (g) =>
    (!only || only.includes(g.name)) &&
    !(has('--fast') && g.slow) &&
    !(!has('--release') && !only && g.releaseOnly)
);

/**
 * Build once, before any gate that reads `dist/`.
 *
 * `needsBuild` was declared on 23 gates and READ BY NOTHING. It looked like
 * machinery and was documentation, so every one of those gates ran against
 * whatever happened to be in `dist/` — and `npm run build` was separately
 * broken (it named a project with no build target and exited 1), so what
 * happened to be there could be many commits old. `npm run gates`, the command
 * that decides whether a release is ready, could pass green on an artifact
 * nobody had rebuilt since before the work it was clearing.
 *
 * The flag now does what its name says. Nx caches, so a fresh tree costs a
 * cache hit; a stale one costs the build, which is the correct price for a
 * verdict about code.
 *
 * A build FAILURE is fatal rather than a skip: gates that read a missing or
 * half-written `dist/` produce noise, and "the build is broken" is the finding,
 * not a footnote to twenty-three other failures.
 */
const BUILD_PROJECTS = 'kernel,angular,react';

function buildOnceIfNeeded() {
  if (!selected.some((g) => g.needsBuild)) return;
  const names = selected.filter((g) => g.needsBuild).length;
  console.log(`\n· building packages — ${names} gate(s) read dist/`);
  try {
    execFileSync(
      'npx',
      ['nx', 'run-many', '-t', 'build', `--projects=${BUILD_PROJECTS}`],
      { cwd: ROOT, stdio: 'pipe', env: process.env }
    );
  } catch (err) {
    console.error(
      `\n❌ Build failed. ${names} gate(s) read dist/, so running them now ` +
        `would report on stale or missing output.\n\n` +
        String(err.stdout ?? err.message).slice(-2000)
    );
    process.exit(1);
  }
}

buildOnceIfNeeded();

function run(gate) {
  try {
    const output = execFileSync(gate.cmd[0], gate.cmd.slice(1), {
      cwd: ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
      // A gate may need its own environment — `retention-gc` needs
      // --expose-gc to reach vitest's forked workers, which a `node --expose-gc`
      // command line would NOT do.
      env: gate.env ? { ...process.env, ...gate.env } : process.env,
    });
    return { code: 0, output };
  } catch (err) {
    return {
      code: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

const hash = (s) => createHash('sha256').update(s).digest('hex');

/** Apply, run, restore. Restoration is verified, not assumed. */
function withMutation(mutation, fn) {
  const path = join(ROOT, mutation.file);
  if (!existsSync(path))
    throw new Error(`mutation target missing: ${mutation.file}`);
  const original = readFileSync(path, 'utf8');
  const before = hash(original);

  let mutated;
  if (mutation.generate) {
    // For mutations that cannot be written as a literal — the bundle-budget one
    // needs INCOMPRESSIBLE bytes, since a repeated string gzips to nothing and
    // would leave the budget unmoved, i.e. an inert mutation masquerading as a
    // blind gate.
    mutated = mutation.generate(original);
  } else if (mutation.append) {
    mutated = original + mutation.append;
  } else {
    if (!original.includes(mutation.find)) {
      throw new Error(
        `mutation anchor not found in ${mutation.file} — the gate's target moved, ` +
          `so this self-test has been silently testing nothing. Fix the anchor.`
      );
    }
    mutated = original.replace(mutation.find, mutation.replace);
  }
  if (mutated === original)
    throw new Error(`mutation was a no-op in ${mutation.file}`);

  try {
    writeFileSync(path, mutated);
    return fn();
  } finally {
    writeFileSync(path, original);
    if (hash(readFileSync(path, 'utf8')) !== before) {
      console.error(
        `\n  FATAL: could not restore ${mutation.file}. Tree is dirty.`
      );
      process.exit(2);
    }
    // Restoring the SOURCE is not enough when the gate rebuilt from it.
    //
    // `check-bundle-budget.mjs` builds before it measures, so mutating a source
    // file makes it write the mutation INTO `dist/` — and the hash check above
    // only ever looked at the file it wrote. dist stayed poisoned: after one
    // self-test run, `size-report.mjs` measured the bare tree at 13.69KB
    // against a true 5.79KB, because 8KB of mutation payload was still sitting
    // in the built artifact.
    //
    // That is the ORIGINAL stale-dist bug wearing new clothes — dist no longer
    // matching source, with nothing noticing — reintroduced by the fix for it.
    // A mutation harness has to restore DERIVED artifacts too, not just the
    // files it edited.
    if (mutation.file.startsWith('packages/')) {
      try {
        execFileSync(
          'npx',
          ['nx', 'run-many', '-t', 'build', `--projects=${BUILD_PROJECTS}`],
          { cwd: ROOT, stdio: 'pipe', env: process.env }
        );
      } catch {
        console.error(
          `\n  FATAL: restored ${mutation.file} but could not rebuild dist/. ` +
            `Built output still contains the mutation — run \`npm run build\`.`
        );
        process.exit(2);
      }
    }
  }
}

const results = [];

if (has('--self-test')) {
  console.log(
    `\nGate self-test — each gate must FAIL against its own mutation\n`
  );
  for (const gate of selected) {
    if (!gate.mutation) {
      if (gate.provenBy) {
        // Not unproven — proven INDIRECTLY, by a companion gate that mutates the
        // checker itself. Counted as proven so the summary is not pessimistic,
        // and named so the link is visible rather than assumed.
        results.push({ gate, state: 'proven-by' });
        console.log(
          `  · ${gate.name.padEnd(20)} proven via ${gate.provenBy} ✓`
        );
        continue;
      }
      results.push({ gate, state: 'unproven' });
      console.log(`  ~ ${gate.name.padEnd(20)} UNPROVEN — ${gate.unproven}`);
      continue;
    }
    process.stdout.write(
      `  · ${gate.name.padEnd(20)} mutating ${gate.mutation.file} ... `
    );
    let result;
    try {
      result = withMutation(gate.mutation, () =>
        run(gate.mutationCmd ? { ...gate, cmd: gate.mutationCmd } : gate)
      );
    } catch (err) {
      results.push({ gate, state: 'error' });
      console.log(`ERROR\n      ${err.message}`);
      continue;
    }
    if (result.code !== 0) {
      results.push({ gate, state: 'proven' });
      console.log(`caught it (exit ${result.code}) ✓`);
    } else {
      results.push({ gate, state: 'blind' });
      console.log(
        `\n      BLIND: the gate passed while its own target was broken.\n` +
          `      It covers: ${gate.covers}\n` +
          `      Right now it covers nothing.`
      );
    }
  }
} else {
  console.log(`\nRunning ${selected.length} gates\n`);
  for (const gate of selected) {
    process.stdout.write(`  · ${gate.name.padEnd(20)} `);
    const result = run(gate);
    const ok = result.code === 0;
    results.push({
      gate,
      state: ok ? 'pass' : gate.knownFailing ? 'known' : 'fail',
    });
    console.log(
      ok
        ? `pass ✓  (${gate.covers})`
        : gate.knownFailing
        ? `RED, known ✗  ${gate.knownFailing}`
        : `FAIL (exit ${result.code}) ✗  ${gate.covers}`
    );
    if (!ok && result.output.trim()) {
      const diagnostic = result.output.trim();
      console.log(
        `\n${diagnostic.slice(Math.max(0, diagnostic.length - 100000))}\n`
      );
    }
  }
}

// ── Summary: what was covered, not merely that it passed ────────────────────
const count = (s) => results.filter((r) => r.state === s).length;
console.log(`\n${'─'.repeat(78)}`);

if (has('--self-test')) {
  const proven = count('proven') + count('proven-by');
  console.log(
    `${proven}/${selected.length} gates PROVEN able to fail ` +
      `(${count('proven-by')} indirectly, via a companion self-test gate). ` +
      `${count('unproven')} unproven, ${count('blind')} blind, ${count(
        'error'
      )} errored.`
  );
  for (const r of results.filter((r) => r.state === 'unproven')) {
    console.log(`  unproven: ${r.gate.name} — ${r.gate.unproven}`);
  }
  for (const r of results.filter((r) => r.state === 'blind')) {
    console.log(`  BLIND:    ${r.gate.name} — passed while broken`);
  }
  const bad = count('blind') + count('error');
  process.exit(bad > 0 ? 1 : 0);
} else {
  console.log(
    `${count('pass')}/${selected.length} passed, ` +
      `${count('fail')} failed, ${count('known')} known-red.`
  );
  if (has('--fast')) {
    const heldBack = GATES.filter((g) => g.releaseOnly).map((g) => g.name);
    if (!has('--release') && heldBack.length) {
      console.log(
        `  release-only (run with --release): ${heldBack.join(', ')}`
      );
    }
    const skipped = GATES.filter((g) => g.slow).map((g) => g.name);
    console.log(
      `  --fast SKIPPED: ${skipped.join(', ')} — this run did not cover them.`
    );
  }
  process.exit(count('fail') > 0 ? 1 : 0);
}
