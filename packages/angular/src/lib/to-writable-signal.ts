import {
  effect,
  Injector,
  isSignal,
  runInInjectionContext,
  signal,
  type WritableSignal,
} from '@angular/core';
import type { Location, NodeAccessor } from '@signal-tree/kernel';
// Restoration designation comes through the adapter SDK, not a deep import.
// See the ruling note at the bottom of `@signal-tree/kernel/adapter`.
import {
  isNodeAccessor,
  replaceLocation,
  withRestorationDesignation,
} from '@signal-tree/kernel/adapter';

/**
 * Converts a writable SignalTree branch into a WritableSignal, or returns an
 * Angular-native leaf unchanged, for use with any API that expects a
 * `WritableSignal` — e.g. as an Angular
 * Signal Forms model, or the value fed to `SignalFormControl`. (Note: Angular
 * has no `FormControl.connect(signal)` API — see `signalForm()` for the
 * signal-native forms bridge.)
 *
 * Branch adaptation creates a two-way binding between the NodeAccessor and a
 * WritableSignal:
 * - Reads all leaf values from the NodeAccessor and exposes them as a signal
 * - Writes to the WritableSignal update the underlying NodeAccessor
 *
 * **Important**: Branch adaptation and `{ undoable: true }` wrappers use
 * `effect()` internally for synchronization, which requires an injection
 * context. Passing an ordinary native leaf without options returns it directly
 * and needs no injection context. This function can be called in:
 * - Component/directive/pipe class field initializers
 * - Component/directive/pipe constructors
 * - Functions called from within an injection context
 *
 * @template T - The type of the node value
 * @param node - The branch accessor or writable leaf to expose
 * @returns The native leaf or a WritableSignal synchronized with the branch
 *
 * @example
 * ```typescript
 * const tree = signalTree({
 *   user: { name: '', email: '' }
 * });
 *
 * // Convert a slice to a WritableSignal (e.g. a Signal Forms model)
 * const userSignal = toWritableSignal(tree.$.user);
 *
 * // A leaf is already native; this returns the same object.
 * const nameSignal = toWritableSignal(tree.$.user.name);
 * ```
 */
export function toWritableSignal<T>(
  node: NodeAccessor<T> | Location<T> | WritableSignal<T>,
  injector?: unknown,
  options?: {
    /**
     * Mark writes ENTERING through this adapter as designating their authored
     * causal turn undoable — the same designation {@link undoable} applies, for
     * the case where there is no callback to wrap.
     *
     * Earned by evidence: Angular Signal Forms' `FormField` directive performs
     * the model write from inside its own DOM listener, so an application never
     * gets a callback around a user's edit. The adapter is the only place it
     * still controls.
     *
     * This is INGRESS designation, not location scoping. Eligibility follows the
     * mutation entrance, so a write to the SAME branch through an ordinary tree
     * handle stays non-undoable — the property that distinguishes this from
     * marking a branch "historical", and it has its own control test.
     *
     * ```ts
     * const model = toWritableSignal(tree.$.editForm, injector, {
     *   undoable: true,
     * });
     * const f = form(model);   // user edits are now undoable operations
     * ```
     */
    undoable?: boolean;
  }
): WritableSignal<T> {
  if (isSignal(node) && !options?.undoable) {
    return node as WritableSignal<T>;
  }

  // Create a signal initialized with the current node value
  const sig = signal(node());

  // Capture original setter before overriding so tree->signal sync doesn't write back and loop
  const originalSet = sig.set.bind(sig);

  // Effect to sync tree (NodeAccessor) changes into the writable signal
  // We intentionally track dependencies inside node() so updates to any leaf propagate.
  const runner = () => {
    originalSet(node() as T);
  };
  if (injector) {
    runInInjectionContext(injector as Injector, () => effect(runner));
  } else {
    try {
      effect(runner);
    } catch {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.warn(
          '[SignalTree] toWritableSignal called without injection context; pass Injector for reactivity.'
        );
      }
    }
  }

  const applyWrite = (write: () => void): void => {
    if (options?.undoable) {
      // Synchronous by construction with the write itself, which is what the
      // designation contract requires. Measured: the directive's write happens
      // inside the DOM dispatch, so there is no scheduling gap to lose it in.
      withRestorationDesignation(write);
    } else {
      write();
    }
    originalSet(node());
  };

  sig.set = (value: T) => {
    applyWrite(() => {
      if (isSignal(node)) (node as WritableSignal<T>).set(value);
      else if (isNodeAccessor(node)) (node as NodeAccessor<T>)(value);
      else replaceLocation(node as Location<T>, value);
    });
  };

  // Forward the updater itself so the canonical location both reads current
  // truth and preserves derive intent; the mirror effect may not have flushed.
  sig.update = (updater: (current: T) => T) => {
    applyWrite(() => {
      if (isSignal(node)) (node as WritableSignal<T>).update(updater);
      else if (isNodeAccessor(node)) (node as NodeAccessor<T>)(updater);
      else (node as Location<T>)(updater);
    });
  };

  return sig;
}
