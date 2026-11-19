Independent bounded R4 review — 2026-11-02

Verdict: no new blocker demonstrated in the R3-to-R4 membership change. This is not a clean-gate or activation verdict: one unchanged prepend control still fails, also on verified R3. No runtime or frozen test was modified.

Identity and authority

- Exact R4 SOURCE-SHA256.json: d0105bca7f743e6b0c0ad07f5c828f560f09c67001597d1317d9c00be9c9ae5a. All five FREEZE entries and all 3,009 candidate files verified. Original and disposable copy still match after execution (post-run-identity.json).
- R3-to-R4.source.patch changes only packages/kernel/src/lib/entity-signal.ts. Reversing its hunks in memory reproduces the predecessor manifest hash d077e163d85c9fdc1b250ffbc9c01b6b2c12c2d76e106b36cadcfb2e5b37412a; R4 hash 115b1a6531cfe64ba5b5a3454b21955d20e298014c7f1b00b7220d123413ab27 (incremental-identity.json).
- Root checkout inspected at 628d302dadb082a48c58528651c9088234d0a777, branch fix/d1-d2-forward-port. It is not the candidate's identity; candidate is a manifest-backed, Git-less snapshot. Root HEAD and dirty-file list unchanged after review. No writes there. Retained production 87f6831f, B closure, public API and budgets remain outside authority to change.
- Read AGENTS, contributor contracts, review contract, independent protocol, support policy, current-controller scope and relevant membership source/reader contracts. No prior independent review conclusions or author RESULTS were consulted.
- Frozen semantic premises at the R4 manifest: entity-membership-source.ts says “The producer reports facts at the moment they are true; the observer turns them into deltas”; entity-membership-view.ts says “The changes of one structural unit, describing its end state. A unit that threw reports what it physically changed before it stopped (often nothing).”

Evidence and bounded interpretation

1. Once-only ownership: entity-signal.ts:1585–1587 captures facts during install. entity-membership-inventory.ts:304–324 suppresses frame deltas while a diffed bulk unit owns them. No second fact capture remains in complete(). Existing producer, bulk interruption, nested-unit, and throwing-listener controls ran. In the same unchanged throwing-listener test R3 emits sequences [1,2,3] instead of [1,2]; R4 passes. This is positive discrimination for the fix, not just absence of failures.
2. Held delivery: source acquires the tree reader hold before fact publication; reader hold count and drain queue defer audience delivery. entity-signal.ts:1591–1612 marks completed before invoking callbacks, attempts observations/publication, and releases the hold in finally. Existing joint-membership-completion tests ran: no events after publish({deferCompletion:true}); completion throws the same sentinel, both sibling events arrive once, repeated complete does not duplicate, and a subsequent useful add arrives.
3. Reentry and neighbour payload: both new completion reentry cases ran, with and without a thrown sentinel. Original add carries no future neighbour; nested add follows it with the original lifetime as predecessor; sequence is [1,2], and a later remove delivers. Facts are derived before completion callbacks can change the structural store. Existing undo/rollback and declarative-reversal delivery controls also passed.
4. Failure/release limits: observed controls cover completion exceptions, throwing readers, rejected preparation/enrollment changes, interrupted bulk stores, listener reentry and destruction. They do not establish arbitrary injected failures at every instruction, nor correctness of an abandoned internal plan that never receives complete().

Preserved failing control (inherited; not an R4 regression demonstrated)

packages/kernel/src/lib/entity-membership-view-v16-controls.spec.ts:153 requires prependOne to emit ['add','reorder']; both exact R3 and R4 emit ['add']. Cheapest falsifier ran unchanged through Nx on both snapshots. R3: 9 pass/2 fail; R4 in the 334-test run: only this test fails. The second R3 failure is the extra-event issue described above.

A separate test-only discriminator r4-review-prepend-payload.spec.ts passed on R4: prepend z into [a,b] emits one add with undefined predecessor and a's lifetime as successor, listener snapshot and physical ids are [z,a,b], and removing z restores the original inventory with one further event. This supports correct observable placement for that trigger; it does not erase the failed exact event-shape assertion or authorize changing the frozen oracle. Its likely redundant-reorder expectation needs explicit implementer disposition before a clean unchanged-suite claim.

Execution and raw artifacts

- First invocation: controls-command.json / controls-first.log / controls-exit.json. Exit 1 before collection: missing node_modules/.modules.yaml; global Nx 21.3.11 fallback; plugin load failed. No semantic test result from this attempt.
- Environment repaired only inside this review directory: copied root node_modules using cp -cR, rebased copied .bin NODE_PATH strings locally. Node 24.15.0, corepack pnpm 10.17.0, local Nx 23.1.0, Vitest 4.1.9. Root and candidate lockfiles match. See environment.json. Shared/frozen dependencies untouched.
- controls-retry-command.json / controls-retry.log / controls-retry-exit.json: corepack pnpm nx test kernel --skip-nx-cache, 17 named membership/completion/installation files, --maxWorkers=1. 333 passed, 1 failed (334). Original tests unchanged; selected_controls in post-run-identity.json records R3 equality for each (only joint-membership-completion is new in R4).
- r3-command.json / r3-first.log / r3-exit.json: same Nx route, entity-membership-view-v16-controls.spec.ts; 9 passed, 2 failed. All 3,008 R3 files copied from and verified against PREDECESSOR-SHA256.json.
- payload-command.json / payload-first.log / payload-exit.json: same Nx route, independent test-only discriminator; 1 passed.
- run-controls.py, run-controls-retry.py and compare-prepend.py preserve executable commands, environment and snapshot setup. gates-list.log is inspection only.

Not run: full kernel/framework suites, type gates, builds, performance/size/release gates, or C7a composition as part of this R4 question. No release qualification, production activation, or general leak/cost claim follows.

Earlier-baseline pinpoint (requested follow-up, after C8 adjudication)

Ran only the exact unchanged prependOne test on fresh, manifest-verified C0 and C7a copies (one selected test each, no broad suites). Both fail with the same ['add'] versus ['add','reorder'] mismatch. C0 manifest f80a70476d3e110db83242f7a17ef02964d7bb7dcb5c071de7d89151e2547e26; C7a manifest d911ae7768e8e1a43eceb99ef5277988a6ff9e59c910337bb1e6b79db4d1b71d. The test is byte-identical on both (afb9fbb606d3cc025f1d4f3fd497266cca49002554fa94eceaa966b4463753e4). Both sources already stage final-front topology before membership facts. Thus the mismatch is present at C0; it was not introduced by C7a, R4, or their C8 merge. The exact earlier introducing revision was not bisected.

Raw commands/first failures: C0-prepend-command.json / C0-prepend-first.log / C0-prepend-result.json and corresponding C7a files. prepend-earlier.py preserves setup and execution; both copied baselines remain manifest-identical afterward.

Contract distinction: kernel README:569 promises current membership and changes, without prescribing the add+reorder encoding. Frozen entity-membership-view.ts:43–47 describes one structural unit's end state; entity-membership-inventory.ts:259–267 says add neighbours describe committed order; :188–195 describes reorder when surviving lifetimes move relative to each other. The exact add+reorder requirement is explicit in the unchanged test at :153. These source comments support the single-add placement interpretation for a fresh prepended lifetime, but they do not authorize overriding the frozen test. Keep this as an OPEN inherited qualification item, with the earlier introducing change/owner-approved event contract still to be reconciled. No oracle edited.
