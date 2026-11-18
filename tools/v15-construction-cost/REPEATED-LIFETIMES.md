# Bounded follow-up to adverse CPU rows

The first completed cohort remains intact. Its neutral ordinary and late-root
whole-episode CPU medians were adverse, including construction, writes and
attachment contributions. This follow-up was specified before timing to test
whether those costs recur across complete store lifetimes after cold compilation.
It does not measure one long-lived store or general application throughput.

Use the exact original admitted packet-2 production bundles and frozen workload.
For ordinary (128 eight-field trees) and late-root (32 eight-field trees), retain
both neutral and Angular-native carriers and all three implementation arms.
Each child runs twelve complete useful lifetimes with the original 64 writes
per tree, held snapshots, and applicable late root attachment/delivery/disposal.
Every episode runs every original intermediate/final oracle and destruction.
Return the full raw stage and oracle record for every episode. Import is separate.

`node repeated-lifetimes.mjs PACKET controls NEW_OUTPUT` runs all twelve
arm/carrier/profile combinations with positive and omitted-final-episode controls.
The latter must fail `episode-count-oracle`; normal children must agree on all
episode oracles. No failed control can be discarded.

`node repeated-lifetimes.mjs PACKET cpu NEW_OUTPUT` runs seven matched rounds
for each profile/carrier. Each round includes each candidate plus independent
baseline and adjacent baseline A/A, alternating order: 112 fresh serial children.
No forced GC and no overlapping build, CPU or heap workload. Automatic GC remains
part of repeated CPU cost. Host load is recorded without claiming exclusivity.

Analyze the first cold episode, the sum of remaining eleven episodes, and all
twelve separately. Report stage, whole-episode, and outer repeated-loop timing;
the latter includes wrapper checks. Retain all seven paired differences and A/A
dispersion. These are descriptive distributions, not confidence intervals. Do not
discard the original adverse sample set or call below-noise differences wins.
