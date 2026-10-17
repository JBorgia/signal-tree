# Qualification failure-ledger reconciliation

Historical counts are verdict changes, not independent production defects.
All348 prior changed cases were matched by file/name/occurrence to current output;
none was missing. Current messages and old messages remain in the archived JSON.

| Historical group | Count | Current status | Interpretation |
| --- | ---: | --- | --- |
| Incumbent-runtime-coupled fixtures | 53 | 53 red | Observation did not execute; equivalent B coverage unfulfilled |
| Changed refusal | 37 | 37 red | Reasons can change; no blanket capability or defect verdict |
| Missing observation | 12 | 12 red | Compatibility gap; not waived as internal detail |
| Hidden-collection publication | 6 | 6 red | Executed public failures |
| Inspection participation | 2 | 2 red | Scalar data loss reproduced; later entity case now refuses |
| Large preparation | 2 | 2 red | Spread-argument RangeError |
| Expected failure now succeeds | 2 | 2 red it.fails | Desired-behavior gains, preserved assertions |
| Global comparator | 1 | 1 red | Selected harness also changes nominal incumbent arm |
| Other assertion differences | 233 | 35 pass,198 red | Causal accounting incomplete; preserve uncertainty |

The current default-to-B ledger has440 changes:55 runtime-coupled,4 inspection,
330 other assertion differences,28 refusal differences,12 observation gaps,
1comparator,2large-preparation,2expected-failure gains,6hidden-publication.
These are message/source classifications and must not be mistaken for exhaustive
root-cause diagnoses. The archived row-level ledger permits independent reclassification.
No unmatched prior case was quietly dropped.

Freshly identified members of the generic group include six bulk remove/clear
rollback failures with the same-target predecessor proof cause. Existing placement
policy cases still pass. Other generic failures remain unresolved: rejection does
not require guessing their cause, while acceptance would require resolving them.
The raw ledger retains every exact expected/actual message and stack.

The original rekey and removed-anchor public replays and stale exact-order failure
have later passing bounded evidence. This does not close every lifetime-anchor or
restoration assertion. Prior detailed source findings remain in qualification/
and are not overwritten. Dynamic construction and shared Link destruction
limitations are separately described in RESULTS.md.
