# Independent final SDK candidate review

No blocker demonstrated for the exact candidate on the installed peers tested here. The corrected Vue path preserves the previously lost fresh dependency error. Angular's bounded own-error fallback passes the preserved same-sentinel dependency controls and the candidate's cycle controls. This is bounded feasibility evidence, not approval across every declared peer version, activation, or release.

## Source identity and coordination

Candidate: `/private/tmp/st-current-read-capability-proof`, archived base commit `87f6831fa60cafe87508f0ace84b7638698ca3b0`. Main checkout HEAD remains `628d302dadb082a48c58528651c9088234d0a777`; the candidate is separate from it. Inspected the nine-file source delta and actual carrier/peer declarations. Read the owner decision and repository review/contributor/support contracts. No runtime/source edits were made.

All 21 listed source/test hashes in the author's `proof-evidence/SOURCE-IDENTITY.json` matched before capture and after execution. Captured exact files and replay controls in `/private/tmp/st-sdk-final-independent-ts_rtj21/`. Dependencies are linked to the candidate, not frozen copies; installed versions are recorded in `compatibility-identity.json`.

- Angular adapter: `1f9cb608b815fa234ba82b66aba385a08d8f8f54e4476b42599b810e73a53424`
- Vue adapter: `cd1d1276fe946a7166f68addb3ca08a1375980ce82c816a47092fc8719fc2bce`
- SDK entry: `85c18646c455d1a445cdfd9ab9450fcda143664058a9e87ecc4763a542048910`

No Helmholtz task/message endpoint was exposed by the available tools. Wrote `proof-evidence/INDEPENDENT-FINAL-FREEZE-REQUEST.md` in the shared candidate evidence directory. Direct receipt/freeze acknowledgment is unconfirmed. The verdict attaches to these verified hashes regardless of later edits. No other reviewers' conclusions were read.

## Contract determinations

**Vue error handling:** `packages/vue/src/lib/vue-observation.ts:55–75` has no catch-and-reread branch. A dependency error thrown during native polling before the outer recipe executes propagates unchanged. The preserved independent falsifier now records the same sentinel for native and candidate, with outer sourceRuns=1 and innerRuns=2. It no longer returns the stale successful value. Fresh own-error identity and recovery without publication also pass on Vue 3.5.42.

**Angular own-error/cycles:** `packages/angular/src/lib/observation-adapter.ts:16–62` only permits cached-error fallback when the thrown value matches its remembered own-recipe failure; an evaluated frame propagates the current error. Nested native cycle detection records the fault so it is not subsequently classified as an own-recipe failure. The preserved eight native/candidate × direct/live × same/different-sentinel controls all retain the fresh dependency error. Candidate cycle tests retain the initial cycle error identity and do not rerun the recipe on the second cached-cycle read. This establishes these cases, not a universal provenance theorem for every possible custom dependency or peer implementation.

Angular live-consumer polling can execute the outer recipe before the wrapper's invocation, then the wrapper performs its fresh source read: the same-sentinel control records three total outer executions rather than the native control's two. The error remains unchanged. This is explicitly recorded; successful controls do not establish identical total recipe counts to native-only computation. The freshness/native-cache distinction requires this qualification.

**Carriers and timing:** `packages/angular/src/lib/carrier.ts` and `packages/vue/src/lib/carrier.ts` are byte-for-byte identical to the retained Git base. Angular retains `Signal<T>`; Vue retains `ComputedRef<T>` for readonly leaves. Actual installed Angular types require the callable plus `[SIGNAL]`; Vue types retain readonly value and the deprecated effect property. Angular proxies the same computed; Vue wraps one computed of the same readCurrent and retains its effect identity. No new private node access or mutation is present. Stable metadata, readonly assignment refusal, lazy construction, dynamic dependency switch/cleanup, and held/ABA new-consumer controls pass. Native-only known-bad ABA controls still fail as expected while the candidate returns the final source value. An application computed warmed before held source changes stays cached until publication; the candidate does not eagerly advance it.

**Ordinary cached Vue readonly flag:** Independently compared the retained baseline file to `git show 87f6831f:packages/vue/src/lib/vue-observation.ts`; they match. The old wrapper already defines `__v_isReadonly: true`. The candidate retains that definition and its default reader still reads source.value. The baseline/candidate executable control reports isReadonly=true and value X after raw changes to A, with one recipe execution for each. There is no new ordinary-cached readonly flag change in this candidate.

**Legacy classification/migration:** `packages/kernel/src/adapter.ts:87–108` keeps the existing conjunction of writable-cell, writable-projection and readonly-cell factories. Masks 0–6 remain portable; mask 7 is native and now requires a callable current-read capability before tree construction. This is the owner-approved behavioral migration, not compatibility-free addition merely because the interface member is optional. Tests exercise the six partial masks, neutral mask 0, rejected unmigrated mask 7 before initial getters/tokens/native factory calls, and migrated routing. The internal default factory remains portable. Capability errors propagate rather than silently returning a bare callable. Factory binding preserves method receiver and captures the supplied capability before later replacement. No unsupported-native fallback was found.

The public burden remains one optional neutral SDK method plus explicit native adapter migration, with unchanged framework carrier declarations. It does not authorize weaker carrier types or make existing native adapters silently eligible for a reduced guarantee.

## Executed controls and commands

Pinned Node: `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node`.
Snapshot root below is `/private/tmp/st-sdk-final-independent-ts_rtj21`.

```sh
node /private/tmp/st-sdk-final-independent-ts_rtj21/st-current-reader-independent-controls.mjs /private/tmp/st-sdk-final-independent-ts_rtj21
node /private/tmp/st-sdk-final-independent-ts_rtj21/st-current-reader-marker-error-controls.mjs /private/tmp/st-sdk-final-independent-ts_rtj21
node /private/tmp/st-sdk-final-independent-ts_rtj21/angular-same-sentinel.mjs
node /private/tmp/st-sdk-final-independent-ts_rtj21/vue-readonly-baseline.mjs
```

All exit 0. Raw logs: `independent.log` (12 rows including intentionally bad comparison controls), `marker.log`, `sentinel.log` (8 variants), `readonly.log`. Preserved originals were not changed. The copied same-sentinel control only retargets its adapter import; the copied readonly control only retargets its candidate import.

From candidate root, with pinned Node bin first in PATH:

```sh
NX_DAEMON=false pnpm nx run-many -t test -p kernel angular vue solid react --parallel=1 --skip-nx-cache -- selected-callback-facade current-read-capability --maxWorkers=2
node tools/check-spec-types.mjs
```

Both exit 0. Focused Nx: 46 tests across 8 files (kernel 19, React 3, Angular 10, Vue 10, Solid 4). The Vue test target also runs its configured spec TypeScript check. Spec-types gate reports OK with existing baseline improvements; no ratchet was edited. Logs: `nx-focused.log`, `spec-types.log`. Nx emitted a nonfatal pre-existing historical tsconfig-path resolution diagnostic referring to a missing `/private/tmp/st-unknown-access-candidate/tsconfig.typecheck-all.json`; this is preserved, not reported as a clean diagnostic-free run.

## Supported-peer limits and remaining checks

Executed: Angular 22.0.7, Vue 3.5.42, Solid 1.9.15, React 19.2.8, TypeScript 6.0.3. Angular declares `^20.0.0 || ^21.0.0 || ^22.0.0`; Vue declares `^3.5.0`. Error polling/caching and cycle behavior make extrapolation to the entire range unwarranted. Heisenberg's separate minimum-peer matrix remains necessary evidence for that wider determination. It must identify exact source and peer versions, not inherit this result by framework name.

Not rerun: all package tests, packed-consumer builds/Node16-Bundler type checks, production build, full release gates, or minimum-peer matrix. No release conclusion is made. Source inspection plus unchanged carrier declarations and the spec-types result do not substitute for exact packed-artifact verification.

Prior rejected Vue source and its first failing control remain at `/private/tmp/st-marker-error-identity-MPO0cU/`; their identity has not been overwritten. This final review supersedes that failure only for the exact corrected hashes above.
