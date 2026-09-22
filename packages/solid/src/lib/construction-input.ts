import type { Accessor } from 'solid-js';
import { isConstructionBranch } from '@signal-tree/kernel/adapter';
import type { SignalTreeFactoryOf } from '@signal-tree/kernel/adapter';

export type FrameworkSignalTreeFactory = SignalTreeFactoryOf<
  'solid',
  Accessor<unknown>
>;

/**
 * Read each branch property once, so accessor-backed definitions cannot change
 * between validation and construction. Terminal data retains its identity.
 * No reactive primitive is read, subscribed to, or adopted here.
 */
export function prepareConstructionInput(initialState: object): object {
  const branches = new WeakMap<object, object>();
  const visit = (value: unknown, path: string): unknown => {
    // NO STORE-PROXY GUARD YET. Vue rejects a `ref`/`reactive` passed as
    // initial state; the Solid equivalent would reject a store proxy, detected
    // by `unwrap(value) !== value`.
    //
    // It is deliberately absent rather than present-but-unproven. Under test,
    // `unwrap` here and `createStore` in a consumer resolve to DIFFERENT
    // solid-js instances, so the check silently fails to fire and its test
    // passes vacuously. Shipping a guard that cannot be demonstrated to work is
    // worse than shipping none: it reads as protection that is not there.
    //
    // Deferred, with the detection strategy recorded above so it can be
    // finished once single-instance resolution is solved for this package.
    if (!isConstructionBranch(value)) return value;
    const previous = branches.get(value);
    if (previous) return previous;
    const prepared: Record<string, unknown> = Object.create(null);
    branches.set(value, prepared);
    // Symbols are not topology, but the kernel diagnoses unregistered markers
    // from them. Preserve descriptors without evaluating symbol getters.
    for (const key of Object.getOwnPropertySymbols(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor) Object.defineProperty(prepared, key, descriptor);
    }
    for (const [key, child] of Object.entries(value)) {
      // The kernel drops this key with its own prototype-pollution diagnostic.
      prepared[key] =
        key === '__proto__'
          ? child
          : visit(child, `${path}[${JSON.stringify(key)}]`);
    }
    return prepared;
  };
  return visit(initialState, '$') as object;
}
