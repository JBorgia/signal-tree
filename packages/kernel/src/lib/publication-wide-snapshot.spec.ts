import { expect, it } from 'vitest';
import { entityMap, signalTree } from '../index';

type Row = { id: string; [field: string]: string | number };

it('captures a wide collection without passing its evidence as call arguments', () => {
  // 320k fields plus membership and placement exceed the engine's call-argument
  // limit even though this root is shallow. Every view still belongs in the
  // snapshot certificate; omission or deduplication is not the repair.
  const rows: Row[] = Array.from({ length: 10_000 }, (_, index) => {
    const row: Row = { id: `r${index}` };
    for (let field = 1; field < 32; field++) row[`f${field}`] = index * 32 + field;
    return row;
  });
  const tree = signalTree({ rows: entityMap<Row, string>() });
  try {
    tree.$.rows.setAll(rows);
    const saved = tree.$();
    expect(saved.rows.all).toEqual(rows);
    tree.$.rows.updateOne('r9999', { f31: -1 });
    const fresh = tree.$();
    expect(fresh.rows.all).toHaveLength(10_000);
    expect(fresh.rows.all[0]).toEqual(rows[0]);
    expect(fresh.rows.all[9999].f31).toBe(-1);
    expect(saved.rows.all[9999].f31).toBe(319_999);
    expect(fresh).not.toBe(saved);
  } finally {
    tree.destroy();
  }
});
