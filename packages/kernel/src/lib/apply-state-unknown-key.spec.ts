import { describe, expect, it } from 'vitest';

import { applyState } from './utils';
import { signalTree } from './signal-tree';

/**
 * APPLYSTATE-UNKNOWN-KEY-0 — what an incoming key MEANS when the target has no
 * location for it.
 *
 * Derived rather than assumed, and the answer is **UNKNOWN-A: IGNORE**, silently,
 * creating no structure. Three independent grounds, none of which is "the
 * implementation does it":
 *
 * 1. SECURITY. The mechanism is one line —
 *    `if (!Object.prototype.hasOwnProperty.call(stateNode, key)) continue;` —
 *    and it is documented as load-bearing against a real prototype-pollution
 *    incident: the devtools channel reaches `applyState` through a bare
 *    `JSON.parse` of a `postMessage` payload, `JSON.parse` mints a real OWN
 *    `__proto__`, and the walk recursed into `Object.prototype`.
 *
 *    "Unknown key" and "prototype-chain key" ARE THE SAME TEST. Choosing CREATE
 *    would reintroduce the incident class, not merely change a convenience.
 *
 * 2. CAUSAL CLASS. `applyState` has exactly ONE production caller — devtools
 *    time-travel — and it declares `participation: 'inspection'`
 *    (DEVTOOLS-JUMP-0, outcome D). INSPECTION-EGRESS-0 forbids an inspection
 *    write acquiring external causal authority; creating tree structure is
 *    strictly stronger than that.
 *
 * 3. CONSTRUCTION MODEL. Ordinary locations materialise at construction. A late
 *    ordinary descendant is not assumed to exist merely because incoming data
 *    names it — DESCENDANT-MATERIALIZATION-0.
 *
 * ⚠️ SCOPE. `applyState` is NOT exported from `@signal-tree/kernel`. This is an
 * internal contract for a devtools replay path, not a public policy API, and no
 * first-class unknown-key option is admitted.
 *
 * ⚠️ WHAT apply-state-pollution.spec.ts ALREADY COVERS, and does not. Its
 * own-ness row uses `toString` — a PROTOTYPE-CHAIN key. That proves the security
 * half. The ordinary unknown key (`{ unknown: 3 }`, neither inherited nor
 * dangerous) had no carrier, which is what these rows add.
 */
describe('applyState — an unknown key is ignored, and creates nothing', () => {
  it('POSITIVE CONTROL — a known key IS written', () => {
    // Without this, "the unknown key did nothing" would be satisfied by an
    // applyState that does nothing at all.
    const tree = signalTree({ known: 1 });
    applyState(tree.$ as never, { known: 2 } as never);
    expect(tree.$.known()).toBe(2);
  });

  it('a ROOT unknown key is ignored, and no location appears', () => {
    const tree = signalTree({ known: 1 });
    applyState(tree.$ as never, { known: 2, unknown: 3 } as never);

    expect(tree.$.known()).toBe(2); // the known key still applies
    expect(
      Object.prototype.hasOwnProperty.call(tree.$, 'unknown')
    ).toBe(false);
    // …and it is absent from the snapshot, so nothing was created out of view.
    expect(tree.$()).toEqual({ known: 2 });
  });

  it('a NESTED unknown key is ignored the same way', () => {
    const tree = signalTree({ b: { known: 1 } });
    applyState(tree.$ as never, { b: { known: 2, unknown: 3 } } as never);

    expect(tree.$.b.known()).toBe(2);
    expect(
      Object.prototype.hasOwnProperty.call(tree.$.b, 'unknown')
    ).toBe(false);
    expect(tree.$()).toEqual({ b: { known: 2 } });
  });

  it('IGNORE, not REJECT — an unknown-only snapshot neither throws nor disturbs', () => {
    // This is the row that separates A from B. Refusal would be a defensible
    // contract; it is not the one in force, and an atomic refusal would also
    // have to leave `known` at 1 — which it does here only because nothing was
    // attempted, not because anything rolled back.
    const tree = signalTree({ known: 1 });
    expect(() =>
      applyState(tree.$ as never, { unknown: 3 } as never)
    ).not.toThrow();
    expect(tree.$.known()).toBe(1);
  });
});
