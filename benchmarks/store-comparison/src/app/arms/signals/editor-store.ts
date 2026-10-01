import {
  computed,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  EDITOR_FIELDS,
  type EditorField,
  type EditorFields,
  type EditorResult,
  type EditorSeed,
  type EditorStore,
  type Line,
  type LinePatch,
} from '../../contract';

export class SignalsEditor implements EditorStore {
  private readonly fields = {} as {
    [K in EditorField]: WritableSignal<EditorFields[K]>;
  };
  private readonly lines = new Map<string, WritableSignal<Line | undefined>>();
  private readonly order: readonly string[];
  private readonly lineIdList: WritableSignal<readonly string[]>;
  private readonly seed: EditorSeed;

  readonly lineIds: Signal<readonly string[]>;
  readonly total: Signal<number>;
  readonly dirty: Signal<boolean>;

  constructor(seed: EditorSeed) {
    this.seed = seed;
    for (const key of EDITOR_FIELDS) {
      (this.fields as Record<EditorField, WritableSignal<unknown>>)[key] =
        signal<unknown>(seed.fields[key]);
    }
    for (const line of seed.lines)
      this.lines.set(line.id, signal<Line | undefined>(line));
    this.order = seed.lines.map((l) => l.id);
    this.lineIdList = signal(this.order);
    this.lineIds = this.lineIdList.asReadonly();

    this.total = computed(() => {
      let sum = 0;
      for (const id of this.order) {
        const l = this.lines.get(id)?.();
        if (l) sum += l.qty * l.price;
      }
      return sum;
    });
    this.dirty = computed(() => {
      for (const key of EDITOR_FIELDS)
        if (this.fields[key]() !== seed.fields[key]) return true;
      for (const orig of seed.lines) {
        const l = this.lines.get(orig.id)?.();
        if (
          !l ||
          l.product !== orig.product ||
          l.qty !== orig.qty ||
          l.price !== orig.price
        )
          return true;
      }
      return false;
    });
  }

  field<K extends EditorField>(key: K): Signal<EditorFields[K]> {
    return this.fields[key];
  }
  set<K extends EditorField>(key: K, value: EditorFields[K]): void {
    this.fields[key].set(value);
  }
  line(id: string): Signal<Line | undefined> {
    return (
      this.lines.get(id) ?? signal<Line | undefined>(undefined).asReadonly()
    );
  }
  updateLine(id: string, patch: LinePatch): void {
    const sig = this.lines.get(id);
    if (!sig) throw new Error(`signals editor: unknown line ${id}`);
    sig.update((l) => (l ? { ...l, ...patch } : l));
  }
  result(): EditorResult {
    const fields = {} as Record<EditorField, unknown>;
    for (const key of EDITOR_FIELDS) fields[key] = this.fields[key]();
    return {
      rowId: this.seed.rowId,
      fields: fields as unknown as EditorFields,
      lines: this.order.map((id) => this.lines.get(id)!()!),
    };
  }
  destroy(): void {
    this.lines.clear();
  }
}
