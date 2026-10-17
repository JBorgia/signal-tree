# B placement repair — pre-execution scope

Baseline: `7673f489f36d7be7f2d61e6fc4843ace0e5c48dd`.
Bounded request: lifetime-sensitive successor/predecessor resolution under the
approved successor policy. This is not acceptance of B. Reclamation, order
admission costs, stale ordering authority, payload semantics and other rejected
qualification findings remain separate. No model or policy assertions change.

The prior 20 public cases remain unchanged. The two B first failures are preserved
at the baseline: externally removed or replaced successor throws before live
predecessor fallback. A repair must make those required successes succeed while
preserving no-placement atomic refusal and same-settlement anchor resolution.

Additional discriminators identified before candidate execution:

- Original tail B following A, with an independent later append Z: restore A,B,Z.
  No successor originally is not the same as originally having no anchors.
- Originally neighborless B with later Z: preserve Z,B (existing case).
- Valid same-settlement removed-successor chain ending at tail remains a tail
  proof, not an unavailable external anchor.
- Cycles, malformed retained placement and read failures remain preparation errors;
  no broad catch converts them into missing successors or successful fallback.
- Same-target predecessor resolution must use proved target placement, never an
  assumed tail or self successor. Preserve existing successful controls; this
  repair is not permission for blanket refusal or new ordering semantics.

Native delta installation consumes only a resolved afterSubject. Merely retaining
beforeSubject or returning a still-missing successor will not implement fallback.
Resolution must remain proportional to touched facts and relevant anchor chains;
no collection snapshot is introduced for the point case.
