import type { ReadableCell } from './cell-runtime';

import {
  NEUTRAL_MATERIALIZATION_REALIZATION,
  type MaterializationRealization,
} from './materialization-realization';
import type { TreeRealization } from './tree-realization';

import { stampDerived } from '../utils';

/**
 * Merge Derived State into SignalTree
 *
 * This module implements the **deep merge** semantics for derived state definitions.
 * When derived state is added to a SignalTree, it is merged INTO the existing tree
 * structure rather than replacing it. This preserves source properties while adding
 * new derived computed signals.
 *
 * ## Deep Merge Behavior
 *
 * When you define a derived namespace at the same path as a source namespace:
 * - All source properties are **preserved** (signals, entityMaps, nested objects)
 * - Only conflicting keys trigger overwrites (with dev warning)
 *
 * ## Example
 *
 * ```typescript
 * const tree = signalTree({
 *   tickets: {
 *     entities: entityMap<Ticket, number>(),
 *     activeId: null,
 *   }
 * }, {
 *   derived: ($) => ({
 *     tickets: {
 *       // This EXTENDS tickets, doesn't replace it
 *       active: computed(() => $.tickets.entities.byId($.tickets.activeId())?.())
 *     }
 *   })
 * });
 *
 * // After merge, $.tickets contains:
 * // - entities (preserved from source)
 * // - activeId (preserved from source)
 * // - active (added from derived)
 * ```
 *
 * This enables patterns like adding computed selectors to namespaces that contain
 * entityMaps without losing access to entity methods like `upsertOne()`, `all()`, etc.
 */
// =============================================================================
// TYPES
// =============================================================================

/** Record with string keys and unknown values */
type AnyRecord = Record<string, unknown>;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Is this value a reactive node of the INSTALLED realization?
 *
 * ⚠️ THIS USED TO CALL ANGULAR'S `isSignal` DIRECTLY, and the substitution is
 * not merely a rename — it changes what happens when no realization is
 * installed. The old call always answered; this one answers `false`, because
 * with no realization there are, by definition, no reactive nodes.
 *
 * For `materialize-markers` that same degradation is documented as "the
 * conservative direction: the walk treats the node as ordinary data". HERE the
 * identical degradation is the OPPOSITE of conservative — a caller-supplied
 * `computed()` treated as ordinary data is silently DROPPED, which this file
 * calls "historically the single most expensive failure mode".
 *
 *     THE SAME DEGRADATION IS NOT EQUALLY SAFE FOR EVERY CONSUMER OF A
 *     CONTRACT. SAFE-FAILURE DIRECTION IS PART OF THE SEMANTICS.
 *
 * Measured: with the realization uninstalled, this substitution turns 4 failing
 * carriers into 8 — `derived-after-tree-call` and `derived-not-state` join the
 * two documented degradations. The scenario is incoherent in practice (a caller
 * passing Angular `computed()` into a tree with no Angular realization), but it
 * is a real coupling of correctness to installation and is recorded rather than
 * discovered later.
 */
declare const ngDevMode: boolean | undefined;

function isSignalLike(
  value: unknown,
  realization: MaterializationRealization =
    NEUTRAL_MATERIALIZATION_REALIZATION
): value is ReadableCell<unknown> {
  return realization.isReactiveNode(value);
}

// =============================================================================
// PATH UTILITIES
// =============================================================================

/**
 * Ensures a path exists in the tree and returns the target object.
 * Creates empty objects along the path if they don't exist.
 *
 * **Important for deep merge:** This function navigates to existing objects
 * rather than replacing them. If `$.tickets` already exists with properties,
 * calling `ensurePathAndGetTarget($, 'tickets')` returns that existing object,
 * allowing new properties to be added alongside existing ones.
 */
function ensurePathAndGetTarget($: AnyRecord, path: string): AnyRecord {
  if (!path) return $;

  const parts = path.split('.');
  let current: AnyRecord = $;

  for (const part of parts) {
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as AnyRecord;
  }

  return current;
}

// =============================================================================
// MAIN MERGE FUNCTION
// =============================================================================

/**
 * Merges derived state definitions into the processed source state.
 *
 * ## Processing Rules
 *
 * - **Nested objects** → recursive merge into existing structure (DEEP MERGE)
 * - **Collisions** → derived signals overwrite source signals with warning
 *
 * ## Deep Merge Semantics
 *
 * When a derived definition contains a nested object at a path that already
 * exists in the source tree, this function **recursively merges** into the
 * existing structure rather than replacing it. This is the key to preserving
 * source properties (like entityMap methods) when adding derived state.
 *
 * The merge happens because:
 * 1. `ensurePathAndGetTarget()` returns the EXISTING object at that path
 * 2. New derived properties are added to that existing object
 * 3. Source properties remain untouched unless explicitly overwritten
 *
 * @param $ - The processed source state tree
 * @param derivedDef - The derived state definition object
 * @param path - Current path for error messages (internal use)
 *
 * @example
 * ```typescript
 * // Source tree has: $.tickets.entities (EntitySignal), $.tickets.activeId (signal)
 * const $ = processSourceState({
 *   tickets: {
 *     entities: entityMap<Ticket>(),
 *     activeId: null
 *   }
 * });
 *
 * // Merge adds $.tickets.active while preserving $.tickets.entities
 * mergeDerivedState($, {
 *   tickets: {
 *     active: derived(() => $.tickets.entities.byId($.tickets.activeId())?.())
 *   }
 * });
 *
 * // Result: $.tickets now has entities, activeId, AND active
 * ```
 */
function mergeDerivedState(
  $: AnyRecord,
  derivedDef: unknown,
  path = '',
  realization?: TreeRealization
): void {
  if (!derivedDef || typeof derivedDef !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(derivedDef as AnyRecord)) {
    const currentPath = path ? `${path}.${key}` : key;

    // ⚠️ THE `DerivedMarker` BRANCH IS GONE, and it was unreachable, not merely
    // unused. `derived()` — the only thing that ever produced a DerivedMarker —
    // was removed in v6.3.1, so from that release onward nothing a caller could
    // write reached this branch. `.derived(($) => ({ … }))` is a DIFFERENT and
    // very much live feature: it takes a factory returning ordinary computeds,
    // which the `isSignalLike` branch below has always handled.
    //
    // Sharing the word "derived" is what kept this alive: the live feature's
    // name made the dead marker look load-bearing.
    if (isSignalLike(value, realization?.materialization)) {
      // Already a signal (computed, signal, etc.) - add directly
      const target = ensurePathAndGetTarget($, path);

      // Check for collision with existing signal
      if (
        key in target &&
        isSignalLike(target[key], realization?.materialization)
      ) {
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
          console.warn(
            `SignalTree: Derived signal "${currentPath}" overwrites source signal. ` +
              `Consider using a different key to avoid confusion.`
          );
        }
      }

      target[key] = stampDerived(value);
    } else if (typeof value === 'function' && realization) {
      const target = ensurePathAndGetTarget($, path);
      target[key] = stampDerived(
        realization.derived.createDerived(value as () => unknown)
      );
    } else if (typeof value === 'object' && value !== null) {
      // =========================================================================
      // DEEP MERGE: Nested derived object - merge into existing structure
      // =========================================================================
      // This is where the magic happens. Instead of replacing the existing
      // namespace, we navigate to it and recursively add derived properties.
      //
      // Example: If source has $.tickets.entities and derived defines
      // { tickets: { active: derived(...) } }, we DON'T replace $.tickets.
      // Instead, we get the existing $.tickets object and add 'active' to it.
      // =========================================================================
      const target = ensurePathAndGetTarget($, path);

      // Ensure nested object exists in target (create if new path)
      if (!(key in target)) {
        target[key] = {};
      } else if (
        isSignalLike(target[key], realization?.materialization)
      ) {
        // Target is a signal - can't merge object into it
        throw new Error(
          `SignalTree: Cannot merge derived object into "${currentPath}" ` +
            `because source is a signal. Either make source an object or use a different key.`
        );
      }
      // NOTE: If target[key] is an existing object (NodeAccessor, plain object),
      // we keep it and recursively merge INTO it - this preserves all source properties!

      // Recurse into nested object - this preserves existing properties
      // while adding new derived signals. The key insight is that target[key]
      // still references the ORIGINAL object from the source tree.
      mergeDerivedState($, value, currentPath, realization);
    } else if (typeof ngDevMode === 'undefined' || ngDevMode) {
      // Anything else is silently dropped — historically the single most
      // expensive failure mode in this file, because a dropped derived value
      // looks exactly like "the feature doesn't work" with no diagnostic.
      //
      console.warn(
        `[SignalTree] [ST2007] Derived "${currentPath}" dropped: the value ` +
          `could not be realized by this tree. Return a computation recipe, ` +
          `a value recognized by the package realization, or a nested object. See ST2007.`
      );
    }
  }
}

/** Applies the configured derived factory to the processed source tree. */
export function applyDerivedFactory(
  $: AnyRecord,
  factory: ($: AnyRecord) => object,
  realization?: TreeRealization
): void {
  mergeDerivedState($, factory($), '', realization);
}
