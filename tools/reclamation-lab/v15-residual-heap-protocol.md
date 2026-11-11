# V15 retained-store residual attribution

Preregistered after the final ten-cycle aging cohort showed continuing residual
heap growth despite zero retained entity lifetimes, value backings and sampled
row payloads. This is a diagnostic comparison of the exact final candidate
bundle, not a further runtime change or a general boundedness claim.

Run Node 24.15.0 with `--expose-gc` in each fresh child. The coordinator reserves
the intentional CPU/heap window. The input is the existing strict production
bundle (`ngDevMode=false`) and complete package archive from the final v15 aging
cohort. Both connection arms import that same bundle: “no recipient” omits the
runtime Link attachment, not the reachable Link code.

Eight serial children cross two factors, twice each in alternating order:
active collection Link versus no recipient; cumulative numeric lifetime ID
oracle versus current-cycle IDs only. Every child retains one tree for thirty
cycles, each adding 1,000 eight-field-plus-ID rows under a pending transaction
and rolling it back. Keys are reused. Full row equality before rollback, pending
one then zero, and empty final rows remain exact oracles. The active connection
must deliver after the first rollback, must never deliver before settlement,
and may only deliver an empty array. The absent-recipient arm must deliver none.

Every cycle checks all current lifetime IDs (and, in the cumulative arm, all
previous IDs): no retained lifetime or backing and no reclamation candidates may
remain. A weak row payload and transaction handle from each cycle must collect
while the tree remains alive. Three event-loop turns with forced GC precede
every heap checkpoint. The retained numeric oracle is the experimental factor;
the cycle record stores counts only. Existing accessible claim, position and
realization-descriptor registries are counted without materializing row facades.

Compare raw trajectories, especially cycles 10/20/30 and tail increments. Do not
attribute all residual bytes to an owner merely because its count grows. The
factorial interventions can show whether the cumulative oracle or active Link
is necessary for that growth; they do not identify an individual closure/map.
The process retains code, VM metadata and result records too. A final checkpoint
after dispose/destroy/helper return checks sampled tree/connection collection.

Two separate planted controls must fail: a skipped population is detected by
the full row oracle; a fabricated early Link delivery is detected before
settlement. This runner must not replace or mutate the original ten-cycle
cohort. Source, protocol, package, bundle and schedule hashes are bound before
execution; failed attempts remain in separate output directories.
