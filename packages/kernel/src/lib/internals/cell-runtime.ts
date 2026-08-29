/**
 * The kernel's ordinary-leaf carrier, as a contract rather than a framework.
 *
 * S1. The kernel needs somewhere to keep a leaf's value that a consumer can read
 * reactively and the kernel can write. Angular has been supplying that directly
 * via `signal()`. This makes the REQUIREMENT explicit so the realization can
 * come from whoever owns the framework binding.
 *
 * ⚠️ DERIVED FROM THE KERNEL'S OPERATIONS, NOT FROM ANGULAR'S API. The entire
 * surface the kernel uses on a leaf is: call to read, `.set`, `.update`,
 * `.asReadonly` (one site, `destroyed`), and an equality option at creation.
 * There is no `computed`, no `effect`, no scheduler here, and there must not be:
 *
 *     DON'T PORT FRAMEWORK PRIMITIVES. PORT THE SIGNALTREE SEMANTICS THAT
 *     CAUSED THEM TO BE USED.
 *
 * ⚠️ ANGULAR'S `WritableSignal` SATISFIES THIS STRUCTURALLY, WITH NO WRAPPER —
 * proven by compilation, with a negative control. That is what lets the Angular
 * vertical keep native performance: one cell per leaf, in Angular's own
 * dependency graph, no adapter object and no second reactive graph.
 *
 *     FRAMEWORK NEUTRALITY MAY ADD AN ADAPTER BOUNDARY. IT MUST NOT ADD A
 *     SECOND REACTIVE GRAPH TO A VERTICAL THAT CAN USE ITS NATIVE GRAPH
 *     DIRECTLY.
 */
export interface ReadableCell<T> {
  (): T;
}

export interface WritableCell<T> extends ReadableCell<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
  asReadonly(): ReadableCell<T>;
}

export interface CellRuntime {
  /** Allocate a leaf carrier. `equal` suppresses no-op writes. */
  createCell<T>(initial: T, equal?: (a: T, b: T) => boolean): WritableCell<T>;
}

/**
 * The kernel's own carrier, used when no realization is installed.
 *
 * ⚠️ THIS IS NOT A REACTIVE FRAMEWORK AND MUST NOT BECOME ONE. It holds a value,
 * reports it, replaces it, and honours an equality function. There is no
 * dependency tracking, no subscriber set, no scheduler, no glitch handling. A
 * consumer that wants reactivity installs a realization that provides it.
 *
 *     REMOVE FRAMEWORK OWNERSHIP FROM THE KERNEL, NOT REACTIVITY FROM THE
 *     PRODUCT.
 *
 * WHY IT HAS TO EXIST. Leaf allocation is the kernel's own canonical state. If
 * the kernel had no carrier of its own it would be unable to build a tree with
 * no adapter installed — which is precisely the configuration
 * `@signal-tree/kernel` must support, and precisely the contingency that made
 * 151 tests fail when line 941 asked an optional adapter about kernel state.
 *
 *     THE KERNEL MUST NOT ASK AN OPTIONAL ADAPTER WHETHER ITS OWN STATE EXISTS.
 *
 * Angular consumers never touch this: `@signal-tree/angular` installs a
 * realization whose `createCell` returns a native `WritableSignal`, so the
 * ordinary leaf stays one native cell in Angular's own graph.
 */
function createPlainCell<T>(initial: T, equal?: (a: T, b: T) => boolean): WritableCell<T> {
  let value = initial;
  const cell = (() => value) as WritableCell<T>;
  cell.set = (next: T) => {
    if (equal ? equal(value, next) : Object.is(value, next)) return;
    value = next;
  };
  cell.update = (fn: (current: T) => T) => cell.set(fn(value));
  cell.asReadonly = () => (() => value) as ReadableCell<T>;
  return cell;
}

/** The kernel's default carrier factory. Replaced by whatever a realization installs. */
const PLAIN_RUNTIME: CellRuntime = { createCell: createPlainCell };

let installed: CellRuntime | undefined;

/** Install the realization's carrier factory. Once per process, by the adapter. */
export function installCellRuntime(next: CellRuntime): void {
  // Registration happens HERE, at the one choke point every cell passes
  // through, so an adapter cannot forget it and cell identity never depends on
  // which runtime is installed.
  // REALIZATION CREATES AN OBJECT. SEMANTIC ADOPTION GIVES IT STATE-CELL
  // IDENTITY. This runtime also mints membership revisions, history counters
  // and diagnostic carriers — none of which are tree state cells — so identity
  // is granted by the authority that installs a cell AS A TREE LEAF, not here.
  installed = next;
}

/**
 * The installed carrier factory, or `undefined`.
 *
 * ⚠️ CALLERS MUST NOT DEGRADE TO "NO CELL". Leaf allocation is the kernel's own
 * canonical state, and `signal-tree.ts` line 941 already proved what happens
 * when the kernel asks an optional adapter about its own state: 151 tests failed
 * because every merge write silently did nothing.
 *
 *     THE KERNEL MUST NOT ASK AN OPTIONAL ADAPTER WHETHER ITS OWN STATE EXISTS.
 *
 * So this NEVER returns undefined: with no realization installed the kernel
 * falls back to its own plain carrier and a tree still builds, reads and writes.
 * What a plain carrier does not provide is reactivity — that is what installing
 * a realization buys.
 */
export function getCellRuntime(): CellRuntime {
  return installed ?? PLAIN_RUNTIME;
}
