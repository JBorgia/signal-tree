import { describe, expect, it } from 'vitest';

import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';

/**
 * STAGED-DRAFT-EDITING-0 — proves `docs/guides/composition-recipes.md`'s §5
 * claim rather than asserting it. Nothing named `beginStage()` or a draft-
 * session API exists in the kernel; the recipe is that an application-owned
 * draft never touches the tree, so it needs no restoration/undo support of
 * its own, and one intentional commit is ONE authored turn regardless of how
 * many fields the draft accumulated.
 *
 * The two things §5 asserts and this file measures rather than assumes:
 *
 * ```text
 * accumulating draft edits      -> zero tree writes, zero restoration growth
 * one commit, N accumulated     -> exactly ONE new restoration entry, holding
 *   fields                         the complete committed state (not N)
 * discard before commit         -> restoration history exactly as it was —
 *                                   nothing was ever authored, so there is
 *                                   nothing to undo
 * ```
 */
describe('STAGED-DRAFT-EDITING-0: a draft that never touches the tree', () => {
  type Ticket = { title: string; priority: 'low' | 'high'; assignee: string };

  const makeTree = () =>
    signalTree(
      {
        ticket: {
          title: '',
          priority: 'low' as 'low' | 'high',
          assignee: '',
        } as Ticket,
      },
      { enhancers: [restoration()], capabilities: ['causal-runtime'] }
    );

  it('accumulating draft edits produces zero tree writes and zero restoration growth', () => {
    const store = makeTree();
    const t = (store as any).__restoration;
    const before = t.getRestorationHistory().length;

    // The draft is a PLAIN application-owned value — this file's stand-in for
    // a form model or a component signal, per §5. It is never `tree.$...set()`.
    let draft: Partial<Ticket> = {};
    const reviewField = <K extends keyof Ticket>(key: K, value: Ticket[K]) => {
      draft = { ...draft, [key]: value };
    };

    reviewField('title', 'Payment webhook failing');
    reviewField('priority', 'high');
    reviewField('assignee', 'ada');

    // Nothing was authored: the canonical value is untouched, and restoration
    // — which only ever sees authored writes — recorded nothing new.
    expect(store.$.ticket()).toEqual({
      title: '',
      priority: 'low',
      assignee: '',
    });
    expect(t.getRestorationHistory().length).toBe(before);
  });

  it('one commit of a multi-field draft is exactly ONE restoration entry, not one per field', async () => {
    const store = makeTree();
    const t = (store as any).__restoration;
    const before = t.getRestorationHistory().length;

    let draft: Partial<Ticket> = {};
    const reviewField = <K extends keyof Ticket>(key: K, value: Ticket[K]) => {
      draft = { ...draft, [key]: value };
    };
    const commit = () => {
      // signalTree expands an object leaf into per-field writable signals, so
      // "one commit" is one `undoable()` call wrapping every field write —
      // this is the "one intentional commit" step §5 describes, not an
      // unwrapped loop of per-field sets each producing its own turn.
      const d = draft as Ticket;
      undoable(() => {
        store.$.ticket.title.set(d.title);
        store.$.ticket.priority.set(d.priority);
        store.$.ticket.assignee.set(d.assignee);
      });
    };

    reviewField('title', 'Payment webhook failing');
    reviewField('priority', 'high');
    reviewField('assignee', 'ada');
    commit();

    await Promise.resolve();
    await Promise.resolve();

    const history = t.getRestorationHistory();
    // Exactly one new entry — not three, despite three accumulated fields.
    expect(history.length).toBe(before + 1);
    expect(history[history.length - 1].state).toEqual({
      ticket: { title: 'Payment webhook failing', priority: 'high', assignee: 'ada' },
    });
  });

  it('discarding a draft before commit leaves restoration history untouched', () => {
    const store = makeTree();
    const t = (store as any).__restoration;
    const before = t.getRestorationHistory().length;

    let draft: Partial<Ticket> = {};
    const reviewField = <K extends keyof Ticket>(key: K, value: Ticket[K]) => {
      draft = { ...draft, [key]: value };
    };
    const discard = () => {
      draft = {}; // Nothing to undo — nothing was ever authored.
    };

    reviewField('title', 'Draft nobody wants');
    reviewField('priority', 'high');
    discard();

    expect(draft).toEqual({});
    expect(store.$.ticket()).toEqual({
      title: '',
      priority: 'low',
      assignee: '',
    });
    // The history is not merely unchanged in length — restoration was never
    // invoked at all, because the draft's edits never reached the tree.
    expect(t.getRestorationHistory().length).toBe(before);
  });
});
