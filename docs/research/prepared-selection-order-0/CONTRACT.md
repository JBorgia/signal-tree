# Prepared selection publication experiment

Preserve evidence checkpoint c267fe446c37d29dccf3b80d6deb44e767abc864 and its
unchanged replays. Runtime baseline remains 19a5bd034d5ebef262f637c397bb41fe50a6a1e3.
D2, S1, M1 and A1 remain independent patches, not accepted integration.

Observed boundary: target-transition installs all prepared collections and scalar
locations before publishing any collection. However selection is not included
in that installation: each collection publisher runs path notifications and
replay taps, then overwrites activeId with its saved target. Thus completing
row/scalar installation alone does not complete the selection disposition.

Hypothesis A (OA): move the existing prepared selection replacement to the end
of that collection's physical install, after its structural/value target and
before closing internal membership observation. All selections then install
before any replay tap runs, using the existing all-install-before-all-publish
loop and invalidation group. Publication no longer writes saved selection.
This changes the physical selection available to writes before taps; it does
not move replay taps out of their existing phase, change their ordering, force
native cached reads fresh inside a group, or change exception policy. Existing
callback-read and held-projection tests remain acceptance tests. The change is
a hypothesis until those tests and coherent delivered snapshots pass.

Hypothesis B (OB): retain selection's deferred publication and use the existing
location-write interception port to record a private per-selection write
revision. Preparation saves that revision; deferred selection may install only
if no selection write has intervened. Every write attempt, including no-op and
ABA writes, advances identity before proceeding. This is not value equality.
Existing tree/subject physical revision clocks do not include activeId, and
scalar turn ownership does not cover this auxiliary location. The experiment
therefore adds local revision bookkeeping via an existing write port; it does
not claim an existing global clock is sufficient or expose any new API. Test
same-collection and cross-collection callbacks. No permanent observer resource
or externally reachable revision is introduced.

A and B answer different questions: A prevents deferred prepared selection from
encountering callback-authored writes at all; B protects a deferred write if
that ordering is retained. Neither is presumed correct. Existing mutation frames
own row installation; selection remains its existing location, not row data.

T1 is separate: declare setAll's planned subject-id array readonly, matching
planFreshSubjectIds; consumers only index/read it. No cast removes readonly.
Previously blocked Nx invocations remain recorded as not executed.

Acceptance requires the original C and C→X falsifiers; C→A (original value),
nested scalar/row writes, throwing callbacks, removed selection and
cross-collection delivery. Check actual callback execution, coherent delivered
owned projections, final selection, pending disposition and retry. A callback
failure after physical commit follows existing committed-settlement semantics:
authority retires, first callback error propagates, retry cannot undo newer
writes. Preparation failure and precommit refusal remain distinct controls.

First OA/OB callback controls preserve C/ABA/nested writes, but a throwing tap
exits prepared publication before updateSignals, leaving owned collection caches
speculative after physical restoration and authority retirement. Preserve these
first failures. Additional bounded OA publication hypothesis (PS): stage every
changed subject epoch/binding dependency, collection version and physical revision
before starting path/replay callback delivery. This uses the existing grouped
invalidation machinery; external native delivery remains at group exit. Callback
order and stop-on-first-throw within a collection remain unchanged. The same
first callback error must propagate. This staging change must pass existing tap
read semantics, including held projections; it is not assumed invisible merely
because it is internal.
