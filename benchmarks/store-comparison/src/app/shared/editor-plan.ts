import type {
  EditorField,
  EditorFields,
  EditorResult,
  EditorSeed,
  EditorStore,
} from '../contract';

interface PlannedEditorEdit {
  readonly label: string;
  readonly expected: EditorResult;
  readonly write: (store: EditorStore) => void;
}

/** Build independent expected states before the seed is handed to any arm. Never read a store. */
export function planEditorEdits(seed: EditorSeed, next: () => number) {
  const initial: EditorResult = {
    rowId: seed.rowId,
    fields: { ...seed.fields },
    lines: seed.lines.map((line) => ({ ...line })),
  };
  let expected = initial;
  const edits: PlannedEditorEdit[] = [];
  function field<K extends EditorField>(key: K, value: EditorFields[K]): void {
    expected = { ...expected, fields: { ...expected.fields, [key]: value } };
    edits.push({ label: key, expected, write: (store) => store.set(key, value) });
  }
  field('driver', 'D' + next());
  field('plant', 'P' + next());
  field('notes', 'note-' + next());
  field('qty', 1000 + next());
  field('eta', 10000 + next());
  for (let i = 0; i < 3; i++) {
    const line = initial.lines[i];
    if (!line) throw new Error('editorCycles: seed needs at least three lines');
    const patch = { qty: 500 + next(), price: 700 + next() };
    expected = {
      ...expected,
      lines: expected.lines.map((item) =>
        item.id === line.id ? { ...item, ...patch } : item
      ),
    };
    edits.push({
      label: `line ${line.id}`,
      expected,
      write: (store) => store.updateLine(line.id, patch),
    });
  }
  return { initial, edits };
}
