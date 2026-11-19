> Superseded recommendation: read PHASE-ADJUDICATION.md first. The later chronology establishes a post-install failure and does not justify a six-read invariant or getter-count repair. This earlier analysis/proposal is retained for history, not implementation authorization.

# Equal-whole getter attribution — read-only investigation

The failed successor remains frozen and uncomposed. All C16 and failed-successor manifest paths were verified before copying and again after investigation; SOURCE-VERIFICATION.json records identities. Only a new trace spec was added to isolated copies. Runtime source unchanged. Each arm ran nine observation cases through pinned Nx: three routes × stable / seventh-read throw / second-read reentry. These trace cases collect evidence; their passing completion is not a correctness verdict. Raw commands/logs/results are under c16/runs/stacks and failed/runs/stacks.

## Exact read attribution

All three routes (setAll, replaceOne, direct row) have the same stack sequence in the matched subscribed-field workload. Full stacks: c16-getter-stacks.json and failed-getter-stacks.json; compact extraction: READ-SITES.json.

| Existing C16 ordinal | Failed ordinal | Getter site and role |
| --- | --- | --- |
| 1 | 2 | entity-signal publicationFields for physical packet edit (C16:1588; failed:1612) |
| 2 | removed | publicationFields for flat ordinary packet edit (C16:1589) |
| 3 | 1, moved earlier | publicationFields for step ordinary edit (C16:1596; failed:1601) |
| absent | 3, new | experimental-publication/entity.ts:122 proposal → fieldValue(edit.after,key) |
| absent | 4, new | entity.ts:187 physical-view `same` comparison → fieldValue(physical.after,key) |
| absent | 5, new | entity-egress-projection.ts:52 payload projection → row[key] |
| 4 | 6 | entity-signal computeField → subscribed location settlement |
| 5 | 7 | path-notifier.ts:125 changedSubjectFieldKeys |
| 6 | 8 | transactions.ts:2150 captureEffects during notification flush |

Thus net +2 is **three newly reached reads minus one removed existing read**, with existing preparation reads also reordered. It is not two new field reads and is not a new native value notification. All six/eight are actual getter executions. The new seventh-read sentinel lands at existing PathNotifier field comparison after installation because earlier additional reads shifted the count. C16 never reaches it. The failed successor returns the exact sentinel on all three routes; later work still delivers the installed row. The reentry-on-read2 case shifts from flat ordinary comparison to physical comparison, followed by three new publication reads before the existing stale-outer refusal; inner write9 survives on both arms.

## Earliest existing values, and what is not a snapshot

`EntityValueTransition` is a frozen shell holding physicalAfter/ordinaryAfter row references. Explicit whole replacement keeps the original accessor-bearing object. `EntityValueStore.prepareValueTransition` stages accessors only for derive; its explicit whole ordinaryAfter and physicalAfter are the same reference, so the retainDivergence comparison does not supply a field snapshot. `physicalValuesByStep`, `valueTransitions`, `valueResults`, `ordinaryPlan.byStep` and admission's frozen edit metadata preserve references/identity, not evaluated getter values. Calling these “immutable prepared field values” would be unsupported.

The earliest evaluated input value in this witness is **physical publicationFields**: C16 entity-signal.ts:2525 compares `a[key]` with `b[key]` at callsite1588. It discards the values after computing the changed-key list. Flat ordinary and step ordinary scans evaluate again at1589/1596; the final step scan is the existing sample corresponding to that step's ordinary edit. These returned values exist transiently at their present evaluation sites and can be retained without a new read. Do not reuse the physical sample as the ordinary sample blindly: inspection divergence, repeated steps and stateful accessors distinguish them.

The installed NativeFieldEndpoint already holds prior value/presence, but equality with the actual offered ordinary value must come from the existing ordinary comparison. Merely copying its prior value without that comparison would substitute old authority for the explicitly supplied field. A later new proposal also creates a value-bearing endpoint, but rereading to create it is precisely one of the added callbacks.

## Disposition

Fresh evidence needs the offered field's evaluated value and presence; it does **not inherently require invoking its getter again** when the same source preparation already evaluated that exact field. Physical view equality also does not inherently need reevaluation when that exact physical comparison has already run. Recipient payloads need selected values, not independent getter invocations per recipient.

The source facts are sufficient for a bounded **retain-existing-evaluations** mechanism, proposed in SUCCESSOR-MECHANISM.md. They are not already stored in a universally reusable immutable row. The successor must retain and transport the relevant existing evaluation results, and preserve the original evaluation order/count/error sites rather than repeat the failed patch's read deduplication/reordering. No mechanism implementation, ablation patch, altered getter restriction, eager row staging, or broad suite ran here.
