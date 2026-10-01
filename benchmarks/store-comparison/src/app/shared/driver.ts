import type { ApplicationRef } from '@angular/core';
import type { Router } from '@angular/router';
import {
  EDITOR_FIELDS,
  STATUSES,
  type Arm,
  type BenchApi,
  type EditorStore,
  type EditKind,
  type GridStore,
  type RenderCounters,
  type Row,
  type RowPatch,
  type Samples,
  type Status,
  type Timed,
} from '../contract';
import { FOOTER, VISIBLE } from './tokens';
import { EditorRegistry } from './editor-registry';
import {
  addCounters,
  diffCounters,
  readCounters,
  resetCounters,
} from './counters';
import { editorSeedFor, generateRows, mulberry32, otherStatus } from './data';
import { RunningHash, canonical, sha256Hex } from './digest';

export interface DriverDeps {
  readonly arm: Arm;
  readonly grid: GridStore;
  readonly registry: EditorRegistry;
  readonly appRef: ApplicationRef;
  readonly router: Router;
  readonly ready: Promise<void>;
}

const ZERO: RenderCounters = { rows: 0, footer: 0, editors: 0 };

interface PlannedEdit {
  readonly id: string;
  readonly patch: RowPatch;
  /** Whether the row is in the visible window (its DOM is verified after the write). */
  readonly visible: boolean;
}

/**
 * The in-page driver. Every timed operation is `performance.now()` immediately before the first
 * store write to the resolution of `settle()`; all plans, seeds and generated data are built
 * before the clock starts. Verification (DOM text equals the expected value) runs after the
 * clock stops and throws a descriptive Error on mismatch, which the runner treats as an INVALID
 * arm.
 */
export class BenchDriver implements BenchApi {
  readonly arm;
  /** Per-run, monotonically increasing source of values never written before. */
  private counter = 0;
  /** Running hash of saved editor results (never the results themselves). */
  private readonly saved = new RunningHash();

  /**
   * Cleared by `dispose()` when the host is destroyed. A CDP global handle ("DevTools console")
   * can keep this driver object alive after teardown, and through these deps it kept the whole
   * grid store reachable, so every arm looked like it retained ~10k rows (first integration run,
   * heap-snapshot retainer path). Disposed, a lingering driver holds nothing of the arm's.
   */
  private deps: DriverDeps | undefined;
  private get d(): DriverDeps {
    if (!this.deps)
      throw new Error('bench driver used after its host was destroyed');
    return this.deps;
  }

  constructor(deps: DriverDeps) {
    this.deps = deps;
    this.arm = {
      id: deps.arm.id,
      label: deps.arm.label,
      library: deps.arm.library,
    };
  }

  dispose(): void {
    this.deps = undefined;
  }

  ready(): Promise<void> {
    return this.d.ready;
  }

  resetCounters(): void {
    resetCounters();
  }

  // -- waiting ---------------------------------------------------------------------------------
  /**
   * Resolves once the application is stable with the DOM updated.
   *
   * FINDING (verified empirically, see the report): in zoneless Angular 22 a signal write marks the
   * view dirty and notifies the change-detection scheduler, which registers a pending task until
   * the scheduled tick has run; `ApplicationRef.whenStable()` therefore resolves only after that
   * tick, i.e. after the DOM reflects the write. A write that schedules no render (an off-screen
   * row nobody observes) leaves nothing pending and resolves on the next microtask, so it cannot
   * hang. Every visible-row write is additionally verified against the DOM by the callers.
   */
  private async settle(): Promise<void> {
    await this.d.appRef.whenStable();
  }

  /**
   * Start in a new task, as an input or socket event does. Back-to-back awaited writes otherwise
   * run inside one chain of timer callbacks, and HTML clamps a timer nested 5 deep to >= 4 ms, so
   * the scheduler's own timer was being delayed: p95 sat at ~5 ms for every arm while p50 was
   * 0.1 ms (first integration run). A message-channel task resets the nesting level.
   */
  private freshTask(): Promise<void> {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }

  private async timed(write: () => void): Promise<Timed> {
    await this.freshTask();
    const before = readCounters();
    const t0 = performance.now();
    write();
    await this.settle();
    const ms = performance.now() - t0;
    return { ms, counters: diffCounters(before, readCounters()) };
  }

  // -- DOM verification ------------------------------------------------------------------------
  private cell(id: string, field: string): string | undefined {
    const el = document.querySelector(`[data-row="${id}"] [data-f="${field}"]`);
    return el?.textContent?.trim();
  }
  private expectRow(context: string, id: string, expected: RowPatch): void {
    for (const [field, value] of Object.entries(expected)) {
      const actual = this.cell(id, field);
      if (actual !== String(value)) {
        throw new Error(
          `${context}: row ${id} field ${field} shows ${JSON.stringify(
            actual
          )}, expected ${JSON.stringify(String(value))}`
        );
      }
    }
  }
  private expectWindow(context: string): void {
    const expected = this.d.grid.ids().slice(0, VISIBLE);
    const actual = Array.from(document.querySelectorAll('[data-row]'), (e) =>
      e.getAttribute('data-row')
    );
    if (
      actual.length !== expected.length ||
      actual.some((id, i) => id !== expected[i])
    ) {
      throw new Error(
        `${context}: visible window mismatch; DOM has ${
          actual.length
        } rows starting ${actual.slice(0, 3).join(',')}, store expects ${
          expected.length
        } starting ${expected.slice(0, 3).join(',')}`
      );
    }
  }

  /**
   * The footer must show counts that match the rows, and the store's own statusCounts must agree
   * (fairness review: an arm with a stale tally passed the row-only digest).
   */
  private expectFooter(context: string, endOfScenario = true): void {
    // Without the footer, per-edit checks would read statusCounts between timed writes and so
    // keep it hot; check once per scenario instead, against the rows only.
    if (!FOOTER && !endOfScenario) return;
    const expected: Record<string, number> = Object.fromEntries(
      STATUSES.map((s) => [s, 0])
    );
    for (const row of this.d.grid.snapshot()) expected[row.status]++;
    const store = this.d.grid.statusCounts();
    for (const s of STATUSES) {
      const shown = document
        .querySelector(`[data-chip="${s}"]`)
        ?.textContent?.trim();
      if (
        store[s] !== expected[s] ||
        (FOOTER && shown !== `${s}: ${expected[s]}`)
      ) {
        throw new Error(
          `${context}: status ${s} rows=${expected[s]} statusCounts=${
            store[s]
          } footer=${JSON.stringify(shown)}`
        );
      }
    }
  }

  private expectEditor(context: string, store: EditorStore): void {
    const result = store.result();
    const section = document.querySelector(`[data-editor="${result.rowId}"]`);
    if (!section)
      throw new Error(`${context}: editor ${result.rowId} not rendered`);
    for (const key of EDITOR_FIELDS) {
      const input = section.querySelector<HTMLInputElement>(
        `[data-field="${key}"]`
      );
      if (input?.value !== String(result.fields[key])) {
        throw new Error(
          `${context}: editor field ${key} shows ${JSON.stringify(
            input?.value
          )}, expected ${JSON.stringify(String(result.fields[key]))}`
        );
      }
    }
    for (const line of result.lines) {
      const qty = section
        .querySelector(`[data-line="${line.id}"] [data-f="qty"]`)
        ?.textContent?.trim();
      const price = section
        .querySelector(`[data-line="${line.id}"] [data-f="price"]`)
        ?.textContent?.trim();
      if (qty !== String(line.qty) || price !== String(line.price))
        throw new Error(
          `${context}: line ${line.id} shows ${qty}/${price}, expected ${line.qty}/${line.price}`
        );
    }
    const total = result.lines.reduce((sum, l) => sum + l.qty * l.price, 0);
    const shownTotal = section
      .querySelector('[data-total]')
      ?.textContent?.trim();
    if (store.total() !== total || shownTotal !== String(total))
      throw new Error(
        `${context}: total store=${store.total()} shown=${shownTotal} expected=${total}`
      );
    const shownDirty = section
      .querySelector('[data-dirty]')
      ?.textContent?.trim();
    if (shownDirty !== String(store.dirty()))
      throw new Error(
        `${context}: dirty shown=${shownDirty} store=${store.dirty()}`
      );
  }

  // -- load ------------------------------------------------------------------------------------
  async load(count: number, seed: number, revision: number): Promise<Timed> {
    const rows = generateRows(count, seed, revision);
    const result = await this.timed(() => this.d.grid.setAll(rows));
    this.expectWindow(`load(${count},${seed},${revision})`);
    this.expectFooter(`load(${count},${seed},${revision})`);
    for (let i = 0; i < Math.min(VISIBLE, count); i++) {
      const r = rows[i];
      this.expectRow(`load(${count},${seed},${revision})`, r.id, {
        status: r.status,
        eta: r.eta,
        qty: r.qty,
        truck: r.truck,
        notes: r.notes,
      });
    }
    return result;
  }

  // -- edits -----------------------------------------------------------------------------------
  private positionPatch(): RowPatch {
    const c = ++this.counter;
    return {
      eta: 10000 + c,
      lat: (300000 + c) / 1e4,
      lng: -(900000 + c) / 1e4,
    };
  }

  private planEdits(
    kind: EditKind,
    count: number,
    seed: number
  ): PlannedEdit[] {
    const grid = this.d.grid;
    const all = grid.ids();
    const r = mulberry32(seed);
    const plan: PlannedEdit[] = [];
    if (kind === 'position-offscreen') {
      if (all.length <= VISIBLE)
        throw new Error(
          `edits(${kind}): needs more than ${VISIBLE} rows, store has ${all.length}`
        );
      for (let i = 0; i < count; i++) {
        const id = all[VISIBLE + Math.floor(r() * (all.length - VISIBLE))];
        plan.push({ id, patch: this.positionPatch(), visible: false });
      }
      return plan;
    }
    const window = all.slice(0, VISIBLE);
    if (window.length === 0) throw new Error(`edits(${kind}): store is empty`);
    const shadow = new Map<string, Status>();
    for (let i = 0; i < count; i++) {
      const id = window[Math.floor(r() * window.length)];
      if (kind === 'position-visible') {
        plan.push({ id, patch: this.positionPatch(), visible: true });
      } else {
        let current = shadow.get(id);
        if (current === undefined) {
          const row = grid.row(id)();
          if (!row) throw new Error(`edits(${kind}): row ${id} missing`);
          current = row.status;
        }
        const next = otherStatus(current, ++this.counter);
        shadow.set(id, next);
        plan.push({ id, patch: { status: next }, visible: true });
      }
    }
    return plan;
  }

  async edits(kind: EditKind, count: number, seed: number): Promise<Samples> {
    const plan = this.planEdits(kind, count, seed);
    const ms: number[] = [];
    let counters = ZERO;
    for (const op of plan) {
      const t = await this.timed(() => this.d.grid.update(op.id, op.patch));
      ms.push(t.ms);
      counters = addCounters(counters, t.counters);
      if (op.visible) this.expectRow(`edits(${kind})`, op.id, op.patch);
      // A status edit changes a count: check the tally on every one (untimed).
      if (kind === 'status-visible') this.expectFooter(`edits(${kind})`, false);
    }
    this.expectFooter(`edits(${kind})`);
    return { ms, counters };
  }

  // -- burst -----------------------------------------------------------------------------------
  async burst(count: number, seed: number): Promise<Timed> {
    const all = this.d.grid.ids();
    if (count > all.length)
      throw new Error(
        `burst: ${count} distinct rows requested, store has ${all.length}`
      );
    const r = mulberry32(seed);
    const chosen = new Set<number>();
    while (chosen.size < count) chosen.add(Math.floor(r() * all.length));
    const plan: PlannedEdit[] = [];
    for (const idx of chosen)
      plan.push({
        id: all[idx],
        patch: this.positionPatch(),
        visible: idx < VISIBLE,
      });
    const grid = this.d.grid;
    // One message carrying many updates: each arm applies it with its own batch form.
    const batch = plan.map((op) => ({ id: op.id, patch: op.patch }));
    const result = await this.timed(() => grid.updateMany(batch));
    for (const op of plan)
      if (op.visible) this.expectRow('burst', op.id, op.patch);
    this.expectFooter('burst');
    return result;
  }

  // -- reorder / remove ------------------------------------------------------------------------
  async reorderAndRemove(
    count: number,
    seed: number
  ): Promise<{ move: Samples; remove: Samples }> {
    const grid = this.d.grid;
    const shadow = [...grid.ids()];
    if (shadow.length < count + 2)
      throw new Error(
        `reorderAndRemove: needs at least ${count + 2} rows, store has ${
          shadow.length
        }`
      );
    const r = mulberry32(seed);
    const window = Math.min(VISIBLE, shadow.length);

    const moves: { id: string; to: number }[] = [];
    for (let i = 0; i < count; i++) {
      // Alternate: pull a row INTO the window, and push a window row OUT to anywhere.
      const from =
        i % 2 === 0
          ? Math.floor(r() * shadow.length)
          : Math.floor(r() * window);
      const to =
        i % 2 === 0
          ? Math.floor(r() * window)
          : Math.floor(r() * shadow.length);
      const id = shadow[from];
      shadow.splice(from, 1);
      shadow.splice(to, 0, id);
      moves.push({ id, to });
    }
    const removes: string[] = [];
    for (let i = 0; i < count; i++) {
      const at =
        i % 2 === 0
          ? Math.floor(r() * window)
          : Math.floor(r() * shadow.length);
      removes.push(shadow[at]);
      shadow.splice(at, 1);
    }

    const moveMs: number[] = [];
    let moveCounters = ZERO;
    for (const m of moves) {
      const t = await this.timed(() => grid.move(m.id, m.to));
      moveMs.push(t.ms);
      moveCounters = addCounters(moveCounters, t.counters);
      this.expectWindow('reorderAndRemove.move');
    }
    const removeMs: number[] = [];
    let removeCounters = ZERO;
    for (const id of removes) {
      const t = await this.timed(() => grid.remove(id));
      removeMs.push(t.ms);
      removeCounters = addCounters(removeCounters, t.counters);
      this.expectWindow('reorderAndRemove.remove');
    }
    this.expectFooter('reorderAndRemove');
    return {
      move: { ms: moveMs, counters: moveCounters },
      remove: { ms: removeMs, counters: removeCounters },
    };
  }

  // -- editors ---------------------------------------------------------------------------------
  async editorCycles(
    cycles: number,
    stack: number,
    seed: number
  ): Promise<{ open: Samples; edit: Samples; close: Samples }> {
    const grid = this.d.grid;
    const registry = this.d.registry;
    const openMs: number[] = [];
    const editMs: number[] = [];
    const closeMs: number[] = [];
    let openCounters = ZERO;
    let editCounters = ZERO;
    let closeCounters = ZERO;

    for (let c = 0; c < cycles; c++) {
      const ids = grid.ids();
      const span = Math.min(VISIBLE, ids.length);
      if (span < stack)
        throw new Error(
          `editorCycles: needs ${stack} rows in the window, store has ${span}`
        );
      // Plans: one seed per stacked editor, each from a distinct visible row.
      const seeds = [];
      for (let i = 0; i < stack; i++) {
        const row = grid.row(ids[(c * stack + i) % span])();
        if (!row) throw new Error('editorCycles: seed row missing');
        seeds.push(editorSeedFor(row, seed, c * stack + i));
      }

      for (let i = 0; i < stack; i++) {
        const s = seeds[i];
        const t = await this.timed(() => {
          registry.open(s);
        });
        openMs.push(t.ms);
        openCounters = addCounters(openCounters, t.counters);
        if (
          registry.stores.size !== i + 1 ||
          !document.querySelector(`[data-editor="${s.rowId}"]`)
        ) {
          throw new Error(
            `editorCycles: editor ${i + 1} for ${
              s.rowId
            } did not render (stores=${registry.stores.size})`
          );
        }
      }

      // Edit 5 fields and 3 lines in each editor. Each edit is one keystroke-sized write, timed
      // to stable like a grid edit (fairness review: editor update cost was unmeasured).
      for (const store of registry.stores.values()) {
        const lineIds = store.lineIds();
        const writes: (() => void)[] = [
          () => store.set('driver', 'D' + ++this.counter),
          () => store.set('plant', 'P' + ++this.counter),
          () => store.set('notes', 'note-' + ++this.counter),
          () => store.set('qty', 1000 + ++this.counter),
          () => store.set('eta', 10000 + ++this.counter),
          ...[0, 1, 2].map(
            (l) => () =>
              store.updateLine(lineIds[l], {
                qty: 500 + ++this.counter,
                price: 700 + ++this.counter,
              })
          ),
        ];
        for (const write of writes) {
          const t = await this.timed(write);
          editMs.push(t.ms);
          editCounters = addCounters(editCounters, t.counters);
        }
        if (!store.dirty())
          throw new Error('editorCycles: editor not dirty after edits');
        this.expectEditor('editorCycles.edit', store);
      }

      // Save the top editor back into the grid, folding its result into the running hash.
      const top = [...registry.stores.values()].at(-1);
      if (!top) throw new Error('editorCycles: no top editor');
      const result = top.result();
      const f = result.fields;
      const patch: RowPatch = {
        truck: f.truck,
        driver: f.driver,
        status: f.status,
        plant: f.plant,
        product: f.product,
        qty: f.qty,
        eta: f.eta,
        notes: f.notes,
      };
      grid.update(result.rowId, patch);
      this.saved.fold(canonical(result));
      await this.settle();
      this.expectRow('editorCycles.save', result.rowId, patch);
      this.expectFooter('editorCycles.save');

      const t = await this.timed(() => registry.closeAll());
      closeMs.push(t.ms);
      closeCounters = addCounters(closeCounters, t.counters);
      if (
        registry.stores.size !== 0 ||
        document.querySelector('[data-editor]')
      ) {
        throw new Error('editorCycles: editors still present after close');
      }
    }
    return {
      open: { ms: openMs, counters: openCounters },
      edit: { ms: editMs, counters: editCounters },
      close: { ms: closeMs, counters: closeCounters },
    };
  }

  // -- digest / teardown -----------------------------------------------------------------------
  async digest(): Promise<string> {
    const rows: readonly Row[] = this.d.grid.snapshot();
    return sha256Hex(
      canonical({
        rows,
        statusCounts: this.d.grid.statusCounts(),
        saved: this.saved.value(),
      })
    );
  }

  async teardown(): Promise<void> {
    // Navigating destroys the host, which disposes this driver: capture what is needed first.
    const { router, appRef } = this.d;
    await router.navigateByUrl('/');
    await appRef.whenStable();
  }
}
