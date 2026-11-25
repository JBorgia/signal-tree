/**
 * The new core on its plain adapter (Phase 1): @signal-tree/core from this
 * repository, no plugins. Leaves are the core's plain cells, which read with
 * .get() and write with .set() and .update() (BRIEF.md 4.4); the subject's
 * `framework: 'plain'` tells the Node micro scenarios to read them that way
 * and to compare them with a bare plain cell (#103, adopted provisionally).
 *
 * Browser-safe: no Node imports.
 */
import type { Signal, WritableSignal } from '@angular/core';
import { entityMap, signalTree } from '@signal-tree/core';
import { measuredTurn } from './bench-flag.ts';
import { isCollectionSeed } from './seed.ts';
import type { Capability, Path, StoreSubject, SubjectCollection, SubjectTree, TreeOptions, WriterContextLike } from './types.ts';

interface CoreCollection {
  setAll(rows: readonly unknown[], options?: { chunk: 'auto' }): void | Promise<void>;
  updateOne(id: string | number, changes: unknown): void;
  addOne(row: unknown): void;
  removeOne(id: string | number): void;
  byId(id: string | number): Record<string, unknown> | undefined;
  all(): readonly unknown[];
  count(): number;
}

/** Replaces collection seeds with core entityMap markers; leaves everything else as given. */
function toCoreState(state: object): object {
  const source = state as Record<string, unknown>;
  let out: Record<string, unknown> | undefined;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isCollectionSeed(value)) {
      out ??= { ...source };
      const idField = value.idField;
      out[key] = idField === 'id' ? entityMap<Record<string, unknown>, string | number>() : entityMap<Record<string, unknown>, string | number>({ selectId: (row) => row[idField] as string | number });
    }
  }
  return out ?? state;
}

function walk(root: unknown, path: Path): unknown {
  let node = root;
  for (const key of path) node = (node as Record<string, unknown>)[key];
  return node;
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'leaf',
  'build',
  'collection',
  'collectionFieldWrite',
  'collectionAddRemove',
  'collectionReads',
  'chunkedSetAll',
  'writers',
]);

export const corePlain: StoreSubject = {
  id: 'core-plain',
  description: 'The new core (@signal-tree/core from this repository) on its plain adapter, no plugins',
  packages: { '@signal-tree/core': 'workspace' },
  framework: 'plain',
  capabilities: CAPABILITIES,
  createTree(state: object, options?: TreeOptions): SubjectTree {
    if (options?.plugins && Object.values(options.plugins).some(Boolean)) throw new Error('core-plain: the plugins are not built yet (Phases 3–5)');
    if (options?.variant && options.variant !== 'bare') throw new Error(`core-plain: variant "${options.variant}" needs the plugins`);
    const tree = signalTree(toCoreState(state));
    return {
      leaf<T>(path: Path): WritableSignal<T> {
        return walk(tree.$, path) as WritableSignal<T>;
      },
      collection<E, K extends string | number>(path: Path): SubjectCollection<E, K> {
        const entities = walk(tree.$, path) as CoreCollection;
        const row = (id: K) => {
          const handle = entities.byId(id);
          if (!handle) throw new Error(`core-plain: no row ${String(id)}`);
          return handle;
        };
        return {
          setAll: (rows) => void entities.setAll(rows),
          setAllChunked: (rows) => entities.setAll(rows, { chunk: 'auto' }) as Promise<void>,
          updateOne: (id, changes) => entities.updateOne(id, changes),
          field: <F extends keyof E & string>(id: K, field: F) => row(id)[field] as Signal<E[F]>,
          writableField: <F extends keyof E & string>(id: K, field: F) => row(id)[field] as WritableSignal<E[F]>,
          addOne: (value) => entities.addOne(value),
          removeOne: (id) => entities.removeOne(id),
          all: () => entities.all() as readonly E[],
          byId: (id) => entities.byId(id),
          count: () => entities.count(),
        };
      },
      turn(label, fn) {
        measuredTurn(label, () => tree.turn(fn));
      },
      as<R>(context: WriterContextLike, fn: () => R): R {
        return tree.as(context, fn);
      },
      destroy() {
        tree.destroy();
      },
    };
  },
};
