import { describe, expect, it, vi } from 'vitest';
import { restoration } from '../enhancers/restoration/restoration';
import { entityMap } from './markers/entity-map';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';

type Row = { id: string; name: string };
const alpha: Row = { id: 'A', name: 'Alpha' };
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function captureRegistration<T>(call: () => T) {
  const original = Map.prototype.set;
  const entries: Array<{ map: Map<unknown, unknown>; key: number }> = [];
  const spy = vi
    .spyOn(Map.prototype, 'set')
    .mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
      value: unknown
    ) {
      const result = Reflect.apply(original, this, [key, value]);
      if (
        typeof key === 'number' &&
        Number.isSafeInteger(key) &&
        value instanceof WeakRef
      ) {
        entries.push({ map: this, key });
      }
      return result;
    });
  try {
    return { value: call(), entries };
  } finally {
    spy.mockRestore();
  }
}

const makeTree = () => signalTree({ rows: entityMap<Row, string>() });

describe('late reads cannot register a forgotten entity lifetime', () => {
  it.each(['node', 'field', 'write'] as const)(
    '%s after removal leaves no activation entry',
    async (kind) => {
      const tree = makeTree();
      try {
        const rows = tree.$.rows;
        rows.setAll([alpha]);
        const held = rows.byIdOrFail('A');
        rows.removeOne('A');
        const captured = captureRegistration(() => {
          if (kind === 'node') return held();
          if (kind === 'field') return held.name();
          try {
            held({ id: 'A', name: 'Rejected' });
          } catch (error) {
            return error;
          }
          return 'write unexpectedly accepted';
        });
        if (kind === 'write') {
          expect(captured.value).toBeInstanceOf(Error);
          expect(String(captured.value)).toMatch(/not found/);
        } else expect(captured.value).toBeUndefined();
        await Promise.resolve();
        await Promise.resolve();
        expect(
          captured.entries.map(({ map, key }) => [key, map.has(key), map.size])
        ).toEqual([]);
        expect(tree.destroyed()).toBe(false);
      } finally {
        tree.destroy();
      }
    }
  );

  it('a first late read cannot retarget a same-key replacement', () => {
    const tree = makeTree();
    try {
      const rows = tree.$.rows;
      rows.setAll([alpha]);
      const held = rows.byIdOrFail('A');
      rows.removeOne('A');
      rows.addOne({ id: 'A', name: 'Replacement' });
      const captured = captureRegistration(() => held());
      expect(captured.value).toBeUndefined();
      expect(held.name()).toBeUndefined();
      expect(rows.byIdOrFail('A')().name).toBe('Replacement');
      expect(captured.entries).toHaveLength(0);
    } finally {
      tree.destroy();
    }
  });

  it('an already-read carrier is removed and never re-registered', () => {
    const tree = makeTree();
    try {
      const rows = tree.$.rows;
      rows.setAll([alpha]);
      const held = rows.byIdOrFail('A');
      const initial = captureRegistration(() => held());
      expect(initial.value).toEqual(alpha);
      expect(initial.entries).toHaveLength(1);
      expect(initial.entries[0].map.has(initial.entries[0].key)).toBe(true);
      rows.removeOne('A');
      const late = captureRegistration(() => held());
      expect(late.value).toBeUndefined();
      expect(late.entries).toHaveLength(0);
      expect(initial.entries[0].map.size).toBe(0);
    } finally {
      tree.destroy();
    }
  });

  it('a first tombstone read tracks undo for a held reactive consumer', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      {
        enhancers: [restoration({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      }
    );
    let unsubscribe: (() => void) | undefined;
    try {
      const rows = tree.$.rows;
      rows.setAll([alpha]);
      await tick();
      const held = rows.byIdOrFail('A');
      undoable(() => rows.removeOne('A'));
      await tick();
      const late = captureRegistration(() => held.name());
      expect(late.value).toBeUndefined();
      expect(late.entries).toHaveLength(1);
      const seen: Array<string | undefined> = [];
      unsubscribe = held.name.subscribe(() => {
        seen.push(held.name());
      });
      tree.undo();
      await tick();
      expect(seen).toEqual(['Alpha']);
      expect(held()).toEqual(alpha);
      expect(late.entries[0].map.has(late.entries[0].key)).toBe(true);
    } finally {
      unsubscribe?.();
      tree.destroy();
    }
  });
});
