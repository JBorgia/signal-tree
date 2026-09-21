import { afterEach, describe, expect, it, vi } from 'vitest';
import { link } from './link';
import { signalTree } from './signal-tree';

const nextTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
afterEach(() => vi.unstubAllGlobals());

for (const devMode of [true, false]) {
  describe(`nested Link ownership with ngDevMode=${devMode}`, () => {
    it('sends a nested user edit after retrieval without flattening its address', async () => {
      vi.stubGlobal('ngDevMode', devMode);
      const tree = signalTree({
        settings: { preferences: { density: 'compact' }, title: 'Workspace' },
      });
      let endpoint = { density: 'comfortable' };
      const writes: { density: string }[] = [];
      const connection = link(tree.$.settings.preferences, {
        get: async () => endpoint,
        set: (value) => {
          endpoint = value;
          writes.push(value);
        },
      });
      try {
        await connection.retrieve();
        await nextTurn();
        tree.$.settings.preferences.density(() => 'compact');
        await connection.settled();
        await nextTurn();
        expect(endpoint).toEqual({ density: 'compact' });
        expect(writes).toEqual([{ density: 'compact' }]);
        tree.$.settings.title('Renamed');
        await connection.settled();
        await nextTurn();
        expect(writes).toHaveLength(1);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    });

    it('keeps a nested path intact in a root-linked snapshot', async () => {
      vi.stubGlobal('ngDevMode', devMode);
      const tree = signalTree({ settings: { density: 'compact' }, count: 0 });
      const writes: unknown[] = [];
      const connection = link(tree.$, {
        set: (value) => {
          writes.push(value);
        },
      });
      try {
        tree.$.settings.density('comfortable');
        await connection.settled();
        await nextTurn();
        expect(writes).toEqual([
          { settings: { density: 'comfortable' }, count: 0 },
        ]);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    });
  });
}
