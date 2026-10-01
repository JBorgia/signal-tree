import {
  computed,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
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

export class SignalsGrid implements GridStore {
  private readonly rows = new Map<string, WritableSignal<Row | undefined>>();
  private readonly idList = signal<readonly string[]>([]);

  readonly ids: Signal<readonly string[]> = this.idList.asReadonly();
  /**
   * Bumped by every write that can change a count. The counts depend on this one signal and read
   * the rows untracked: a hand-written store would not make one computed depend on N row signals
   * (fairness review: N producer edges cost memory and per-edit polling no library arm pays).
   */
  private readonly version = signal(0);

  readonly statusCounts: Signal<Counts> = computed(
    () => {
      this.version();
      return untracked(() => {
        const counts = {
          scheduled: 0,
          loading: 0,
          enroute: 0,
          onsite: 0,
          returning: 0,
          complete: 0,
        } as Record<Status, number>;
        for (const id of this.idList()) {
          const row = this.rows.get(id)?.();
          if (row) counts[row.status]++;
        }
        return counts;
      });
    },
    // Chips only change when a count changes; a position edit must not re-render the footer.
    { equal: sameCounts }
  );

  row(id: string): Signal<Row | undefined> {
    const existing = this.rows.get(id);
    if (existing) return existing;
    return signal<Row | undefined>(undefined).asReadonly();
  }

  setAll(rows: readonly Row[]): void {
    const keep = new Set<string>();
    for (const row of rows) {
      keep.add(row.id);
      const existing = this.rows.get(row.id);
      if (!existing) {
        this.rows.set(row.id, signal<Row | undefined>(row));
      } else {
        // A refetch replaces every row, as setAll does in the library arms. Diffing rows here was
        // an equality short-circuit (METHODOLOGY rule 4) that only this arm got (fairness review).
        existing.set(row);
      }
    }
    for (const id of [...this.rows.keys()]) {
      if (!keep.has(id)) {
        this.rows.get(id)?.set(undefined);
        this.rows.delete(id);
      }
    }
    this.idList.set(rows.map((r) => r.id));
    this.version.update((v) => v + 1);
  }

  update(id: string, patch: RowPatch): void {
    const sig = this.rows.get(id);
    if (!sig) throw new Error(`signals: update of unknown row ${id}`);
    sig.update((row) => (row ? { ...row, ...patch } : row));
    this.version.update((v) => v + 1);
  }

  updateMany(patches: readonly RowUpdate[]): void {
    // A feed message: signal writes coalesce into one change-detection pass on their own.
    for (const { id, patch } of patches) this.update(id, patch);
  }

  remove(id: string): void {
    const sig = this.rows.get(id);
    if (!sig) return;
    this.rows.delete(id);
    sig.set(undefined);
    this.idList.update((ids) => ids.filter((x) => x !== id));
    this.version.update((v) => v + 1);
  }

  move(id: string, index: number): void {
    this.idList.update((ids) => {
      const from = ids.indexOf(id);
      if (from < 0) return ids;
      const next = ids.slice();
      next.splice(from, 1);
      next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
      return next;
    });
  }

  snapshot(): readonly Row[] {
    return this.idList().map((id) => this.rows.get(id)!()!);
  }

  destroy(): void {
    this.rows.clear();
    this.idList.set([]);
  }
}
