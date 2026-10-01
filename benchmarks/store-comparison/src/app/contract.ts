import type { Routes } from '@angular/router';
import type { Signal } from '@angular/core';

/**
 * The contract every arm implements and the runner drives. Read METHODOLOGY.md first.
 *
 * Arms own ONLY their store code. The grid, editor, data generation, timing and correctness
 * digest are shared and identical across arms, so a difference in a result comes from the store
 * (and the reactive work the store's idiomatic shape causes), never from the harness.
 */

export type Status =
  | 'scheduled'
  | 'loading'
  | 'enroute'
  | 'onsite'
  | 'returning'
  | 'complete';
export const STATUSES: readonly Status[] = [
  'scheduled',
  'loading',
  'enroute',
  'onsite',
  'returning',
  'complete',
];

/** A dispatch-grid row (a ticket/truck), shaped like an operational grid row. */
export interface Row {
  readonly id: string;
  readonly ticket: number;
  readonly truck: string;
  readonly driver: string;
  readonly status: Status;
  readonly plant: string;
  readonly product: string;
  readonly qty: number;
  readonly eta: number;
  readonly lat: number;
  readonly lng: number;
  readonly notes: string;
}
export type RowPatch = Partial<Omit<Row, 'id'>>;
export interface RowUpdate {
  readonly id: string;
  readonly patch: RowPatch;
}

/**
 * The grid's store. Created once per grid route instance inside that component's injection
 * context; `destroy()` is called when the route is left.
 *
 * Implement each member the way the library's own documentation recommends for a keyed
 * collection. Wrapping a library signal in `computed` to satisfy `Signal<T>` is allowed.
 */
export interface GridStore {
  /** Ids in server order. Changes on setAll/remove/move, not on a field patch. */
  readonly ids: Signal<readonly string[]>;
  /**
   * One row. The grid calls this once per VISIBLE row and keeps the returned signal while the
   * row is visible; it is read on every render of that row.
   */
  row(id: string): Signal<Row | undefined>;
  /** Count per status over ALL rows (the footer chips). Must always be correct. */
  readonly statusCounts: Signal<Readonly<Record<Status, number>>>;
  /** Replace the whole collection in `rows` order (initial load and refetch). */
  setAll(rows: readonly Row[]): void;
  /** Patch one existing row. */
  update(id: string, patch: RowPatch): void;
  /**
   * Apply many row patches as one batch: a live-feed message carrying updates for many rows.
   * Use the library's documented batch or multi-entity form, as an expert would for a batch;
   * a loop over `update` is right only when the library offers nothing better.
   */
  updateMany(patches: readonly RowUpdate[]): void;
  /** Remove one row. */
  remove(id: string): void;
  /** Move an existing row to `index` in server order (0-based, clamped). */
  move(id: string, index: number): void;
  /** All rows in server order, for the correctness digest only (never timed). */
  snapshot(): readonly Row[];
  /** Release everything the store holds. */
  destroy(): void;
}

/** One editable line of an order in the editor. */
export interface Line {
  readonly id: string;
  readonly product: string;
  readonly qty: number;
  readonly price: number;
}
export type LinePatch = Partial<Omit<Line, 'id'>>;
/** Scalar editor fields, bound to inputs. */
export interface EditorFields {
  readonly truck: string;
  readonly driver: string;
  readonly status: Status;
  readonly plant: string;
  readonly product: string;
  readonly qty: number;
  readonly eta: number;
  readonly notes: string;
}
export type EditorField = keyof EditorFields;
export const EDITOR_FIELDS: readonly EditorField[] = [
  'truck',
  'driver',
  'status',
  'plant',
  'product',
  'qty',
  'eta',
  'notes',
];
export interface EditorSeed {
  readonly rowId: string;
  readonly fields: EditorFields;
  readonly lines: readonly Line[];
}
export interface EditorResult {
  readonly rowId: string;
  readonly fields: EditorFields;
  readonly lines: readonly Line[];
}

/**
 * A stacked editor's own store: created when the editor opens, inside the editor component's
 * injection context; `destroy()` is called when the editor closes. Everything it holds must be
 * releasable, because the runner measures heap retained across many open/close cycles.
 */
export interface EditorStore {
  field<K extends EditorField>(key: K): Signal<EditorFields[K]>;
  set<K extends EditorField>(key: K, value: EditorFields[K]): void;
  /** Line ids in order. */
  readonly lineIds: Signal<readonly string[]>;
  line(id: string): Signal<Line | undefined>;
  updateLine(id: string, patch: LinePatch): void;
  /** Sum of qty * price over all lines. */
  readonly total: Signal<number>;
  /** True once any field or line differs from the seed. */
  readonly dirty: Signal<boolean>;
  /** Current values, for save and the digest (never timed). */
  result(): EditorResult;
  destroy(): void;
}

export type ArmId =
  | 'signals'
  | 'ngrx'
  | 'st14'
  | 'st15-released'
  | 'st15-candidate'
  | 'st15-undo';
export interface ArmLibrary {
  /** npm package name, e.g. `@ngrx/signals` (for an alias, the real package name). */
  readonly name: string;
  /**
   * The specifier this arm imports, e.g. `st15-released`. The runner reads the installed version
   * from `node_modules/<specifier>/package.json`, so an arm never reports its own version.
   */
  readonly specifier: string;
}
export interface Arm {
  readonly id: ArmId;
  readonly label: string;
  /** `undefined` for the hand-written signals baseline. */
  readonly library?: ArmLibrary;
  /** Called in the grid route component's injection context. */
  createGrid(): GridStore;
  /** Called in an editor component's injection context. */
  createEditor(seed: EditorSeed): EditorStore;
}
/** What each `arms/<id>/arm.ts` exports: `export const ROUTES = armRoutes(ARM)` (shared/arm-routes). */
export type ArmRoutes = Routes;

// ---------------------------------------------------------------------------------------------
// The in-page driver the runner calls through `window.__bench` (shared/driver.ts implements it).
// Every timing is milliseconds from immediately before the first store write to the moment the
// application is stable again with the DOM updated (ApplicationRef.whenStable), measured with
// performance.now(). Setup (data generation, seeds, plans) always happens BEFORE the clock starts.
// ---------------------------------------------------------------------------------------------

export interface BenchArmInfo {
  readonly id: ArmId;
  readonly label: string;
  readonly library?: ArmLibrary;
}
/** Counts of view refreshes since the last `resetCounters()`. */
export interface RenderCounters {
  /** Row component template evaluations. */
  readonly rows: number;
  /** Footer (status chips) template evaluations. */
  readonly footer: number;
  /** Editor component template evaluations (all open editors). */
  readonly editors: number;
}
export interface Timed {
  readonly ms: number;
  readonly counters: RenderCounters;
}
export interface Samples {
  /** One duration per awaited operation, in order. */
  readonly ms: readonly number[];
  /** Counters summed over all operations. */
  readonly counters: RenderCounters;
}
/** Which fields an edit plan writes. */
export type EditKind =
  /** eta/lat/lng of a VISIBLE row: a live position update; status counts must not change. */
  | 'position-visible'
  /** eta/lat/lng of a row OUTSIDE the visible window: pure store + fan-out cost. */
  | 'position-offscreen'
  /** status of a visible row: the footer counts change. */
  | 'status-visible';

export interface BenchApi {
  readonly arm: BenchArmInfo;
  /** Resolves when the grid route is rendered and the store exists (no rows yet). */
  ready(): Promise<void>;
  /**
   * setAll with `count` rows generated deterministically from `seed`. `revision` 0 is the initial
   * load; revision r > 0 returns the same ids in the same order with a deterministic ~5% of rows
   * changed (a refetch). Timed from setAll to stable.
   */
  load(count: number, seed: number, revision: number): Promise<Timed>;
  /** `count` single-row updates, each awaited to stable, every write a value never written before. */
  edits(kind: EditKind, count: number, seed: number): Promise<Samples>;
  /** `count` updates to distinct rows applied as ONE `updateMany` batch (a live-feed message), then one wait. */
  burst(count: number, seed: number): Promise<Timed>;
  /** `count` moves then `count` removes, each awaited to stable. */
  reorderAndRemove(
    count: number,
    seed: number
  ): Promise<{ readonly move: Samples; readonly remove: Samples }>;
  /**
   * `cycles` times: open `stack` editors one above another (each seeded from a distinct row, each
   * awaited to stable and timed), edit 5 fields and 3 lines in each (each write timed to stable),
   * save the top editor back into the grid store (untimed), then close all (timed, awaited).
   */
  editorCycles(
    cycles: number,
    stack: number,
    seed: number
  ): Promise<{
    readonly open: Samples;
    readonly edit: Samples;
    readonly close: Samples;
  }>;
  /** SHA-256 hex of the canonical JSON of grid.snapshot(), grid.statusCounts() and every saved EditorResult so far. */
  digest(): Promise<string>;
  resetCounters(): void;
  /** Navigate to the empty route (destroys the grid store and editors) and await stable. */
  teardown(): Promise<void>;
}

declare global {
  interface Window {
    __bench?: BenchApi;
  }
}
