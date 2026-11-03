# Independent adoption review

Reviewed frozen entity-patch.mjs SHA256 ba21c351c86dc42351a02234fb294aca51fdd1b8a1a47240c7b03e9aa8fef115. No candidate edits.

## Confirmed blocker: frame adoption and inspection chronology disagree

Public sequence:
1. rows a.n7,b.n8.
2. Inspection writes a.n99,b.n88.
3. p=transact(()=>rows.setAll([{id:'a',n:99,m:1},{id:'b',n:88,m:2}])).
4. p.inspect() throws pending inspection unavailable because an authored contribution has no mutation chronology.

Frozen unchanged first witness+bundle+log preserved. Separate no-inspection control establishes p.rollback succeeds, restoring a7,b8; repeat rollback no-ops. Same settlement with inspection failure also restores7/8. This is inspection participation failure, not proven orphaned responsibility or rollback corruption.

Baseline comparison: p.inspect succeeds listing only m changes; rollback retains99/88. The patch adds ordinary n responsibility as intended but loses inspection availability. Production baseline does not supply the newly approved adoption behavior; comparing only original inspection success would miss that capability difference.

Source cause: commitAndProjectEntityMutationFrame prepares ordinary-before replace-value facts and replaces observer evidence with those facts. setAll later publishes stagedUpdates with its original physical prev (entity-signal.ts3779). Inspection-visible99→authored99 therefore has no n chronology in those notifications, while paired responsibility includes ordinary7→99. This is the same semantic-before boundary across a frame writer, rather than a new ownership design question.

## Positive bounded probes

Nine independent assertions passed across three scenarios: field absence versus explicit undefined restores absent ordinary member; mixed scalar+two-row throwing preparation aborts scalar and leaves inspection display intact, subsequent adoption can still rollback to original ordinary values; native store retirement releases inspection shadow and new lifetime baseline is isolated. These do not establish general collection/frame qualification.

Existing raw reentry evidence inspected: transaction-internal getter-authored77 being restored7 after abort is consistent with transaction ownership, not a lost-write defect. Ordinary reentry77 survives in provided control; its blanket expectation of throw is not independently justified. Original red assertions remain preserved, should be categorized explicitly rather than counted as all pass.

## Source observations and limits

Fast path captures physical clock before authority preparation and validates before installation. Frame preparation similarly precedes paired installation; native point realization now carries prepared authority. Preparation calls may execute getters/deep equality; exception handling and ordinary-before facts are tested, not universal allocation failure recovery.

Inspection shadows are keyed by lifetime, partial updates merge authored fields onto ordinary before, and retire/clear delete shadows. This is bounded divergence storage rather than a permanent canonical row mirror. Existing direct store retire test demonstrates removal, not end-to-end retention/heap collection under every pending recovery obligation.

No architecture acceptance, no broad suites, no candidate edits. Recommend retain corrected mechanisms but block full acceptance on demonstrated setAll inspection failure. Root must decide whether this omitted writer belongs within currently authorized finite repair; reviewer supplies evidence, not authorization.

Replay: Node24.15.0 node loader.mjs; ENTRY=settlement.ts node loader.mjs; BASELINE=1 ENTRY=settlement.ts node loader.mjs from this frozen directory. Exact paths/constants contained in loader. first-bundle.mjs contains primary assertion, current bundle contains separate settlement diagnostic. Do not overwrite first artifacts.
