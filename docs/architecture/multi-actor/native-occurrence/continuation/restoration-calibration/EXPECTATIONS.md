# Frozen before execution
Exact C21 input manifest 73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27. No source changes ship. Original specs/failures remain unchanged. N=3/32/256 only; no 130k invocation.

No acquired reader: undo row reads <=3N + zero singleton; redo <=12N + one currentIndex read.
Acquired restoration reader (snapshot, no subscribers): undo <=3N + one destroyed-state read; redo <=12N + one currentIndex and one destroyed-state read.
Freeze singleton provenance separately from per-row ceiling. Trace confirms exact singleton source counts and plain/traced parity. Do not simply allow an unexplained constant. Preserve all original row contents/order, write=N, tombstone=N, reader history/index and empty-state assertions, including both original import styles. Use soft budget assertions so semantic assertions and raw outputs still execute under mutants.

Temporary mutant V: duplicate actual canApplyEffect validation in the reached buildPreparedRealizationContext effect loop, preserving original validation and ordering afterward. Expect increased undo per-row reads and budget rejection; semantic results must remain correct. This models accidentally repeated prepared validation, not an injected counter.
Temporary mutant S: duplicate actual row snapshot evaluation in snapshotCollectionEntityValue, retaining the final returned snapshot. Expect increased redo per-row reads and budget rejection; semantic results must remain correct. This models discarded snapshot materialization, not an injected counter.
Run each independently from identical runtime bytes, record exact mutant patch, observed stacks/counts, semantic results and restore SHA256 after each. No counter implementation edits, no threshold/artifact-budget edits, no combined mutant. Baseline must pass first. Mutation kill requires reached extra real work plus failure specifically at calibrated work assertion, not mere process failure.

130k source expectations only: acquired reader undo 390001, redo 1560002 if the same linear bucket counts persist. These are not a new executed 130k result. Existing first undo failure remains evidence; redo remains unexecuted. Independent review required before composition. Private-counter optimization parked.
