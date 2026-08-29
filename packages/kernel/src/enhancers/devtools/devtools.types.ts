import { Assert, Equals } from '../test-helpers/types-equals';
import { devTools } from './devtools';

import type {
  DevToolsConfig,
  Enhancer,
} from '../../lib/types';

/**
 * `devTools()` returns the NEUTRAL enhancer contract.
 *
 * This asserted the realization-facing shape,
 * `(config?) => <T>(tree: ISignalTree<T>) => ISignalTree<T> & DevToolsMethods`.
 * That was implementation vocabulary; migrating to `Enhancer<TAdded>` changed
 * it, so the row went red and was updated deliberately rather than the
 * migration being bent around it.
 *
 * `devTools` fronts TWO implementations — a mutating production noop and an
 * identity-replacing dev enhancer, selected at module load — so one signature
 * has to fit both. Neither that, nor whether a call site still infers
 * `connectDevTools` without a cast, is visible from this row. See
 * `devtools-contract.typing.spec.ts` (proven green BEFORE the signature changed)
 * and the runtime accumulation-survival test in `devtools.spec.ts`.
 */
type ExpectedSignature = (config?: DevToolsConfig) => Enhancer<DevToolsMethods>;

type ActualSignature = typeof devTools;

type _ContractCheck = Assert<Equals<ActualSignature, ExpectedSignature>>;

export {};


// ─────────────────────────────────────────────────────────────────────────────
// MOVED HERE IN 15.0 — TYPE-BARREL-CONVERGENCE-0.
//
// These declarations lived in `lib/types.ts`, the KERNEL type barrel, even
// though this module owns them. That was co-location, not duplicate authority:
// `ISignalTree` never named a capability method bag, so the kernel type surface
// did not statically own optional machinery. The move corrects placement only —
// no rename, no semantic change, and the package root still re-exports every
// one of them from here.
//
//     A PUBLIC RE-EXPORT MAY SURVIVE A MOVE. A SECOND DECLARATION MAY NOT.
// ─────────────────────────────────────────────────────────────────────────────

/** One module's activity record, as reported by {@link DevToolsMethods.exportDebugSession}. */
export interface DevToolsModuleMetadata {
  name: string;
  methods: string[];
  addedAt: Date;
  lastActivity: Date;
  operationCount: number;
  averageExecutionTime: number;
  errorCount: number;
}

/** Aggregate counters, as reported by {@link DevToolsMethods.exportDebugSession}. */
export interface DevToolsPerformanceMetrics {
  totalUpdates: number;
  moduleUpdates: Record<string, number>;
  modulePerformance: Record<string, number>;
  signalGrowth: Record<string, number>;
  memoryDelta: Record<string, number>;
  moduleCacheStats: Record<string, { hits: number; misses: number }>;
}

/** One logged event, as reported by {@link DevToolsMethods.exportDebugSession}. */
export interface DevToolsLogEntry {
  timestamp: Date;
  module: string;
  type: 'composition' | 'method' | 'state' | 'performance';
  data: unknown;
}

/** What {@link DevToolsMethods.exportDebugSession} returns. */
export interface DevToolsDebugSession {
  metrics: DevToolsPerformanceMetrics;
  modules: DevToolsModuleMetadata[];
  logs: DevToolsLogEntry[];
}

export interface DevToolsMethods {
  connectDevTools(name?: string): void;
  disconnectDevTools(): void;
  /**
   * Snapshot the current debug session — metrics, per-module activity, logs.
   *
   * DECLARED IN 15.0, PRESENT SINCE LONG BEFORE. `devTools()` has always
   * attached this at runtime and `devtools.spec.ts` has always asserted it, but
   * it was missing from this interface, so reaching it required a cast — and the
   * demo carried exactly that cast, with a hand-written `compositionHistory`
   * field the runtime does not return. Same runtime-present / type-missing drift
   * already recorded for `destroyed`, `registerCleanup` and `updateAndReport`.
   *
   * It surfaced because removing `.with()` removed the cast that was hiding it.
   */
  exportDebugSession(): DevToolsDebugSession;
}
