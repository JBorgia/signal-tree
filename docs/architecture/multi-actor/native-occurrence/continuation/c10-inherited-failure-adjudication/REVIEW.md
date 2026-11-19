# Focused classification of C10 promoted kernel failures

**No introduced defect demonstrated in the three assigned files.** Exact promoted C10 and exact C8a reproduce the same five failures, with 32 passing tests in each arm. This is separate from the earlier parent-reentry and equality-getter oracle adjudication. It is not a disposition of Main's full kernel run, absent/restoration work, other frameworks, or release readiness.

## Identity and execution

- C10 promoted `/private/tmp/st-native-combined-c10-promoted/SNAPSHOT.json`: SHA256 `de88e207c66e65a1a191d05ab4f2b5b2a4deeead71a06f239f278e28dee70dc4`, 3042 manifest files.
- C8a `/private/tmp/st-native-combined-c8a/SNAPSHOT-C8a.json`: SHA256 `04ba51dec86f537921521cf0a8ef5276c788e48b9a4e4abc24c7c5d14eda9652`, 3031 manifest files.
- Lockfile on both arms and existing reviewer-owned dependencies: `5e1ccb86b533ff4241d8a6ae5ac32ee9a56c6e10a416a8d1be3322d0ba531239`.

All source files were copied into this directory and verified against those manifests. All manifest files remained unchanged after execution (`VERIFIED.json`). Two new diagnostic specs were added only in owned copies; original tests and runtime files were not edited. The three original test files, link.ts, lifecycle.ts, recipient-occurrence.ts and native-occurrence.ts are byte-identical between the two arms. Full individual hashes are in VERIFIED.json.

The initial redundant dependency clone was interrupted before any tests; `setup.py` retains that attempt and `setup-resume.py` records completion. Both source copies instead use the dependency tree already independently copied at `/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules`, never Main's/frozen dependencies. Each arm uses separate Nx cache/workspace-data directories. No install or dependency upgrade occurred. Node 24.15.0 and package-pinned pnpm 10.17.0 were used through Nx.

Original focused command, executed in each owned source copy:

```sh
corepack pnpm nx test kernel tree-error-public-contract.spec.ts occurrence-successor.spec.ts entity-tap-reads.spec.ts --skip-nx-cache --maxWorkers=1
```

`runs/focused-c10` and `runs/focused-c8a` each preserve exact COMMAND.json, first.log and RESULT.json: exit 1, 5 failed / 32 passed / 37 total. Main's command and bounded excerpts are in `main-partial-evidence/`; no completed-full-suite result is inferred from them.

## Classification

| Failure | C10 / C8a | Classification | Bounded recommendation |
| --- | --- | --- | --- |
| tree-error-public-contract: Link exactly three members | Both expose `declare,dispose,retrieve,settled` | Inherited experimental/runtime versus public-contract mismatch; public input reaches it | Do not attribute to parent freshness or silently bless a fourth public member |
| occurrence-successor: exact replacement/disposal | Both retain unresolved count 1 instead of 0 | Private fixture omits installed readiness activation | Preserve assertions; complete the actual private lifecycle in the fixture |
| occurrence-successor: work independent of sibling count | Both finalized count 0 instead of 1 | Same missing activation; asserted work never occurs | Retain positive finalization and work calibration |
| occurrence-successor: hidden support/reappearance | Both reappear unresolved at 1 instead of 0 | Same missing activation | Retain visibility/readiness assertions |
| entity-tap-reads: pre-held cell stays stale | Both observe `[['b'],['b']]` instead of `[['a','b'],['b']]` | Obsolete oracle under approved acquisition-independent freshness, already failing on C8a | Update only this held-ST-reader expectation/comment/name; preserve post-group check |

### Link surface: inherited, but not waived

`evidence-source/packages/kernel/src/lib/tree-error-public-contract.spec.ts:232–239` calls ordinary public signalTree/link APIs and enumerates the returned handle. No private injection is needed to reach the discrepancy. `link.ts:138–154` still documents/types a deliberately three-member Link. `link.ts:1162–1176` unconditionally constructs the extra enumerable experimental `declare` member. The runtime and test are identical on C8a and C10; both raw logs show the fourth member.

This is not an error-reporting delivery defect: the other seven tests in that file pass in both arms. It is also not automatically an obsolete assertion merely because experimental runtime currently differs. The governing PLAN.md authorizes bounded implementation but not unspecified exports; the occurrence DESIGN.md explicitly scopes private experimental work without public API activation. The freshness approval does not authorize Link surface changes. Keep the production-surface tripwire/evidence and have Main distinguish experimental qualification from eventual public-surface reconciliation. No recommendation here adds a public method, changes enumeration, or hides this mismatch for release.

### Occurrence fixtures omit an actual lifecycle phase

The three failures use RecipientOccurrences and lifecycle.runDeclaration/prepareNativeRequirement directly, not only public setters. At occurrence-successor.spec.ts:58–68,83–87,111–117 they prepare requirements, install the primitive record and call finalizeNativeRequirement, but never call deliverNativeRequirementReady.

The existing runtime explains the result:

- lifecycle.ts:118–121: readiness requires absence from both unfinishedRequirements and unactivatedRequirements.
- :181–187: preparation places the requirement in both sets.
- :200–212: finalization seals evidence; installed completion removes the activation barrier. The source comment expressly separates installed readiness delivery from sealing.
- :340–363: declaration horizon closure resolves unfinished evidence, but cannot invent missing installed activation.
- recipient-occurrence.ts:62–70: an unresolved entry retains its readiness subscription until that lifecycle delivers.

**Executed discriminator:** copied the original spec to `independent-occurrence-completion.spec.ts` in each owned arm and appended only `life.deliverNativeRequirementReady(p.requirement)` after each of the four existing finalizer calls. No assertion, count, runtime path or original fixture changed. The exact small diff is `diagnostics/completion-only.patch`.

```sh
corepack pnpm nx test kernel independent-occurrence-completion.spec.ts '--testNamePattern=exact replacement cancels|finalization work is independent|hidden unresolved support' --skip-nx-cache --maxWorkers=1
```

`runs/completion-c10` and `runs/completion-c8a`: exit 0, all three targeted tests pass; 13 unrelated cases intentionally filtered out. In particular, the positive finalized-count/work assertions now execute, the two sibling sizes retain equal nonzero work, cancellation/disposal checks remain, and hidden support resolves on reappearance. This isolates missing activation rather than weakening expectations to accept stuck readiness. This diagnostic retains original installation/finalization ordering; it does not claim that old manual ordering is the preferred production recipe.

**Public-input discriminator:** `diagnostics/independent-public-readiness.spec.ts` creates a normal tree with transactions, calls ordinary link and `t.$.n(1)`, and uses private instrumentation only to observe the real producer's native requirement. It makes no declaration call and does not inject readiness itself. It asserts an actual preparation, readiness false during preparation, exactly one installed callback reading 1, readiness true afterward, and endpoint delivery `[1]` after settling. It destroys the tree and disposes the link/observer.

```sh
corepack pnpm nx test kernel independent-public-readiness.spec.ts --skip-nx-cache --maxWorkers=1
```

`runs/public-setter-c10` and `runs/public-setter-c8a`: exit 0, one test passes in each. Thus no ordinary public setter/Link readiness defect is demonstrated by these private fixture failures. This is bounded to the tested scalar path, not all source kinds.

The existing `joint-readiness.spec.ts` control “sealing and activation do not close an enclosing declaration horizon” also passes on C10 (`runs/public-installation-c10`: one pass, seven filtered). It uses real public setters inside an experimental declaration with private observation; it is not evidence that `declare` is already approved in the shipped public type surface.

### Entity held reader: approved expectation correction, already present in C8a

`entity-tap-reads.spec.ts:262–279` acquires `const held = rows.all` before a transaction, removes `a`, and reads held and newly acquired readers in onRemove. Both arms return only `b` through both readers. The old assertion and comment require acquisition-time-dependent staleness.

The archived framework-current-read DECISION.md explicitly states that SignalTree-provided readers must be fresh during callbacks even when acquired earlier, and application-created native computed values retain framework timing. This fixture contains ST readers, not an application-created native computed. Expecting `[['b'],['b']]` is a direct approved correction, not a runtime scheduling repair. It already fails on C8a, so it is not introduced by the parent snapshot patch. Preserve the original red log. The final held-value assertion is blocked by the preceding hard failure in these original runs and is not claimed as executed; no corrected entity test was run in this task.

## Limits and archive

No whole suite, runtime patch, original test edit, root/frozen-input edit, type-gate rerun, benchmark, release gate, absent/restoration adjudication or other-framework work was performed. Added diagnostics were executed through the kernel Nx runtime target; no separate spec-type sign-off is claimed. Inherited missing archived-tsconfig diagnostics remain in first logs and did not prevent the selected tests from running.

Archive this report, IDENTITY.json, both *-MANIFEST.json files, VERIFIED.json, scripts, DIAGNOSTIC-CHANGE.txt, `runs/`, `diagnostics/`, `evidence-source/`, `contracts/`, and `main-partial-evidence/`. SHA256.json seals that bounded packet. Exclude the large source/dependency working copies, Nx caches/data and the abandoned partial dependency clone. Main owns any fixture reconciliation or public-surface decision.
