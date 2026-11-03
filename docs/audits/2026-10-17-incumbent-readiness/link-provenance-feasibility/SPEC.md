# Bounded Link provenance feasibility — preregistered

Source: b7f93463cbdf439d74d33a2834f87fd58856dd39. Production safe hold unchanged.
Owner premise: “Direct unrelated writes that must progress”; “Synchronous reactive
copies that must remain held”; “Deferred callbacks where provenance is unavailable—
handled explicitly, never guessed.” No new public API or release freeze.

This is an executable scalar responsibility model plus an actual-kernel observation
probe, not an integrated Link candidate. Model instrumentation is explicit and cannot
be cited as already available production tracking. No ownership of subscriber writes
is transferred to a transaction. Metadata concerns permission to publish only.

Observable proposal: each installed value revision carries a dependency set. A
tracked read unions those facts into the current synchronous execution frame.
Notification delivery seeds a frame from the delivered revision, including callback
argument dependency even if no getter runs. Nested callbacks stack frames, restoring
in finally; queued notifications retain their revision's label, not the later value's.
An authored overwrite replaces the old location label with the current frame's
accumulated facts plus its transaction label. This is conservative control/data-flow
tracking: a constant write after a dependent read in the same frame remains held.

Confirmation resolves a token as committed. Rejection does NOT make a dependent
copied value publishable merely because no transaction remains pending. A surviving
copy of rejected truth remains ineligible until a new eligible value replaces it.
No automatic rollback of derived application state is invented. Labels may outlive
pending handles while a current value, queued delivery or active frame needs them.
No whole-store canonical mirror; model value storage only stands for native values.
Reclamation of labels is checked at last model reference, not claimed for production.

Prewritten cases (assertions frozen before model execution):
1. Trusted fresh external input y progresses while x pending (conditional capability).
2. Tracked callback argument x→y remains held with no read call.
3. Multi-hop x→y→z remains held; confirmation allows final z.
4. Tracked getter x read before y write remains held.
5. New trusted fresh overwrite y releases y, leaves dependent z held.
6. Same-value overwrite replaces publication provenance (revision, not equality).
7. Constant write after dependent read in same frame remains conservatively held.
8. Rejection alone never releases copied rejected payload; corrective rewrite does.
9. Nested settlement does not discard another pending token; retry has stable result.
10. Throw restores outer context, preserves already-authored dependency, and does not
    contaminate later independent frames.
11. Queued old delivery after newer overwrite retains original dependency.
12. Latest endpoint admission rechecks after reentrant write/settlement.
13. Unknown callback is held; absent execution metadata cannot mean independence.
14. An async closure copying x and an async constant write y=7 have identical kernel
    mutation metadata at y. Probe both with pending x=7. Record writes and sends.
15. Policy witness: classifying unscoped writes clean leaks the deferred copy;
    classifying them unknown blocks the direct unrelated control. Neither passes the
    complete requirement automatically. Trusted-input model scope is a hypothesis
    requiring a real host/application boundary, NOT an authorized API.
16. Destroy drops model value/queue references; obligation-free tokens reclaimed.

Runtime observability investigation must cover native computed caches and scheduling,
not assume all framework effects use notifier delivery. Universal JS data flow,
closure variables, native promise callbacks and third-party scheduler provenance are
outside the instrumentation. Unknown outcomes remain held explicitly in model.

Run model with node --test model.test.mjs (research executable, not package suite).
Run kernel-probe.mjs using repo esbuild; capture all loaded source hashes, no runtime
source edits. Preserve first red output. No broad suite/benchmark: production bytes
are unchanged. Independent review challenges framing and interpretation separately.
