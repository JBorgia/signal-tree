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
 * Browser-safe: the reference app imports this file.
 */
import type { Signal, WritableSignal } from '@angular/core';
import { entityMap, signalTree } from '@signal-tree/angular';
import { measuredTurn } from './bench-flag.ts';
import { isCollectionSeed } from './seed.ts';
import type { Capability, Path, StoreSubject, SubjectCollection, SubjectTree, TreeOptions } from './types.ts';

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
    return {
      leaf<T>(path: Path): WritableSignal<T> {
        return walk(tree.$, path) as WritableSignal<T>;
      },
      collection<E, K extends string | number>(path: Path): SubjectCollection<E, K> {
        const entities = walk(tree.$, path) as V15EntitySignal;
        return {
          setAll(rows) {
            entities.setAll(rows as unknown[]);
          },
          updateOne(id, changes) {
            entities.updateOne(id, changes as Record<string, unknown>);
          },
          field<F extends keyof E & string>(id: K, field: F): Signal<E[F]> {
            const row = entities.byId(id);
            if (!row) throw new Error(`v15-shim: no row ${String(id)}`);
            return row[field] as Signal<E[F]>;
          },
          count() {
            return entities.count();
          },
        };
      },
      turn: measuredTurn,
      destroy() {
        tree.destroy();
      },
    };
  },
};
