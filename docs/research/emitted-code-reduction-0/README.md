# V16 emitted-code reduction audit

Owner declined higher ceilings on 2026-10-14 and requested an audit of obsolete or unnecessary machinery. Budgets remain unchanged.

## Measured reduction

Base is G1 `4b37f3fca9194cadb393d108ad6194e4418a12bc` plus the reviewed point-owner lookup (now local commit `d70d7d95`). The archived P1 build graph supplies the before artifact; input hashes and the generator are in `attribution.json` and `attribute.mjs`. After artifacts were freshly produced from the same source with the recorded changes, using Node 24.15.0 and the repository Rollup configurations. The explicit-close build wrapper is recorded in the adjacent disposition-cost evidence; its build returned only after every output write/close completed. Rollup emitted pre-existing semantics-composition TS4111 warnings; build success is not claimed as a clean declaration diagnostic.

| Fixture | Before gzip bytes | After gzip bytes | Reduction |
| --- | ---: | ---: | ---: |
| bare production | 11930 | 11919 | 11 |
| entities production | 27431 | 26893 | 538 |

The fixtures use the bundle gate's browser/minification/external/define/gzip options. These are deterministic size observations, not CPU or application-memory benchmarks. Scalar equality-pass sharing alone gives 11919/27418 bytes. Remaining reductions come from the entity changes together; no per-edit gzip attribution is claimed.

Current gate: bare 11.64/13.99 KiB and entities 26.26/29.07 KiB production/development. Both fail unchanged ceilings. Fresh production demo initial size is 562.67 kB, down from the prior recorded 565.08 kB but still above its 550 kB error ceiling. These demo figures are uncompressed Angular budget units, not library gzip units.

## Retained changes

1. Share scalar frame validation/equality collection only. Prepared and direct installation bodies remain distinct and unchanged, including option-access order, counters, reentry and single-use guards. An earlier broader install-sharing draft was rejected during independent source review: it changed accessor-option evaluation and instrumented counter ordering. It was never integrated. Its exact source was not archived before revision; the discussion/hash and counterexample description remain in session history. No executed behavioral failure is claimed for that draft.
2. Ordinary rekey retains its missing-row, no-op and occupied-destination checks, then delegates to the existing prepared execution body. Prepared topology callers retain their different validation contract. No publication or participation order changed.
3. Delete unused numeric restore-index implementation and its only helper. Live anchor-based restore remains.
4. Move the complete private-index integrity witness into the spec, preserving every check and both existing callsites. Add two negative controls proving key/subject corruption still makes the witness throw. No runtime test hook or type casts added.
5. Remove stale deleted-method labels from the current census generator. Historical generated research snapshots are not rewritten.

Independent source reviews found no blocker in the final narrow changes. Full kernel: 5741 ordinary passes, 12 expected failures, 12 skips, exit 0. Focused source checks: 69 and 25 passes (overlapping full suite, not additive). Source typecheck completed without reported errors; the original compound command recorded only its final exit, so its individual exit was not independently captured. Spec-types exit 0; affected-file ESLint exit 0. Bundle and demo exit 1 for unchanged budgets. Existing four-framework point-owner verification predates this reduction and is not represented as a rerun. No performance-neutrality claim is made for the sharing refactor.

## Audit disposition

- Old enhancer-requirements.ts has no runtime caller and falsely says ordering lacks validation. It is already absent from the bundle. Deleting it would be maintenance cleanup, not measured savings; public configuration tests already target the current resolver.
- Additional entity test/probe hooks remain in production. Their consumers include installed-artifact retention probes. Moving them needs an explicit nonproduction probe route; deleting the probes or counting reduced coverage as optimization is unacceptable.
- Plain EntityMap statically retains optional prepared point/transition/restore facilities. This is the strongest larger reduction hypothesis. Split read-only identity/projection access from optional mutation preparation, preserving a single kernel owner and existing native/Link/membership semantics. It is not demonstrated savings yet.
- General realization fallback, declarative targets, descriptor reconstruction and entity mutation frames have live callers. No obsolete whole rollback engine was established. Do not delete them from names or successful fast-path tests.

See the two independent audit reports for callers, history, tests and limitations. Nothing here authorizes new ceilings or claims release readiness.
