# Prepared membership order handoff

Frozen candidate manifest `89711d0f17704e7b1ac92bd5076fec4e115d45be0571c441c2a8555538846a67` (3,033 files), based on exact C8a. Three runtime files carry already-prepared physical order endpoints to the membership observer. No ordinary proof or new live-order snapshot is introduced. Independent mechanism review preceded implementation; final implementation review is pending.

First unchanged predecessor controls: 4 pass / 2 fail (existing-only and mixed overwrite prepend omit survivor ordering). Repaired six controls pass. Seven additional controls pass: canonical mixed setAll event, immutable endpoints under listener reentry, inspection physical order separated from ordinary proof, and active membership observation adding no source snapshots at 32/1,024 rows for fresh/existing prepends. Source types and the unchanged spec-types ratchet pass.

Affected membership/completion run: 272 pass. Final frozen new/legacy/placement controls: 29 pass. Counts overlap, not a unique total. Final diagnostic output is optional; semantic assertions always execute. Fresh legacy add+reorder oracle is aligned narrowly to an exact final-neighbour add under the reviewed end-state contract; genuine existing-lifetime movement still requires reorder. First tests/logs and helper corrections are preserved with their rationale in ORACLE-DISPOSITION.md and FIXTURE-SINK-NOTE.md.

The supplied order comparison is O(N) over existing endpoint arrays when a reorder exists. No CPU, heap, artifact budget or full qualification claim. Root runtime, B closure and production hold remain unchanged. No activation, push, publication or ceiling change.
