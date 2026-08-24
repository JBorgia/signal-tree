import { computed } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { entityMap } from './types';
import { restoration } from '../enhancers/restoration/restoration';

/**
 * DERIVATION E — the last two members: `tap` and `intercept`.
 *
 * `tap`       push notification of add/update/remove.
 * `intercept` a WRITE-PATH AUTHORITY: it can block or transform a mutation
 *             before it lands.
 *
 * These are different in kind and are derived separately.
 */
type Row = { id: string; n: number };
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type RestorationRows = {
  $: {
    rows: {
      addOne(row: Row): void;
      updateOne(id: string, changes: Partial<Row>): void;
      ids(): string[];
      byId(id: string): { n: () => number | undefined } | undefined;
      intercept: ReturnType<
        typeof signalTree<{ rows: ReturnType<typeof entityMap<Row, string>> }>
      >['$']['rows']['intercept'];
    };
  };
  canUndo(): boolean;
  getRestorationHistory(): unknown[];
};

function createRestorationRows(): RestorationRows {
  return signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [restoration()] }
  ) as unknown as RestorationRows;
}

// ============================================================================
// E-TAP — is push observation a function, given a complete pull surface?
// ============================================================================
describe('E-TAP — push observation', () => {
  it('MEASURE — tap reports WHICH member changed and how', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    const seen: string[] = [];
    tree.$.rows.tap({
      onAdd: (e, id) => seen.push(`add:${id}:${e.n}`),
      onUpdate: (id, changes) =>
        seen.push(`upd:${id}:${JSON.stringify(changes)}`),
      onRemove: (id) => seen.push(`rem:${id}`),
    });

    tree.$.rows.addOne({ id: 'a', n: 1 });
    tree.$.rows.updateOne('a', { n: 2 });
    tree.$.rows.removeOne('a');

    expect(seen).toEqual(['add:a:1', 'upd:a:{"n":2}', 'rem:a']);
  });

  it('NULL — the pull surface carries the same information, recovered by diff', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });

    // ANG-V0-D already established entityMap CRUD is fully visible through its
    // own read surface. The only thing push adds is CHANGE IDENTITY, which pull
    // recovers by diffing — at O(width) per change rather than O(delta).
    let prev = new Map<string, number>();
    const events = computed(() => {
      const next = new Map(tree.$.rows.all().map((r) => [r.id, r.n]));
      const out: string[] = [];
      for (const [id, n] of next) {
        if (!prev.has(id)) out.push(`add:${id}:${n}`);
        else if (prev.get(id) !== n) out.push(`upd:${id}:{"n":${n}}`);
      }
      for (const id of prev.keys()) if (!next.has(id)) out.push(`rem:${id}`);
      prev = next;
      return out;
    });

    tree.$.rows.addOne({ id: 'a', n: 1 });
    expect(events()).toEqual(['add:a:1']);
    tree.$.rows.updateOne('a', { n: 2 });
    expect(events()).toEqual(['upd:a:{"n":2}']);
    tree.$.rows.removeOne('a');
    expect(events()).toEqual(['rem:a']);
  });
});

// ============================================================================
// E-INT — `intercept` is a write-path authority, and the async form is broken.
// ============================================================================
describe('E-INT — write-path authority', () => {
  it('MEASURE — a SYNCHRONOUS interceptor really does block the write', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.intercept({
      onAdd: (e, ctx) => {
        if (e.n < 0) ctx.block('negative');
      },
    });

    expect(() => tree.$.rows.addOne({ id: 'bad', n: -1 })).toThrow(/negative/);
    expect(tree.$.rows.ids()).toEqual([]);

    tree.$.rows.addOne({ id: 'ok', n: 1 });
    expect(tree.$.rows.ids()).toEqual(['ok']);
  });

  it('DR-2 — async interceptors fail closed before any mutation can land', async () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });

    // TypeScript allows an async function where a void-returning callback is
    // expected, so runtime still has to fail closed before a synchronous write
    // path can commit.
    let blockAttempted = false;
    expect(() =>
      tree.$.rows.intercept({
        onAdd: async (e, ctx) => {
          await Promise.resolve();
          if (e.n < 0) {
            blockAttempted = true;
            ctx.block('negative');
          }
        },
      })
    ).toThrow(/ST2033/);

    expect(() => tree.$.rows.addOne({ id: 'bad', n: -1 })).not.toThrow();
    expect(tree.$.rows.ids()).toEqual(['bad']);

    await tick();

    // The async handler was never admitted, so no delayed block can leak in after
    // the synchronous mutation path has already made a decision.
    expect(blockAttempted).toBe(false);
    expect(tree.$.rows.byId('bad')?.n()).toBe(-1);
  });

  it('DR-2 — thenable add interceptors fail closed before the add lands', async () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    let transformAttempted = false;

    tree.$.rows.intercept({
      onAdd: (_entity, ctx) => {
        return Promise.resolve().then(() => {
          transformAttempted = true;
          ctx.transform({ id: 'a', n: 99 });
        });
      },
    });

    expect(() => tree.$.rows.addOne({ id: 'a', n: 1 })).toThrow(/ST2033/);
    expect(tree.$.rows.ids()).toEqual([]);

    await tick();

    expect(transformAttempted).toBe(true);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('DR-2 — thenable update interceptors fail closed before the update lands', async () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.addOne({ id: 'a', n: 1 });
    let transformAttempted = false;

    tree.$.rows.intercept({
      onUpdate: (_id, _changes, ctx) => {
        return Promise.resolve().then(() => {
          transformAttempted = true;
          ctx.transform({ n: 99 });
        });
      },
    });

    expect(() => tree.$.rows.updateOne('a', { n: 2 })).toThrow(/ST2033/);
    expect(tree.$.rows.byId('a')?.n()).toBe(1);

    await tick();

    expect(transformAttempted).toBe(true);
    expect(tree.$.rows.byId('a')?.n()).toBe(1);
  });

  it('DR-2 — thenable remove interceptors fail closed before the removal lands', async () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.addOne({ id: 'a', n: 1 });
    let blockAttempted = false;

    tree.$.rows.intercept({
      onRemove: (_id, _entity, ctx) => {
        return Promise.resolve().then(() => {
          blockAttempted = true;
          ctx.block('too late');
        });
      },
    });

    expect(() => tree.$.rows.removeOne('a')).toThrow(/ST2033/);
    expect(tree.$.rows.byId('a')?.n()).toBe(1);

    await tick();

    expect(blockAttempted).toBe(true);
    expect(tree.$.rows.byId('a')?.n()).toBe(1);
  });

  it('DR-2 — blocked interceptor creates no history residue', async () => {
    const tree = createRestorationRows();
    const initialHistoryLength = tree.getRestorationHistory().length;
    tree.$.rows.intercept({
      onAdd: (_entity, ctx) => ctx.block('negative'),
    });

    expect(() => tree.$.rows.addOne({ id: 'bad', n: -1 })).toThrow(/negative/);

    await tick();

    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.canUndo()).toBe(false);
    expect(tree.getRestorationHistory()).toHaveLength(initialHistoryLength);
  });

  it('DR-2 — thenable interceptor failure creates no history residue', async () => {
    const tree = createRestorationRows();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    await tick();
    const historyBeforeFailedUpdate = tree.getRestorationHistory().length;
    let transformAttempted = false;
    tree.$.rows.intercept({
      onUpdate: (_id, _changes, ctx) => {
        return Promise.resolve().then(() => {
          transformAttempted = true;
          ctx.transform({ n: 99 });
        });
      },
    });

    expect(() => tree.$.rows.updateOne('a', { n: 2 })).toThrow(/ST2033/);

    await tick();

    expect(transformAttempted).toBe(true);
    expect(tree.$.rows.byId('a')?.n()).toBe(1);
    expect(tree.getRestorationHistory()).toHaveLength(historyBeforeFailedUpdate);
  });

  it('DEFECT — ctx.blocked / ctx.blockReason are vestigial: block() throws instead of setting them', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    let observedBlocked: boolean | undefined;

    tree.$.rows.intercept({
      onAdd: (e, ctx) => {
        observedBlocked = ctx.blocked;
        // The ctx exposes `blocked`/`blockReason` as if a handler could consult
        // or set them. `block()` throws out of the loop, so they are never true.
      },
    });

    tree.$.rows.addOne({ id: 'a', n: 1 });
    expect(observedBlocked).toBe(false);
  });
});
