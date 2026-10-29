# Independent core implementation review — first failures

2026-10-29. Candidate `/private/tmp/link-collection-proof-successor`, HEAD `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775` plus the seven tracked runtime changes recorded by `/private/tmp/link-collection-proof-evidence/core-independent/first-before.json`. The matching after manifest is identical. Review was requested before the worker's final freeze; the worker then froze runtime for this independent test. This is a blocking first-failure review, not final qualification of a subsequently revised artifact.

## Disposition

Two concrete failures violate the claimed core collection seed/selected-support rules. Neither depends on native retirement or selected whole-unit installation. The parent applied the recurrence stop after receiving these first failures; source is frozen for archival. Do not patch them or revise their assertions automatically. Full core approval is withheld.

### 1. Open-horizon enrollment erases later validation/window support

**Observed:** a collection Link created after x7 installs inside another Link's still-open independent declaration seeds x7 as clean. The outer callback then throws. A later independent y8 edit through the new Link sends x7/y8 immediately with receipt `{state:'started',basis:'declared'}` while unrelated foreign q is still pending.

Producer: `packages/kernel/src/lib/core-independent-review.spec.ts:8–32`. It first adds ordinary a{x0,y0}, flushes, opens q on another tree, then executes `c0.declare(independent, () => { updateOne(a,{x:7}); c1=link(rows,...); throw sentinel; })`. It asserts the same sentinel and successful c1 creation, then independently updates y8 through c1. The physical row assertion passes. The no-send assertion at line28 fails; raw output records the incorrect declared basis and q's still-current transaction change. The post-q-confirm useful-send assertion is not reached and is not claimed passed.

**Source mechanism:** `experimental-publication/private.ts:282–290` normalizes a seed reference to `initialRequirement()` when its current proof looks safe, without preserving its unfinished `NativeRequirement.frames`. That proof can acquire invalid validation and its captured possible-owner window when the enclosing horizon finishes. `registerCollectionProjection:292–296` also snapshots each requirement's proof into the summary. `lifecycle.ts:239–255` finalizes requirements only at horizon close; creation is not that close. Thus a reference that is not yet final can become an irrevocably clean recipient baseline.

**Violated contract:** DESIGN-REVISION-2 initialization requires exact selected support and forbids guessed clean source facts. Atomic-summary step4 says unfinished horizon references deny early delivery, and step6 requires summaries to respond to horizon finalization rather than permanently cache mutable proof state. A0's enclosing validation lower bound and recipient-only enrollment rule also prohibit creating permission by enrolling c1. The inspection-baseline exception is not authority to erase unfinished native validation.

This failure is native eligibility safety, not an application omission: the native writer and open declaration horizon are both instrumented, and the later independent declaration changes only y. Untouched x retains its own support.

### 2. Omitted nested collection still blocks a projection that excludes it

**Observed:** a root Link carries q-dependent support on branch.rows.a.x7. A complete independent root replacement omits optional branch and authors other1. The actual root is exactly `{other:1}`, but the Link sends nothing and reports `{state:'held',reason:'pending-dependency'}`.

Producer: `core-independent-review.spec.ts:35–48`. It verifies the earlier dependent row edit produced no send, then calls `tree.$({other:1})` under the root Link's independent declaration. The exact omitted-root value assertion passes; useful send `[{other:1}]` fails at line46.

**Source mechanism:** `private.ts:157` combines every `b.collections` summary into aggregate support unconditionally. The existing plain-field path uses completed membership/exposure to remove masked contributors (`ready:196+` and `exposed`), but collection subtrees are not filtered by their ancestor presence. `maskPayload` can omit the branch while the proof still includes its hidden collection.

**Violated contract:** A0 removal/omission says hidden facts cease contributing to the visible payload while they may remain retained for recovery. DESIGN-REVISION-2 requires typed collection subtrees composed with ancestor-presence gates. Removing a subtree from the selected outgoing domain must stop its positive contributors from blocking that projection; it must not destroy their native or held-lifetime evidence. This is a useful-progress failure, not permission to clear q globally or confirm it.

## Execution and artifact identity

Command, using the checkout's Node24.15.0 and pnpm10.17.0 through Nx:

`corepack pnpm nx test kernel --skip-nx-cache -- --testFile=src/lib/core-independent-review.spec.ts`

First result: **2 tests failed**, one file failed. Raw log: `/private/tmp/link-collection-proof-evidence/core-independent/first.log`. Runtime/test identity: `first-before.json` and `first-after.json`, byte-identical JSON. Review fixture SHA-256: `a784b59acac28fb58c22f661b53e7e02f10854ba9b2e1478147502a2fd14a512`.

Harness limitation: after Nx finished, the shell attempted to assign zsh's reserved `status` variable; this failed and prevented writing a separate exit-code file. The raw Nx/Vitest log independently records both failures and the failed target. No rerun was performed to cosmetically repair that wrapper artifact. The source identity and original output remain intact.

Only the separately owned reviewer fixture was added. No runtime, existing test, controller, policy or assertion was edited.

Exact tracked runtime SHA-256 values from both manifests (paths relative to `packages/kernel/src/lib/`):

| File | SHA-256 |
| --- | --- |
| entity-signal.ts | c067b3fb92b3b4ea1cce8296a280b0136296afd2d1361e485bad3ad30183e096 |
| experimental-publication/entity.ts | a856635b5dc28fe9ab7d33ffcc71136e67f888cde35f0d44e14a511d0430861b |
| experimental-publication/lifecycle.ts | 4c788a106968031a2f3782790a86431384599901e0ea9eb3c9f06acd29bbb7cd |
| experimental-publication/private.ts | 94b0e0077c7124a1b43005969bc5fc32712b7a11aee5853ec9b2f1591a03a868 |
| internals/entity-egress-projection.ts | 381f1a8dbb515c6d29af62cac6a3f77c94c4a131ec755bc7fbed031bc2c4aa42 |
| internals/entity-publication.ts | 92e02a26869866912e551725cd22d9e1b06dc437a6005d622dbbac13f60975ef |
| link.ts | 606adbfe289ea42eaf42e194e4310c75ec268cb8d7de8c54903d3a4629006e77 |

The manifest covers these tracked runtime changes and the exact executed reviewer fixture; it is not a manifest of every untracked sibling proof-retirement file or an installed package. The untracked proof-retirement module is not imported by the reviewed lifecycle source. Parent archival should include the entire checkpoint separately.

## Why these are covered counterexamples

These tests exercise neutral/kernel collection Links and ordinary public writes. They do not depend on Angular/Vue cache timing or the separately reproduced inherited native carrier failure. They do not reuse the historical wider-root/descendant oracle: the first retains a real unfinished validation obligation of x, and the second removes q's entire contributing subtree from the outgoing domain. Both expected outcomes follow directly from the approved seed/horizon and exact-selected-domain rules. No new foreign-owner relevance policy is stipulated.

The executions establish failures of this candidate. They do not establish a first-introduction commit: no frozen-predecessor execution of these new tests was performed. The frozen baseline's collection declaration gate was unsupported, so blindly running the same direct declarations there would not establish equivalent mechanism coverage. This attribution limit does not excuse a candidate that now claims these covered paths.

## Source-review positives and unclosed scope

The diff does address several required mechanisms: mandatory outgoing enforcement no longer bypasses unsupported collection bindings; collection summaries are separate from authored requirements; aggregate receipt readiness waits for selected support; sparse native overlays avoid copying unrelated subject maps on bare point edits; the reducer carries ordinary-vs-physical field origin; source evidence exposes negative seed contributions; and explicit order gets support-only revision participation. These are source observations, not a substitute for the failed controls or proof of complete equivalence.

Per-step P/O field association is improved through step.physical and forEdit, but a complete per-step/context survival claim remains unestablished. `internals/entity-publication.ts:178–185` still flattens grouped point packets after their preparation body and spreads the first packet's metadata; the grouped selected path must retain its deferred qualification. The source native preparer also obtains current execution input scopes when it eventually runs. Do not count selected grouping or source-context finalization as passed by ordinary forward tests.

Acquisition was still being finalized and independently tested by the implementation owner. This review does not certify it. Native retirement and selected whole-unit/callback freshness are explicitly unimplemented/unqualified sibling boundaries. Terminal-proof changes being coordinated elsewhere receive no approval from this core report. Broad suites, cost acceptance and installed-package qualification were not run here.

The next decision is the existing recurrence disposition for these covered failures, not another automatic local patch. Any later authorized candidate needs a new exact-artifact review while preserving these first failures and unchanged useful-progress/safety assertions.
