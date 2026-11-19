# Lazy-owner composition correction

C0 plus reviewed lazy-owner patch initially applied only two of three hunks. Ordinary-placement added a parameter to the following function signature, so the helper insertion context failed. The command sequence incorrectly continued into tests: 40 ReferenceError failures, 44 passes. This is a patch-assembly error, not 40 runtime mechanism defects. First partial source and rejected hunk preserved under first-failure; exact run/source identities under runs/lazy-placement-recipient.

Inserted the reviewed helper verbatim before the changed signature, preserving ordinaryPlacements transport and both reviewed call-site changes. No oracle or runtime policy changed. Subsequent checks use a new run directory. Original patch rejection and raw test output remain intact.
