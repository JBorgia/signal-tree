/**
 * The shape the adapter CONSUMES from the kernel.
 *
 * ⚠️ NOT YET IMPLEMENTED BY THE KERNEL. The S1 kernel work is a narrow
 * read-only surface over the committed turns the transactions enhancer already
 * retains in its private `confirmedTurns`. Declared structurally here, rather
 * than by importing kernel internals, so:
 *
 *   - the adapter is testable before that surface lands, and
 *   - Studio never depends on `causal-runtime` internals, which stay unexported.
 *
 * Deliberately READ-ONLY and pull-based. Subscription is not here because S1
 * does not need it, and adding streaming "because the UI will eventually want
 * it" would be speculative machinery in the one place that must stay cheap.
 */

/** One location's net consequence, as the kernel already records it. */
export interface KernelTurnEffect {
  readonly position: number;
  /** Required in the kernel as of the CausalEffect.path fix. */
  readonly path: string;
  readonly ownerPath: string;
  readonly kind: 'set' | 'add' | 'remove' | 'rekey';
  readonly before?: unknown;
  readonly after?: unknown;
  readonly subject?: unknown;
}

/** One committed transaction, as retained by the transactions enhancer. */
export interface KernelConfirmedTurn {
  readonly id: number;
  readonly effects: readonly KernelTurnEffect[];
  readonly positions: readonly number[];
}

/**
 * What the kernel can and cannot say about completeness.
 *
 *     BOUNDED RETENTION IS NOT CAUSAL COMPLETENESS.
 *
 * ⚠️ Studio must never render retained turns as "everything that happened".
 * This envelope exists so truncation is a FACT the reader states, not something
 * a consumer has to infer from a suspiciously round history length.
 */
export interface KernelRetention {
  readonly truncated: boolean;
  readonly firstAvailableTurnId?: number;
}

export interface KernelConfirmedTurnSnapshot {
  readonly turns: readonly KernelConfirmedTurn[];
  readonly retention: KernelRetention;
}

/**
 * A read-only window onto one tree's retained committed turns.
 *
 *     BOUNDED TO EXISTING RETAINED HISTORY. NOT A SECOND HISTORY.
 *
 * The reader must not retain its own copy, must not mutate transaction state,
 * and must cost nothing beyond what `confirmedTurns` already costs when no
 * Studio consumer is attached.
 */
export interface ConfirmedTurnReader {
  /**
   * Opaque runtime tree identity. Compared for equality and used as a `Map`
   * key — never serialized. See `assignStudioTreeId`.
   */
  readonly treeId: unknown;
  readConfirmedTurns(): KernelConfirmedTurnSnapshot;
}
