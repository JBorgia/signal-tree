import { isProxy, isRef, type Ref } from 'vue';
import { isConstructionBranch } from '@signal-tree/kernel/adapter';
import type { SignalTreeFactoryOf } from '@signal-tree/kernel/adapter';

export type FrameworkSignalTreeFactory = SignalTreeFactoryOf<
  'vue',
  Ref<unknown>
>;

/**
 * Read each branch property once, so accessor-backed definitions cannot change
 * between validation and construction. Terminal data retains its identity.
 * No reactive primitive is read, subscribed to, or adopted here.
 */
export function prepareConstructionInput(initialState: object): object {
  const branches = new WeakMap<object, object>();
  const visit = (value: unknown, path: string): unknown => {
    if (isRef(value) || isProxy(value)) {
      throw new TypeError(
        `SignalTree: Vue ref or proxy at ${path}. Pass plain initial values (copy ref.value into an independent snapshot). Use leaf(existing) only to store the reactive object as data; its writes remain external to the tree.`
      );
    }
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
