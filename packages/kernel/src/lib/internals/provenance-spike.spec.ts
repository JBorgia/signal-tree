import { beforeEach, describe, expect, it } from 'vitest';

import { signalTree } from '../signal-tree';
import { external } from '../external';
import { transactions } from '../../enhancers/transactions/transactions';
import {
  getProvenanceRecords,
  getUncoveredAuthoredWrites,
  observeProvenance,
  provenanceScope,
  resetProvenanceSpike,
} from './provenance-spike';

/**
 * ATTRIBUTION-OWNER-0 falsification suite.
 *
 * The NULL under test: an enhancer-local synchronous provenance scope plus
 * existing internal write/origin/settlement seams can observe attempts,
 * committed effects, rollback, mixed origins, nesting and derived consequences
 * correctly — with no public kernel change.
 *
 * These tests try to BREAK that. A failure here is EVIDENCE, classified
 * A / B / C. It is never a reason to repair the kernel.
 *
 * RESULT — 2026-09-08. A REFUTED. B vs C NOT CLOSED. 10 passed / 4 red.
 *
 * CORRECTION TO THE FIRST REPORT. The first run blamed `interceptLeafSignals`
 * and called the result "outcome B". That was the wrong channel, not the whole
 * story: `PathNotifier` — already subscribed by transactions, restoration,
 * link, the diagnostic journal and the causal realization adapter — DOES
 * observe transaction writes, and carries `transactionOwner` for tree
 * isolation. Switching channel turned case 3 green.
 *
 * The four still-red cases are marked `it.fails` as executable evidence. If a
 * future seam makes one pass, `it.fails` flips it RED and forces a re-read.
 *
 * DO NOT "fix" them by changing the kernel. Deriving the narrow authoring seam
 * is a separate, authorized piece of work — see TODO.md § ATTRIBUTION-OWNER-0.
 */

const scopeOf = (id: string) =>
  getProvenanceRecords().find((r) => r.scopeId === id);

describe('ATTRIBUTION-OWNER-0 spike', () => {
  beforeEach(() => resetProvenanceSpike());

  it('1. ordinary authored write is attributed to the scope', () => {
    const tree = signalTree({ n: 0 });
    const stop = observeProvenance(tree);

    provenanceScope({ scopeId: 's1', externalClaim: { opaque: true } }, () => {
      tree.$.n(1);
    });
    stop();

    const s = scopeOf('s1');
    expect(s?.effects).toHaveLength(1);
    expect(s?.effects[0]).toMatchObject({
      path: 'n',
      origin: 'authored',
      disposition: 'committed',
      objectIsChanged: true,
      published: 'unknown', // no seam reports the publication fact
    });
    expect(s?.summary.classification).toBe('committed');
  });

  it('1b. the external claim is carried opaquely and never interpreted', () => {
    const claim = Symbol('provider-issued');
    const tree = signalTree({ n: 0 });
    const stop = observeProvenance(tree);
    provenanceScope({ scopeId: 'opaque', externalClaim: claim }, () =>
      tree.$.n(1)
    );
    stop();
    expect(scopeOf('opaque')?.externalClaim).toBe(claim);
  });

  it('2. multiple immediate writes in one scope', () => {
    const tree = signalTree({ a: 0, b: 0 });
    const stop = observeProvenance(tree);
    provenanceScope({ scopeId: 's2' }, () => {
      tree.$.a(1);
      tree.$.b(2);
    });
    stop();

    const s = scopeOf('s2');
    expect(s?.effects.map((e) => e.path).sort()).toEqual(['a', 'b']);
    expect(s?.summary.committed).toBe(2);
  });

  it('3. transaction commits — effects stay committed', () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const stop = observeProvenance(tree, 'path-notifier');

    provenanceScope({ scopeId: 's3' }, () => {
      const pending = tree.transaction(() => {
        tree.$.n(1);
      });
      pending.confirm();
    });
    stop();

    const s = scopeOf('s3');
    expect(s?.effects.every((e) => e.disposition === 'committed')).toBe(true);
    expect(s?.summary.classification).toBe('committed');
  });

  it.fails(
    '4. transaction rolls back — effects become rolled-back, not committed',
    () => {
      const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
      const stop = observeProvenance(tree, 'path-notifier');

      const pending = provenanceScope({ scopeId: 's4' }, () =>
        tree.transaction(() => {
          tree.$.n(1);
        })
      );
      pending.rollback();
      stop();

      const s = scopeOf('s4');
      expect(s?.effects.length).toBeGreaterThan(0);
      expect(s?.effects.every((e) => e.disposition === 'rolled-back')).toBe(
        true
      );
      expect(s?.summary.classification).toBe('rolled-back');
    }
  );

  it('5. committed write then the scope throws => durable effect + failed', () => {
    const tree = signalTree({ n: 0 });
    const stop = observeProvenance(tree);

    expect(() =>
      provenanceScope({ scopeId: 's5' }, () => {
        tree.$.n(1);
        throw new Error('boom');
      })
    ).toThrow('boom');
    stop();

    // The write is already durable — non-transactional consequences run
    // immediately in the caller's stack.
    expect(tree.$.n()).toBe(1);
    const s = scopeOf('s5');
    expect(s?.threw).toBe(true);
    expect(s?.summary.committed).toBe(1);
    // Must NOT report the whole scope as failed while state is durable.
    expect(s?.summary.classification).toBe('partial');
  });

  it.fails(
    '6. committed effect + later rolled-back transaction => partial',
    () => {
      const tree = signalTree(
        { log: 0, n: 0 },
        { enhancers: [transactions()] }
      );
      const stop = observeProvenance(tree, 'path-notifier');

      const pending = provenanceScope({ scopeId: 's6' }, () => {
        tree.$.log(1); // immediate, durable
        return tree.transaction(() => {
          tree.$.n(1);
        });
      });
      pending.rollback();
      stop();

      const s = scopeOf('s6');
      expect(s?.summary.committed).toBeGreaterThan(0);
      expect(s?.summary.rolledBack).toBeGreaterThan(0);
      expect(s?.summary.classification).toBe('partial');
    }
  );

  it('7. authored + external effects in one scope keep independent origins', () => {
    const tree = signalTree({ a: 0, b: 0 });
    const stop = observeProvenance(tree);

    provenanceScope({ scopeId: 's7' }, () => {
      tree.$.a(1);
      external(() => tree.$.b(2));
    });
    stop();

    const s = scopeOf('s7');
    const origins = Object.fromEntries(
      (s?.effects ?? []).map((e) => [e.path, e.origin])
    );
    expect(origins).toEqual({ a: 'authored', b: 'external' });
  });

  it('8. nesting order does not change the effect set', () => {
    const treeA = signalTree({ x: 0 });
    const stopA = observeProvenance(treeA);
    provenanceScope({ scopeId: 'inner-external' }, () => {
      external(() => treeA.$.x(1));
    });
    stopA();
    const a = scopeOf('inner-external');

    resetProvenanceSpike();

    const treeB = signalTree({ x: 0 });
    const stopB = observeProvenance(treeB);
    external(() => {
      provenanceScope({ scopeId: 'outer-external' }, () => treeB.$.x(1));
    });
    stopB();
    const b = scopeOf('outer-external');

    const shape = (r: typeof a) =>
      (r?.effects ?? []).map((e) => ({
        path: e.path,
        origin: e.origin,
        disposition: e.disposition,
      }));

    expect(shape(a)).toEqual(shape(b));
  });

  it('9. nested provenance scopes — inner wins, lineage retained', () => {
    const tree = signalTree({ a: 0, b: 0 });
    const stop = observeProvenance(tree);

    provenanceScope({ scopeId: 'outer' }, () => {
      tree.$.a(1);
      provenanceScope({ scopeId: 'inner' }, () => {
        tree.$.b(2);
      });
    });
    stop();

    expect(scopeOf('outer')?.effects.map((e) => e.path)).toEqual(['a']);
    expect(scopeOf('inner')?.effects.map((e) => e.path)).toEqual(['b']);
    expect(scopeOf('inner')?.parentScopeId).toBe('outer');
  });

  // REFUTES SUB-PREDICTION A with the current seam. Not because the model
  // forbids multi-actor transactions, but because a write inside a transaction
  // body publishes AFTER settlement — by which time the synchronous provenance
  // scope has closed. Compare case 3, which passes only because the scope wraps
  // the whole transaction. This is the sharpest B-vs-C discriminator found.
  it.fails(
    '10. SUB-PREDICTION A: one transaction may contain two provenance scopes',
    () => {
      const tree = signalTree({ a: 0, b: 0 }, { enhancers: [transactions()] });
      const stop = observeProvenance(tree, 'path-notifier');

      const pending = tree.transaction(() => {
        provenanceScope({ scopeId: 'agentA' }, () => tree.$.a(1));
        provenanceScope({ scopeId: 'agentB' }, () => tree.$.b(2));
      });
      pending.confirm();
      stop();

      expect(scopeOf('agentA')?.effects.map((e) => e.path)).toEqual(['a']);
      expect(scopeOf('agentB')?.effects.map((e) => e.path)).toEqual(['b']);
    }
  );

  it.fails(
    '12. a reversal names its cause and does not implicate the other scope',
    () => {
      const tree = signalTree({ a: 0, b: 0 }, { enhancers: [transactions()] });
      const stop = observeProvenance(tree, 'path-notifier');

      const pending = tree.transaction(() => {
        provenanceScope({ scopeId: 'victimA' }, () => tree.$.a(1));
        provenanceScope({ scopeId: 'culpritB' }, () => tree.$.b(2));
      });
      pending.rollback();
      stop();

      const victim = scopeOf('victimA');
      // Non-vacuity guard: [].every() is true, so without this the assertion
      // below passes on an empty effect set and the test lies.
      expect(victim?.effects.length).toBeGreaterThan(0);
      expect(
        victim?.effects.every((e) => e.disposition === 'rolled-back')
      ).toBe(true);
      // The cause must be the transaction, never the other actor's scope.
      for (const effect of victim?.effects ?? []) {
        expect(effect.revertedBy).toMatch(/^transaction:/);
        expect(effect.revertedBy).not.toContain('culpritB');
      }
    }
  );

  // MO-2 / CONTROL 11 — the adversarial namespace case, and the limit of what
  // is currently provable.
  //
  // MEASURED: two independent trees EACH open transaction id 1. They are
  // separated only by `ownerId` (1 vs 2) and distinct `transactionOwner`
  // objects. A sidecar keyed on `transactionId` alone therefore lets one tree's
  // rollback revert another tree's effects. The spike was written with exactly
  // that defect and it did not show, because rollback emits no event at all —
  // the bug hid behind the silence.
  //
  // WHAT THIS PROVES: attribution isolates across a colliding transaction id.
  // WHAT IT CANNOT PROVE: rollback disposition isolation, which needs settlement
  // outcome exposed. Do not read a pass here as MO-2 fully closed.
  it('MO-2/C11. two trees sharing transaction id 1 do not cross-attribute', () => {
    const treeA = signalTree({ a: 0 }, { enhancers: [transactions()] });
    const treeB = signalTree({ b: 0 }, { enhancers: [transactions()] });
    const stop = observeProvenance(treeA, 'path-notifier'); // '**' sees both

    provenanceScope({ scopeId: 'treeA' }, () =>
      treeA.transaction(() => {
        treeA.$.a(1);
      })
    ).confirm();
    provenanceScope({ scopeId: 'treeB' }, () =>
      treeB.transaction(() => {
        treeB.$.b(1);
      })
    ).confirm();
    stop();

    const a = scopeOf('treeA');
    const b = scopeOf('treeB');

    // Non-vacuity: both scopes must actually hold effects, and the adversarial
    // condition must really have occurred — the same transaction id on both.
    expect(a?.effects.length).toBeGreaterThan(0);
    expect(b?.effects.length).toBeGreaterThan(0);
    expect(a?.effects[0].transactionId).toBe(1);
    expect(b?.effects[0].transactionId).toBe(1);

    // Isolation: neither scope absorbed the other's path.
    expect(a?.effects.map((e) => e.path)).toEqual(['a']);
    expect(b?.effects.map((e) => e.path)).toEqual(['b']);
  });

  it('13. same-value write is not reported as a published effect', () => {
    const tree = signalTree({ status: 'paid' });
    const stop = observeProvenance(tree);

    provenanceScope({ scopeId: 's13' }, () => {
      tree.$.status('paid');
    });
    stop();

    const s = scopeOf('s13');
    // Either no event fired, or it fired with objectIsChanged:false. What must
    // NOT happen is a claim that a value changed. `published` stays 'unknown'
    // for every effect — the spike cannot observe the publication fact.
    expect(s?.effects.filter((e) => e.objectIsChanged)).toHaveLength(0);
    expect(s?.effects.every((e) => e.published === 'unknown')).toBe(true);
    expect(s?.summary.classification).toBe('no-published-state-effect');
  });

  it('15. authored write outside every scope is a coverage gap, not attribution', () => {
    const tree = signalTree({ a: 0, b: 0 });
    const stop = observeProvenance(tree);

    provenanceScope({ scopeId: 's15' }, () => tree.$.a(1));
    tree.$.b(2); // outside every scope — a human at the keyboard
    stop();

    expect(scopeOf('s15')?.effects.map((e) => e.path)).toEqual(['a']);
    // It must land in coverage accounting, attributed to nobody.
    expect(getUncoveredAuthoredWrites().map((u) => u.path)).toEqual(['b']);
  });
});
