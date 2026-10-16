# Final independent slice review

Inspected final arms and unchanged 40-case tests; independently ran each arm through tests.mjs, producing review-final-a.json and review-final-b.json. Both pass 40/40. No implementation/test edits by reviewer.

Reviewed hashes:
- A: 3b13ef34da17265b9b53d734fcf5b6801e6b7f99f4217872e96fa6689c90e585
- B: 7bbbb82b685c8f6bd9ef5ae8f3bda595a3b986a3155c693fb1620bdf58bd27f2
- tests: 57aa667fd9a6143acb153176bedd6ff1e8599b3833f4255549dfcfe6649df614

## Remaining concrete finding

Both arms can replace the original callback exception during failed-abort reporting. Executable: `node /private/tmp/st-authority-slice-20261016/review-final-adversarial.mjs`. Give an extensible Error a nonconfigurable own recovery property, then begin a callback which writes x=1, arms a cleanup fault, and throws that Error. Both throw TypeError: Cannot redefine property: recovery, rather than the original Error. The owner remains pending without an exposed usable handle. This violates unconditional original exception preservation. Recovery reporting must be best-effort and collision safe; the contract also needs a usable explicit fallback channel when attaching to an Error is impossible. A similarly must avoid replacing the original if attaching recoveryError fails. This is shared prototype hardening, not evidence favoring either authority architecture.

## Confirmed corrections and limits

A's entity preparation now captures revision before payload cloning; B clones branch inputs and outputs. The original differences are corrected under the experimental rules. Repeated absent scalar removal is now an explicit no-op in both, and absent entity removal refuses in both. These reflect the checked control policies.

The staged afterPrepared:1 fault now fires after first location preparation and before any multi-location installation. A modifies cloned pending Maps and projection copies; B modifies cloned ledgers and plans. The fault leaves original authority and terminality intact; retry passes. This establishes a meaningful staged failure boundary rather than only an entry guard. It does not cover engine allocation failure during Map installation.

Unexpected observer errors are drained and asserted at each normal test completion, closing the original swallowed-assertion gap. The intentional observer-error test still uses includes(marker) and consumes all errors, so it could hide extra errors in that one scenario; this does not invalidate the normal observer tests.

Retention sizes correspond to actual maps in source. A canonical/native counts disclose duplicate storage; B has no persistent full-store mirror and drops ledger locations on last contribution. The reclamation scenario exercises retained refs after repeated removals and final pending retirement. These are modeled logical retention counts, not physical heap reclamation evidence. Stats enumerate debug maps and must remain outside measured point operations.

The masked settlement test asserts observed values and terminality but permits zero deliveries. That accurately checks no obsolete value exposure, not guaranteed masked-settlement publication. Both prototype implementations publish, as source inspection confirms. Do not describe this test as proving notification existence.

A and B remain valid distinct authority models for the bounded domain. Their sequence selection is not naive unconditional before-value restoration. Common copied payload behavior and normalized installedUnits/observerDeliveries now improve cost comparison, but original publications and visitedLocations counters still have different meanings. A separates resolution visits; B folds contribution visits into visitedLocations. B payload-copy counts include read copies, unlike A's separately classified read copies. Any workload with reads must report that distinction.

Control failures under stricter experimental output-copy or mandatory getter-update rejection requirements are capability differences, not established incumbent defects or compatibility acceptance. Neutral Map-based reactive models do not establish framework-integration or production performance. No whole-contract clean bill until the shared exception-reporting finding is resolved or explicitly scoped, and no preferred arm follows from this review.
