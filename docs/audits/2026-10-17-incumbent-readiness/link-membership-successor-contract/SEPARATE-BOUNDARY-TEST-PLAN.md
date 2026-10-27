# Separate delivery/participant boundary controls — before execution

Five added cases drafted outside runtime. Existing ordinary-member-publication-facts3 and heterogeneous-reentry-publication1 remain byte-identical and are explicitly included in the future focused command. Runtime2dacae7b is unchanged; no tests execute here.

Public mixed-undo cases all restore left.a1 and right.a11/b12 from one undoable unit. A public right-row onUpdate callback authors newer work once. The tests assert complete restored physical snapshot at that callback, useful final native state and endpoint payload; no private capture hook is represented as public behavior.

1. Reverse forward authored constituent order (b60 before a50). Undo delivery callback writes a777. Final physical and last endpoint must retain a777/b12; older reversal cannot overwrite the callback or lose b restoration.
2. Callback writes a disjoint field `note:99` on a after n restoration. Final a.n11/b.n12 plus a.note99. An older whole-row notification must not erase the later field.
3. Queued preflight: after mixed undo/callback777, synchronously flush path admission and author newer a888 before microtasks/I/O. Existing link-inflight-settlement-audit's queued-preflight case establishes that admission is not an endpoint start. Require no start at that synchronous checkpoint and only current a888/b12 afterward, never obsolete restored11/callback777 as a fresh later send.
4. In-flight serialization: keep the forward a50/b60 request unresolved, undo and callback-write777, require no second request while first is active. Acknowledgment must produce one current corrective777/b12 request with maximum active count1. The old started forward packet is permitted and immutable.
5. Private coexistence/release: use existing registerMembershipPublication twice alongside an armed Link. Each participant returns its own precomputed internal record and completion token. Both records/completions must be used; releasing A leaves B and Link useful; releasing B leaves Link useful. Do not assert participant invocation order or add a registration API. This is a private controlled participant test, not an application callback/public API guarantee. Current duplicate-registration first failures remain historical evidence, never overwritten.

No callback-throw case is added: exact public tap reporting/async containment needs its separate established error controls, and adding an ambiguous thrown-value oracle would obscure this chronology vector. Existing invalidation/error/recovery controls remain independently required. No GC/resource-retention claim follows from release-callback counts.

Proposed future Nx command after parent freezes source/tests: `corepack pnpm exec nx test kernel --testFile=src/lib/separate-boundary-contract.spec.ts --testFile=src/lib/ordinary-member-publication-facts.spec.ts --testFile=src/lib/internals/causal-runtime/heterogeneous-reentry-publication.spec.ts --skip-nx-cache`, with pinned Node/pnpm and immutable source manifests. No broad suite is requested.

Preregistered identities (no run):

- `/private/tmp/link-membership-successor-contract/packages/kernel/src/lib/ordinary-member-publication-facts.spec.ts`: `541633e80cba180fae6020593c95b5f88c5ca4de65fde488853ee6e16bfe2c70`.
- `/private/tmp/link-membership-successor-contract/packages/kernel/src/lib/internals/causal-runtime/heterogeneous-reentry-publication.spec.ts`: `af6b26df9c06e0c62bc19e97bc0dd1ecded0fef6666547016b0b610380e2feb1`.
- `/private/tmp/link-membership-successor-contract-evidence/separate-boundary-contract.spec.ts`: `67cbeaee99c14287d4b59532edfe50bce5035a53f45873d55aaf8f64a4bd7966`.

## Preparation-reentry addition (before execution)

A sixth case starts foreign q synchronously from the existing optional membership
preparer while authoring omission of x. q therefore exists before installation;
settling earlier p alone must not release the omission payload. Settling q sends
{y:0}. The callback runs once and is not replayed to refresh metadata. This uses
the existing registration seam and is expected to stop at its known collision on
the rejected baseline. It is distinct from q opening after authorship but before
Link delivery, which must not extend a fixed window. No runtime result is implied.
