import { computed, type Signal } from '@angular/core';
import { entityMap, signalTree } from '@signaltree/core';
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

export class St14Editor implements EditorStore {
  private readonly tree;
  private readonly seed: EditorSeed;
  readonly lineIds: Signal<readonly string[]>;
  readonly total: Signal<number>;
  readonly dirty: Signal<boolean>;

  constructor(seed: EditorSeed) {
    this.seed = seed;
    // Scalar fields are plain state leaves; order lines are an entityMap collection.
    this.tree = signalTree({
      ...seed.fields,
      lines: entityMap<Line, string>(),
    });
    this.tree.$.lines.setAll(seed.lines as Line[]);
    const $ = this.tree.$;
    this.lineIds = $.lines.ids;
    this.total = computed(() =>
      $.lines.all().reduce((sum, l) => sum + l.qty * l.price, 0)
    );
    this.dirty = computed(() => {
      for (const key of EDITOR_FIELDS)
        if ($[key]() !== seed.fields[key]) return true;
      const all = $.lines.all();
      for (let i = 0; i < seed.lines.length; i++) {
        const l = all[i];
        const o = seed.lines[i];
        if (
          !l ||
          l.id !== o.id ||
          l.product !== o.product ||
          l.qty !== o.qty ||
          l.price !== o.price
        )
          return true;
      }
      return false;
    });
  }

  field<K extends EditorField>(key: K): Signal<EditorFields[K]> {
    return this.tree.$[key] as unknown as Signal<EditorFields[K]>;
  }
  set<K extends EditorField>(key: K, value: EditorFields[K]): void {
    (this.tree.$[key] as unknown as { set(v: EditorFields[K]): void }).set(
      value
    );
  }
  line(id: string): Signal<Line | undefined> {
    const node = this.tree.$.lines.byId(id);
    return computed(() => node?.());
  }
  updateLine(id: string, patch: LinePatch): void {
    this.tree.$.lines.updateOne(id, patch);
  }
  result(): EditorResult {
    const fields = {} as Record<EditorField, unknown>;
    for (const key of EDITOR_FIELDS) fields[key] = this.tree.$[key]();
    return {
      rowId: this.seed.rowId,
      fields: fields as unknown as EditorFields,
      lines: this.tree.$.lines.all().map((l) => ({ ...l })),
    };
  }
  destroy(): void {
    this.tree.destroy();
  }
}
