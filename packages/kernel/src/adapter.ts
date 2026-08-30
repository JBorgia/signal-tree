/**
 * `@signal-tree/kernel/adapter` — the FRAMEWORK-ADAPTER SDK.
 *
 * Advanced surface for authoring a realization package such as
 * `@signal-tree/angular`. It is NOT ordinary SignalTree user API and is NOT
 * re-exported from the kernel root.
 *
 * It was refused as speculative until a real consumer existed. That consumer
 * now does: `@signal-tree/angular` must install its realizations across an npm
 * boundary, and deep-importing kernel source is not a contract.
 *
 * WHAT THIS DELIBERATELY IS NOT. Every export below is a realization CONTRACT
 * or its installer. None of these appear, and adding one means the seam is
 * wrong rather than the SDK incomplete:
 *
 *     member-membership · PhysicalCommitClock · the physical scalar-slot
 *     runtime · production substrate stats · CellIdentity · subject machinery ·
 *     TreeNodeOf · restoration internals
 *
 * The discriminator:
 *
 *     COULD A `@signal-tree/fake-reactive` PACKAGE BE WRITTEN AGAINST ONLY
 *     THIS SURFACE, PLUS A TINY FAKE REACTIVE PRIMITIVE?
 *
 * If an adapter needs a kernel internal to answer a question, the question was
 * kernel semantics and belongs on the kernel side of the boundary.
 */

export type {
  ReadableCell,
  WritableCell,
  CellRuntime,
} from './lib/internals/cell-runtime';
import type { WritableCell } from './lib/internals/cell-runtime';
export { installCellRuntime } from './lib/internals/cell-runtime';

export type { DerivedRuntime } from './lib/internals/derived-runtime';
export { installDerivedRuntime } from './lib/internals/derived-runtime';

export type { MaterializationRealization } from './lib/internals/materialization-realization';
export { installMaterializationRealization } from './lib/internals/materialization-realization';

export type {
  ObservationToken,
  ScalarLeafRealization,
} from './lib/internals/scalar-leaf-realization';
export { installScalarLeafRealization } from './lib/internals/scalar-leaf-realization';

export { installTrackingSuppression } from './lib/internals/tracking-suppression';

/**
 * SEMANTIC INGRESS — the one export here that is not a realization contract.
 *
 * `toWritableSignal` (the Angular Signal Forms bridge) wraps its writes in this
 * so a user's form edit becomes a restoration-eligible causal turn. The kernel
 * CANNOT infer that: only the integration knows a write originated from a human
 * editing a control rather than from program logic.
 *
 * RULED: it stays here. It does not go on the kernel root, it is not
 * deep-imported, and the behaviour is not removed from `toWritableSignal`. That
 * revises this SDK's definition to: realization contracts PLUS the minimum
 * semantic facts only an integration can truthfully assert. It is the only
 * earned example today; adjacent history/restoration internals do NOT follow it
 * in. The final spelling is open until the pre-freeze surface pass.
 *
 * DO NOT mark this export with the internal-marker tag, or mention that tag as
 * a bare token in this docblock: the build runs `stripInternal`, which erases
 * the export from the emitted declarations and breaks the Angular package's
 * compile — measured, twice.
 */
export { withRestorationDesignation } from './lib/internals/restoration-eligibility';

// ---------------------------------------------------------------------------
// TYPE BINDING — how a framework registers its native carrier.
//
// TYPE-A-PACKAGE-BINDING-0, outcome TA-B. The kernel binds `'cell'` and cannot
// describe a framework's carrier: Angular's `WritableSignal` is distinguished by
// the private brands `[SIGNAL]` / `[ɵWRITABLE_SIGNAL]`, which is exactly why a
// neutral cell is NOT assignable to it. A structural restatement would be a lie.
//
// So the registry is DECLARED HERE, in the module an adapter names, and an
// adapter merges its own entry into it:
//
//     declare module '@signal-tree/kernel/adapter' {
//       interface LeafCarriers<T> { angular: AngularLeaf<T>; }
//     }
//
// It must be the canonical declaration `LeafOf`/`TreeNodeOf` consume — augmenting
// a barrel re-export would create a second, unused interface and silently leave
// the real registry unchanged.
//
//     THE FRAMEWORK-SPECIFIC TYPE TRUTH CROSSES THE PACKAGE BOUNDARY. THE
//     FRAMEWORK ITSELF DOES NOT CROSS BACK INTO THE KERNEL.
//
// `CarrierKind` is deliberately NOT exported: an adapter writes
// `TreeNodeOf<T, 'angular'>` and never needs to name the union.
export interface LeafCarriers<T> {
  // `WritableCell` IS the neutral leaf contract — it already declares `(): T`,
  // so no separate neutral-leaf type needs to cross the boundary. Keeping this
  // entry on an earned SDK type also removes an adapter <-> types import cycle.
  cell: WritableCell<T>;
}

export type {
  TreeNodeOf,
  LeafOf,
  ISignalTreeOf,
  SignalTreeFactoryOf,
  EntitySignalOf,
  EntityNodeOf,
} from './lib/types';
export type { EntitySignalWithSlicesOf } from './lib/markers/entity-map';
export type { ReadonlyStoreOf, ReadonlyViewOf } from './lib/readonly';
