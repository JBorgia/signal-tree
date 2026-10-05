import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { getTreeRealizationPort } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

// Promoted unchanged from the independent observation audit
// (/private/tmp/signaltree-observation-audit/observation-audit.spec.ts, 8/4).
// An operation event reports what the operation actually did to the tree, not
// what history looks like after callbacks the operation triggered have run.
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const make = () =>
  signalTree({ x: 0, y: 0 }, { enhancers: [transactions(), restoration()] });

describe('independent producer-boundary audit', () => {
  it('reset during restoration publication does not label an applied undo as noop', async () => {
    const tree = make();
    let reset = false;
    const rr = restorationReader(tree)!;
    const events: unknown[] = [];
    try {
      undoable(() => tree.$.x(1));
      await tick();
      const id = rr.snapshot().entries[0].entryId;
      const stop = tree.$.x.subscribe(() => {
        if (tree.$.x() === 0 && !reset) {
          reset = true;
          tree.resetRestorationHistory();
        }
      });
      rr.subscribe((event, snapshot) => events.push({ event, snapshot }));
      try {
        tree.undo();
      } finally {
        stop();
      }
      const operation = (
        events as {
          event: {
            kind: string;
            outcome?: string;
            affectedEntryIds?: readonly string[];
          };
        }[]
      ).find((record) => record.event.kind === 'operation')!;
      expect(reset).toBe(true);
      expect(operation.event.outcome).toBe('applied');
      expect(operation.event.affectedEntryIds).toEqual([id]);
    } finally {
      tree.destroy();
    }
  });
});

describe('refusal versus failure and lifecycle cleanup controls', () => {
  it('classifies an explicit restoration validation refusal separately from an exception', async () => {
    const tree = make();
    const reader = restorationReader(tree)!;
    const port = getTreeRealizationPort(tree.$)!;
    const original = port.validateEffects;
    const events: unknown[] = [];
    try {
      undoable(() => tree.$.x(1));
      await tick();
      reader.subscribe((event) => events.push(event));
      port.validateEffects = () => ({ kind: 'structural-drift' });
      expect(() => tree.undo()).toThrow();
      expect(events.at(-1)).toMatchObject({
        operation: 'undo',
        outcome: 'refused',
        affectedEntryIds: [],
      });
    } finally {
      port.validateEffects = original;
      tree.destroy();
    }
  });
  it('reports an actual pre-application exception as failed without affected entries', async () => {
    const tree = make();
    const reader = restorationReader(tree)!;
    const port = getTreeRealizationPort(tree.$)!;
    const original = port.validateEffects;
    const events: unknown[] = [];
    try {
      undoable(() => tree.$.x(1));
      await tick();
      reader.subscribe((event) => events.push(event));
      port.validateEffects = () => {
        throw new Error('probe validation failure');
      };
      expect(() => tree.undo()).toThrow('probe validation failure');
      expect(events.at(-1)).toMatchObject({
        operation: 'undo',
        outcome: 'failed',
        affectedEntryIds: [],
      });
      expect(tree.$.x()).toBe(1);
      expect(reader.snapshot().entries[0].status).toBe('applied');
    } finally {
      port.validateEffects = original;
      tree.destroy();
    }
  });
});

it('an applied undo reports affected entries even if synchronous reactive delivery throws', async () => {
  const tree = make();
  const reader = restorationReader(tree)!;
  const events: { event: unknown; snapshot: unknown }[] = [];
  let invoked = false;
  try {
    undoable(() => tree.$.x(1));
    await tick();
    const id = reader.snapshot().entries[0].entryId;
    const off = tree.$.x.subscribe(() => {
      if (tree.$.x() === 0) {
        invoked = true;
        throw new Error('reactive delivery');
      }
    });
    reader.subscribe((event, snapshot) => events.push({ event, snapshot }));
    try {
      tree.undo();
    } catch {
      /* delivery failure after the undo applied */
    } finally {
      off();
    }
    expect(invoked).toBe(true);
    expect(tree.$.x()).toBe(0);
    expect(events.at(-1)?.event).toMatchObject({
      operation: 'undo',
      affectedEntryIds: [id],
    });
  } finally {
    tree.destroy();
  }
});

// Companions: the same cases for redo and for a structured refusal of each
// category, so a classifier keyed to one message or one operation cannot pass.
describe('operation outcome companions', () => {
  it('reset during redo publication still reports the applied entry', async () => {
    const tree = make();
    const rr = restorationReader(tree)!;
    const events: {
      kind: string;
      outcome?: string;
      ids?: readonly string[];
    }[] = [];
    try {
      undoable(() => tree.$.x(1));
      await tick();
      const id = rr.snapshot().entries[0].entryId;
      tree.undo();
      let reset = false;
      const stop = tree.$.x.subscribe(() => {
        if (tree.$.x() === 1 && !reset) {
          reset = true;
          tree.resetRestorationHistory();
        }
      });
      rr.subscribe((event) =>
        events.push({
          kind: event.kind,
          ...(event.kind === 'operation'
            ? { outcome: event.outcome, ids: event.affectedEntryIds }
            : {}),
        })
      );
      try {
        tree.redo();
      } finally {
        stop();
      }
      expect(reset).toBe(true);
      expect(tree.$.x()).toBe(1);
      expect(events.find((event) => event.kind === 'operation')).toEqual({
        kind: 'operation',
        outcome: 'applied',
        ids: [id],
      });
      // The reset itself is still observed; the old entry is not resurrected.
      expect(rr.snapshot().entries).toEqual([]);
    } finally {
      tree.destroy();
    }
  });

  it.each(['structural-drift', 'effect-validation-failed'] as const)(
    'a structured %s refusal is refused, leaves state unchanged, and is not an exception',
    async (kind) => {
      const tree = make();
      const reader = restorationReader(tree)!;
      const port = getTreeRealizationPort(tree.$)!;
      const original = port.validateEffects;
      const events: unknown[] = [];
      try {
        undoable(() => tree.$.x(1));
        await tick();
        reader.subscribe((event) => events.push(event));
        port.validateEffects = () => ({ kind } as never);
        expect(() => tree.undo()).toThrow();
        expect(events.at(-1)).toMatchObject({
          operation: 'undo',
          outcome: 'refused',
          affectedEntryIds: [],
        });
        expect(tree.$.x()).toBe(1);
        expect(reader.snapshot().entries[0].status).toBe('applied');
      } finally {
        port.validateEffects = original;
        tree.destroy();
      }
    }
  );

  it('an exception whose message imitates a refusal code is still failed', async () => {
    const tree = make();
    const reader = restorationReader(tree)!;
    const port = getTreeRealizationPort(tree.$)!;
    const original = port.validateEffects;
    const events: unknown[] = [];
    try {
      undoable(() => tree.$.x(1));
      await tick();
      reader.subscribe((event) => events.push(event));
      port.validateEffects = () => {
        throw new Error('ST1034: imitation from an unrelated validator');
      };
      expect(() => tree.undo()).toThrow(/imitation/);
      expect(events.at(-1)).toMatchObject({
        operation: 'undo',
        outcome: 'failed',
        affectedEntryIds: [],
      });
      expect(tree.$.x()).toBe(1);
    } finally {
      port.validateEffects = original;
      tree.destroy();
    }
  });
});
