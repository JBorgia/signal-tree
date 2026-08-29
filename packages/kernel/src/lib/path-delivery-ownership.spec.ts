import { describe, expect, it } from 'vitest';

import {
  hasPathObservers,
  installPathDeliveryRuntime,
  pathObservation,
  resetPathDeliveryRuntime,
} from './internals/path-observation-port';
import { getPathNotifier, PathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';

/**
 * `PATH-NOTIFIER-DELIVERY-OWNERSHIP-0` — the bare kernel depends on a nullable
 * port; optional observers install the delivery engine.
 *
 *     PRODUCERS MUST NOT STATICALLY OWN OPTIONAL DELIVERY MACHINERY.
 *     OPTIONAL OBSERVERS INSTALL DELIVERY AUTHORITY; THE CORE DEPENDS ONLY ON
 *     ITS NULLABLE PORT.
 *
 * Measured: 1.42 KB gzip of a 10.65 KB bare bundle was delivery machinery no
 * subscriber-less consumer could ever execute. Bare is now 9.22 KB.
 *
 * ⚠️ THE BUNDLE HALF OF THIS CONTRACT IS NOT TESTABLE FROM HERE. These carriers
 * prove the SEMANTICS survive the split; they cannot prove the engine actually
 * tree-shakes, because in a test runner every module is loaded. The bundle
 * carriers live in the size harness and require BOTH directions —
 * `bare -> absent` AND `link()/restoration -> present` — because "module
 * absent" passes vacuously if the build simply failed to reach anything.
 */

const CAPS = {
  capabilities: ['causal-runtime', 'position-topology'] as never,
  enhancers: [],
};

describe('PATH-NOTIFIER-DELIVERY-OWNERSHIP-0', () => {
  it('an uninstalled port reports no observers and emitting is inert', () => {
    resetPathDeliveryRuntime();
    try {
      // ⚠️ THIS USED TO ALSO ASSERT `port.hasObservers()`. The port is typed as
      // the contract it PROVIDES rather than as the whole `PathNotifier`, and
      // `hasObservers` was never called on it in production —
      // `hasPathObservers()` is that surface.
      expect(hasPathObservers()).toBe(false);
      const port = pathObservation();

      // ⚠️ THIS CARRIER HAS OUTLIVED TWO PROTOCOLS, and the assertion it makes
      // is deliberately the same one each time: publishing into an uninstalled
      // port is INERT and does not throw.
      //
      //   · it once asserted `{ blocked: false, value: 2 }` — the interceptor
      //     verdict protocol, deleted in PATH-NOTIFIER-INTERCEPT-SURVIVAL-0
      //   · it then called `port.emitMutation({ ... })` — deleted in 15.0 with
      //     `MutationEnvelope` itself (ME-B, MUTATION-ENVELOPE-OWNERSHIP-0)
      //
      // It now exercises the SOLE surviving publication operation. The fact
      // being defended never changed; only the vocabulary did, which is the
      // point of keeping one carrier rather than writing a new one per protocol.
      expect(() =>
        port.notify('a', 2, 1, 'a', undefined, [1], undefined, undefined)
      ).not.toThrow();
    } finally {
      getPathNotifier(); // restore the shared runtime for other suites
    }
  });

  it('a bare tree mutates correctly with no delivery runtime installed', () => {
    resetPathDeliveryRuntime();
    try {
      const tree = signalTree({ count: 0, user: { name: 'a' } }, CAPS);
      tree.$.count.set(5);
      tree.$.user.name.set('b');
      expect(tree()).toEqual({ count: 5, user: { name: 'b' } });
    } finally {
      getPathNotifier();
    }
  });

  it('asking for the engine installs it — no consumer knows the port exists', () => {
    resetPathDeliveryRuntime();
    expect(hasPathObservers()).toBe(false);

    const notifier = getPathNotifier();
    notifier.subscribe('**', () => undefined);

    // The subscription is visible THROUGH THE PORT without the subscriber ever
    // having mentioned it.
    expect(hasPathObservers()).toBe(true);
  });

  // ── The ordering carrier ────────────────────────────────────────────────
  it('a facade captured BEFORE installation observes an engine installed after', () => {
    // ⚠️ THIS IS THE CARRIER THAT FAILED FIRST. The initial port handed out an
    // inert object when nothing was installed; a marker processor captured it
    // at construction and every later mutation vanished — 32 entity, link and
    // undo tests went red. The facade must be a stable delegator, not a
    // snapshot of the state at capture time.
    resetPathDeliveryRuntime();
    const capturedEarly = pathObservation();
    expect(hasPathObservers()).toBe(false);

    const notifier = getPathNotifier(); // installs
    const seen: string[] = [];
    notifier.subscribe('**', (_v, _p, path) => {
      seen.push(String(path));
    });

    expect(hasPathObservers()).toBe(true); // the SAME captured facade now delivers
    capturedEarly.notify('a.b', 2, 1, 'a.b');
    notifier.flushSync?.();
    expect(seen).toContain('a.b');
  });

  it('several optional consumers share ONE delivery authority', () => {
    resetPathDeliveryRuntime();
    const first = getPathNotifier();
    const second = getPathNotifier();
    expect(second).toBe(first);

    // Both "consumers" subscribe; one runtime, both observed.
    const hits: string[] = [];
    first.subscribe('**', () => void hits.push('first'));
    second.subscribe('**', () => void hits.push('second'));
    pathObservation().notify('x', 2, 1, 'x');
    first.flushSync?.();
    expect(hits.sort()).toEqual(['first', 'second']);
  });

  it('installing a runtime is idempotent, not additive', () => {
    resetPathDeliveryRuntime();
    const engine = new PathNotifier();
    installPathDeliveryRuntime(engine);
    installPathDeliveryRuntime(engine);

    const hits: string[] = [];
    engine.subscribe('**', () => void hits.push('x'));
    pathObservation().notify('p', 2, 1, 'p');
    engine.flushSync?.();
    expect(hits).toEqual(['x']); // once, not twice
    getPathNotifier();
  });

  // ⚠️ THE PATH-NOTIFIER-PREINSTALL-CONTROL-0 CARRIERS WERE DELETED WITH THEIR
  // SUBJECT. They pinned that `TreeConfig.batchUpdates` survived installation
  // ordering; BATCH-UPDATES-INTENT-0 retired the option, so the behaviour they
  // protected no longer exists.
  //
  // Recorded rather than silently dropped, because a carrier disappearing is
  // normally a warning sign. Here the subject went with it: the performance
  // requirement moved to the delivery engine, which owns its own scheduling and
  // is exercised by the engine's own suites.


  // ── CLUSTER 2 — reset coherence ─────────────────────────────────────────
  it('no supported reset leaves a subscribed engine behind a detached producer', () => {
    // ⚠️ THIS STATE WAS REACHABLE. `resetPathDeliveryRuntime()` cleared the
    // port's pointer and left the engine — and its live subscriber — intact:
    //
    //     hasPathObservers()      false
    //     engine.hasObservers()   true
    //
    // `owned-mutation` guards on the former, so a registered subscriber
    // silently stopped receiving. Two mutable holders for one delivery
    // relationship, with independent resets.
    //
    //     TWO REFERENCES TO THE SAME OBJECT MAY BE USEFUL.
    //     TWO MUTABLE AUTHORITIES FOR WHICH OBJECT IS CURRENT ARE NOT.
    const engine = getPathNotifier();
    engine.subscribe('**', () => undefined);
    expect(hasPathObservers()).toBe(true);
    expect(engine.hasObservers()).toBe(true);

    resetPathDeliveryRuntime();

    // Detached AND quiet — never detached while still subscribed.
    expect(hasPathObservers()).toBe(false);
    expect(engine.hasObservers()).toBe(false);
  });

  it('the port exposes ONLY the contract it provides', () => {
    // A structural guard against the facade drifting back toward the engine's
    // shape. `intercept` survived the engine's deletion as a callable no-op
    // precisely because nothing checked this.
    const port = pathObservation() as unknown as Record<string, unknown>;
    // ⚠️ ONE OPERATION, NOT TWO. This read `['emitMutation', 'notify']` until
    // ME-B established that a transport which only transcodes into `notify` is
    // not a second semantic boundary.
    //
    //     ONE SEMANTIC PUBLICATION JOB, ONE PORT OPERATION.
    //
    // This assertion is what stops a future parameter object from being added
    // BESIDE the protocol instead of replacing it — the exact dual-protocol
    // shape the ruling removed. Replacing the positional signature in place is
    // admissible; growing this list back to two is not.
    expect(Object.keys(port).sort()).toEqual(['notify']);
    expect(port['intercept']).toBeUndefined();
    expect(port['subscribe']).toBeUndefined();
    expect(port['setBatchingEnabled']).toBeUndefined();
  });

  it('reacquisition after a reset reattaches the retained engine and delivers', () => {
    // ⚠️ RESET COHERENCE IS TWO HALVES. The carrier above proves detachment is
    // clean — the engine does not keep subscribers behind a detached producer.
    // It says nothing about REACQUISITION: `getPathNotifier()` returns the
    // RETAINED singleton, so if it installed only on first creation, every
    // consumer after a reset would hold a live engine that the producer never
    // publishes to. Permanently detached, and silent.
    const first = getPathNotifier();
    first.subscribe('**', () => undefined);
    expect(hasPathObservers()).toBe(true);

    resetPathDeliveryRuntime();
    expect(hasPathObservers()).toBe(false);

    const again = getPathNotifier();
    expect(again).toBe(first); // the retained singleton, not a new engine

    const seen: string[] = [];
    again.subscribe('**', (_v, _p, path) => void seen.push(String(path)));
    expect(hasPathObservers()).toBe(true); // reattached

    // and delivery actually reaches it
    const tree = signalTree({ x: 0 }, CAPS);
    tree.$.x.set(1);
    again.flushSync?.();
    expect(seen.length).toBeGreaterThan(0);
  });
});
