/** Research fixture vocabulary only; not a production API or ownership model. */
export type EntityKey = string | number;
export type EntityFields = { name: string; score: number };
export type EntityRef = { readonly kind: 'held-entity' };
export type EntityEntry = { key: EntityKey; value: EntityFields };
export interface EntityDomain {
  add(key: EntityKey, value: EntityFields): EntityRef;
  lookup(key: EntityKey): EntityRef | undefined;
  remove(ref: EntityRef): void;
  rekey(ref: EntityRef, key: EntityKey): void;
  field(
    ref: EntityRef,
    change: { field: 'name'; value: string } | { field: 'score'; value: number }
  ): void;
  heldRead(ref: EntityRef): EntityFields | undefined;
  entries(): EntityEntry[];
  /** Real outbound relationship, not a synchronous observer imitation. */
  linkName(
    ref: EntityRef,
    receive: (name: string | undefined) => void
  ): { settled(): Promise<void>; dispose(): void };
}
