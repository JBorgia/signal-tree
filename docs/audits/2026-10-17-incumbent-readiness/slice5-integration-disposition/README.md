# Frozen migration integration rejected

Candidate `f01ed39a7df8a5de185ebec0773e09e36537dacb` fails complete qualification. Production `87f6831fa60cafe87508f0ace84b7638698ca3b0` remains unchanged. The candidate is preserved on local branch `codex/v16-transition-qualification`; no activation, API acceptance, merge, push, tag, publication or ceiling increase occurred. B remains closed.

The covered recurrence is ordinary order composition across membership changes. This is a concrete integration failure, not a claim that all prior bounded controls were invalid or that the representation is impossible. Later runtime repair stops at the authorized recurrence boundary.

## Decisive unchanged comparisons

| Public operation | Production 87f6831f | Candidate f01ed39a |
| --- | --- | --- |
| Seed z,a,c; inside undoable add w then overwrite-prepend c; undo/redo preserves rows/order/held references | Pass | Throws `Prepared order domain contains absent lifetime` |
| Bare Link attached to a leaf beneath an omitted branch; settle omission and re-additions | Pass | `settled()` does not complete; unchanged 5-second test times out |
| Same Link scenario using branch and collection sources | 2 pass | 2 pass |

Each selected test body is byte-identical across the two source commits. Name-filter skips are unexecuted remaining cases, not successes. ORDER-REPLAY.json and LINK-REPLAY.json record commands, source hashes, exits and clean checkout identities. The original full-suite failures are retained separately from these discriminating replays.

The order producer retains ordinary endpoints at the explicit order operation. `completeOrderCapture` extends physical endpoints across preceding/following membership intervals while spreading ordinary endpoints unchanged. Restoration then passes that intermediate ordinary endpoint alongside the complete inverse membership. For add-w then prepend-c, undo removes w but ordinary order still includes w. Existing validation correctly rejects the contradictory prepared unit. Filtering absent lifetimes would not establish correct order; the separate multi-removal wrong-order failures remain unresolved.

The Link branch-membership handler updates eligible value and dirty state, then returns without refreshing the scalar source's eligibility evidence. Ancestor membership and leaf location also have different structured addresses. This explains the leaf-only concentration; no arbitrary ticket grant or forced flush is justified.

## Completed verification

Full `node tools/verify-gates.mjs --release`: **79/84 pass, 5 fail, 0 known-red**, exit1. This ordinary registry invocation completed; it is not an interrupted or partial run.

| Suite | Ordinary passes | Failures | Expected failures | Skips |
| --- | ---: | ---: | ---: | ---: |
| Kernel | 5,965 | 66 | 5 | 12 |
| Angular | 244 | 0 | 0 | 3 |
| React | 81 | 0 | 0 | 0 |
| Vue | 179 | 0 | 0 | 0 |
| Solid | 111 | 0 | 0 | 0 |
| Demo | 169 | 0 | 0 | 4 |
| React reference | 26 | 0 | 0 | 0 |

All 66 kernel failures are retained in 18 named groups in FAILURE-LEDGER.md; they do not represent 66 independent production defects. Two adoption expectations conflict with approved semantics, while other errors, event vocabulary, work-budget and fault-model questions remain unresolved. No assertion was changed to obtain green. The kernel run took564.15seconds; two large tests timed out. This is not a matched performance comparison.

The other four failed gates are lint:budget, dead-exports, release-claims and bundle-budget. Typecheck, spec-types, facade closure, installed Angular AOT, retention checks and the registry's other successful gates retain their exact evidence. Full registry output is capped by the unchanged runner; the retained test output begins partway through per-file lines, but includes all failure headings and all suite totals. No omitted earlier per-file output is invented.

Source manifest verifies all809 TS/TSX files unchanged after qualification. Built-artifact hashes identify175 files; no artifact is approved for publication. The pinned install's initial offline cache miss and successful frozen network installation are retained as environment preparation, not a test failure.

## Artifact and remaining qualification limits

Fresh bundle gate values below are rounded KiB (the tool labels them KB), not exact byte differences from an incumbent:

| Fixture | Measured | Current ceiling |
| --- | ---: | ---: |
| Bare production | 12.68 | 12.41 |
| Bare development | 15.05 | 14.79 |
| Entities production | 31.76 | 26.16 |
| Entities development | 34.66 | 28.98 |

All four remain blockers. Prior new-key budget approval does not accept these additional costs. No ceilings changed. Source inspection also identifies potentially quadratic endpoint membership comparisons; no causal timing share is assigned.

Separate mutation qualification, post-mutation clean rebuild, fresh production demo/routes and matched CPU/heap/construction/churn/post-drain comparisons were **not executed** after this rejection. Earlier sampled collectibility and registry retention passes remain valid within their scope; neither means universal lifecycle acceptance. The stronger semantic matrix remains scoped evidence, not a newly completed pass. The original 4N-versus2N prepend cost remains unaccepted.

## Disposition and replay

Preserve bounded gains and first failures; reject this integration. Retaining production does not make v16 release-ready. Viable next decisions are to keep the current conservative production behavior while readiness stays blocked, or authorize a separately reviewed successor whose complete-turn ordinary membership/order facts and Link source lifecycle are specified before implementation. A public scope reduction is an owner decision, not an implied consequence of rejection. Do not automatically patch another neighbor/ticket exception or resume qualification.

From either recorded checkout, using Node24.15.0/pnpm10.17.0 and its own frozen-lockfile dependencies:

```bash
PATH=/private/tmp/derive-placement-successor/toolchain:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false CI=1 corepack pnpm exec nx test kernel --testFile=src/enhancers/restoration/order-composition-readiness.spec.ts '--testNamePattern=addition then overwrite prepend supports repeated undo and redo with held references' --skip-nx-cache
PATH=/private/tmp/derive-placement-successor/toolchain:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false CI=1 corepack pnpm exec nx test kernel --testFile=src/lib/link-absent-locations.spec.ts '--testNamePattern=no enhancers.*an omission' --skip-nx-cache
```

Full registry command/environment is REGISTRY-COMMAND.json. Evidence archive contains raw results, exact source and artifact manifests, source patch from production, unchanged tests, failure ledger and independent reviews. Local source identity is preserved beyond disposable directories. A fresh independent reviewer who did not work on this implementation recommends rejection and confirms the recurrence stop. Root verified the source claims and corrected one early-return description; both review versions are preserved. Prior reviewers' bounded findings and the independence disclosure are retained separately. No reviewer pass overrides a reproduced failure.
