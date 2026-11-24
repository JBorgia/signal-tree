/**
 * Typed errors. Every error and refusal the library throws is a
 * SignalTreeError carrying an [ST####] code from ERROR_CODES. Once released, a
 * code keeps its meaning and its message.
 */

export const ERROR_CODES = {
  ST1001: { cause: 'invalid-initial-state', message: 'The initial state cannot be used to build a tree' },
  ST1002: { cause: 'prototype-key', message: 'A "__proto__" key cannot enter the tree' },
  ST1003: { cause: 'tree-destroyed', message: 'The tree has been destroyed' },
  ST1004: { cause: 'absent-location', message: 'The location does not exist' },
  ST1005: { cause: 'async-callback', message: 'A context-setting scope cannot run an async callback' },
  ST1006: { cause: 'not-a-function', message: 'Expected a function' },
  ST1010: { cause: 'duplicate-key', message: 'An entity with this key already exists' },
  ST1011: { cause: 'missing-key', message: 'No entity has this key' },
  ST1012: { cause: 'invalid-key', message: 'An entity key cannot be null or undefined' },
  ST1013: { cause: 'invalid-row', message: 'An entity row must be a plain object' },
  ST1014: { cause: 'change-id-unavailable', message: 'changeId is only available with the default selector (row => row.id)' },
  ST1020: { cause: 'missing-plugin', message: 'This operation needs a plugin that is not installed' },
  ST2034: { cause: 'observer-error', message: 'An observer threw while a change was being published' },
  ST2035: { cause: 'observer-errors-suppressed', message: 'Further observer errors were suppressed' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorCause = (typeof ERROR_CODES)[ErrorCode]['cause'];

export interface SignalTreeErrorDetails {
  /** The location involved, as path segments, when there is one. */
  readonly path?: readonly PropertyKey[];
  /** The entity key involved, when there is one. */
  readonly key?: unknown;
  /** Anything else that explains the error. */
  readonly detail?: string;
  /** The underlying error, for example the one an observer threw. */
  readonly error?: unknown;
}

function describePath(path: readonly PropertyKey[]): string {
  return path.map((segment) => (typeof segment === 'symbol' ? segment.toString() : JSON.stringify(segment))).join(' > ');
}

function formatMessage(code: ErrorCode, details: SignalTreeErrorDetails): string {
  let message = `[${code}] ${ERROR_CODES[code].message}`;
  if (details.path && details.path.length > 0) message += ` at ${describePath(details.path)}`;
  if ('key' in details) message += ` (key ${typeof details.key === 'string' ? JSON.stringify(details.key) : String(details.key)})`;
  if (details.detail) message += `: ${details.detail}`;
  return message;
}

export class SignalTreeError extends Error {
  readonly code: ErrorCode;
  /** What went wrong, as a stable machine-readable name. */
  readonly reason: ErrorCause;
  readonly path: readonly PropertyKey[] | undefined;
  readonly key: unknown;

  constructor(code: ErrorCode, details: SignalTreeErrorDetails = {}) {
    super(formatMessage(code, details), 'error' in details ? { cause: details.error } : undefined);
    this.name = 'SignalTreeError';
    this.code = code;
    this.reason = ERROR_CODES[code].cause;
    this.path = details.path;
    this.key = details.key;
  }
}

/** A write or operation the tree refused. Nothing changed. */
export class SignalTreeRefusal extends SignalTreeError {
  constructor(code: ErrorCode, details: SignalTreeErrorDetails = {}) {
    super(code, details);
    this.name = 'SignalTreeRefusal';
  }
}

/** An event on a tree's onTreeError channel. */
export interface TreeErrorEvent {
  readonly code: ErrorCode;
  readonly error: SignalTreeError;
  /** Stable for the tree's lifetime and distinct between live trees. */
  readonly treeId: string;
  /** The location involved, as path segments; empty for the whole tree. */
  readonly path: readonly PropertyKey[];
}
