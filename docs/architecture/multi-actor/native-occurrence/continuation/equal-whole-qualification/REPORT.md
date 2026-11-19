# Frozen equal-whole runtime — bounded qualification

No runtime changes. Tested exact candidate manifest `8ed29ecbbd0cb8cefcecff4bda5cb6351dd9e59ed7590fb571d412cc0a182d0b` in a new test-only copy. All original candidate paths remain byte-identical, including Main's six tests and the invalid late-getter no-new-throw oracle. Test-only manifest: `a95b716f10c7dc43efc0f60d13a31a947695affff153b376ba6232c6835a28e3`. `tests.patch` contains two added specs; no runtime patch. Original successor remains frozen/uncomposed.

## Results

| Bounded check | Result |
| --- | --- |
| Main six unchanged + thirteen new qualification cases | 18 pass / 1 fail. The failure is the stronger mixed-row immediate rollback-progress assertion described below |
| Post-install exact-error/invalidation/settlement cases | All six pass: three whole routes, with/without foreign pending owner |
| Supplied own undefined / real deletion | Both pass; own-property presence and useful output asserted |
| Real remove/readd at same key | Pass: fresh subject id and reader identity, clean new support, correct row and survival after foreign rollback |
| No collection recipient during whole authorship | Pass: native endpoint refresh observed before late enrollment; subsequent real write publishes while foreign owner remains pending |
| Original retained-root reexposure | Pass unchanged (one selected, four other tests filtered) |
| Terminal-owner characterization | Two cases observed on exact C16 and successor; differences described below, not a new policy oracle |
| Mixed attribution, whole versus existing explicit field, confirm versus rollback | Four observations per arm, externally audited for actual proof and output outcomes; not counted as eight semantic test passes |
| Spec types | Pass after a fixture-only compatibility correction; ratchet unchanged |

Earlier immutable-runtime evidence remains applicable: 45 original first-proof passes included Main six, native admission equal/inverse/net-zero, footprint classification and packet index/adversarial restored-endpoint/reentry controls; source types passed there. This qualification did not rerun those unchanged files or any full suite/build/framework matrix.

## Substantive post-install assertions

The new cases do NOT require a universal count of six or no new getter error. The seventh-read sentinel is a fixed fault trigger for this frozen workload. Each asserts the exact thrown object, installation already visible at throw, selected endpoint retained, horizon ready+invalid at catch, and no endpoint send within the failed call. With foreign q pending, flush is held, q inspection is unchanged, and confirmation produces exactly one row7 delivery. Without q, flush sends the installed row. `lifecycle.started` is asserted once with surviving basis, not declared. All six pass.

Original erroneous-oracle failure source remains in the copied candidate; its raw first failure is preserved separately in PRESERVED-late-getter-first-failure. It was not rewritten, silently counted green, or used as the acceptance oracle. Plato's phase review independently classified it; these new tests assert the applicable behavior instead.

## Preserved mixed-row failure and bounded attribution

Setup: own q owns x7; unowned y9 carries possible dependency on q and an unrelated foreign r. Explicit whole independent reauthoring refreshes only y's native evidence; x keeps its exact pending-owner endpoint and q inspection. Those assertions pass. The test then rolls back q and demands immediate whole output `{id:a,x:0,y:9}` while r remains pending. Physical row and both source field proofs are correct/clean, but no row has been sent. The original failed assertion and first.log remain unchanged.

Paired tracing discriminates this from a newly introduced whole-field ownership error:

- On the successor, q confirmation sends `{id:a,x:7,y:9}` immediately while r remains pending. It cannot send before q settles.
- On q rollback, both source field proofs are clean, but recipient `projectRevision` carries unknown=true/possible=[r pending]. It sends `{id:a,x:0,y:9}` when r confirms.
- The existing explicit-field reauthoring path on exact C16 has the SAME rollback hold and later useful output, with the same clean source field proofs and recipient possible-window hold. The successor's explicit-field route also reproduces it.

This preserves an unmet stronger progress expectation without assigning it to the new whole-offer delta or weakening its test. The bounded whole-reauthoring/native-owner behavior is established; full mixed rollback progress under another pending owner is not. No caller guard or repair was attempted. Inspect mixed-trace.json, baseline/mixed-trace.json and audit-observations.py for the generating sequence and nonvacuous comparisons.

## Terminal-owner characterization, not policy installation

After q writes x7 and confirms:

| Local pending authority at equal whole write | Exact C16 | Successor |
| --- | --- | --- |
| None | Same old endpoint, D=[q confirmed] | Fresh endpoint, D=[] |
| A separate local r owns y1 | Same old x endpoint | Same old x endpoint; r-owned y preserved; r rollback yields x7/y0 |

The successor did not modify the selector. Native responsibility returns early without local pending authority (`transactions.ts:2379–2397`), so a newly offered field uses the source proposal. With a local pending turn, the existing no-effect owner-marker guard (`:2472–2483`) selects the prior endpoint. No terminal outcome was queried to clear ownership, and no such policy was added in this qualification.

The no-other-pending difference is outside the narrow claimed unowned/pending-owner proof and must remain visible to Main/review; this report does not silently accept universal terminal-owner reauthoring. Its actual values and rollback behavior remain correct in the exercised cases. No broad future-inverse or terminal-owner semantics are inferred from endpoint identity alone.

## Test/artifact maintenance preserved

First spec-types failure was three uses of Object.hasOwn unsupported by this checkout's TS lib target. FIRST-QUALIFICATION.spec.ts and runs/spec-types/first.log are preserved. The fixture now uses Object.prototype.hasOwnProperty.call with identical presence assertions; the two affected cases reran and passed, then spec types passed. No source config, public type or ratchet changed.

A first observation audit read an empty terminal diagnostic because a later presence-only filter executed afterAll and overwrote the shared temporary JSON. FIRST-AUDIT.txt records this artifact issue; FIRST-audit-observations.py is preserved. Terminal cases were replayed without test changes, and fresh output was archived under their run directory. This is not a product failure or a relaxation of a terminal expectation.

## Review boundary

No newly demonstrated unsafe pending-owner behavior or post-install failure-handling violation in the executed cases. The mixed rollback progress failure remains red and has a preexisting explicit-field witness. The confirmed-owner endpoint difference is explicitly characterized rather than installed as policy. These qualifications must accompany any composition decision; this report is not full acceptance. Runtime, budget, API, native notification and terminal-owner selector code are untouched.
