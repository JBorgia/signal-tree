# Selected-key restoration experiment

Starting checkpoint `9a09c4d1c652cad600bb54a74652dd1ef5a48837`; runtime baseline
`19a5bd034d5ebef262f637c397bb41fe50a6a1e3`. D2 and shared-publication S1 are
unchanged independent overlays. No new SDK or application API is proposed.

Existing active-entity tests establish: a selected key may be absent; selection
outlives a removed row; explicit clear clears selection; a selected live row's
rekey carries selection, while unrelated selection is unchanged. The omitted
collection README describes collection-path reintroduction clearing selection,
not every ordinary row re-add. Held entity facades bind to a subject lifetime,
not a reusable business key. Selection chooses the current membership at a key.

Commit `f2f34753` introduced prepared subject-following selection for structural
key handoff/permutation. Preserve this purpose. There is no supporting contract
that unresolved selected membership should clear the key. Never restore a
transaction-start selection snapshot over an independent later selection.

Two separately testable kernel hypotheses:

- M1: only when the selected key is absent, observe existing collection membership
  (`idsSignal`) before physically resolving that key. When present, retain only
  its subject dependency. Native dependency cleanup removes the membership edge
  on appearance and removes old selection edges on a selection change. No
  retained node is rebound. Stable-key tokens remain the comparison option:
  potentially narrower absent-key invalidation, but additional allocation,
  reclamation and lifetime responsibilities are not justified yet.
- A1: prepared transitions preserve the current selected key if it has no live
  subject or that subject has no target key. If the selected subject survives
  under another key, selection follows it as before. This corrects physical
  selection disposition, independently of any invalidation mechanism. Explicit
  clear and whole-collection reintroduction paths remain unchanged.

S1 remains a third, separate publication hypothesis: it batches native dirtiness
before synchronous delivery. M1/A1 do not claim to repair Vue's old serial
publication, and S1 cannot invent a missing dependency or recover discarded
selection. D2 captures responsibility independently and must satisfy the same
selection and projection contracts when combined.

Tests must record pre-removal, removed, installed/restored, publication and
post-rollback activeId; distinguish direct row, active projection and held
lifetime; include initial absence, same/new lifetimes, selection while absent,
rekey, unrelated writes, identity and dependency cleanup. Existing projection
matrix and prior falsifiers remain unchanged. Broader suites require independent
review and survival of both projection coherence and selection disposition.

Disposition after execution: M1+A1+S1 passes the focused missing-dependency and
projection controls, and A1 repairs the simple discarded-key trace. Combined
acceptance is nevertheless falsified by independent selection from replay taps.
The value-comparison A2 experiment also fails an ABA selection sequence. See
README and immutable first-result records; no runtime candidate is accepted.
