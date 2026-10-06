import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { explainRollbackFailure, transactions } from './transactions';
import { SignalTreeRollbackError } from '../../lib/types';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';

/**
 * A REFUSED ROLLBACK MUST SAY WHICH REFUSAL HAPPENED.
 *
 * ⚠️ THE REGRESSION THIS CARRIES. `TX-SURFACE-0` collapsed both refusal kinds
 * onto one constant sentence — "SignalTree could not rollback the pending
 * transaction" — with the kind surviving only on `.cause`. A thrown error's
 * message is what reaches a console, a bug report and a log aggregator; `.cause`
 * is what reaches a debugger someone already opened. So a developer saw one
 * sentence for two very different situations:
 *
 *   later-confirmed-dependency   later work relies on facts the rollback would
 *                                invalidate. REFUSING IS CORRECT, and there is
 *                                nothing to fix in their code.
 *   effect-validation-failed     the compensation itself could not be applied.
 *                                Something IS wrong.
 *
 * Telling a developer "correct behaviour" and "your data is stuck" with the same
 * words is the whole defect.
 *
 * ⚠️ SEMANTICS UNCHANGED. These rows assert the refusal still HAPPENS in the
 * same cases and still carries the same `cause`. Only the rendering improved.
 */

type Row = { id: string; n: number };

const tick = () => Promise.resolve();

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [transactions()] }
  ) as unknown as {
    $: {
      rows: {
        addOne(r: Row): void;
        removeOne(id: string): void;
        updateOne(id: string, patch: Partial<Row>): void;
        ids(): string[];
      };
    };
    transaction(fn: () => void): { confirm(): void; rollback(): void };
  };

describe('a refused rollback names its refusal', () => {
  it('a refused rollback throws, and the thrown MESSAGE names the kind', async () => {
    // ⚠️ NO ESCAPE HATCH. A first version allowed `message === ''` to fall
    // through to a state assertion and return, which would have let this row
    // quietly become a NON-REFUSAL test the first time a causal change stopped
    // the refusal firing. It refuses deterministically; the row requires that.
    //
    // ⚠️ AND THE TITLE WAS WRONG BEFORE THE PROBE. Through 15.4.3 this
    // fixture produced `effect-validation-failed` (structural-drift on the
    // re-add). A removal whose key later work re-occupied is now refused by
    // the planner as `later-confirmed-dependency` (rollback/rebase review,
    // item 2), asserted below. The title names no kind, so it holds for both;
    // naming a kind the fixture does NOT produce is how a green row ends up
    // proving something other than its title.
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await tick();

    const pending = tree.transaction(() => {
      undoable(() => tree.$.rows.removeOne('a'));
    });
    await tick();

    tree.$.rows.addOne({ id: 'a', n: 99 });
    await tick();

    expect(() => pending.rollback()).toThrow(SignalTreeRollbackError);

    // Re-run the refusal and inspect the message this time.
    const t2 = makeTree();
    t2.$.rows.addOne({ id: 'a', n: 1 });
    await tick();
    const p2 = t2.transaction(() => {
      undoable(() => t2.$.rows.removeOne('a'));
    });
    await tick();
    t2.$.rows.addOne({ id: 'a', n: 99 });
    await tick();

    let message = '';
    let cause: unknown;
    try {
      p2.rollback();
    } catch (e) {
      message = (e as Error).message;
      cause = (e as { cause?: unknown }).cause;
    }

    expect(message).not.toBe('');
    expect(message).toContain(
      'SignalTree could not rollback the pending transaction'
    );
    expect(message).toContain((cause as { kind: string }).kind);
    expect((cause as { kind: string }).kind).toBe('later-confirmed-dependency');
    // ⚠️ AND IT IS NOT DOUBLED. The prefix appears exactly once. A refusal
    // thrown deeper used to be caught and re-wrapped, producing prefix-reason-
    // prefix-reason; the constant message hid it because both layers rendered
    // identically.
    expect(message.split('SignalTree could not rollback').length - 1).toBe(1);
  });

  it('the two refusal kinds do not produce the same sentence', () => {
    // ⚠️ THE LOAD-BEARING ROW, and it calls the PRODUCTION renderer.
    // A first version reimplemented the function here and passed while proving
    // nothing about shipped code — DELETE THE DUPLICATE TO MAKE THE CLAIM
    // FALSIFIABLE. `explainRollbackFailure` is exported from an internal module
    // that is not a package entrypoint, so this costs no public surface.
    const render = explainRollbackFailure;

    const dependency = render({
      kind: 'later-confirmed-dependency',
      pendingTurnId: 1,
      conflictingTurnId: 2,
      pendingEffect: {} as never,
    });
    const validation = render({
      kind: 'effect-validation-failed',
      pendingTurnId: 1,
      compensation: [],
      errorMessage: 'subject was reclaimed',
    });

    expect(dependency).not.toBe(validation);
    expect(dependency).toContain('later-confirmed-dependency');
    expect(validation).toContain('effect-validation-failed');
    // The constant survives as a PREFIX, so existing matchers keep matching.
    for (const m of [dependency, validation]) {
      expect(
        m.startsWith('SignalTree could not rollback the pending transaction')
      ).toBe(true);
    }
  });
});

// Rollback/rebase review, item 6: observed later work (a realization) has no
// turn of its own, and its ledger entries carried the id of the turn being
// rolled back, so the refusal named that turn as its own conflict. It now
// names no conflicting turn ("later work"); authored work still names its own.
describe('a dependency refusal names the conflicting turn, or none', () => {
  const refusal = async (
    later: (tree: ReturnType<typeof makeTree>) => void
  ) => {
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await tick();
    const pending = tree.transaction(() =>
      tree.$.rows.updateOne('a', { n: 5 })
    );
    await tick();
    later(tree);
    await tick();
    try {
      pending.rollback();
    } catch (error) {
      return {
        message: (error as Error).message,
        cause: (error as { cause: Record<string, unknown> }).cause,
      };
    }
    throw new Error('rollback was accepted');
  };

  it('observed later work (a realization): no conflicting turn', async () => {
    const { message, cause } = await refusal((tree) =>
      withWriteContext({ intent: 'system', participation: 'realized' }, () =>
        tree.$.rows.updateOne('a', { n: 7 })
      )
    );
    expect(cause['kind']).toBe('later-confirmed-dependency');
    expect(cause['conflictingTurnId']).toBeUndefined();
    expect(cause['conflictingEffect']).toMatchObject({ kind: 'set' });
    expect(message).toContain(': later work depends on state');
  });

  it('a later authored turn: names that turn, not the one rolled back', async () => {
    const { message, cause } = await refusal((tree) =>
      tree.$.rows.updateOne('a', { n: 7 })
    );
    expect(cause['kind']).toBe('later-confirmed-dependency');
    expect(typeof cause['conflictingTurnId']).toBe('number');
    expect(cause['conflictingTurnId']).not.toBe(cause['pendingTurnId']);
    expect(message).toContain(`: turn ${cause['conflictingTurnId']} depends`);
  });
});
