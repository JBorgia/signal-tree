# C20 recipient contract reconciliation

Test-only successor to C19. Runtime files and discovery configuration remain unchanged.
Snapshot SHA256: 9f14f5a476482cca596528aaed18cbf6be17122f73261e0fa047be40b641e94c.

Exactly twelve obsolete recipient-only hold cases are extracted verbatim into research-only originals. Their stronger positive counterparts assert current absence/payload, actual pending-input holds, surviving admission without declaration permission, no duplicate delivery, foreign owner state, and useful settlement. The thirteen other tests in the original files remain ordinary live tests.

Independent review first identified two assertion gaps: post-retirement permission inspection and missing post-settled checks. Both were corrected before the C20 run. A second independent source/discovery review verifies exact extraction and retained assertions.

Nx targeted composition: 25 passed across three files, exit 0. SOURCE-AFTER verifies unchanged. Twelve replacement cases and thirteen counterweights are not additional runtime fixes. Full verification remains incomplete; C19's large-batch stall, point-work budget, clear guard sensitivity and API-surface qualification remain separate.

Two startup attempts were interrupted and preserved; neither supplies a test verdict. The successful run uses its own diagnostic sink and explicit Nx cache/workspace-data directories. Cold graph startup discovered archived evidence configurations; no timing comparison is claimed. Spec-types passes its unchanged ratchet; source hashes remain unchanged.

No budget changes, activation, merge, push, tag or release.
