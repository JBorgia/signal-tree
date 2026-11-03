import { entityMap } from '../index';
import { signalTree } from './signal-tree';

type Row = { id: string | number; value: number };
// Deliberately malformed runtime inputs, bounded at the fixture boundary.
const row = (id: unknown, value: number): Row => ({ id, value } as Row);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('legacy key admission public controls', () => {
  for (const key of [undefined, null]) {
    it(`retains ${String(key)} separately from spelled and typed keys`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const tree = signalTree({ rows: entityMap<Row, string | number>() });
      try {
        const rows = tree.$.rows;
        rows.addOne(row('left', 1));
        rows.addOne(row(key, 2));
        rows.addOne(row(String(key), 3));
        rows.addOne(row(1, 4));
        rows.addOne(row('1', 5));
        rows.addOne(row('right', 6));
        const values: ReadonlyMap<unknown, Row> = rows.asMap();
        expect([...values.keys()]).toEqual(['left', key, String(key), 1, '1', 'right']);
        expect([...values.values()].map(e => e.value)).toEqual([1,2,3,4,5,6]);
        expect(warn.mock.calls.filter(c => String(c[0]).includes('[ST2001]'))).toHaveLength(1);
        expect(() => rows.addOne(row(key, 9))).toThrow(/already exists/);
        expect(rows.asMap()).toEqual(values);
      } finally { tree.destroy(); }
    });
    it(`production mode retains ${String(key)} without warning`, () => {
      vi.stubGlobal('ngDevMode', false);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const tree = signalTree({ rows: entityMap<Row, string | number>() });
      try {
        tree.$.rows.addOne(row(key, 7));
        const values: ReadonlyMap<unknown, Row> = tree.$.rows.asMap();
        expect(values.size).toBe(1);
        expect(values.get(key)?.value).toBe(7);
        expect(warn).not.toHaveBeenCalled();
      } finally { tree.destroy(); }
    });
  }
});

it('retains null and undefined as two distinct raw keys together', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const tree = signalTree({ rows: entityMap<Row, string | number>() });
  try {
    tree.$.rows.addOne(row(undefined, 1));
    tree.$.rows.addOne(row(null, 2));
    const values: ReadonlyMap<unknown, Row> = tree.$.rows.asMap();
    expect([...values.keys()]).toEqual([undefined, null]);
    expect(values.get(undefined)?.value).toBe(1);
    expect(values.get(null)?.value).toBe(2);
  } finally { tree.destroy(); }
});
