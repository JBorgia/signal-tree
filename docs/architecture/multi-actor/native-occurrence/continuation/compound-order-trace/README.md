# Compound ordinary placement causal trace

Original unchanged two-file replay on combined B: 2 pass / 2 fail (runs/compound-order in Main combined B). Source is captured in SOURCE.json. The isolated trace changes only two console logs in prepareOrdinaryRealization; original fixture/assertions unchanged. It reproduces the same ordinary Link order failure. No runtime correction selected here.

The ordinary inverse has four edits: remove fresh A(S5), restore old A(S1) with successor B(S2), remove X(S4), restore B(S2) with predecessor A(S1) and successor C(S3). At preparation entry physicalEffects is empty: physical state already satisfies the separately selected topology, so ordinary placement alone needs restoration.

Sequential ordinary placement inserts A while B is absent, placing A after C. B is then inserted before C. The resulting recorded interval says B→C→A, matching the actual outgoing payload; original ordinary order was A→B→C. Exact effects and final interval are in runs/trace/first.log, ORDER-TRACE-PREP and ORDER-TRACE-INSTALL.

This differs from physical placement planning, which already orders restores against same-unit restored neighbors. The ordinary value loop needs sequential lifetime/field validation; reordering all effects is not justified. The missing operation is final ordinary placement preparation against the whole proposed membership, with lifetime-sensitive successor/predecessor policy and capture/publication derived from the same final facts. Payload edits must retain execution dependencies. No global ordering policy or inspection-display order is inferred here.

Further review must distinguish repeated writes of the same lifetime, cyclic anchor chains with no surviving neighbor, anchors removed in the same inverse, key occupancy, and preparation/reentry refusal. This trace alone does not select a repair, prove generic topology sufficiency or qualify a native candidate.
