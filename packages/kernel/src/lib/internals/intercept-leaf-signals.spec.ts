import { describe, expect, it } from 'vitest';

import { createReactiveTestRealization } from '../../reactive-test-realization';
import { entityMap } from '../markers/entity-map';
import { signalTree } from '../signal-tree';
import { interceptLeafSignals } from './intercept-leaf-signals';
import { withWriteContext } from '../write-context';
import type { WriteMetadata } from '../types';

const signal = createReactiveTestRealization().locations.createCell;

interface Captured {
  path: string;
  next: unknown;
  prev: unknown;
  meta?: WriteMetadata;
  ownerPath?: string;
}

function captureWrites(): {
  list: Captured[];
  onWrite: (
    path: string,
    next: unknown,
    prev: unknown,
    meta?: WriteMetadata,
    ownerPath?: string
  ) => void;
} {
  const list: Captured[] = [];
  return {
    list,
    onWrite: (path, next, prev, meta, ownerPath) => {
      list.push({ path, next, prev, meta, ownerPath });
    },
  };
}

// Scalar callbacks carry an uncovered private receipt even without write context.
// Check every own field and descriptor; do not discard symbols or accept subsets.
function expectScalarMetadata(
  actual: WriteMetadata | undefined,
  fields: WriteMetadata
): void {
  if (actual === undefined) throw new Error('Scalar callback metadata missing');
  expect(Object.getPrototypeOf(actual)).toBe(Object.prototype);
  expect(Object.getOwnPropertyNames(actual).sort()).toEqual(Object.keys(fields).sort());
  for (const [key, value] of Object.entries(fields)) {
    expect(Object.getOwnPropertyDescriptor(actual, key)).toEqual({
      value, enumerable: true, configurable: true, writable: true,
    });
  }
  const symbols = Object.getOwnPropertySymbols(actual);
  expect(symbols).toHaveLength(1);
  expect(symbols[0].description).toBe('ScalarPublicationCoverage');
  expect(Object.getOwnPropertyDescriptor(actual, symbols[0])).toEqual({
    value: undefined, enumerable: true, configurable: true, writable: true,
  });
}

describe('interceptLeafSignals — WriteMetadata passthrough (PR1)', () => {
  it('passes `meta` from withWriteContext to onWrite on .set()', () => {
    const tree = { count: signal(0) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    withWriteContext({ intent: 'hydrate', origin: 'external' }, () => {
      tree.count(1);
    });

    expect(list).toHaveLength(1);
    expect(list[0].path).toBe('count');
    expect(list[0].ownerPath).toBe('count');
    expect(list[0].next).toBe(1);
    expect(list[0].prev).toBe(0);
    expectScalarMetadata(list[0].meta, {
      intent: 'hydrate',
      origin: 'external',
      mutationIntent: 'replace',
    });

    restore();
  });

  it('passes `meta` from withWriteContext to onWrite on .update()', () => {
    const tree = { count: signal(10) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    withWriteContext({ intent: 'user' }, () => {
      tree.count((c) => c + 1);
    });

    expect(list).toHaveLength(1);
    expectScalarMetadata(list[0].meta, {
      intent: 'user',
      mutationIntent: 'derive',
    });
    expect(list[0].ownerPath).toBe('count');
    expect(list[0].next).toBe(11);
    expect(list[0].prev).toBe(10);

    restore();
  });

  it('supplies mutation intent and an uncovered receipt when no write context is active', () => {
    const tree = { count: signal(0) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    tree.count(5); // no context

    expect(list).toHaveLength(1);
    expectScalarMetadata(list[0].meta, { mutationIntent: 'replace' });
    expect(list[0].ownerPath).toBe('count');

    restore();
  });

  it('reports owner paths for built-in markers at their owning positions', () => {
    const storage = new Map<string, string>();
    const tree = signalTree(
      {
        rows: entityMap<{ id: number; name: string }, number>({
          selectId: (row) => row.id,
        }),
        // Was `stored()`. The subject here never needed a DURABLE leaf —
        // only a leaf. Durability moved to persistence()/Link.
        theme: 'light',
      },
      { capabilities: ['causal-runtime'] }
    );
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree.$, onWrite);

    tree.$.rows.addOne({ id: 1, name: 'A' });
    tree.$.theme('dark');

    expect(list.map((entry) => entry.ownerPath)).toEqual(['rows']);
    expect(list.map((entry) => entry.path)).toEqual(['rows']);

    restore();
  });

  it('captures meta synchronously — context from outer frame is observed even through nested set calls', () => {
    const tree = { a: signal(0), b: signal(0) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    withWriteContext({ intent: 'bulk' }, () => {
      tree.a(1);
      tree.b(2);
    });

    expect(list).toHaveLength(2);
    expectScalarMetadata(list[0].meta, {
      intent: 'bulk',
      mutationIntent: 'replace',
    });
    expectScalarMetadata(list[1].meta, {
      intent: 'bulk',
      mutationIntent: 'replace',
    });

    restore();
  });

  it('captures the innermost meta when withWriteContext frames nest', () => {
    const tree = { a: signal(0), b: signal(0) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    withWriteContext({ intent: 'hydrate' }, () => {
      tree.a(1); // captures `hydrate`
      withWriteContext({ intent: 'user' }, () => {
        tree.b(2); // captures `user`
      });
    });

    expect(list).toHaveLength(2);
    expectScalarMetadata(list[0].meta, {
      intent: 'hydrate',
      mutationIntent: 'replace',
    });
    expectScalarMetadata(list[1].meta, {
      intent: 'user',
      mutationIntent: 'replace',
    });

    restore();
  });

  it('does not invoke onWrite when value is unchanged (referential equality)', () => {
    const tree = { count: signal(7) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    withWriteContext({ intent: 'user' }, () => {
      tree.count(7); // no change
    });

    expect(list).toHaveLength(0);
    restore();
  });

  it('preserves backward compatibility for 3-arg onWrite callbacks (meta dropped silently)', () => {
    const tree = { count: signal(0) };
    const calls: Array<[string, unknown, unknown]> = [];
    // Intentionally only 3 args — TypeScript permits because meta is optional.
    const onWrite = (path: string, next: unknown, prev: unknown): void => {
      calls.push([path, next, prev]);
    };
    const restore = interceptLeafSignals(tree, onWrite);

    withWriteContext({ intent: 'user' }, () => {
      tree.count(1);
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(['count', 1, 0]);
    restore();
  });

  it('cleanup function restores original .set / .update behavior', () => {
    const tree = { count: signal(0) };
    const { list, onWrite } = captureWrites();
    const restore = interceptLeafSignals(tree, onWrite);

    tree.count(1);
    expect(list).toHaveLength(1);

    restore();

    // After restore, writes are no longer intercepted.
    tree.count(2);
    expect(list).toHaveLength(1);
    expect(tree.count()).toBe(2);
  });
});
