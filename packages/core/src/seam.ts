/**
 * The write seam's public types (BRIEF.md 4.3) and the error channel.
 */
import type { ErrorCode, TreeErrorEvent } from './errors.ts';
import { SignalTreeError } from './errors.ts';

export type PathSegment = string | number | symbol;
/** A location: the path from the root to a leaf or branch. */
export type Location = readonly PathSegment[];

export type Origin = 'user' | 'agent' | 'sync' | 'server' | (string & {});

export interface TurnHandle {
  /** Distinct for every turn of a tree. */
  readonly id: number;
}

export interface WriterContext {
  /** For example 'user', 'agent:planner', 'sync:orders'. */
  readonly writer: string;
  readonly origin: Origin;
  readonly turn?: TurnHandle;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export type WriteKind = 'set' | 'update' | 'insert' | 'remove' | 'changeId';

export interface WriteOp<T = unknown> {
  readonly location: Location;
  readonly kind: WriteKind;
  readonly next: T;
  readonly context: WriterContext;
}

export interface WriteEffect {
  readonly location: Location;
  readonly before: unknown;
  readonly after: unknown;
  readonly changed: boolean;
  /** Who made the write, and in which turn (W1). */
  readonly context: WriterContext;
}

export interface Interceptor {
  readonly name: string;
  /** May observe, refuse (throw a typed SignalTreeRefusal), or transform. Calls next() at most once. */
  intercept(op: WriteOp, next: (op: WriteOp) => WriteEffect): WriteEffect;
}

export interface TurnInfo {
  readonly turn: TurnHandle;
  /** The writer context the turn was opened under. */
  readonly context: WriterContext;
}

export type ObserveListener = (effects: readonly WriteEffect[], turn: TurnInfo) => void;

export interface ScopeHandle {
  readonly path: readonly PathSegment[];
  intercept(interceptor: Interceptor): () => void;
  observe(listener: ObserveListener): () => void;
  /** The scope's current state, for late attachment. */
  snapshot(): unknown;
  onDispose(fn: () => void): void;
}

export interface Attachment<Api> {
  readonly api: Api;
  detach(): void;
}

export interface Plugin<Api> {
  readonly name: string;
  attach(scope: ScopeHandle): Attachment<Api>;
}

export const USER_CONTEXT: WriterContext = Object.freeze({ writer: 'user', origin: 'user' });

/** Checks and freezes a writer context supplied by a caller. */
export function writerContext(input: unknown): WriterContext {
  const candidate = input as Partial<WriterContext> | null;
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof candidate.writer !== 'string' ||
    candidate.writer === '' ||
    typeof candidate.origin !== 'string' ||
    candidate.origin === ''
  ) {
    throw new SignalTreeError('ST1007');
  }
  const context: { writer: string; origin: Origin; meta?: Readonly<Record<string, unknown>> } = { writer: candidate.writer, origin: candidate.origin };
  if (candidate.meta !== undefined) context.meta = Object.freeze({ ...candidate.meta });
  return Object.freeze(context);
}

/** True for functions declared async, which a context-setting scope cannot run (W5, W6). */
export function isAsyncFunction(fn: unknown): boolean {
  return typeof fn === 'function' && fn.constructor?.name === 'AsyncFunction';
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

// ------------------------------------------------------------ error channel

export const OBSERVER_ERROR_LIMIT = 50;
const WINDOW_MS = 1000;

let treeSerial = 0;

/** A tree's onTreeError channel: observer errors at most 50 per second, then one report of how many were suppressed (T10). */
export class ErrorChannel {
  /** Stable for the tree's lifetime and distinct between live trees (X6). */
  readonly treeId = `tree-${++treeSerial}`;
  private windowStart = 0;
  private inWindow = 0;
  private suppressed = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly sink: (event: TreeErrorEvent) => void;

  constructor(sink: ((event: TreeErrorEvent) => void) | undefined) {
    this.sink =
      sink ??
      ((event) => {
        console.error(event.error);
      });
  }

  /** Reports an error an observer, subscriber, link or plugin threw. Never throws. */
  observerError(error: unknown, path: readonly PropertyKey[], code: ErrorCode = 'ST2034'): void {
    const now = Date.now();
    if (now - this.windowStart >= WINDOW_MS) {
      this.flushSuppressed();
      this.windowStart = now;
      this.inWindow = 0;
    }
    if (this.inWindow >= OBSERVER_ERROR_LIMIT) {
      this.suppressed++;
      if (this.timer === null) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flushSuppressed();
        }, WINDOW_MS - (now - this.windowStart));
        (this.timer as { unref?: () => void }).unref?.();
      }
      return;
    }
    this.inWindow++;
    this.emit(code, new SignalTreeError(code, { path, error }), path);
  }

  private flushSuppressed(): void {
    if (this.suppressed === 0) return;
    const count = this.suppressed;
    this.suppressed = 0;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit('ST2035', new SignalTreeError('ST2035', { detail: `${count} more in the last second` }), []);
  }

  private emit(code: ErrorCode, error: SignalTreeError, path: readonly PropertyKey[]): void {
    try {
      this.sink(Object.freeze({ code, error, treeId: this.treeId, path: Object.freeze([...path]) }));
    } catch {
      // An error handler that throws must not reach the writer (X3).
    }
  }

  dispose(): void {
    this.flushSuppressed();
  }
}
