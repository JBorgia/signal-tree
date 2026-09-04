import type {
  CallablePart,
  LeafDefinition,
  NonCallableValue,
} from '../leaf';

/** Internal callable read contract shared by locations and legacy plumbing. */
export interface ReadableCell<T> {
  (): T;
}

/** Internal writable callable contract used by generic tree utilities. */
export interface WritableCell<T> extends ReadableCell<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
  asReadonly(): ReadableCell<T>;
}

/** Kernel-owned public read contract for one state or derived leaf. */
export interface ReadonlyLocation<T> extends ReadableCell<T> {
  peek(): T;
  subscribe(listener: () => void): () => void;
}

/** Kernel-owned public write contract for one state leaf. */
export interface Location<T> extends ReadonlyLocation<T> {
  /** Replace the complete value. Callable values require {@link leaf}. */
  (value: NonCallableValue<T>): void;
  /** Derive the next complete value from the current value. */
  (update: (current: T) => T): void;
  /** Replace callable or constructable state without invoking it. */
  (value: LeafDefinition<CallablePart<T>>): void;
  /** Read the current value. Kept last so generic inference resolves `T`. */
  (): T;
  asReadonly(): ReadonlyLocation<T>;
}
