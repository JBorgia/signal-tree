# Successor acceptance cases — written before native implementation

Design inputs, not run results. Keep every A1 first failure and original assertion.
The following conditions are additions and combinations, not replacements for
existing tests. Production remains87; d0e7 A1 stays immutable.

| ID | Sequence / scope | Required observations |
| --- | --- | --- |
| G1 | Baseline aggregate x0/y0; p writes x7; after p returns, declare dependent[p] around literal x7; independent y8 | p still owns native x; no forced value event for x7; x receipt superseded, y receipt held; confirm p yields useful x7/y8; y declaration valid |
| G2 | Same as G1, reject p | Native x0/y8; no stale x7 send from terminalizing p; inspection/authority coherent; ordinary fresh proof or actual conservative gate required for corrected send |
| G3 | p writes another source; ordinary x7 copy declared[p]; q stays pending; reject p | x7 survives as ordinary application truth; old permission remains unusable; fresh complete independent x7 setter permits useful progress if all untouched support is safe; no forced value event |
| G4 | G1 held projection, then independent literal replacements x2/y3 while p remains pending | Useful x2/y3; p not confirmed by publication; old receipts terminal, old contributing proofs retired only when replaced; unrelated q may remain pending |
| G5 | Untouched pending ancestor/lifetime vs actually consumed updater value | Former valid-but-held; latter omitted known input contradicts independent declaration after write, preserving write conservatively |
| G6 | Partial branch, whole branch, root and nested collection | Actual authored footprint only; no outer after-image certification; updater input captured before callback; partial failure preserves installed prefix responsibility |
| G7 | Two connections, nested validation getters/reporter reentry, async misuse | No permission before every relevant validation horizon completes; no shared grant across connections; primary errors unchanged; async continuation needs fresh declaration |
| G8 | Pending receipt superseded by later projection while old x fact still contributes; then p confirms | Confirmation still wakes live x support despite terminal old receipt; latest useful projection sends; retained old receipt never revives |
| G9 | Pure no-op vs equal support replacement, ABA, net-zero membership, no setter | Exact support/no-write distinction; completion independent of value events; no lost useful unsent predecessor; settled does not strand work |
| P1 | Preserved no-Link and default-Link omit7→inspection99→transaction7→inspect→rollback | Meaningful membership effect; P true/O false before adoption, true/true pending, false/false after rollback; no ordinary-absence inferred from undefined |
| P2 | P absent/O present; inspected omission then ordinary retained-child write | Initial P/O true/true; inspection false/true; ordinary equal y7 true/true; rejection leaves true/true y7. No invented O membership/value compensation; do not restore inspection-only absence |
| P3 | Present undefined, whole replacement, partial outer update, retained point, inStructuralWrite | Presence/value independent; no duplicate capture; only authored path/supplied membership changes; retained sibling hidden |
| P4 | Equality/preparation/capture failure and reentrant newer write | Before-install failure changes neither source nor reachable resources; O-only ABA advances the native membership revision and invalidates stale same-source preparation; after-install authority retained; newer write survives; exact error/recovery contract |
| P5 | Local divergence, repeated cycles, convergence, held references, source destroy and dispose | No unrelated scan; records remain only for real O/P or recovery obligations; convergence releases; retained-node semantics unchanged; collectibility measured separately |
| D1 | Preserved heterogeneous public tap reentry | Complete native A777/B12 and final settled outbound A777/B12; original failing source/log preserved |
| D2 | Same installed unit with enqueue observer, synchronous notifier subscriber, native effect and tap reentry | Older complete delta admitted before any reentry; newer unit remains newer; public/native timing unchanged; no physical reread for O |
| D3 | Preserved first-invalidation throw, later row/scalar invalidation and publication | Every installed obligation attempted; original primary error retained, secondary handled by established mechanism; state coherent; no stranded completion |
| D4 | Compound membership/order/field inverse, inspection99/O7, callbacks changing membership/rekey/order | Source ordinary footprint preserved in capture/inspection/default and declared Link; callback unit distinct; no duplicate old transition from notification |
| D5 | Queued vs in-flight sends, held newer projection, later eligible projection, disposal | Started immutable packet may complete, latest eligible correction follows; hold cannot strand later eligible work; no sends after explicit disposal; tree destruction distinct |
| E1 | Field replacement, entity full replacement/setAll, add/remove/rekey, subset/full order, same-key new lifetime | Separate field/existence/key/order support; useful safe sends; no retargeting held references; no speculative topology committed by incidental observation |
| E2 | Authoritative incoming for one connection amid other pending owners | Correct connection/source scope only; no global grant or echo; source/capture/publication coherent |
| Q1 | Increasing unrelated state with fixed edits/dependencies, then broad operation controls | Measure construction separately; point admission/reduction/cleanup proportional to actual touched facts and subscribers; broad output/order costs explicit |
| Q2 | Retained receipts, multiple connections/trees, pending/in-flight work, drain and repeated disposal | Detached terminal receipt cells; no unjustified retained source/payload graphs; live foreign dependencies retained until their real disposition |

Application hidden-input omission remains a labeled misuse example outside safety
pass counts. A connection created with unavailable support is not granted blanket
independence. Missing ordinary-parent creation and fresh inspection identity cases
must be mapped to existing authority before they can join the supported run; no
oracle will be selected from whichever behavior the new implementation produces.

G1's support-only construction does not require a handle before transact returns.
G2 and G3 are deliberately distinct: rejecting an owned x contribution and
rejecting a publication dependency of an ordinary x copy have different native
state outcomes. Existing scalar active-owner contradictions remain unchanged.
