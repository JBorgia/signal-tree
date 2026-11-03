# Bounded v16 current-read SDK proof — frozen

Installed-peer proof complete; no production activation or release conclusion.
The exact source/packed artifacts are frozen for Heisenberg's separate peer matrix.
Main checkout and v15 are untouched. No shared-history operation or external CLI
review/source transmission was performed.

## Source and artifacts

- Base: `87f6831fa60cafe87508f0ace84b7638698ca3b0`, Git tree `10e6be502fda139bb16ab7a72c426efc86ce8888`.
- Base archive SHA256: `f68758a1fda1ccb3198098f97d1f0c4b254ce2def039c602d291b2deb72595ad`.
- Scratch: `/private/tmp/st-current-read-capability-proof`, newly archived; separate from rejected repair.
- [Source patch](source.patch): `98e4180b0700ade7a90fc5263552ce998522b9830fd25bc760fad550661089fa`.
- [Tests patch](tests.patch): `f29d16d9eaec396f951e63b32eb7953627d4c11d6084492d8ffd91c0c02cb9a5`.
- [Combined patch](candidate.patch): `c8db0ed469e42b425b3299204bca86965f59cf4880c3b7e06707ceb24d9b048c`.
- [SOURCE-IDENTITY.json](SOURCE-IDENTITY.json): all 9 changed source files + 12 new test/type files match Hume's 21-file review.
- Source-identity SHA256: `10a5d0a4548e7e2da88328d072e0b6b3878633298bd356aee8849ab973614d72`.
- [ARTIFACT-FREEZE.json](ARTIFACT-FREEZE.json) lists every emitted declaration and four exact tarball hashes.
- [Matrix handoff](CANDIDATE-HANDOFF.md) is also written to `/private/tmp/st-current-reader-peer-matrix/CANDIDATE-HANDOFF.md`.
- `git apply --check ../candidate.patch` from `proof-evidence/patch-base`: exit 0. No patch applied outside scratch.

## Final behavior and public burden

Only approved SDK addition: optional `ObservationAdapter.createCurrentReadonlyCell<T>(readCurrent: () => T): ReadableCell<T>`.
Kernel routes callback-acquired current reads through realization. Selection truth
is kernel-owned and available during held publication; later callback writes survive.
No public barrel exports or carrier types are added/weakened.

Each Angular/Vue realization has one native computed of the same source, stable
metadata, and an invocation marker. A native evaluation during this direct read
supplies its result; a reused native cache is followed by one source-current read.
Direct held reads see restored A and newer C, while a warmed app computed retains
X and its execution count until publication. New held consumers survive ABA.
Native reads still establish real dependencies; cleanup and readonly checks pass.
Solid uses its stable accessor. Neutral/React retain callable current reads.

Vue has no error fallback: a pre-recipe dependency-poll error propagates unchanged.
Angular retries only the matching remembered own-recipe failure; fresh recipe
errors and detected nested native/cycle faults propagate. Hume's same-sentinel
controls and candidate cycle tests pass on the installed peers; this is not a
universal provenance theorem across every future dependency or framework version.

Direct invocation counts are one source execution on cold, cached and invalidated
reads, preserving exact returned object identity. Native polling can separately
execute a recipe before wrapper invocation: Angular live error/recovery control
records two executions per publication versus native control's one. See
[observer-counts-final.log](observer-counts-final.log). No identical whole-graph
recipe-count claim is made. Real held `where`/`find`, nested queries and errors pass.

Existing full-trio classification alone requires migration; rejection precedes
state getters, tokens and native construction. Masks 0–6 remain portable; their
unused native factory members are never called. Capability-only remains portable.
Method receiver/snapshot survives the owner-bound wrapper. Existing epoch hooks
are bound too so passing the bound adapter preserves native epoch behavior.
[ENFORCEMENT.md](ENFORCEMENT.md) records the source basis; the earlier any-method
interpretation is withdrawn and preserved in ENFORCEMENT-FIRST.md.

Ordinary Vue cells already had `__v_isReadonly: true` in retained source.
Baseline and candidate both report readonly=true, held X, recipe count 1;
[baseline control](vue-readonly-baseline.log). Ordinary flag semantics did not change.

## Executed gates on the frozen source

| Gate | Result | Raw record |
| --- | --- | --- |
| Byte-identical Angular/Vue original public callback tests | 0 each, one pass + one filtered private case each | angular-exact.log, vue-exact.log |
| Hume actual-adapter controls | 0; expected-bad comparison controls remain bad | independent-final.log |
| Hume marker-error oracle after correction | 0; exact fresh Vue sentinel retained | marker-error-final.log |
| Focused Nx, all five facades + boundary/error/query tests | 0; 46 passed / 8 files | post-review-focused.log |
| Source typecheck | 0 | post-review-typecheck.log |
| Spec types, unchanged ratchet | 0 | post-review-spec-types.log |
| Final full five-project suite | 0; 6484 passed, 5 expected failures, 15 skipped | all-tests-final.log |
| Canonical kernel/Angular/Vue/Solid build | 0 | build-first.log |
| Four local npm packs | 0 each; all 151 packed files byte-match canonical dist | pack-*.log, ARTIFACT-FREEZE.json |
| Strict packed consumer, Bundler / Node16 | 0 / 0; skipLibCheck=false | consumer-*-final.log |
| Packed runtime native migration + portable masks | 0 | consumer-runtime.log |
| Five real source mutants | all 5 killed by assertion, source restored | MUTATION-REPORT.md |
| Post-mutant restoration focused suite | 0; 46 passed | restored-focused.log |

The full final suite used the same frozen hashes; it was not repeated after
mutants because all sources were restored byte-for-byte. Earlier all-tests-first
passed before corrections and is not the acceptance source. Its complete source
snapshot was not captured: no invented exact-source qualification is attached.
Known rejected adapter bytes/hashes remain under rejected-blind-error-fallback/.

Packed consumer fixtures resolve actual tarball contents without declaration edits
or source path aliases. They cover emitted actual adapters, optional legacy source
assignability, explicit migration, preserved Signal/ComputedRef/Accessor types and
negative readonly/invalid-capability checks. Runtime rejects legacy native adapters
before a state getter and accepts migrated adapters/portable masks. The standard
all-five-package network-install release consumer gate was not run; this was the
bounded four-artifact offline consumer proof. Package manifests remain canonical
workspace manifests, not release-finalized manifests.

## Preserved failures and review boundary

Exact original failures and 14 prior evidence hashes remain unchanged at
`/private/tmp/st-selected-projection-repair/repair-evidence/`.
Hume's Vue bug reproduced before correction: marker-error-before.log exits 1,
returns stale X instead of the fresh dependency error. Its rejected source is saved.
Other first failures are retained: observer error-timing harness assumption, Angular
TypeScript narrowing error, overly broad partial-adapter policy, consumer fixture
path/dependency setup, initial dependency-clone race and wrong patch-check cwd.
None is relabeled as a passing result or repaired by weakening a test/type contract.

[Independent final review](INDEPENDENT-FINAL-REVIEW.md): no tested-peer blocker.
Tested: Angular 22.0.7, Vue 3.5.42, Solid 1.9.15, React 19.2.8, TS 6.0.3, Node 24.15.0.
Angular 20/21 and Vue 3.5.0 artifact matrix remains separate, owned by Heisenberg.
No peer-range, ceiling, production/demo, deployment or release acceptance is implied.
All source/tests and four packages are frozen; remaining writes are evidence only.
