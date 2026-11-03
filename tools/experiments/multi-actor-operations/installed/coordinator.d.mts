/** Experiment-only declarations for the adjacent, hashed coordinator fixture. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type Immutable<T> = T extends readonly (infer E)[] ? readonly Immutable<E>[] : T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;
export function immutable<T extends JsonValue>(value: T): Immutable<T>;
export type Actor = { readonly kind: 'unknown' } | { readonly kind: 'declared'; readonly label: string };
export type Review<P extends JsonValue> = { readonly operationId: string; readonly revision: number; readonly actor: Actor; readonly proposal: Immutable<P> };
export type Command<P extends JsonValue> = Review<P> & { readonly commandId: string };
export type DeliveryContext = { readonly operationId: string; readonly revision: number; readonly attemptId: string };
export type Receipt = { readonly commandId: string; readonly status: 'applied' | 'rejected'; readonly reason?: JsonValue };
export interface Adapter<P extends JsonValue> {
  apply(command: Command<P>, context: DeliveryContext): unknown | Promise<unknown>;
}
export type OperationState<P extends JsonValue> = {
  readonly id: string;
  readonly revision: number;
  readonly proposal: Immutable<P>;
  readonly actor: Actor;
  readonly attempts: number;
  readonly status: 'draft' | 'reviewed' | 'approved' | 'rejected' | 'delivering' | 'uncertain' | 'succeeded' | 'failed';
  readonly receipt?: Receipt;
  readonly deliveryError?: string;
};
export class OperationCoordinator<P extends JsonValue = JsonValue> {
  constructor(adapter: Adapter<P>);
  create(id: string, proposal: P, actor?: Actor): OperationState<P>;
  inspect(id: string): OperationState<P>;
  revise(id: string, proposal: P): OperationState<P>;
  review(id: string): Review<P>;
  approve(binding: Review<P>): OperationState<P>;
  reject(id: string): OperationState<P>;
  deliver(id: string): Promise<OperationState<P>>;
  forget(id: string): void;
  dispose(): void;
}
