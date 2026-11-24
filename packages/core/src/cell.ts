import { SignalTreeError } from './errors';

/**
 * The adapter contract (BRIEF.md 4.3, with ruling 8) and the plain cell, the
 * framework-free adapter the core uses when no other adapter is given.
 */

/** Cell types by adapter tag. Adapters augment this, for example `angular: WritableSignal<T>`. */
export interface CellTypes<T> {
  plain: PlainCell<T>;
}

export type NativeCell<Tag extends string, T> = Tag extends keyof CellTypes<T> ? CellTypes<T>[Tag] : never;

/**
 * Hands a write made through a cell's own API to the tree's write seam. One
 * shared function per tree, never a closure per cell (ruling 8).
 */
export type Route = (cell: object, next: unknown) => void;

export interface CellAdapter<Tag extends string> {
  readonly tag: Tag;
  /** Create a native cell. Writes made through the cell's own API must call route(cell, next), never store directly. */
  createCell<T>(initial: T, route: Route): NativeCell<Tag, T>;
  /** Store a value the seam accepted. The only path that mutates storage. */
  commit<T>(cell: NativeCell<Tag, T>, value: T): void;
  /** Untracked read. */
  peek<T>(cell: NativeCell<Tag, T>): T;
  /** Observers see every commit inside fn as one change. */
  batch(fn: () => void): void;
  /** Optional: recognise framework cells passed in the initial state and adopt them without copying. */
  matches?(value: unknown): boolean;
  adopt?<T>(value: unknown, route: Route): NativeCell<Tag, T>;
}

// ---------------------------------------------------------------- plain cell

/** @internal Where a tree keeps the node of a cell it created. */
export const NODE: unique symbol = Symbol('signal-tree.node');

type Listener = () => void;

/**
 * A framework-free cell. Reads with get(), writes with set() and update(), and
 * notifies subscribers after each change. Every write goes through the tree.
 */
export class PlainCell<T> {
  /** @internal */ _value: T;
  /** @internal */ _route: Route;
  /** @internal */ _listeners: Listener[] | null = null;
  /** @internal */ _adapter: PlainAdapterState;
  /** @internal */ _queued = false;
  /** @internal The value when the cell was queued; a batch that nets to it notifies no one. */
  _queuedFrom: unknown = undefined;
  /** @internal */ _destroyed = false;
  /** @internal Declared here so plain cells keep one shape. */
  [NODE]: unknown = undefined;

  /** @internal */
  constructor(initial: T, route: Route, adapter: PlainAdapterState) {
    this._value = initial;
    this._route = route;
    this._adapter = adapter;
  }

  get(): T {
    if (this._destroyed) throw new SignalTreeError('ST1003');
    return this._value;
  }

  set(value: T): void {
    this._route(this, value);
  }

  update(fn: (current: T) => T): void {
    this._route(this, fn(this.get()));
  }

  /** Calls `listener` after each change. Returns the function that stops it. */
  subscribe(listener: Listener): () => void {
    (this._listeners ??= []).push(listener);
    return () => {
      const listeners = this._listeners;
      if (!listeners) return;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }
}

/** @internal */
interface PlainAdapterState {
  depth: number;
  queue: PlainCell<unknown>[];
  onListenerError: (error: unknown) => void;
}

export interface PlainAdapterOptions {
  /** Receives every error a subscriber throws. Other subscribers still run. Defaults to rethrowing asynchronously. */
  readonly onListenerError?: (error: unknown) => void;
}

export interface PlainAdapter extends CellAdapter<'plain'> {
  /** @internal Replaces where subscriber errors go. */
  setListenerErrorHandler(handler: (error: unknown) => void): void;
  /** @internal After this, reading the cell throws and it notifies no one. */
  destroyCell(cell: object): void;
}

function notify(cell: PlainCell<unknown>, state: PlainAdapterState): void {
  const listeners = cell._listeners;
  if (!listeners || listeners.length === 0) return;
  if (listeners.length === 1) {
    try {
      listeners[0]!();
    } catch (error) {
      state.onListenerError(error);
    }
    return;
  }
  for (const listener of listeners.slice()) {
    try {
      listener();
    } catch (error) {
      state.onListenerError(error);
    }
  }
}

function flush(state: PlainAdapterState): void {
  const queue = state.queue;
  // A subscriber may write; its notifications join this flush.
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]!;
    cell._queued = false;
    const from = cell._queuedFrom;
    cell._queuedFrom = undefined;
    if (Object.is(cell._value, from)) continue;
    notify(cell, state);
  }
  queue.length = 0;
}

const plainAdapters = new WeakSet<object>();

/** @internal True for adapters made by createPlainAdapter. */
export function isPlainAdapter(adapter: object): boolean {
  return plainAdapters.has(adapter);
}

/** Creates a plain adapter. Each one batches its own cells. */
export function createPlainAdapter(options: PlainAdapterOptions = {}): PlainAdapter {
  const state: PlainAdapterState = {
    depth: 0,
    queue: [],
    onListenerError:
      options.onListenerError ??
      ((error) => {
        queueMicrotask(() => {
          throw error;
        });
      }),
  };
  const adapter: PlainAdapter = {
    tag: 'plain',
    createCell<T>(initial: T, route: Route) {
      return new PlainCell(initial, route, state) as NativeCell<'plain', T>;
    },
    commit<T>(cell: NativeCell<'plain', T>, value: T) {
      const plain = cell as PlainCell<T>;
      const previous = plain._value;
      plain._value = value;
      if (plain._listeners === null || plain._listeners.length === 0) return;
      if (state.depth > 0) {
        if (!plain._queued) {
          plain._queued = true;
          plain._queuedFrom = previous;
          state.queue.push(plain as PlainCell<unknown>);
        }
        return;
      }
      notify(plain as PlainCell<unknown>, state);
    },
    peek<T>(cell: NativeCell<'plain', T>) {
      return (cell as PlainCell<T>)._value;
    },
    batch(fn: () => void) {
      state.depth++;
      try {
        fn();
      } finally {
        state.depth--;
        if (state.depth === 0 && state.queue.length > 0) {
          state.depth++;
          try {
            flush(state);
          } finally {
            state.depth--;
          }
        }
      }
    },
    setListenerErrorHandler(handler) {
      state.onListenerError = handler;
    },
    destroyCell(cell) {
      const plain = cell as PlainCell<unknown>;
      plain._destroyed = true;
      plain._listeners = null;
    },
  };
  plainAdapters.add(adapter);
  return adapter;
}

/** True when `value` is a plain cell. */
export function isPlainCell(value: unknown): value is PlainCell<unknown> {
  return value instanceof PlainCell;
}
