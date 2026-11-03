# Independent I1 review

Reviewer: independent publication_contract agent, read-only source and raw-run review.
Question: indexed-tail equivalence to the original D2 snapshot, and validity of
fixed-mutation work attribution. No publication/API contract change proposed.

Finding: no concrete semantic blocker. Conditional pre-clone sampling preserves
the original time and fact, subject anchors, undefined handling, subsequent fresh
subject ordering, and physical-revision reentry guard. Mixed setAll retains the
original pre-state tail even if removed by earlier staged instructions.

Two measurement findings were verified and addressed:

1. Initial probe did not prove updateOne changed the row before removal. Preserve
   point-work-initial.mjs and alias-fixed runs; final point-work.mjs asserts n=2
   before removal outside measured work. All ten useful-update runs pass.
2. Named counters cover lastActiveKey and neighborSubjectsForKey, not every index
   access. Report those exact counters, never total indexed work or total cost.

Root verified activeKeysSnapshot's one-push-per-linked-node implementation,
lastActiveKey's tail pointer, indexed neighbor lookup, recorded callers and
unchanged zero-scan historical test. Independent anchor controls also pass32/32
on each of D2 and D2I, including98 injected rich-capture-fault hits per lane.
These results support scan removal only; they do not independently establish
capture or publication correctness. Separate prior controls are retained.

## Independent interpretation of the new ordinary-input counterexample

The reviewer verified all five raw manifests and outputs in omitted-leaf-evidence:
baseline passes4/4; D2,D2I,OAP,OAPI each fail4/4 with stable inputs. D's disposition
validator explicitly refuses previously supported rollback, retains pending1 and
open scope, and refuses retry. The scalar-only case excludes I1 and entity/Vue
publication paths; attribution is independently supported by the lane comparison.
Exact mismatched journal/settlement fields were not traced, so no more specific
repair diagnosis is claimed.

This differs from the original injected-capture failure: that falsely succeeded
and lost authority. This ordinary-input regression refuses and retains authority.
It does not establish an ordinary trigger for the original injected failure.
The narrow I1 correction remains supported; the combined integration is blocked.
