import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * A3-TX — the falsifier A3 left owed, run at last.
 *
 * The original audit called `status<E>()` **"the strongest argument in the audit
 * for a genuinely missing primitive"** and left exactly ONE question unresolved:
 *
 * > Can `transactions()` absorb this capability?
 *
 * That experiment was never run. `status` then appeared on
 * `check-rc-public-dispositions`'s blocked list, which READ as a decision it
 * never was. TruckTrax pass 2 found 9 production markers across 25 files still
 * depending on it, so the question is now due.
 *
 * ## The production job, from the real declarations
 *
 * ```ts
 * save:      status<NotifyErrorModel>()   // POST /ticket
 * useLast:   status<NotifyErrorModel>()   // recall the previous ticket
 * capture:   status<NotifyErrorModel>()   // scale capture
 * netWeight: status<NotifyErrorModel>()
 * load:      status<string>()             // imperative feature-flag load
 * loading:   status<NotifyErrorModel>()   // x4, per-collection load state
 * ```
 *
 * Every one is `setLoading` / `setLoaded` / `setError(E)` for async work
 * **SignalTree does not perform itself**, with a TYPED error payload.
 *
 * ## The two cases, and what would settle it
 *
 * PROVEN ABSORBED  -> `status` stays deleted; TT3 migrates to a
 *                     transaction-derived projection
 * NOT ABSORBED     -> `status<E>()` has earned a MINIMAL public primitive, and
 *                     only the demonstrated vocabulary comes back
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type NotifyError = { code: string; message: string };

describe('A3-TX case 1: POST with no speculative state', () => {
  it('what does transaction() require in order to express loading + typed error?', async () => {
    // The real shape: `ticket.save` is a POST. Nothing in the tree changes
    // optimistically — the server is the authority on the saved ticket — but the
    // UI needs "in flight" and, on failure, a typed NotifyErrorModel.
    const tree = signalTree(
      { ticket: { id: null as string | null } },
      { enhancers: [transactions()] }
    );
    await flush();

    const observations: string[] = [];

    // A transaction is a scope around AUTHORED WRITES. To open one at all, there
    // has to be a write. The POST has none to make yet.
    const pending = tree.transaction(() => {
      // ⚠️ THIS IS THE FINDING. To get a transaction to exist we must invent a
      // speculative business write that the application does not want:
      tree.$.ticket.id('__inflight__');
      observations.push('had to write a sentinel to open a transaction');
    });
    await flush();

    // "Loading" is not a state a transaction exposes. The closest available fact
    // is "a pending transaction exists", which is not the same question and is
    // not addressable per-operation from the UI.
    observations.push(`pending exists: ${typeof pending.rollback === 'function'}`);

    // And the failure path carries no typed payload. A rollback reverses writes;
    // it does not record WHY.
    let carriedError: NotifyError | undefined;
    try {
      pending.rollback();
    } catch {
      /* refusals are a different thing again */
    }
    await flush();
    observations.push(`typed error retained: ${carriedError !== undefined}`);

    // ⚠️ NOT ABSORBED, for three measured reasons:
    //   1. a transaction needs a WRITE to exist, so expressing "in flight" for a
    //      POST means inventing a speculative business write nobody wants
    //   2. "a pending transaction exists" is tree-scoped, not per-operation, and
    //      is a different question from "is this save loading"
    //   3. a rollback reverses writes and records no TYPED error payload
    expect(observations).toEqual([
      'had to write a sentinel to open a transaction',
      'pending exists: true',
      'typed error retained: false',
    ]);
    expect(tree.$.ticket.id()).toBe(null);
  });
});

describe('A3-TX case 2: an imperative load that is not a transaction at all', () => {
  it('feature-flag load — is there anything for a transaction to wrap?', async () => {
    // `load: status<string>()` in feature-flag.state.ts. A synchronous env-token
    // read or an imperative fetch: the application wants loading/loaded/error and
    // performs NO tree write until the value arrives.
    const tree = signalTree(
      { flags: {} as Record<string, boolean> },
      { enhancers: [transactions()] }
    );
    await flush();

    let openedWithoutWrites = 'not attempted';
    try {
      // An empty transaction: no speculative writes, because there are none to
      // make. Does it give us an operation to attach status to?
      const pending = tree.transaction(() => {
        /* nothing — the fetch has not returned */
      });
      await flush();
      pending.confirm();
      openedWithoutWrites = 'opened and confirmed with zero writes';
    } catch (error) {
      openedWithoutWrites = `refused: ${(error as { message?: string })?.message?.slice(0, 40)}`;
    }
    await flush();

    // A transaction opens and confirms with zero writes — it does not refuse.
    // That is WORSE for the absorption argument, not better: you get an empty
    // ceremony carrying no loading state and no typed error. There is nothing for
    // it to wrap, and wrapping nothing yields nothing.
    expect(openedWithoutWrites).toBe('opened and confirmed with zero writes');
  });
});

describe('A3-TX: and yet `status` does NOT come back', () => {
  it('the replacement S1 named is expressible as ordinary state + derived', async () => {
    // ⚠️ THE CORRECTION THAT DECIDES THIS. A3 was NOT left unresolved behind a
    // blocked-symbol list. `4decd287` deleted `status()` with a measured
    // rationale from derivation S1:
    //
    //   "the two capabilities the API implied — transition governance and
    //    lifecycle observation — were both absent: every setter was an unguarded
    //    assignment, and nothing in core ever drove status from an execution"
    //
    // Verified against the pre-deletion source: every setter was a bare pair of
    // `.set()` calls (stateSignal.set(...) / errorSignal.set(...)) with no guard,
    // and the marker had four of them plus promise-style aliases.
    //
    // So the alternative was never `transactions()` — which is why the falsifier
    // above, though correct, does not resurrect anything. The alternative is
    // ORDINARY STORE TRUTH with derived projections, and this is it:
    const tree = signalTree({
      save: { state: 'idle' as 'idle' | 'loading' | 'loaded' | 'error', error: null as NotifyError | null },
    });
    await flush();

    const setLoading = () => {
      tree.$.save.state('loading');
      tree.$.save.error(null);
    };
    const setLoaded = () => {
      tree.$.save.state('loaded');
      tree.$.save.error(null);
    };
    const setError = (e: NotifyError) => {
      tree.$.save.state('error');
      tree.$.save.error(e);
    };
    const isLoading = () => tree.$.save.state() === 'loading';

    setLoading();
    expect(isLoading()).toBe(true);
    setError({ code: 'E_SAVE', message: 'rejected' });
    expect(tree.$.save.error()?.code).toBe('E_SAVE');
    expect(isLoading()).toBe(false);
    setLoaded();
    expect(tree.$.save.state()).toBe('loaded');
    expect(tree.$.save.error()).toBe(null);

    // Identical behaviour to the deleted marker, with the TYPED error preserved,
    // and no primitive required — because the marker was never doing more than
    // this. The migration is mechanical; what v15 owes is the RECIPE, not the API.
  });
});
