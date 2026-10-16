# Independent premise and interpretation review

Reviewed CONTRACT.md, tests.mjs, both implementations and notes. No implementation or harness edits. Executable counterexamples: `node /private/tmp/st-authority-slice-20261016/review-probes.mjs`. Results reflect files inspected before root/arm corrections.

## Authority classification

A is genuinely an authoritative sparse state model with a private current-state projection: normal write and settlement select from base/pending facts and install both maps. It explicitly retains and copies current values twice. Its representation is a location Map with copied per-location pending Maps, not a persistent global tree. It establishes feasibility of this bounded architecture, not persistent-tree performance.

B genuinely has native committed authority plus indexed live-obligation records. First pending touch captures native truth; subsequent ordinary writes update the obligation base; acceptance promotes only newer contributions; rejection selects surviving facts; last contribution removes the ledger. This is conditional hidden-base storage required by pending dependencies, not an unconditional full-store mirror or naive before-value compensation. Undo history is separately retained and acknowledged. That classification does not establish correctness of every mutation entry point.

## Confirmed counterexamples

1. B discards absence authorship when absence is currently projected. Start x=1; begin p removing x; ordinary remove x; reject p. A remains absent; B resurrects 1. Entity removal has the identical bug. Also begin p removing x, begin q removing x, reject p: B exposes 1 although q is pending; A remains absent. The early returns in B.remove/removeEntity bypass authoring exactly when hidden pending facts matter. This is a concrete A/B divergence in absence/overlap behavior. Whether a repeated removal of visibly absent state must author a new absence is not explicit: the contract also mentions non-noop writes, and the exact control may intentionally treat removal as a semantic no-op. Do not stipulate A as the correct outcome without checking control and current contracts. It blocks treating the arms as equivalent on this sequence until that policy is resolved.

2. A's entity input cloning occurs before writeState captures its revision, both in add and reference.write. A getter that commits x=9 while cloning an add payload lets the outer add succeed. B detects revision change, preserves x=9 and refuses the add. A's notes overstate getter-driven preparation invalidation. This violates the stated uniform preparation/revision boundary if getter input is supported; it does not imply partial installation occurred. Ordinary A.write does capture revision before its clone.

3. B retains scalar/branch object input by alias. write('branch', obj={n:1}); obj.n=2 changes read('branch') to {n:2}, with no write/installation/publication. A reads {n:1}. B.read and snapshot expose the same object as additional mutation routes. The harness already uses flat branch objects, but the contract does not explicitly define ownership/copy semantics; B's notes disclaim deep immutability. Clarify or isolate this dimension before comparing capabilities/copy costs. A's extra copies buy semantics B currently does not provide. This is an observed difference, not an asserted unambiguous contract failure.

## Harness interpretation gaps

Observer implementations catch callback errors. Several tests put assertions inside observers without draining/asserting unexpected errors. In observer reentry write survives settlement, ran=true precedes checks; final x=7 prevents some false passes, but it does not detect all assertion failures where later independent state happens to match. The nested-settlement case can likewise lose diagnostics. Assert no unexpected takeErrors() after every test except those explicitly testing error delivery; assert exact expected errors in those tests.

The case named 'settlement publishes even without restoration' actually rejects x=1 back to x=0. It does not test terminal publication when a newer committed value masks the settled contribution. Add a masked-owner settlement and assert terminal status during notification while the value remains unchanged. Empty handles are promised but not tested.

Fault injection occurs at entry before staging. Mixed failure currently proves only an early refusal changes nothing; it cannot demonstrate a failure after preparing the first of multiple locations. No common test exercises preparation reentry, though notes claim revision protection. Add getter reentry where within scope; retain narrower fault-coverage wording otherwise.

Destroy tests verify only throwing writes/settlement, not reclamation. Explicit retention assertions after last-owner retirement and destroy are absent. Retention counters themselves are source-inspection claims and logical sizes, not a heap-retention proof. No common assertion currently verifies zero B ownership cells on ordinary writes or A's duplicate current store.

The unchanged original restoration case is appropriate. Pending undo refusal is explicitly allowed by the contract, so requiring success was a harness defect rather than evidence against either arm.

## Costs and limits

Both use direct location lookup and scan/copy contributions at touched locations; neither promises constant work at unbounded owner fan-in. Counter labels are not comparable without normalization: A publications counts observer calls, B publications counts successful installations even without observers; A separates resolutionVisits while B includes contribution visits in visitedLocations. A structured-clones branch/entity values, B aliases branch objects and shallow-copies entity records. Compare native writes and disclosed retained facts first; allocation/CPU totals require common payload and observer semantics or explicit subset labels.

The common workload covers useful authored ordering, hidden values, absence vs undefined, lifetime replacement, coherent settlement and reentrant delivery, but currently misses the absence divergences above. Native Maps plus queued observers are explicitly a neutral model, not evidence of Angular/Solid/Vue/React native-signal integration costs. No production recommendation or incumbent equivalence follows from these arms alone, especially where the exact incumbent fault injection is unsupported.

## Exact control follow-up

Ran `node /private/tmp/st-authority-slice-20261016/review-control-probes.mjs` against the wrapper's exact 8d220643 checkout. Repeated scalar remove and second pending remove produce present 1 after rejecting the first owner, matching B. Therefore the earlier absence observation is a policy divergence, not an established B defect. Repeated entity removal throws `Entity with id E not found`; neither prototype matches this exact control policy. Do not replace it without authority.

Control branch input alias mutation leaves `{member:1}`, matching A's copy isolation. Control getter-reentrant entity add throws `Entity frame responsibility preparation reentered installation`, preserves inner x=9, and leaves entity absent, matching B's preparation boundary. These are concrete current-control differences on two separate dimensions, not a winner determination.
