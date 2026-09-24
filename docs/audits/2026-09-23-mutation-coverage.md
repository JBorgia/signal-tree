# Frozen M01–M30 mutation coverage inventory

Inventory of executed **main-audit and temp15 production-candidate evidence**, recorded 2026-09-24. The initial inventory was read-only. Subsequently authorized isolated source-substitution runs added the executions documented below; no main source/dist or prototype was changed. The definitions remain [frozen MUTATIONS.md](../research/transaction-semantics-2/MUTATIONS.md).

**Seventeen counted production-source mutant variants now have verified green → targeted red → restored green chains, covering fifteen distinct IDs: M01, M02, M03, M04, M05, M06, M08, M10, M14, M15, M20, M22, M24, M25, and M26.** These counts include two M03 variants and two M24 carrier variants; they exclude marker-only instrumentation and superseded invalid attempts. The original temp15 M03 run covered only two writers. The later isolated main-source M03 run kills the mutant with the frozen three-writer S04 assertion. Neither establishes successful surgical overlap settlement or all S12 permutations. No complete M01–M30 closure, whole-law proof, or mutation sweep is established.

## Evidence classes

- **A — source kill:** an actual candidate production-source change, matching the stated mutant, makes a previously passing targeted assertion fail. Compilation/import/timeouts are not semantic kills. Scope remains the particular assertion and candidate bytes.
- **B — instrument/control only:** scripted returns, error injection, mocked processes, or a changed test fixture demonstrate sensitivity of an instrument. They are not production-source mutants.
- **C — already red:** a proposed witness already fails before mutation. Another failure is not a kill; it needs a separate passing witness. This does not mean an unexecuted mutant was actually tried.
- **D — unsupported/no proof:** no executed production-source mutation pair was found, or the required candidate capability cannot be measured. A green ordinary regression is not a mutation kill.

A row can name several classes because it has different witnesses. “No proof” means absent from the inspected evidence, not a claim that no historical experiment exists anywhere.

## Verified production-source executions

The [temp15 report](/private/tmp/v15-safety-mutation-proof/report.json), [patches and narrative](/private/tmp/v15-safety-mutation-proof/RESULTS.md), and raw logs identify `/private/tmp/signaltree-15-safety` as the candidate. Only `transactions.ts` was temporarily changed, independently from identical original bytes.

| Mutation | Passing control | Targeted failure | Restoration and limit |
|---|---|---|---|
| **M02:** move lifecycle rejection and `authority.discardPending` before compensation | [Baseline: 22 passed](/private/tmp/v15-safety-mutation-proof/baseline-22.log) | [Structural refusal/retry test](/private/tmp/v15-safety-mutation-proof/retire-before-compensation.log): rollback threw and physical values remained intact, but pending count was **0 instead of 1**. [Exact patch](/private/tmp/v15-safety-mutation-proof/retire-before-compensation.patch). | [Restored: 22 passed](/private/tmp/v15-safety-mutation-proof/restored-22.log). This proves the authority-retirement assertion detects that ordering defect, not every settlement failure path. |
| **M03, partial coverage:** remove later-pending overlap check | Same 22-test green baseline | [Older overlapping rollback test](/private/tmp/v15-safety-mutation-proof/omit-later-pending-check.log): expected atomic refusal, but rollback did not throw. [Exact patch](/private/tmp/v15-safety-mutation-proof/omit-later-pending-check.patch). | Same restored green. This is a **two-writer refusal guard**. It proves neither successful surgical overlap resolution nor the frozen three-writer requirement. |

Original transaction SHA-256: `06d9a8f3ebedc9565d2a614dd3d4fa1518c0fb6ae2ff9928c38b889786c365ec`. Mutant hashes are `ee6041390019db8da4e2cad9bfbfd402e229927da6dd270f9d8b9d516e3b451b` and `13d5e3b324fc56622915c6aa5295334725a71facefd186f8e3fbecf232b5822b`. The report records exit 0/1/1/0, expected assertion failures, per-mutation restoration, and matching final hashes for all four protected files. These hashes identify historical tested bytes, not a claim that the evolving checkout still matches them.

## M01–M30 mapping

References **S**, **T**, **C**, **A** below mean the preserved scalar, structural, composition, and authority evidence listed after the table. Statuses describe those snapshots, not a rerun at inventory time.

| ID | Frozen wrong behavior | Actual coverage and remaining limitation |
|---|---|---|
| M01 | Rollback writes captured baseline | **A:** isolated S14/confirmed-newer/R baseline-overwrite kill below. **C** still applies to already-red S11/12/RA, /RR, S06 and five S12 rejection orders; none counted as kills. |
| M02 | Retire turn before settlement succeeds | **A**, temp15 execution above. Main F09/F10 are passing regression witnesses, not independently mutated main proof. |
| M03 | Ignore newer pending owner | **A:** temp15 two-writer guard plus the subsequent isolated main-source **three-writer S04 kill** below; **C** still applies to five S12 successful-settlement orders. `S12/reject/321` is held but must first be shown to reach the particular removed newer-owner guard; its green status alone is insufficient. |
| M04 | Confirmation assigns a new sequence | **A:** Boyle's actual confirmation-ID substitution makes frozen S11/12/AR read x2 instead of x1 after accepting older/rejecting newer. One violated assertion; both settlements succeed. Raw phase/hash verification below. |
| M05 | Key identity uses `String(key)` | **A:** Mencius refined I06 typed-key source kill below. Initial handle-guard error excluded; I08 not claimed mutated. |
| M06 | Entity lifetime equals business key | **A, numeric-key subset:** actual add planning uses numeric business key as lifetime ID. Frozen T11-I07/1 detects old held ref reading replacement before and after fresh rollback; two violated state assertions. String-key companion survives. No unsupported/errors. |
| M07 | Partial mixed settlement | **D; B related refusal controls.** T T14 has measurable state/publication assertions but overall terminal-disposition evidence is unsupported. No partial-install source mutant ran. |
| M08 | Drop queued ambient context | **A, native classification:** actual enqueue capture becomes empty metadata; two existing external-outside-undo controls wrongly acquire undo history. Frozen later-literal companion survives; frozen transaction companion becomes unsupported (not counted). Distinct from M25's execution-time context read. |
| M09 | Resurrect predecessor after newer rejection | **D; C for several overlap orders.** No source kill. Passing S `S11/21/RR` and `S12/reject/321` can measure final resurrection independently of already-red older-first cases. |
| M10 | Remove structural-add dependency | **A:** isolated classifier lookup removal produces eight state-assertion violations across frozen `T02a/"A"` and `T12/confirmed/"A"`. Later unsupported terminal assertions are excluded from the kill; pending guard witness survives. Details below. |
| M11 | Older accept overwrites committed frontier | **D.** Passing S `S14/confirmed-newer/A` and `S02/ordinary/A`; no source replay/precedence mutant. |
| M12 | Superseded pending becomes visible after newer accept | **D.** Passing S `S11/21/AA` and O05 are candidate witnesses, not executed mutants. |
| M13 | Successful contribution lacks terminal disposition | **D — unsupported; B related scripted disposition controls.** S terminal reader and T T13/T14 explicitly lack the required native terminal/per-contribution evidence. State correctness does not close this row. |
| M14 | Structural dependency treated as supersession | **A, bounded native classifier only; D for MATRIX:** the same source mutant violates one existing native required-refusal assertion. Frozen T02a/T12-confirmed instead reach unsupported terminal reading with zero violated assertions: no MATRIX kill. Details below. |
| M15 | Structural independence treated as dependency | **A:** subsequent isolated main-source `T06a/"A"` kill below. All eight T06a keys held in the earlier baseline/current evidence; only key `"A"` was selected for this mutant execution. |
| M16 | Confirmed/realized write fails to advance precedence | **D.** S ordinary/confirmed-frontier passing cases cover bounded local truth; A's canonical/revision capability remains unsupported. No precedence-source mutant. |
| M17 | Arrival order becomes authority order | **D — unsupported; B numerical instrument controls.** A T18/T19/T21 stop at unsupported revision ingress. Scripted corrupt canonical values are not a revision-ordering source mutation. |
| M18 | Publish settlement half-state | **D; two surviving bounded source probes.** The earlier immediate-owner timing probe and later heterogeneous scalar-install `publish: true` probe produce no measured half-state red. Later control/mutant/restored each retain six held rows and two unsupported T14 rows; no M18 kill or whole-law pass. Details below. |
| M19 | Second terminal call mutates state | **D for named state-mutation kill; separate uncounted source publication proof:** terminal-guard removal makes AR/RR publish one unchanged sentinel snapshot. AA/RA survive; all values and pending membership remain unchanged. Main disposition excludes this notification-only proof from named-mutant totals. |
| M20 | Failed settlement reports terminal success | **A:** separate isolated F09 retry false-success kill below; native pending membership stays intact. This is independent of M02 lost-authority evidence. F10 was not mutated. |
| M21 | Invent order for unordered authority | **D — unsupported; B related disposition controls.** A T22 retains pending facts but cannot read canonical truth, so its overall result is unsupported, not held. |
| M22 | Terminal contributions retained in active correctness state | **A, destruction only:** subsequently authorized real-GC cleanup-removal proof below. Live terminal/history separation remains red/policy open; no whole-L15 closure. Link disposal copied-test negative control remains **B**. |
| M23 | One pending contribution blocks unrelated publication | **C/D.** C3/C8 Link noninterference witnesses are already violated in the preserved composition run. Those reds cannot kill a global-deferral mutant. No source mutation pair found. |
| M24 | Flatten semantic identity with strings/delimiters | **A:** two refined private-address carrier source variants below. Node-address mutation killed without capture but **survives with capture**; position-address mutation killed in both modes. No whole-L17 claim. |
| M25 | Read context at queue execution instead of enqueue | **A:** isolated queue-source context-timing mutant below, killed by native batching+restoration external-write controls in both enhancer orders. The nine frozen composition combinations lack this particular capability pair; none of their unsupported cases was counted. |
| M26 | Unsupported deferred operation executes anyway | **A:** isolated source mutant below queues `proceed` before the native composition refusal; C4's frozen refusal-safety witness detects leaked state and actual owner publication. Earlier in-memory controls remain **B**. This is not surgical successful settlement. |
| M27 | Diagnostics/history required for correctness | **D.** No product-source mutation execution found; no retention or diagnostic-dependence work run by this inventory. |
| M28 | Unversioned authoritative snapshot treated as unordered | **D; C for A1 as a whole.** A1 is already violated and canonical reading unsupported. No passing canonical witness or source mutation pair. |
| M29 | Snapshot settles unrelated pending contribution | **C/D; B independent settlement instrumentation.** A1 already loses its visible overlay, but its actual settlement reader still says pending. That is not a demonstrated terminal-settlement mutant. A5 lacks revision ingress. No source kill. |
| M30 | Correlated accept treated as plain snapshot | **D — unsupported; B scripted acceptance controls.** A2/T20 have no mapped correlated-settlement ingress. No source mutation proof. |

## Evidence inspected and exclusions

- **S:** [scalar current](2026-09-23-semantics-supplemental/current-final.json), [scope and baseline analysis](2026-09-23-semantics-supplemental/README.md): 25 held / 9 violated / 1 unsupported. Refusal safety is separate from successful surgical settlement.
- **T:** [structural current](2026-09-23-semantics-structural/current-final.json), [baseline comparison](2026-09-23-semantics-structural/baseline-current-comparison.json): 135 held / 48 violated / 24 unsupported; 48 already-red cases remain red, and no held→violated transition in that comparison. These are ordinary baseline/current executions, not mutants.
- **C:** [selected composition current](2026-09-23-semantics-composition/current-combinations.json): 28 held / 10 violated / 133 unsupported. The selected baseline is `baseline-combinations.json`; actual Links are attached for every Link-labelled combination. Earlier v3 executions are preserved and are not interchangeable with this fixture version (Mencius correction).
- **A:** [authority results](2026-09-23-semantics-authority/RESULTS.md): both current and immutable HEAD have 1 violated / 10 unsupported. Twenty-eight scripted selftests establish instrument sensitivity only.
- **B controls:** [validation-instrument corrections](2026-09-23-validation-instrument-corrections.md), [supplemental selftests](../../packages/kernel/src/enhancers/transactions/semantics-supplemental-selftest.spec.ts), [authority selftests](../../packages/kernel/src/enhancers/transactions/semantics-authority-selftest.spec.ts). The original [all-constructors-throw probe](/private/tmp/signaltree-audit-7ade0e3e/validation-probe-semantics-all-cases-throw-7ade0e3e.output.txt) exposed a reporting defect. Compiler/publisher mocked-process controls and gate-registry mutation anchors do not establish any M01–M30 product-law kill. The corrections document explicitly says no full mutation matrix ran.
- **Prototype-boundary evidence excluded from product-source totals:** `tools/experiments/transaction-options/evidence/*mutations*.json` declares “semantic-boundary mutations; not production source mutation proof.” `mutations.mjs` wraps candidate behavior rather than mutating main/temp15 production files. Its reported kills belong to that experiment and cannot transfer here. The prepared candidate also has hundreds of baseline failures; any individual experimental kill requires its own passing-witness comparison, not aggregate red totals. No prototypes were modified or rerun.
- **Initial worker confirmations (superseded by later executions below):** Mencius initially reported no product-source mutation runs from his slice; Descartes confirmed exactly the two temp15 mutants above. Dotted-address, Link inspection, and opaque-leaf red-before-fix regressions are not additional mutant executions.

## Initial ranked concrete source probes — proposals at inventory time

Each requires a fresh passing **targeted** control at the exact candidate hash, one isolated source edit, a semantic assertion failure rather than infrastructure failure, byte restoration, and a restored passing rerun. Do not require the entire currently-red conformance matrix to turn green before testing a passing witness.

1. **M19:** in `transactions.ts`, bypass the terminal lifecycle early return/error for one duplicate/opposite settlement path. Run the corresponding S `terminal/AA`, `/AR`, `/RA`, or `/RR` sentinel control. Expected kill: later `{x:9,y:8,z:7}` changes or an owner callback publishes. Merely throwing an unexpected error is not the requested semantic kill.
2. **M01/M11, separately:** force compensation to include a scalar already superseded by a confirmed write, targeting S `S14/confirmed-newer/R`; separately replay an older accepted effect over newer truth, targeting `/A`. Both witnesses currently hold. The edits must actually affect these paths; deleting an unused guard is not a mutation of the named behavior.
3. **M15:** broaden the structural dependency predicate so rekey/later independent field work refuses. Target `T06a/"A"` first; all eight key variants currently hold. Expected kill is refusal of the required successful independent settlement, with values preserved. This remains one independence witness, not all of L8.
4. **M08/M25:** separately discard captured metadata or read active metadata inside the deferred closure in `batching.ts` (`capturedMeta` / `withWriteContext` seam). Target C4 `CCTX2/coalesce/transaction` and `CCTX2/coalesce/later-local-constant`. Expected kill is lost transaction ownership or wrong later-constant result after flush, not unsupported fixture construction.
5. **M05/M24:** normalize one semantic key/address carrier to `String(key)` or delimiter joining, targeting I06 / `I08/typed-pair` for numeric/string identity and I01 for dotted/literal separation. Mutate only the actual address carrier consumed by the target; keep parsing/imports valid. These are distinct identity attacks and need separate provenance.
6. **M20:** make an actually failed occupied-key rollback return terminal success on retry while retaining the first failure setup. Target F09's unchanged-conflict retry (`refused` required). This adds the false-success proof that the existing M02 run does not supply.

The later run below supplies the three-writer M03 safety witness. Authority/revision mutants and global publication M23 still need suitable passing, discriminating witnesses or missing native capabilities. Do not count safe-refusal guards as proof of successful overlap settlement, and do not invent canonical state in an adapter to manufacture a passing mutation baseline.

Publisher review was performed during the later execution pause: original37 mocked controls plus7 independent controls passed on copied scripts. This is orchestration evidence only, not real publication/full-gate approval. Details: [/private/tmp/publisher-independent-entity-worker/REVIEW.md](/private/tmp/publisher-independent-entity-worker/REVIEW.md).


## Subsequently authorized isolated main-source executions

[Preregistered targets](/private/tmp/signaltree-isolated-M15-M03-v2/PREREGISTRATION.md), [runner](/private/tmp/signaltree-isolated-M15-M03-v2/run.mjs), [complete report](/private/tmp/signaltree-isolated-M15-M03-v2/report.json), and [verified sequences](/private/tmp/signaltree-isolated-M15-M03-v2/verified-sequences.json) preserve the actual execution. Command: `node /private/tmp/signaltree-isolated-M15-M03-v2/run.mjs` (exit0 after all six child runs). The first runner attempt failed while recording an absent root `tsconfig.json`, **before any control ran**; its [log](/private/tmp/signaltree-isolated-M15-M03/execution.log) is an instrument error, not a kill. The corrected runner uses the real `tsconfig.base.json`; target assertions were unchanged.

The source candidate is the dirty working-source snapshot at HEAD `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`, **not** that immutable commit's production bytes. Esbuild captured and content-addressed all **75 loaded source modules** before execution. Subsequent builds reject uncaptured dependencies and read only captured bytes, replacing only the designated `transactions.ts` region. The report records every module hash, auxiliary lockfile/config/manifests, Node executable hash/version, esbuild package/entry hash/version, per-run bundle hash, source hash, command, exit code and assertions. `.metafile.json` files record the actual bundle graph. Fresh child processes execute each bundle. No main source or dist file was overwritten.

| ID | Frozen unchanged witness | Control | Isolated source mutant | Restored control |
|---|---|---|---|---|
| M15 | T06a/"A" independent field after rekey | held, exit0, seven assertions | Remove only `effect.kind !== 'rekey'` exemption in same-subject dependency classification. **violated, exit1:** `independent rekey reversal succeeds`, actual `refused`, expected `settled`. | held, exit0; original source and bundle hashes identical |
| M03 | S04 THREE pending, same location — reject MIDDLE | held, exit0 | Remove only later-pending overlap loop. **violated, exit1:** newest writer expected `y=3`, got `1`. No unsupported/error result. | held, exit0; original source and bundle hashes identical |

[Exact M15 patch](/private/tmp/signaltree-isolated-M15-M03-v2/M15.patch) and [exact M03 patch](/private/tmp/signaltree-isolated-M15-M03-v2/M03.patch) are computed against the captured original bytes. [Execution log](/private/tmp/signaltree-isolated-M15-M03-v2/execution.log) contains all six results.

| Bytes | SHA-256 |
|---|---|
| Original/restored transactions.ts | `bbad1721debfaaea68109cc64aeb7872ea50d121ca455a6945f3ac33af63a140` |
| M15 transactions.ts | `4b777a0a334b7bc0facb2b3056802c4ef67494d0a07668117a6cb750b57207b9` |
| M03 transactions.ts | `6f7a073cf93d2b2e814a2334b0926077c4c9d7fee2ffb3bd409177b7c5402ec6` |
| Both control/restored bundles | `8f3678757cd6dec8ff260582401c04058420791f9ad7652480ea49e70dd5cc64` |
| M15 bundle | `d8768b81432173fff1f2d462b51b5cf0b3587bb121709f4b970854348412586d` |
| M03 bundle | `f26cacc737feced68b547b6da194d23fd79d543ec39097928753667e6e794082` |

The final read-only comparison found `liveInputChangesAfterRun: []` and `mainTransactionBytesUnchanged: true`. M15 demonstrates detection of a false structural dependency on one passing case. M03 supplies the previously missing **three-writer safety** kill; the baseline may legally refuse, so it does not prove surgical settlement, all permutations, or whole-law closure. No unsupported outcome was treated as a kill.


## Subsequent M25/M26 executions

[Preregistration](/private/tmp/signaltree-isolated-M25-M26/PREREGISTRATION.md), [isolated runner](/private/tmp/signaltree-isolated-M25-M26/run.mjs), [full report and input hashes](/private/tmp/signaltree-isolated-M25-M26/report.json), [verified sequences and live divergence](/private/tmp/signaltree-isolated-M25-M26/verified-sequences.json), and [raw execution log](/private/tmp/signaltree-isolated-M25-M26/execution.log) record the next authorized pair. Command: `node /private/tmp/signaltree-isolated-M25-M26/run.mjs`, exit0. Every child sequence was **exit0 control → exit1 intended mutation → exit0 restored**.

This run captured **80 source modules** before control execution, including transactions dependencies that other workers could subsequently change. Bundles use only those copied bytes; any new dependency is rejected. The final run comparison and subsequent report comparison both found no live divergence. This claim is timestamped in the evidence, not a promise that main remains unchanged later. No main source/dist files were written.

| ID | Passing witness | Exact isolated change | Intended failure |
|---|---|---|---|
| M25 | Existing `batching-context-safety.spec.ts` native external-write/undo assertions, both `[batching(), restoration()]` and reversed enhancer order. The same setup/assertions are executed directly in the isolated entry; the original spec hash is recorded. | [Patch](/private/tmp/signaltree-isolated-M25-M26/M25.patch): inside the deferred closure, replace `withWriteContext(capturedMeta, ...)` with `withWriteContext(getActiveWriteContext() ?? {}, ...)`. | Physical x remains7, but `canUndo()` is **true instead of false** in both orders. Baseline and restored controls both assert x7 and no undo record. No canonical adapter or synthetic overlay. |
| M26 | Unmodified frozen `CCTX4-CCTX5/coalesce/inner-transaction`, actual C4 transactions+batching fixture. | [Patch](/private/tmp/signaltree-isolated-M25-M26/M26.patch): insert `coalescedUpdates.set(node, proceed)` immediately before the existing unsupported composition guard throws. | The same recognized native refusal remains and callback does not complete, but state is **{x:7,y:0,z:5} instead of {x:0,y:0,z:5}**; a real owner callback publishes x7; after ordinary z6, refused x7 still remains. |

M26's confirmed-count trace includes legitimate outer work and is not asserted to be zero. The execution stays on the refusal branch throughout; its green control is **safe refusal**, never evidence of surgical success. Both mutants fail concrete semantic assertions, not unsupported/import/constructor/error paths.

| Bytes | SHA-256 |
|---|---|
| Original/restored batching.ts | `8899a815e0ca41c804277ff43bb03d7dfbdf2ad2554a8ead216a17febe4f14d1` |
| M25 batching.ts | `284b5ca7ab4d2e08b3a0a539d978cf92248aa7a7b97b2f43c70ce23fd347f161` |
| M26 batching.ts | `58cb3caad423dcce699be4c83f4038758c5ec8171153a3f56e3aaa9caa5ea114` |
| Both control/restored bundles | `9afdb65f931f6388a6fbf71f5557aa8df5e6ddc33ebe21af0b2d611e8a990713` |
| M25 bundle | `498e8776f4be1a4a864df480de9365f4047ca7136cbcef32a1ecf2a5d9101e95` |
| M26 bundle | `4bb3aae07bc9bcb2d3b633277c8a0476c4ad1ebb8c41bafff230bce9960f658d` |

The earlier publisher review applies only to its recorded old publisher snapshot. The later frozen seal received its own independent review: [/private/tmp/publisher-seal-independent-boyle/REVIEW.md](/private/tmp/publisher-seal-independent-boyle/REVIEW.md), 49 green → boundary-removal sensitivity red → restored49 green. No bounded blocker; mocked orchestration only, not product-law mutation evidence.


## Subsequent independent M20 and M01 executions

Each run froze **68 loaded modules** before execution, with independent reports and bundles. Main source/dist were untouched; end comparisons report no live divergence. Candidate is captured dirty working source, not immutable HEAD. Commands `node /private/tmp/signaltree-isolated-M20/run.mjs` and `node /private/tmp/signaltree-isolated-M01/run.mjs` both exit0. Each includes original green → marker-only reachability green → intended source mutant red → identical restored green. Markers are instrument evidence and excluded from source-kill counts.

| ID | Unchanged witness / measured discriminator | Intended mutant result | Evidence |
|---|---|---|---|
| M20 | F09/unchanged-conflict; actual pre-install refusal catch reached twice. Add only `lifecycle = 'rejected'` before rethrowing original error. | First native refusal identical; retry **settled vs refused**. Other eight assertions held, including original pending ID, values and zero publication. | [results](/private/tmp/signaltree-isolated-M20/RESULTS.md), [exact patch](/private/tmp/signaltree-isolated-M20/M20.patch), [report](/private/tmp/signaltree-isolated-M20/report.json), [hashes](/private/tmp/signaltree-isolated-M20/verified-sequences.json) |
| M01 | S14/confirmed-newer/R; scalar supersession skip reached once. Remove that skip only, leaving structural skip intact. | Older rollback succeeds but restores captured **x0 over confirmed x2**. Preceding four assertions held. | [results](/private/tmp/signaltree-isolated-M01/RESULTS.md), [exact patch](/private/tmp/signaltree-isolated-M01/M01.patch), [report](/private/tmp/signaltree-isolated-M01/report.json), [hashes](/private/tmp/signaltree-isolated-M01/verified-sequences.json) |

Original/restored transactions SHA256 for both: `283290832a0a64dcece1a8e517a116284c6127e49ec4f34c339bc3b00c5c5378`. M20 mutant `f6ebf27f7f4ec5cb13fc014a9092917baf37d3f3e40ff7756d4e75bef7b2adb1`; M01 mutant `eabf8f6056e5405b26b0c437865307f5ada40cd3fc4f7028e7f53d0a1c6d2008`. Full dependency/config/runtime/compiler hashes, raw stdout/stderr and bundle graphs are recorded separately. No unsupported capability, infrastructure error or prior red was counted. M01 does not establish M11 acceptance behavior or all frontier laws; M20 does not fabricate terminal disposition metadata.

Follow-up inspection downgrades the initial M19 guard-deletion suggestion: a missing native pending turn already produces empty compensation. Removing just a lifecycle guard need not mutate the sentinel, so reachability and an actual replay discriminator are required before claiming that kill.

## Mencius's refined M05/M24 source executions

Reviewed the [refined report](/private/tmp/signaltree-isolated-M05-M24-v2/report.json), [separate position-carrier report](/private/tmp/signaltree-isolated-M24-position/report.json) and [all three verified sequences](/private/tmp/signaltree-isolated-M05-M24-v2/verified-sequences.json). All use the same frozen75-module input snapshot; each has control0 → semantic mutant1 → restored0, identical control/restored bundles and no live divergence. These runs were executed by Mencius; this inventory read their actual outcomes.

- **M05:** StructuralStore key lookup uses String equality and handle acquisition uses the same wrong lookup, retaining native handle guards. Frozen I06 detects numeric score7 instead of0 and textual row name `target` instead of `control`, alongside wrong held-lifetime lookups. Mutated source SHA256 `54a5421af8e90598bff10adfbce58563212b68d31499dbf685f7a7954f7fdf3f`.
- **M24 node carrier:** flatten nonempty structured segments with join/split, preserving root[]. Existing literal/nested root Link workload detects literal `a.b` staying0 instead of1 without capture. **Capture-enabled variant survives.** Mutated source SHA256 `4aeae92fa61f800045af29bdc9704acb85484bbe0fd5195ef966d42954583a73`.
- **M24 position carrier:** separate `registerPositionAddress` flattening, same native workload. Both capture modes detect literal0 instead of1. Mutated source SHA256 `6ff23654bf43a9d081eae877a7bdd0cbbc28c2f4f6ef25dbe6401a2cf52260d0`.

Initial `/private/tmp/signaltree-isolated-M05-M24/report.json` remains preserved but excluded: M05 stopped at a runtime handle guard error; initial M24 also corrupted empty-root identity and measured broad no-delivery. Refined variants supply the bounded semantic evidence. Two M24 variants count as one distinct mutation ID; these results do not close all structured-identity laws.


## M18 bounded publication-seam probe — surviving, not counted

[Preregistration](/private/tmp/signaltree-isolated-M18-seam/PREREGISTRATION.md), [results](/private/tmp/signaltree-isolated-M18-seam/RESULTS.md), [exact source substitution](/private/tmp/signaltree-isolated-M18-seam/early-owner-delivery.patch), and [hashes/sequence](/private/tmp/signaltree-isolated-M18-seam/verified-sequences.json). Frozen68 modules; unchanged O02/multifield-reject with actual owner observer. Replace only the owner's two microtask scheduling calls with immediate invocation of the existing dispatch. Control0 → mutant0 → restored0; every run has four held assertions and one real coherent `{x:0,y:0,z:0}` snapshot. Original/restored hashes identical, live divergence empty.

This timing variant **survives**, because the scalar frame has installed all slots before this notification seam. It does not actually expose a half-installed state and is not counted as a killed M18. No synthetic observer, split scalar replay or new architecture was added to force a red. Scope remains O02 at this seam; global L13 applicability is unresolved. M19 fallback was not run because bypassing terminal guards alone has no demonstrated replay after pending authority removal.


## Subsequently authorized M22 destruction-only real-GC mutation

[Preregistration](/private/tmp/signaltree-isolated-M22-destroy/PREREGISTRATION.md), [results](/private/tmp/signaltree-isolated-M22-destroy/RESULTS.md), [patch](/private/tmp/signaltree-isolated-M22-destroy/M22.patch), [full report](/private/tmp/signaltree-isolated-M22-destroy/report.json), [separate hashes](/private/tmp/signaltree-isolated-M22-destroy/verified-sequences.json). Unchanged frozen Tesla v3 public-operation `gcCase('destroyed-confirmed-held')`; actual fresh-process GC, no raw history snapshots or mocked collectors. Remove only confirmed-history release call on destroy. Control0: obsolete payload collected/count0; mutant1: retained/count2; restored0: collected/count0. Before destroy count2; destroyed flag and reader refusal remain true in every phase. Original/restored bytes and bundle identical, live divergence empty. This snapshot independently captures later transaction source bytes and does not mix earlier M20/M01 snapshots.

**Destruction-only coverage:** live-history combined store remains already red and policy open. No general L15 closure; other GC arms were not rerun in this particular mutation sequence. The surviving M18 timing probe remains excluded from counts.


## Subsequent M10/M14 classifier executions — raw counts and bounded scope

[Preregistration](/private/tmp/signaltree-isolated-M10-M14/PREREGISTRATION.md), [raw report](/private/tmp/signaltree-isolated-M10-M14/report.json), [verified phase sequences](/private/tmp/signaltree-isolated-M10-M14/verified-sequences.json), and [results with chronology](/private/tmp/signaltree-isolated-M10-M14/RESULTS.md). All 75 loaded modules were captured before execution; no shared production/dist changes. Both mutations change only structural-add dependency classification, preserving the M15 rekey-independence exemption. Controls, marker-only reachability, and restored controls each have three held scoped rows. Phase exits are **0 → 0 → 1 → 0** for each mutant, but exit1 alone does not establish a kill.

| Executed source variant / witness | Mutant row outcomes | Actual violated assertions | Unsupported assertions | Counted source kills |
|---|---|---:|---:|---:|
| M10 / frozen T02a, T12 pending, T12 confirmed, key `"A"` | 2 violated, 1 held | 8 | 2 | 1 |
| M14 / same three frozen MATRIX witnesses | 2 unsupported, 1 held | 0 | 2 | 0 |
| Same M14 variant / existing native classifier witness | 1 violated | 1 | 0 | 1 |

All these mutant runs have zero execution-error assertions. M10's four state violations per affected row are membership count, exact typed-key presence, entity fields, and held-lifetime lookup. Membership is **0 instead of 1**. These concrete failures occur before terminal reading becomes unsupported; that unsupported suffix is preserved and contributes no kill. T12 pending remains protected by the separate pending guard. [M10 patch](/private/tmp/signaltree-isolated-M10-M14/M10.patch).

M14 returns `superseded` for an actual add dependency. The MATRIX witnesses retain measured visible state, then cannot read the native terminal disposition: this is **not a MATRIX kill or constitutional L8 proof**. The separate, preregistered existing `transactions.spec.ts` witness requires native rollback refusal for a pending add followed by dependent field work. Its sole violated assertion is `native add dependency requires refusal`, actual false versus expected true; entity17 and name `later` remain preserved. [Native report](/private/tmp/signaltree-isolated-M14-native-classifier/report.json), [native preregistration](/private/tmp/signaltree-isolated-M14-native-classifier/PREREGISTRATION.md), [M14 patch](/private/tmp/signaltree-isolated-M10-M14/M14.patch). The native sequence is also **0 → 0 → 1 → 0**, with one branch-reachability marker and identical control/restored bundle bytes. This counts once as a **bounded native-classifier source kill**, not as surgical product conformance.

Original/restored transactions SHA256: `283290832a0a64dcece1a8e517a116284c6127e49ec4f34c339bc3b00c5c5378`; M10: `e21bfcfa10b4bafbf3321522b2e9a8fe2b0867df98e3718bea8209e4963432cf`; M14: `deda153fb112cb0e38b9aa3ddf5e5e41980058a46df88646417ccbd4f868a6a7`. Both original runs ended with no live input divergence. Their aggregate scripts nevertheless exited1: the MATRIX aggregate correctly cannot count unsupported M14, and the native aggregate retained an outdated verdict-name predicate. Raw per-phase results, not that aggregate exit, support the bounded claims.

The later native v2 attempt stopped before execution after live source changed. [Native v3 snapshot replay](/private/tmp/signaltree-isolated-M14-native-classifier-v3/report.json) reproduces the same phase sequence using the original captured graph and explicitly reports live divergence; it is neither an additional mutant nor current integration evidence. These additions therefore change the previous **12 variants / 10 IDs to 14 variants / 12 IDs**, not 15 variants from double-counting M14's MATRIX/native runs or its replay. Marker-only runs, unsupported-only outcomes, compile failures, and the surviving M18 timing probe remain excluded. Consolidated current conformance awaits Main's explicit source-stable signal after restoration repair.


## Subsequent M04, M06 and M08 — separately verified source variants

Ownership coordinated with Boyle: his M04/M11/M12/M19 slice is separate from Mencius's M06/M08; ledger released for these additions. User requested central inclusion of M04. No main production/dist, frozen oracle, shared test, architecture/prototype or prior conformance evidence edits. Counts progress from14 variants/12 IDs → **15/13 with M04** → **17/15 with M06 and M08**. Each source variant counts once, regardless of witness/marker counts. M11/M12 remain unexecuted here; the subsequent M19 notification-only probe is recorded separately below and excluded from named-mutant counts.

| ID / actual substitution | Frozen or existing passing witness | Mutant result | Counted variants |
|---|---|---|---:|
| M04 / confirmation assigns `turn.id = this.nextTurnId++` before confirmed insertion | Unchanged frozen S11/12/AR; older x1 accepted, newer x2 rejected | One violated assertion: visible x2 instead of x1. Both settlements and other assertions hold. | 1 |
| M06 / numeric add key replaces fresh subject planning | Unchanged frozen T11-I07/1 and T11-I07/"1", actual public held facades | Numeric row has two violated assertions: old held ref reads `{name:'fresh',score:0}` instead of undefined before and after fresh rollback. String companion held. | 1 |
| M08 / empty metadata captured when replacement queued | Two existing native external-outside-undo controls, both enhancer orders; two frozen C4 companions | Two native rows each violate `canUndo()`: true instead of false; x7 remains correct. One frozen later-literal row held; one frozen transaction row unsupported. | 1 |

All three phase sequences are **control0 → marker-only0 → intended mutant1 → restored0**, with identical original/restored bundles. Source modules captured: M04 68; M06 75; M08 80. Every run has empty live input divergence at completion. No errors, unsupported results, marker variants or survivors contribute to killed-variant counts.

### M04 evidence independently checked

[Boyle results](/private/tmp/signaltree-isolated-M04/RESULTS.md), [raw report](/private/tmp/signaltree-isolated-M04/report.json), [patch](/private/tmp/signaltree-isolated-M04/M04.patch), [independent stdout/bundle/sequence verification](/private/tmp/signaltree-isolated-M06/M04-independent-verification.json). Command `node /private/tmp/signaltree-isolated-M04/run.mjs`. This inventory independently matched phase stdout to JSON rows and recomputed bundle hashes; it did not rerun or edit Boyle's evidence. Original/restored transaction hash `f16ce152e977965505ba853766eb62b1d15ae43b06eb8eeacdd7400f2d71eefe`, mutant `d86442665afb89c29208f7e2a25342dd37fe0481440baba5570685e05d554c93`. One bounded confirmation-precedence kill, not every L6/L11 case.

### M06 numeric lifetime evidence and survivor

[Preregistration](/private/tmp/signaltree-isolated-M06/PREREGISTRATION.md), [results](/private/tmp/signaltree-isolated-M06/RESULTS.md), [raw report](/private/tmp/signaltree-isolated-M06/report.json), [patch](/private/tmp/signaltree-isolated-M06/M06.patch), [verified sequence](/private/tmp/signaltree-isolated-M06/verified-sequences.json). Command `node /private/tmp/signaltree-isolated-M06/run.mjs`, aggregate exit0 after expected semantic mutant1. Only `addOneWithStructuralEffect`'s unique planning expression changes to `typeof id === 'number' ? id : structuralStore.planFreshSubjectIds(1)[0]`. Actual numeric key1 is subject1 on both additions; strings retain native fresh allocation. No key stringification, fabricated handles, guard removal, type casts or new identity model. Distinct-facade assertion still holds: the stale facade retargets new truth. Fresh rollback succeeds. Mutant totals: **one violated row/two violated assertions, one held row, zero unsupported/error**. String-key survivor is explicit; no whole-L7 claim.

Original/restored entity-signal hash `fcf260b88665b5f5fd68dd2aca9cec2c1e0cbc92aa9a06880292dd593688f2ea`; mutant `c65d92ea39a94594a36c2e6e249a56cca375453bc84b13da8fefeacf0b82d54e`. Marker-only records native allocations1 then2 for each typed key. The actual mutant preserves all downstream frame validation and handle guards.

### M08 classification evidence, unsupported companion, and distinction from M25

[Preregistration](/private/tmp/signaltree-isolated-M08/PREREGISTRATION.md), [results](/private/tmp/signaltree-isolated-M08/RESULTS.md), [raw report](/private/tmp/signaltree-isolated-M08/report.json), [patch](/private/tmp/signaltree-isolated-M08/M08.patch), [independent per-row sequence verification](/private/tmp/signaltree-isolated-M08/verified-sequences.json). Command `node /private/tmp/signaltree-isolated-M08/run.mjs`. The whole enqueue metadata capture becomes `{}`, dropping all fields including intent, external origin, realized participation, transaction ID and owner. Native `withWriteContext` replaces ambient context; it does not merge missing fields back. Queue mechanics, scope guard and separately captured restoration designation remain unchanged.

The two existing `batching-context-safety.spec.ts` external controls keep x7 but wrongly acquire undo history in both enhancer orders. Their two actual `canUndo()` failures alone establish **one bounded source kill**. Frozen C4 CCTX2/coalesce/later-local-constant survives. Frozen C4 CCTX2/coalesce/transaction becomes unsupported because there is no unambiguous native pending ID; this is **not a kill**. Raw mutant totals: **two violated rows/two violated assertions, one held row, one unsupported row/assertion, zero execution errors**. The original aggregate classifier rejects any mixed unsupported result and exits1; its report remains unchanged. Independent verification confirms the concrete native failures without relabelling that unsupported row or requiring the aggregate to be green.

M08 empties capture **at enqueue** and leaves execution's `withWriteContext(capturedMeta, ...)` intact. Prior M25 leaves capture intact but reads `getActiveWriteContext() ?? {}` **at execution**. Marker-only traces verify actual queued metadata and execution context; no M25 mutant was rerun or renamed. Original/restored batching hash `8899a815e0ca41c804277ff43bb03d7dfbdf2ad2554a8ead216a17febe4f14d1`; M08 mutant `b0fc702f7df6338a08951fb403b48e2c37274ecc2549bd58265c0c6356a937a9`. This does not turn unsupported composition or canonical-policy cases into passes.


## M19 terminal guard probe — bounded publication proof, uncounted

[Boyle's corrected results](/private/tmp/signaltree-isolated-M19-guard/RESULTS.md), [raw report](/private/tmp/signaltree-isolated-M19-guard/report.json), [exact source patch](/private/tmp/signaltree-isolated-M19-guard/M19.patch). Main's explicit disposition: retain this actual production-source → semantic assertion red as **notification-only evidence**, not a counted named M19 state-mutation kill. The total remains **17 counted source variants / 15 distinct IDs**.

Control24 held assertions → marker24 held → mutant22 held/two violated → restored24 held, phase exits0/0/1/0. There are four case rows: mutant terminal/AA and terminal/RA remain held; terminal/AR and terminal/RR violate only `terminal attempt produces no owner publication`. Each observes one actual `{x:9,y:8,z:7}` callback instead of none. Every sentinel value and native pending-membership assertion remains held. No unsupported/error assertion supplies the red. Empty rollback still enters native realization/publication; no synthetic observer or manufactured replay was introduced.

68 captured inputs, no live divergence; control/restored source and bundle hashes identical. This inventory independently compared raw phase stdout to report rows and recomputed all four bundle hashes. Initial entry-regex harness error occurred before control and is excluded. The owner's mistaken first survivor-prediction narrative is preserved as `incorrect-prediction-draft.md`; the corrected report matches actual raw outcomes. Neither instrument error nor corrected narrative changes the counted total. No value replay or whole-L14/M19 closure is established.


## M18 heterogeneous install-publication probe — survivor, uncounted

[Raw report](/private/tmp/signaltree-isolated-M18-install-publication/report.json), [preregistration](/private/tmp/signaltree-isolated-M18-install-publication/PREREGISTRATION.md), [exact source substitution](/private/tmp/signaltree-isolated-M18-install-publication/source.patch), and [corrected execution log](/private/tmp/signaltree-isolated-M18-install-publication/execution-corrected.log). This is a separate bounded probe from the earlier owner-scheduler timing survivor. The isolated `tree-realization-adapter.ts` substitution changes only the heterogeneous scalar frame commit's `publish: false` to `publish: true`, keeping `advanceRevision: false` and the surrounding install/publication path unchanged.

All75 source modules were captured. Control → mutant → restored each reports **six held case rows and two unsupported case rows**, comprising **38 held assertions and two unsupported assertions**, zero violated assertions and zero execution-error rows. The two unsupported rows are `T14/accept/"A"` and `T14/reject/"A"`: native terminal disposition remains unavailable. They are not passes. The eight raw case rows/assertions/traces are identical across all three phases. Node exits **0/0/0** describe the runner's partial-scope execution policy, not full conformance or successful complete-law validation.

Actual V8 coverage records the source seam's enclosing `commitAndPublish`, `commit`, and `planHeterogeneousFrame` ranges with count2 in every phase. This inventory independently matched those report entries to the saved coverage files, matched stdout to report rows, and recomputed bundle hashes. The substitution executed but did not yield a measured half-state assertion failure in these workloads: **SURVIVOR, no M18 kill**. Lack of a red does not prove the mutant generally safe or close L13.

Original/restored source hash is `787e113601f19fbb6fe1c2190c85f4f9f99b21e95a29e816f818b5cc4940859b`; original/restored bundle hash is `db8c0496a75566ba9222fa1deb09b41c737a2834d9ec2fef7f113adf8284423b`. Both are identical after restoration. The report records empty live-source and auxiliary divergence. Main production was not mutated by this probe; subsequent catalogue cleanup/promotion is a separate action, not mutation restoration or part of this captured evidence.

### Interrupted first attempt and resolver-only repair

The initial worker was interrupted by an automated content flag, with no semantic proof result from that interruption. The saved [initial script](/private/tmp/signaltree-isolated-M18-install-publication/run.initial.mjs) and [initial log](/private/tmp/signaltree-isolated-M18-install-publication/execution.log) retain the preceding `MODULE_NOT_FOUND` while locating pnpm's platform-specific esbuild binary. Main changed only the temporary runner's binary resolution to `createRequire(require.resolve('esbuild/package.json')).resolve('@esbuild/darwin-arm64/bin/esbuild')` and then ran all three phases. Independent script diff confirms only that resolver change. Neither the interruption nor module-resolution failure is a semantic result or kill. The counted total remains **17 source variants / 15 distinct IDs**.
