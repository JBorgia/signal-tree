# Independent bounded successor review

No runtime edits. Read four successor runtime files, design.md, NESTED-CONTRACT.md and focused specs. Two minimal private-adapter probes executed; these are internal handoff/fault-model counterexamples, not reproduced ordinary public transaction triggers.

## Blockers

1. **Preparation mutates admitted whole-row evidence.** In tree-realization-adapter point loop, `row.value = effect.after` directly aliases a whole-row effect's after-value. A subsequent field effect passes that object to assignPreparedSubjectValue. Probe `review-probe-alias.ts` supplies whole-row after `{id:'a',n:8}`, then field n after9. `preparePointRealization` returns a plan but the caller's original after-object is already `{id:'a',n:9}` before installation; actual tree remains7. `review-probe.log` preserves result. This contradicts the isolated preparation claim. It was inherited in physical preparation, but preserving ordered edit references does not cure it and may carry corrupted historical facts into ordinary preparation.

2. **The same realized value is evaluated twice and splits ordinary/physical truth.** New edit construction reads effect.after, then physical assignment reads it again. `review-probe.ts`/`review-probe-getter.log` uses one top-level n getter yielding8 then9. Preparation reads twice; installation gives physical9, and an ordinary transaction to10 rolls back8. The first captured edit determines ordinary authority while the second getter result determines physical target. Existing focused tests intentionally admit throwing/reentrant after getters, so accessor evaluation is already within the supported controlled preparation fault model. One coherent prepared realization must not manufacture this divergence. This is stronger than a test that only expects the throwing getter to abort.

No correction performed. Preserve these first observations. They do not disprove the ordered handoff mechanism, but current implementation is not acceptable under its stated preparation requirements.

## Scope and other findings

- Point path preflight rejects deeper nonstructural effects before frame/row target staging. It returns optional-capability absence, not successful realization or an accepted public refusal. Production transaction constructors inspected by the reachability record supply []/[key]; restoration's genuinely nested path uses other adapters. This supports a bounded optimization gate without claiming nested handling. General fallback still needs its own dual-truth qualification; unchanged code is not proof of correctness.
- The gate occurs after the structural branch; it must not be advertised as a global deep-effect guard. Mixed structural plans remain outside this successor.
- Top-level field edit uses defineProperty and explicit presence, preserving present undefined versus absent and literal dotted field names. Whole-row edit and later fields apply sequentially in the store. The alias blocker prevents accepting that sequence end-to-end yet.
- Captured prepared ordinary facts flow through existing metadata while physical notifications remain physical; no second settlement authority or public adapter export was introduced by these changes.
- Existing outer physical revision check protects against live reentry before installation. It does not detect mutation of effect.after data that is not a tree write, nor inconsistent duplicate getter results; hence the concrete probes above.
- No proof of arbitrary nested parent reconstruction, structural lifetime adoption, full-target restoration, memory/performance acceptance or broad qualification follows.

## Correction re-review

Original blockers and raw results above remain preserved. Independently inspected the corrected point loop and reran both unchanged probes against the frozen successor. Results in review-corrected.log, exact four-file source identities in review-corrected-source.sha256:

- Alias probe: caller's whole-row after remains n8; tree remains7 before installation; a plan is prepared. The physical target receives an isolated clone, so a later field edit no longer mutates the admitted whole-row value or the ordinary-edit copy.
- Getter probe: reads1, installed physical8, subsequent ordinary transaction rollback8. `effect.after` is read once into prepared value evidence; physical target and ordered ordinary edits derive from that evaluation.

The correction addresses both concrete blockers. It uses the existing deepClone contract; it does not establish universal arbitrary-object cloning/getter guarantees beyond that substrate, nor claim preparation free from all user reflection. The encompassing revision guard still validates after preparation.

Bounded disposition: no remaining blocker identified in this successor's top-level/whole-row point-handoff correction by this review. The known partial-restoration n/m recurrence is expressible without changing ownership semantics or public SDK. Worker-reported34/34 and typecheck are separate claims; this reviewer independently executed only the two exact probes and inspected source. Parent owns affected compatibility/recovery verification.

This permits considering the bounded successor together with parent's focused evidence; it does not finish slice1 gate obligations or qualify structural/full-target/nested missing-parent restoration. Deeper point decline remains optional-capability deferral, not successful nested handling or blanket permission to refuse a supported public operation. No adoption/release recommendation follows solely from this re-review.
