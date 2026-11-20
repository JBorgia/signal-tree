// The contract between the runner and an implementation under test. A subject
// is anything that can replay the vocabulary in model.ts: the published
// kernels today, packages/core from Phase 1. Adding one means writing a
// Subject and registering it in subjects/registry.ts; the runner, generator
// and comparator do not change.
import type { ErrorInfo, Json, Observation, Op, OpKind, Outcome, TreeConfig } from './model.js';

export interface Subject {
  /** Short name used on the command line and in intended-differences.json, e.g. `v16`. */
  readonly name: string;
  /** What it is, e.g. `@signal-tree/kernel@16.0.0-rc.1`. */
  readonly description: string;
  /** Operation kinds this subject implements. Others are reported as `unsupported`. */
  readonly supports: ReadonlySet<OpKind>;
  /** Build a fresh tree with the initial state from model.ts and the given plugins. */
  open(config: TreeConfig): Session;
}

export interface Session {
  /**
   * Perform one operation and report its immediate outcome. Must not throw:
   * anything the implementation throws is an outcome. Return synchronously
   * whenever possible; the runner relies on that to keep same-tick steps in
   * one turn.
   */
  apply(op: Op): Outcome | Promise<Outcome>;
  /** Read everything observable right now. Must not throw and must not write. */
  observe(): Observation;
  /** Dispose links and the tree. */
  close(): void;
}

/** Handles a sequence has opened, addressed modulo their count (see model.ts). */
export class HandleTable<T> {
  readonly #items: T[] = [];

  add(item: T): number {
    this.#items.push(item);
    return this.#items.length - 1;
  }

  resolve(ref: number): { index: number; item: T } | undefined {
    if (this.#items.length === 0) return undefined;
    const index = ref % this.#items.length;
    return { index, item: this.#items[index] as T };
  }

  get size(): number {
    return this.#items.length;
  }

  all(): readonly T[] {
    return this.#items;
  }
}

/** Relabels opaque per-tree identities (entity subjects) as s1, s2, … in order of first appearance. */
export class FirstSeenLabels {
  readonly #labels = new Map<unknown, string>();

  label(raw: unknown): string {
    let label = this.#labels.get(raw);
    if (label === undefined) {
      label = `s${this.#labels.size + 1}`;
      this.#labels.set(raw, label);
    }
    return label;
  }
}

const ST_CODE = /\[?(ST\d{4})\]?/;

/** Normalizes anything thrown into ErrorInfo. */
export function describeError(thrown: unknown): ErrorInfo {
  if (!(thrown instanceof Error)) {
    return { class: 'non-error', message: safeString(thrown) };
  }
  const record = thrown as unknown as Record<string, unknown>;
  const info: {
    class: string;
    code?: string;
    st?: string;
    causeKind?: string;
    stage?: string;
    reason?: string;
    recovery?: { callbackFailed: boolean };
    message: string;
  } = { class: thrown.constructor?.name || 'Error', message: thrown.message };
  const st = ST_CODE.exec(thrown.message)?.[1];
  if (st) info.st = st;
  if (typeof record['code'] === 'string') info.code = record['code'];
  const cause = record['cause'];
  if (cause && typeof cause === 'object' && typeof (cause as Record<string, unknown>)['kind'] === 'string') {
    info.causeKind = (cause as Record<string, unknown>)['kind'] as string;
  }
  if (typeof record['stage'] === 'string') info.stage = record['stage'];
  if (typeof record['reason'] === 'string') info.reason = record['reason'];
  const recovery = record['recovery'];
  if (recovery && typeof recovery === 'object') {
    info.recovery = { callbackFailed: Boolean((recovery as Record<string, unknown>)['callbackFailed']) };
  }
  return info;
}

export function stCodeOf(text: string): string | undefined {
  return ST_CODE.exec(text)?.[1];
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/** Deep-copies a value into JSON-safe form so later mutation cannot alter a recorded outcome. */
export function toJson(value: unknown): Json {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v))) as Json;
}

/** Runs `fn`, turning a throw into an error outcome. */
export function attempt(fn: () => Json | undefined): Outcome {
  try {
    const value = fn();
    return value === undefined ? { status: 'ok' } : { status: 'ok', value };
  } catch (thrown) {
    return { status: 'error', error: describeError(thrown) };
  }
}
