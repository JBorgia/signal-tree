# Independent scalar obligation successor review

Disposition: withhold the completed scalar gate and entity progression. The fourteen role discriminators survive, but two additional native-consumption cases demonstrate a stale confirmed-owner constraint in the claimed scalar path. The same defect occurs on the predecessor, so this is an uncovered contract failure retained by the successor, not an introduced runtime regression. It must not be silently counted as green or solved with a caller-specific exemption. This review does not authorize another runtime edit or choose the architectural response to the bounded stopping rule.

## Identity and scope

Checkout `/private/tmp/link-obligation-scalar-successor`, HEAD `9f819662775da6a129e4cf7699e5bc5907e5588f`. Reviewed two-file candidate:

- lifecycle.ts SHA-256 `6502aad6bc889649f1252c75a3dfb06551c8822d6652ff99ae456e3fe64e4d64`
- private.ts SHA-256 `d872d97d38a5ffca82f33aabf56fdb0e129d277f30fbedc6752759a8897f6a62`

Full paths and before/after identities are in CONFIRMED-BEFORE.json, CONFIRMED-AFTER.json and CONFIRMED-COMPARATORS.json; candidate diff is REVIEWED.patch. The predecessor run used `/private/tmp/link-evidence-combination-review` at test-only HEAD9f819662775da6a129e4cf7699e5bc5907e5588f, whose runtime comes from b9eef50d. Its two runtime files exactly match git-show9f819662, verified before execution. Only a new test copy was added there. No entity draft or runtime file was edited by this reviewer.

Governing combination SPEC: readiness `dabd8880:docs/audits/2026-10-17-incumbent-readiness/link-evidence-combination-review/SPEC.md`. Earlier governing membership contract is392fcf46. Read repository review-contract; the prior scoped review already read contributor/agent contracts. This is not release verification. Root proposed the confirmed-D question; I independently wrote the two-case witness, checked its contract basis, executed both comparisons through Nx, and interpreted the raw results. No other new reviewer verdict supplied the conclusion.

## Concrete blocker: confirmed D is still promoted to a mandatory input declaration owner

`experimental-publication/lifecycle.ts:73` computes input owners from every consumed source proof's owners, with no owner-outcome distinction. `:92–93` installs those identities into validation and marks an independent declaration invalid when its empty input set omits them. `private.ts:118,125–126` reaches this path for direct scalar derive; branch input capture at `:107–108` and the same preparation call reaches it for updateAndReport. The original source requirement retains the owner cell in its frozen proof after confirmation; retiring an operation/registry entry does not retire that historical constraint from the current source proof.

The combination SPEC is explicit: “a source revision's **unsettled D** becomes an input requirement of the consumer.” Its owner rule also says each obligation needs its “own justified discharge.” Confirmation is such a successful terminal outcome; this witness contains neither a pending source obligation nor a rejected/abandoned source. The earlier declaration SPEC's surviving-write clause requires accounting for “other actual pending dependencies”; it does not establish permanent historical owner taint. This does not waive a pending actual input, inherited uncertainty, or enclosing validation declaration.

Preregistered witness: `CONFIRMED-PREREG.spec.ts`, copied into `packages/kernel/src/lib/publication-confirmed-input-independent.spec.ts`.

1. Source p writes7, confirms, and flushes fully.
2. A separate unrelated q opens and remains pending.
3. Inside an independent declaration, either derive the confirmed source leaf to8 or consume source.updateAndReport's native argument to write target8.
4. Require no contradiction, useful send8 with declared basis, and q remaining pending.

Candidate raw `CONFIRMED-FIRST.log`: **2 failed**, both at line14's no-throw assertion, with `Declaration invalid: contradiction; writes may remain`. Predecessor `CONFIRMED-PREDECESSOR-FIRST.log`: **2 failed at the same assertion**. Later value8, send8, receipt and q-stability assertions were not reached in either run; their truth is not claimed. The source reason is exact: outcome-confirmed owner p remains in the source proof, is promoted to I, then is treated as an omitted declaration input. This is not hidden getter inference: both routes use existing instrumented native input boundaries.

Commands, from the respective checkout: `COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=src/lib/publication-confirmed-input-independent.spec.ts --skip-nx-cache`. Both raw logs retain the generating command and first failure. The root's ongoing spec-types run found two TS2339 diagnostics because declare is not on the public Link type. I preserved the original spec/logs and added only the established private Experimental interface and cast; executable assertions are unchanged. See FIXTURE-CORRECTION.md and CONFIRMED-TYPE-CORRECTED.spec.ts. Its subsequent type-gate outcome is separate evidence, not inferred here.

Counterargument: older implementation also requires p and a dependent[p] declaration can succeed. Neither establishes the new independent-input contract: an old defect is not a compatibility promise, and forcing applications to retain historical transaction handles is a different observable requirement. Conversely, this failure does not establish that every terminal identity should be removed everywhere. Confirmed D consumption, explicit V, rejected/abandoned authority, inherited W and receipt history have different jobs. Either native evidence must express successful discharge at consumption without weakening those reasons, or an explicit contract revision must justify historical-handle requirements. A blanket owner filter or new independence bypass is not selected by this report.

## Supported survival of the role-combination delta

001-first-roles.log records20/20: the unchanged14 combination cases, root's two overlap controls and four native preparation controls. The tests are useful: p-first holds now wait for q; q-first still waits for p; independent literal in p no longer throws and publishes after p; pending same-p native consumption still contradicts; inherited W(p) plus new D(p) remains unknown then surviving. The D/W overlap setup deliberately uses private withWriteContext to remove ambient transaction metadata on another source; it is a controlled enhancer-boundary witness, not claimed as an ordinary application sequence.

Source mapping supports that bounded result. Proof destination/input/validation/possible roles survive combineProofs, per-projection summary counts and sameProof. Fresh candidate W is sampled in finalizeNativeRequirement after preparers and normalized against this installation's D and consumed actual owners. Native input possible/unknown is preserved independently, so matching identity does not erase inherited W. prepareRevision no longer injects D into shared input contradiction sets; D remains in operation delivery dependencies. Callback-invalidated declarations expose the pre-install candidate W through nativeProof, rather than sampling owners again at completion. The return-validation fixture is still under root adjudication; its original005 final value assertion failed after earlier window/send assertions passed. I do not treat that confounded fixture as another demonstrated runtime failure or a fully passing control.

002-combined-scalar.log records211/213. Its two reds are the previously preserved wider-input fallback oracle and known-native contradiction expectation; neither is automatically a new regression. That count does not include these two confirmed-input falsifiers. No whole-suite success is claimed.

Operation retirement removes reverse dependents on start/supersede/disposal; horizon completion clears frame/input arrays after proof freezing. The retained owner-bearing proof explains the new confirmed-input failure but is not itself a demonstrated memory leak. Indexed wake and source/recipient ownership remain distinct in inspected code; no churn, retained-receipt heap, or full recovery cost proof was executed here.

## Physical/ordinary certificate concern remains source-only

The predecessor concern remains at `private.ts:120–129`. Inspection replaces the physical native view with unavailable evidence. Ordinary preparation selects fresh versus mutable NativeView using mutation.changed, while tree-scalar-slot-runtime distinguishes ordinary semantic change from physicalChanged after inspection. A physical restoration with unchanged ordinary value can therefore reuse/mutate a view certificate. That does not establish correct correspondence for a previously cached physical snapshot.

I did not execute a P/O cache falsifier in this bounded review. A valid one must demonstrate the actual native updater receives the historical physical argument while its certificate is replaced with different ordinary proof; it cannot substitute a fresh capture-only reader or treat an application-saved value as a native supplied input. The root-level updater walks a store and can read nested materialized child snapshots, so source mapping alone does not close the cache case. Likewise owners-empty unavailableInput is not proof that the corresponding ordinary owner evidence was legitimately discharged. These are precise outstanding verification limits, not an asserted observed inspection payload leak and not excuses to relabel the confirmed-D failure.

The confirmed-D cases are sufficient to withhold scalar completion/entity progression under the current reviewed scope. Remaining framework, P/O, work/retention and broader compatibility gates are not credited from focused counts. The findings distinguish current covered scalar behavior from explicitly unmigrated entity producers; no entity recurrence is alleged.

Root factual addendum: verified predecessor HEAD9f819662 by git rev-parse; corrected its identity above without changing the review conclusion. Corrected root validation probe007 and spec-types011 subsequently passed; original logs and fixture dispositions remain separate.
