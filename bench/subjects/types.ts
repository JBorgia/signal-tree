/**
 * The store subject: the only surface the scenarios and the reference app use
 * to reach the store under test. Phase 0's subject is a shim over the published
 * @signal-tree/angular@15.4.9; later subjects wrap the new core. A scenario
 * declares the capabilities it needs, and the runner reports it as not
 * applicable when the subject lacks one.
 *
 * Handles are framework-native (Angular WritableSignal / Signal) so a micro
 * gate measures the store's own leaf, not a wrapper around it.
 */
import type { Signal, WritableSignal } from '@angular/core';

export type Capability =
  /** Framework-native writable leaf handles: read, set, update (M1, M2, S1). */
  | 'leaf'
  /** Build a tree from a plain initial state (M3). */
  | 'build'
  /** Keyed collection: setAll, updateOne, per-field cells (S2). */
  | 'collection'
  /** Writable per-field cells of a collection row (S4c). */
  | 'collectionFieldWrite'
  /** setAll(rows, { chunk: 'auto' }) that yields between chunks (S3, W4). */
  | 'chunkedSetAll'
  /** Writer identity: tree.as({ writer, origin }, fn) (W1). */
  | 'writers'
  /** hold() a location for a writer, with a contention policy (W2). */
  | 'hold'
  /** Optimistic transactions with confirm() and rollback() (T1). */
  | 'transactions'
  /** Transaction inspect() (T9). */
  | 'transactionInspect'
  /** Undo history with a retain cap (R1, R4). */
  | 'restoration'
  /** history.undo({ writer }) (W3). */
  | 'selectiveUndo'
  /** Links created elsewhere in the tree (S7). */
  | 'links'
  /** Plugins attached to subtree scopes (S6(b)). */
  | 'scopedPlugins'
  /** Plugin internal collection sizes and their configured caps (S5). */
  | 'pluginCollectionSizes';

export type Path = readonly string[];

export interface WriterContextLike {
  readonly writer: string;
  readonly origin: string;
}

export type HoldPolicy =
  | { readonly kind: 'refuse' }
  | { readonly kind: 'queue' }
  | { readonly kind: 'merge'; merge(current: unknown, incoming: unknown, context: WriterContextLike): unknown };

export interface TreeOptions {
  /** Plugins installed on the whole tree (S4, S5, S7). */
  readonly plugins?: {
    readonly transactions?: boolean;
    readonly restoration?: { readonly retain: number };
    readonly writers?: boolean;
  };
  /**
   * S6(b): 'scoped-plugins' attaches every plugin to a different 10% subtree
   * (the subject splits the top-level keys of the state into 10% shares).
   */
  readonly variant?: 'bare' | 'scoped-plugins';
}

export interface SubjectTransaction {
  inspect(): unknown;
  confirm(): void;
  rollback(): void;
}

export interface SubjectCollection<E, K extends string | number> {
  setAll(rows: readonly E[]): void;
  /** Capability 'chunkedSetAll': setAll(rows, { chunk: 'auto' }). */
  setAllChunked?(rows: readonly E[]): Promise<void>;
  updateOne(id: K, changes: Partial<E>): void;
  /** A held, framework-native cell for one field of one row. */
  field<F extends keyof E & string>(id: K, field: F): Signal<E[F]>;
  /** Capability 'collectionFieldWrite': a held writable cell for one field of one row. */
  writableField?<F extends keyof E & string>(id: K, field: F): WritableSignal<E[F]>;
  count(): number;
}

export interface PluginCollectionSize {
  readonly plugin: string;
  readonly collection: string;
  readonly size: number;
  readonly cap: number;
}

export interface SubjectTree {
  /** The framework-native leaf at `path`. Callers hold the returned handle. */
  leaf<T>(path: Path): WritableSignal<T>;
  /** The keyed collection at `path`. */
  collection<E, K extends string | number>(path: Path): SubjectCollection<E, K>;
  /**
   * Runs `fn` as one store turn (a native turn where the subject has one) and,
   * in bench builds, brackets it with a `signal-tree:` measure. Scenarios call
   * this once per turn or batch, never per write.
   */
  turn(label: string, fn: () => void): void;
  /** Capability 'writers'. */
  as?<R>(context: WriterContextLike, fn: () => R): R;
  /** Capability 'hold'. Returns the release function. */
  hold?(path: Path, context: WriterContextLike, policy?: HoldPolicy): () => void;
  /** Capability 'transactions'. */
  transact?(fn: () => void): SubjectTransaction;
  /** Capability 'restoration' (no filter) and 'selectiveUndo' (writer filter). */
  undo?(filter?: { readonly writer?: string }): void;
  /** Capability 'restoration': run `fn` as an undoable operation. */
  undoable?(fn: () => void): void;
  /** Capability 'links': create `count` links on locations under `path`; returns dispose. */
  linkMany?(path: Path, count: number): () => void;
  /** Capability 'pluginCollectionSizes'. */
  pluginCollections?(): readonly PluginCollectionSize[];
  destroy(): void;
}

export interface StoreSubject {
  readonly id: string;
  readonly description: string;
  /** Exact versions of the store packages the subject wraps. */
  readonly packages: Readonly<Record<string, string>>;
  readonly capabilities: ReadonlySet<Capability>;
  createTree(state: object, options?: TreeOptions): SubjectTree;
}

export function missingCapabilities(subject: StoreSubject, required: readonly Capability[]): Capability[] {
  return required.filter((capability) => !subject.capabilities.has(capability));
}
