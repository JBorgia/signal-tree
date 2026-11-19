# Provenance repair verified

The archival caveat in REVIEW.md is resolved. All COMPOSITION.json `from` files now hash to their recorded layer SHA256. Both original import-conflict stages are retained separately; removing only conflict markers and retaining both import sets independently reconstructs the resolved sources exactly. MERGE-RESOLUTION.json matches those paths and final hashes. PROVENANCE-RECHECK.json additionally records the preserved conflict-stage hashes.

Frozen candidate MANIFEST remains2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd, byte-identical to the independently reviewed manifest; all3102 candidate files still match. No source/test changes or replay. Earlier LAYER-AUDIT.json remains historical evidence of the original staging state; this addendum records the repair without overwriting that observation.

The eight independent dynamic regressions remain outside this frozen candidate. Their later promotion must have a distinct source/test manifest; prior95-case result includes the own-copy overlay, while Main frozen broad runs retain their own exact discovery identity. No pending promotion or broad result is inferred here.
