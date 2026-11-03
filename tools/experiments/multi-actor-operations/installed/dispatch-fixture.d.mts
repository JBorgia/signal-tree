import type { Immutable, Receipt } from './coordinator.mjs';
export type DispatchValues = { route: string; note: string; window: string; capacity: number };
export type DispatchProposal = {
  readonly entityId: 'delivery-1';
  readonly patch: Partial<DispatchValues>;
  readonly expected: Partial<Record<keyof DispatchValues, number>>;
};
export class DispatchBackend {
  commits: number;
  snapshot(): Immutable<{ values: DispatchValues; versions: Record<keyof DispatchValues, number> }>;
  failNextPersistence(): void;
  setAllowed(allowed: boolean): void;
  proposal(patch: Partial<DispatchValues>, reads?: readonly (keyof DispatchValues)[], observation?: Immutable<{ values: DispatchValues; versions: Record<keyof DispatchValues, number> }>): Immutable<DispatchProposal>;
  apply(command: unknown): Receipt;
}
