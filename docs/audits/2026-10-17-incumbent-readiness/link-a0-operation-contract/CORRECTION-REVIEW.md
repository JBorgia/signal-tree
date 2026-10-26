# A0 correction verification

Reviewed frozen REVIEW-CANDIDATE.md SHA-256 `5dbb7b48ddaecaadf37e33fc8de153e7d96c76653082d75a51df8d11635cef8c` and COMPOSITION-MAP.md SHA-256 `0bbcdc8a1cafb16bc0279958fb4bf0b788c81f4310f22f9a625a40c82821ee8d`. Also inspected DESTRUCTION-MAP.md (`fdf2d02e238ead01b9322b1cc9686552a0d9fcd6b5a0e117083a2fdd2bb3395d`) against frozen f01 source and production87's explicit disposal path. Source f01 remains clean at `f01ed39a7df8a5de185ebec0773e09e36537dacb`.

This is a narrow verification of my prior findings, not another architecture inventory. I did not read other new verdicts or edit runtime. No model, test, build or benchmark was executed. Parent-supplied intended final corrections are identified as intentions, not silently attributed to these frozen files.

## Disposition

The prior representation and composition findings are closed at the design level. **Two precise textual corrections remain before treating A0 as complete:** specify the outer contradiction oracle for accumulated dependencies, and preserve authentic terminal confirmation when a registry disappears. Neither requires a new owner policy. Once incorporated, I find no remaining mechanism/authority blocker from this bounded review to a separately authorized finite native A1. That is not runtime acceptance or resumed release qualification.

## Verified corrections

| Prior finding | Frozen correction and assessment |
| --- | --- |
| Equal state could suppress required new responsibility | Lines 62–63 distinguish unchanged effective support from an explicit support-changing equal setter. Line 91 routes support-only work before the scalar equality early return. Discriminator 3 retains the same-7-after-rejection useful-send case, with no synthetic scalar emission or compensation. This follows the approved API's equal-value authored-revision rule. Closed. |
| Child-only support could escape the enclosing scope | Lines 85–87 now merge child declared/known obligations into enclosing known evidence and retain shared validation. The fresh outside-horizon replacement remains distinct. The accumulation gap is closed; the resulting error oracle still needs the correction below. |
| Required leaf progress lacked a trusted baseline | Line 50 establishes baseline-safe support only when the actual conservative gate permits the coherent baseline and known foreign support does not block it. The positive case creates the connection first, then opens unrelated x, then replaces y. Creation during pending/unavailable evidence remains unknown. No initial-send or blanket independence is granted. Closed for the promised positive case. |
| Receipt wording could change the approved last-revision contract | Line 143 expressly preserves the last relevant authored revision; multiple internal fact references do not become multi-revision delivery status. Terminal receipts remain separate from live proof. Closed. |
| Per-method closure did not explain the original compound history failure | COMPOSITION-MAP explicitly extends P and O through selected paired records across the existing history bucket at restoration.ts:3967–3972, corrects the intermediate ordinary endpoint at 4447–4463, and gives the add-w/prepend-c before/after calculation. Selection remains with existing rollback/history authority. Incidental neighbors and unavailable optional frontier bridges do not become new ownership/refusal rules. Closed as a design mapping, not a passing runtime result. |
| Late order callback admitted witness after possible reentry | The composition companion installs the existing order-interference witness with the source terminal interval, before capture listeners, then makes later order delivery idempotent. This directly addresses transactions.ts:2777–2807 versus entity frame observeCommitted after installation. It does not authorize foreign bridging or change ABA policy. Closed at design level. |
| No-event completion depended on an existing held send | The companion maps pending reduction to a release signal visible to settled(), schedules through the existing consequence key even when held.size was zero, and releases that work on explicit disposal. This replaces the exact link.ts:991–1002 gap. Native scheduling/error/retention proofs remain A1 obligations. |

The split native value/capture/membership timing and partial-success rule remain intact. The companion prohibits application getters/equality in private commit and retains a post-install rich-capture fault case. It does not weaken ordinary failure coverage by excluding all post-install failures as process OOM.

## Remaining correction 1: retain separate declared and accumulated-known sets

Frozen line 85 says outer independent → inner dependent(p) write → outer literal write remains dependent on p, but does not explicitly state whether the outer operation is valid-held or contradictory. Safety alone cannot determine the observable error contract.

The governing declared-contract SPEC requires validating the accumulated lower bound against the complete declaration. Its admission rules say a complete list omitting a known owner cannot replace responsibility. The approved API defines a late contradiction as an after-callback declaration error with installed writes retained. The archived examples model explicitly merges child dependencies into `parent.known`, then checks that set against `parent.declared`. It has no child-declaration exception that amends an outer independent assertion into a complete dependent declaration.

By contrast, f01 `experimental-publication/lifecycle.ts:70–78` merges declarations and known owners into the same frame owner array. Its final proof can hold on p without reporting the outer omission. That implementation is not the authority for this diagnostic choice.

The contract-preserving prewritten oracle is:

```text
outer declare independent:
    inner declare dependent(p): y(9)
    y(7)
=> outer after-callback contradiction; installed y(7) remains;
   no early send; no successful outer receipt is returned.
```

A fresh valid declaration after the failed horizon closes may replace its addressed value support, preserving other required structural/dependency facts. The correction must retain the immutable declared set separately from accumulated known/inherited evidence and validate completeness at horizon closure. The parent has explicitly confirmed this intended resolution; the frozen candidate does not yet state it. No union-as-outer-completeness policy is selected.

Cheapest falsifier: this trace paired with an explicitly complete outer declaration and a fresh later independent overwrite. Assert error stage/reason, retained value, conservative/terminal receipt behavior and no early endpoint call. **Not run.**

## Remaining correction 2: source disappearance cannot downgrade known confirmation

Frozen line 137 correctly distinguishes registry availability from irreversible owner outcomes, but then broadly says registry removal makes evidence unavailable to early authorization. Restrict that sentence to unresolved or unverifiable evidence.

The API explicitly permits known terminal confirmation. At f01, `lifecycle.ts:27–31` removes source registry storage without changing retained cells. `refresh`/`decision` use those cells' actual outcomes (`58–64`, `81–84`), and declaration validation accepts an authentic confirmed cell (`131–132`). Thus an authentic confirmation already retained by a proof or handle does not become unknown merely because its source registry is later removed. Pending evidence whose outcome is no longer obtainable must remain conservative; disappearance cannot invent confirmation or rejection.

This is a precision correction preserving the already-stated irreversible-outcome rule, not a request for automatic destruction progress or a new lifetime policy.

Cheapest falsifier: compare a retained authentic confirmed dependency followed by source destruction with a still-pending dependency followed by source destruction. The first retains its known outcome; the second acquires no terminal permission from removal. **Not run.**

## Destruction gap is not presented as a pass

The revised candidate now accurately separates explicit connection disposal from source destruction. f01 link.ts:1055–1082 and production87:898–923 release local waiters before user cleanup; neither Link registers a tree-destroy-to-dispose callback. f01 signal-tree.ts:2003–2022 runs registered cleanup, and transactions.ts:4928–4944 unregisters experimental owner storage separately from native authority cleanup. f01 settled() checks explicit disposal and otherwise waits its chain/held obligations.

Lines 136–141 and discriminator 14 explicitly preserve the weak queued-destroy witness and call automatic held-destruction progress unestablished. Cleanup after both explicit disposal and tree destruction is not represented as source-destroy-alone success. This closes the prior overclaim risk. I verified the native boundaries; I did not rerun or independently re-extract the archived destroy witnesses in this narrow check.

The known held-destruction gap therefore remains accurately bounded evidence, not a hidden A1 safety/progress pass. Any broader cancellation/auto-drain guarantee would require its own public-lifetime decision. The finite A1 may test the stated boundaries and complete explicit cleanup without selecting that new promise.
