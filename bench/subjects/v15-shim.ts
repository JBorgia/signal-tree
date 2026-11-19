/**
 * Phase 0 store subject: a shim over the published @signal-tree/angular@15.4.9.
 * API taken from the package's type declarations: signalTree(state),
 * entityMap<E, K>({ selectId }), leaves typed AngularLeaf<T> (an Angular
 * WritableSignal), EntitySignal.setAll / updateOne / byId / count.
 *
 * The shim only adapts names; it installs no enhancers and does not extend
 * v15. 15.4.9 has no chunked setAll, holds, writer identity or scoped plugins,
 * so those capabilities are absent and their scenarios report "not applicable".
 * v15 has no turn API either: turn() runs fn as is and only adds the bench
 * measure around it.
 *
 * #12: in bench builds the shim remembers the handles it hands out (leaves;
 * rows and fields of collection cells) and, inside each turn's measure, reads
 * the leaves and the touched rows' cells untracked. v15's leaves are
 * projections of kernel storage that recompute on read, so without this the
 * recomputation lands in change detection, outside the store's marks. The
 * leaves are all read (the shim cannot see writes made through a native
 * handle); collection cells only for rows the turn updated. The registry
 * (one id per rendered row) is counted in S2's store heap.
 *
 * Browser-safe: the reference app imports this file.
 */
import { untracked, type Signal, type WritableSignal } from '@angular/core';
import { entityMap, signalTree } from '@signal-tree/angular';
import { measuredTurn } from './bench-flag.ts';
import { isCollectionSeed } from './seed.ts';
import type { Capability, Path, StoreSubject, SubjectCollection, SubjectTree, TreeOptions } from './types.ts';

declare const __SIGNAL_TREE_BENCH__: boolean | undefined;

/** #12: handles handed out, read inside the turn measure in bench builds. */
interface LazyReads {
  readonly leaves: (() => unknown)[];
  readonly collections: { entities: V15EntitySignal; rows: Set<string | number>; fields: Set<string>; touched: Set<string | number>; all: boolean }[];
}

function runLazyReads(lazy: LazyReads): void {
  untracked(() => {
    for (const leaf of lazy.leaves) leaf();
    for (const collection of lazy.collections) {
      for (const id of collection.all ? collection.rows : collection.touched) {
        const row = collection.entities.byId(id);
        if (row) for (const field of collection.fields) (row[field] as () => unknown)();
      }
      collection.touched.clear();
      collection.all = false;
    }
  });
}

interface V15EntitySignal {
  setAll(rows: unknown[]): void;
  updateOne(id: string | number, changes: Record<string, unknown>): void;
  byId(id: string | number): Record<string, unknown> | undefined;
  readonly count: () => number;
}

/** Replaces collection seeds with v15 entityMap markers; leaves everything else as given. */
function toV15State(state: object): object {
  const source = state as Record<string, unknown>;
  let out: Record<string, unknown> | undefined;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isCollectionSeed(value)) {
      out ??= { ...source };
      const idField = value.idField;
      out[key] = entityMap<Record<string, unknown>, string | number>({
        selectId: (row) => row[idField] as string | number,
      });
    }
  }
  return out ?? state;
}

function walk(root: unknown, path: Path): unknown {
  let node = root;
  for (const key of path) node = (node as Record<string, unknown>)[key];
  return node;
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>(['leaf', 'build', 'collection']);

export const v15Shim: StoreSubject = {
  id: 'v15-shim',
  description: 'Shim over the published @signal-tree/angular@15.4.9, no enhancers installed',
  packages: { '@signal-tree/angular': '15.4.9', '@signal-tree/kernel': '15.4.9' },
  capabilities: CAPABILITIES,
  createTree(state: object, options?: TreeOptions): SubjectTree {
    if (options?.plugins && Object.values(options.plugins).some(Boolean)) {
      throw new Error('v15-shim: plugins need capabilities 15.4.9 does not have');
    }
    if (options?.variant && options.variant !== 'bare') {
      throw new Error(`v15-shim: variant "${options.variant}" needs scoped plugins`);
    }
    const tree = signalTree(toV15State(state)) as unknown as { readonly $: unknown; destroy(): void };
    let lazy: LazyReads | undefined;
    if (typeof __SIGNAL_TREE_BENCH__ !== 'undefined' && __SIGNAL_TREE_BENCH__) lazy = { leaves: [], collections: [] };
    return {
      leaf<T>(path: Path): WritableSignal<T> {
        const leaf = walk(tree.$, path) as WritableSignal<T>;
        lazy?.leaves.push(leaf);
        return leaf;
      },
      collection<E, K extends string | number>(path: Path): SubjectCollection<E, K> {
        const entities = walk(tree.$, path) as V15EntitySignal;
        const reads = lazy && { entities, rows: new Set<string | number>(), fields: new Set<string>(), touched: new Set<string | number>(), all: false };
        if (reads) lazy!.collections.push(reads);
        return {
          setAll(rows) {
            entities.setAll(rows as unknown[]);
            if (reads) reads.all = true;
          },
          updateOne(id, changes) {
            entities.updateOne(id, changes as Record<string, unknown>);
            if (reads?.rows.has(id)) reads.touched.add(id);
          },
          field<F extends keyof E & string>(id: K, field: F): Signal<E[F]> {
            const row = entities.byId(id);
            if (!row) throw new Error(`v15-shim: no row ${String(id)}`);
            reads?.rows.add(id);
            reads?.fields.add(field);
            return row[field] as Signal<E[F]>;
          },
          count() {
            return entities.count();
          },
        };
      },
      turn(label, fn) {
        measuredTurn(label, fn, lazy && (() => runLazyReads(lazy!)));
      },
      destroy() {
        tree.destroy();
      },
    };
  },
};
