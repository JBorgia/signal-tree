# Independent packet oracle alignment review

Bounded recommendation: accept the eight private-oracle alignments as test-contract reconciliation. No runtime, public-payload, structural-sequence, point-cost or activation acceptance follows. This is source/assertion review; I did not rerun Hume's suites or treat Main's source check as independent execution.

Verified candidate manifest SHA-256 `97aaedeef46bb224ce28e063798b2ea868d7a03ef519adf157293a577415754e`; only packet-index-adversarial.spec.ts and packet-index-review.spec.ts differ from supplied baseline manifest542125…. All manifest bytes verify (PACKET-VERIFICATION.json). Original complete files remain under the author's originals/. Compared their assertions with the actual new files and tests.patch.

Authority boundary read in source: AdmissionMetadata in internals/entity-publication.ts:48–98 explicitly transfers private source-owned metadata arrays/edit shells, preserving edit identity; mutable shells receive copied field lists/structural descriptors, frozen shells with borrowed mutable metadata are refused. Payload before/after values and proof objects are not transferred/frozen. This supports immediate language-level mutation refusal; it does not require the older delayed 'admission structure changed' error or permit a generic thrown-TypeError oracle.

| Original case | Independent assessment |
|---|---|
| Restored same-subject precedence | Only nested structural metadata is frozen. proposed11 and selected8 remain distinct; installed before endpoint must be the exact restored5 object, not just equal5. Negative presence clears. Extra test retains original unsafe shell and asserts the precise source error, zero callbacks/installation, and unchanged/unfrozen borrowed descriptor. |
| Append mutation | Reflect.set must return false, admitted array remains exact, preparation runs once, responsibility is initially uninstalled, then useful source/responsibility7 actually installs. Not an early-error-only pass. |
| Subject mutation | Same mechanism; original subject1 remains, subject2 must remain absent after actual install. |
| Structural-kind mutation | Kind remains add and actual row/source7 installs. No conversion to a remove/noop. |
| Recipient prepare append | Counts callback execution; captures error exactly at append; requires TypeError and propagated identity; verifies frozen unchanged contents, no completion, no source rows or responsibility install. An unrelated TypeError before callback cannot pass. |
| Retired held support | Requires a support function, unknown proof both before/after real retirement, source row count0, denied truncation and unchanged array. Does not pretend successful corruption is supported input. |
| Finalizer append refusal | Requires attempts0 before finalization and1 after; exact append error identity propagates, completion0 and both installations absent. Missing finalizer or unrelated TypeError cannot pass. |
| Old stale-endpoint diagnostic | Remains an executing regression: denied99 append, attempts/completions1/1, admitted payload only7, installed responsibility7, later native endpoint7 and row count1. Removing installation/completion cannot pass. |

Useful unchanged controls remain: selection beats proposal when no restored endpoint, including certified absence; forEdit preserves original edit identities and distinct support for duplicate subjects; duplicate steps/ordinals compare the reverse-find reference and exact restored endpoint identity; later finalizer source reentry must retain99 and refuse stale7; payload getter reentry remains tested. These prevent interpreting the alignment as permission to discard endpoint precedence or source revision checks.

Caller payload remains outside the restriction. Unchanged packet-admission-r1.spec.ts explicitly checks row object identity/unfrozen payload, borrowed metadata copies, and actual public rows.setAll input array/row/nested tags mutability. Reading AdmissionMetadata confirms it freezes shell/membership/metadata, not edit.after or proof requirement. These are narrower and stronger evidence than calling every input 'private'. No tests changed public callers to frozen objects.

Reported29/29 and81/3 are Hume's preserved runs, not a new replay here. Structural-admission-sequence and point budget assertions remain unchanged. The unsafe-shape refusal test checks borrowed metadata remains writable; it does not claim all partial admission work is globally rollback-atomic. No blocker found in the alignment's stated scope.
