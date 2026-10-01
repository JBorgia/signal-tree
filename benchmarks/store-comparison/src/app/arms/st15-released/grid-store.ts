import { computed, type Signal } from '@angular/core';
import { entityMap, signalTree } from 'st15-released';
import {
  STATUSES,
  type GridStore,
  type Row,
  type RowPatch,
  type RowUpdate,
  type Status,
} from '../../contract';

type Counts = Readonly<Record<Status, number>>;

function sameCounts(a: Counts, b: Counts): boolean {
  return STATUSES.every((s) => a[s] === b[s]);
}

function createTree() {
  return signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    {
      // README "Tree construction": derived values are zero-argument recipes declared in the
      // same signalTree(...) call and memoized as native readonly signals.
      derived: ($) => ({
        statusCounts: (): Counts => {
          const counts = {
            scheduled: 0,
            loading: 0,
            enroute: 0,
            onsite: 0,
            returning: 0,
            complete: 0,
          } as Record<Status, number>;
          for (const r of $.rows.all()) counts[r.status]++;
          return counts;
        },
      }),
    }
  );
}

export class St15Grid implements GridStore {
  private readonly tree = createTree();

  readonly ids: Signal<readonly string[]> = this.tree.$.rows.ids;
  // Same equality wrapper as every arm: the chips change only when a count changes.
  readonly statusCounts: Signal<Counts> = computed(
    () => this.tree.$.statusCounts(),
    { equal: sameCounts }
  );

  row(id: string): Signal<Row | undefined> {
    const node = this.tree.$.rows.byId(id);
    return computed(() => node?.());
  }

  setAll(rows: readonly Row[]): void {
    this.tree.$.rows.setAll(rows as Row[]);
  }

  update(id: string, patch: RowPatch): void {
    this.tree.$.rows.updateOne(id, patch);
  }

  updateMany(patches: readonly RowUpdate[]): void {
    // entityMap.updateMany(ids, changes) applies ONE shared patch, so it cannot carry per-row
    // values. The documented batching() enhancer + tree.batch() was measured (A/B, 10k rows,
    // burst of 100, 45 samples): no difference (Angular already coalesces signal writes into
    // one render), for ~0.7-1.2 KB more per arm, so an expert would not install it here.
    // upsertMany of merged rows was also measured (same digest): ~2x slower at 10k rows and
    // 12-25% slower at 50k than this loop, for both 14.1.3 and 15.3.1.
    const rows = this.tree.$.rows;
    for (const { id, patch } of patches) rows.updateOne(id, patch);
  }

  remove(id: string): void {
    this.tree.$.rows.removeOne(id);
  }

  move(id: string, index: number): void {
    // entityMap documents no positional move; reordering is a setAll of the reordered list.
    const all = this.tree.$.rows.all().slice();
    const from = all.findIndex((r) => r.id === id);
    if (from < 0) return;
    const [row] = all.splice(from, 1);
    all.splice(Math.max(0, Math.min(index, all.length)), 0, row);
    this.tree.$.rows.setAll(all);
  }

  snapshot(): readonly Row[] {
    return this.tree.$.rows.all().map((r) => ({ ...r }));
  }

  destroy(): void {
    this.tree.destroy();
  }
}
