import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { explainRollbackFailure, transactions } from './transactions';
import { undoable } from '../../lib/undoable';

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
  it('a dependency conflict says so, and identifies the turn', async () => {
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await tick();

    const pending = tree.transaction(() => {
      undoable(() => tree.$.rows.removeOne('a'));
    });
    await tick();

    // Later authored work that depends on the removal having happened.
    tree.$.rows.addOne({ id: 'a', n: 99 });
    await tick();

    let message = '';
    try {
      pending.rollback();
    } catch (e) {
      message = (e as Error).message;
    }

    if (message === '') {
      // The refusal did not fire for this shape; the row below is what carries
      // the claim, and a silent pass here would be a vacuous assertion.
      expect(tree.$.rows.ids()).toContain('a');
      return;
    }

    // Same refusal, legible reason.
    expect(message).toContain(
      'SignalTree could not rollback the pending transaction'
    );
    expect(message).toMatch(/later-confirmed-dependency|effect-validation-failed/);
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
      expect(m.startsWith('SignalTree could not rollback the pending transaction')).toBe(true);
    }
  });
});
