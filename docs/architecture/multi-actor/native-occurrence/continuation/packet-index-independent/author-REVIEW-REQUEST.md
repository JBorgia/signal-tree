# Independent review request

Review the exact candidate and patch against combined B, using BASE-SOURCE-SHA256.json and FREEZE.json. Read raw source/tests/logs; RESULTS is a claim to verify, not a preferred verdict.

Determine whether the per-prepare ordered sequence and last-subject index preserve actual producer semantics: duplicate/repeated ordinals, empty steps, authoredRemoval dedup, final partial/removal/rekey, restoredFields precedence, original forEdit identity and physical pairing, deferred point aggregation, failure/reentry and responsibility-before-install atomicity.

Explicitly assess the new private admission guard and delayed support capture. The five changed private mutation/capture discriminators are preserved against B. Is the guarded structure exactly the needed boundary, and does any legitimate source producer mutate it? Payloads and requirement cells are not deep frozen or cloned.

Do not overlook the cost tradeoff: finite population array construction becomes linear at the counted sites, while original point visits increase 14400→27600 and still fail <2000. This candidate is not overall green. Three structural-sequence failures reproduce on unmodified B and remain unresolved. No CPU/OOM claim or new ceiling is supplied.

Use a fresh disposable copy; do not patch this frozen candidate. Main owns integration and final architectural authority.
