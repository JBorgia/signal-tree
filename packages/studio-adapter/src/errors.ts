import { type StudioCapability } from './capabilities';

/**
 * Structured refusals. Codes, never strings to parse.
 *
 * ⚠️ `STUDIO_TREE_NOT_FOUND` and `STUDIO_TREE_DESTROYED` are DIFFERENT FACTS
 * and must not be collapsed:
 *
 *     never existed / attachment removed   -> NOT_FOUND
 *     destruction seen while attached      -> DESTROYED
 *
 * Because destroy eviction is automatic, DESTROYED will rarely surface here —
 * most races resolve as NOT_FOUND. The distinction is kept because the lower
 * reader contract proves it, not because a bridge scenario was built to
 * exercise it.
 */
export type StudioBridgeError =
  | { readonly code: 'STUDIO_TREE_NOT_FOUND' }
  | { readonly code: 'STUDIO_INVALID_LIMIT' }
  | { readonly code: 'STUDIO_TREE_DESTROYED' }
  | {
      readonly code: 'STUDIO_CAPABILITY_UNAVAILABLE';
      readonly capability: StudioCapability;
    }
  | {
      readonly code: 'STUDIO_PROTOCOL_MISMATCH';
      readonly expected: number;
      readonly received: number;
    };

export type StudioResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StudioBridgeError };

/** Thrown only by `attachStudio(..., { require })` — never by a plain attach. */
export class StudioRequirementError extends Error {
  readonly code = 'STUDIO_REQUIREMENT_UNMET';
  constructor(readonly missing: readonly StudioCapability[]) {
    super(
      `STUDIO_REQUIREMENT_UNMET: this tree cannot provide [${missing.join(', ')}]. ` +
        'attachStudio only throws when the caller declared `require`; without it ' +
        'attachment succeeds and the capability is reported as unavailable.'
    );
    this.name = 'StudioRequirementError';
  }
}
