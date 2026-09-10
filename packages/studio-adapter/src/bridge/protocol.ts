import { type StudioTreeId } from '@signal-tree/studio-query';

import { type StudioCapability } from '../capabilities';
import { type StudioBridgeError } from '../errors';
import { type ConfirmedTurnsResponse, type StudioBridgeTree } from '../registry';

/** Transport/envelope shape. */
export const STUDIO_PROTOCOL_VERSION = 1;
/** Record shapes carried inside the envelope. */
export const STUDIO_SCHEMA_VERSION = 1;

/**
 * The connect signal.
 *
 * ⚠️ NOT A SECRET, AND NOT AUTHENTICATION. Any script in the inspected page's
 * main realm can see this message and could answer or send one. See
 * S1-BRIDGE-SPEC §4: same-realm script is inside the application trust
 * boundary, and the boundary that actually holds is that production never
 * installs the bridge at all.
 */
export const STUDIO_CONNECT = 'SIGNALTREE_STUDIO_CONNECT';

export interface StudioHello {
  readonly protocol: typeof STUDIO_PROTOCOL_VERSION;
  readonly schema: typeof STUDIO_SCHEMA_VERSION;
}

export type StudioBridgeRequest =
  | { readonly protocol: number; readonly id: string; readonly command: 'hello' }
  | { readonly protocol: number; readonly id: string; readonly command: 'listTrees' }
  | {
      readonly protocol: number;
      readonly id: string;
      readonly command: 'readConfirmedTurns';
      readonly treeId: StudioTreeId;
    }
  /**
   * ⚠️ These two ALTER STUDIO INSTRUMENTATION ONLY — they start and stop a
   * recorder. They are not application-state mutation, and the protocol still
   * admits no `setValue`, `eval` or rollback command. Recording never begins
   * merely because DevTools opened; a person asks for it.
   */
  | {
      readonly protocol: number;
      readonly id: string;
      readonly command: 'startRealizationCapture';
      readonly treeId: StudioTreeId;
      readonly maxEffects?: number;
    }
  | {
      readonly protocol: number;
      readonly id: string;
      readonly command: 'stopRealizationCapture';
      readonly treeId: StudioTreeId;
    }
  | {
      readonly protocol: number;
      readonly id: string;
      readonly command: 'readRealizations';
      readonly treeId: StudioTreeId;
    }
  | {
      readonly protocol: number;
      readonly id: string;
      readonly command: 'readCurrentValue';
      readonly treeId: StudioTreeId;
      readonly path: string;
    }
  /**
   * Key structure only — no values. The state pane needs names; values are read
   * per-path on demand, so arbitrary application data never crosses the
   * transport to populate a sidebar.
   */
  | {
      readonly protocol: number;
      readonly id: string;
      readonly command: 'readStateShape';
      readonly treeId: StudioTreeId;
      readonly maxDepth?: number;
      readonly maxKeys?: number;
    };

export type StudioBridgeResponse<T = unknown> =
  | {
      readonly protocol: typeof STUDIO_PROTOCOL_VERSION;
      readonly id: string;
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly protocol: typeof STUDIO_PROTOCOL_VERSION;
      readonly id: string;
      readonly ok: false;
      readonly error: StudioBridgeError;
    };

export type { StudioBridgeError, StudioBridgeTree, ConfirmedTurnsResponse, StudioCapability };

/** Structural validation. Nothing is trusted because it arrived on the port. */
export function isStudioBridgeRequest(value: unknown): value is StudioBridgeRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['id'] !== 'string' || typeof candidate['protocol'] !== 'number') {
    return false;
  }
  switch (candidate['command']) {
    case 'hello':
    case 'listTrees':
      return true;
    case 'readConfirmedTurns':
    case 'startRealizationCapture':
    case 'stopRealizationCapture':
    case 'readRealizations':
    case 'readStateShape':
      return typeof candidate['treeId'] === 'string';
    case 'readCurrentValue':
      return typeof candidate['treeId'] === 'string' && typeof candidate['path'] === 'string';
    default:
      return false;
  }
}
