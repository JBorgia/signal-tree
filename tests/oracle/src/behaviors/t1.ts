// T1 | Transactions are optimistic: speculative writes are visible
// immediately, before confirm()
//
// At every transact() that returns, the state read straight afterwards (no
// confirm) must show the body's writes. The expected value of each location
// comes from applying the body to the state before it, for the writes whose
// meaning is fixed by their names alone: set and update of a leaf, a branch
// write, and addOne, updateOne, upsertOne, setField and removeOne on a key
// whose presence makes the write meaningful. Locations touched by any other
// write are not checked.
import type { Json, StateView, WriteOp } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, locValues, rowLoc, type Loc } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  'Transactions are optimistic: speculative writes are visible immediately, before confirm()';

const ABSENT = 'absent';

interface Model {
  readonly scalars: Map<Loc, number | undefined>;
  readonly rows: Map<string, Record<string, Json>>;
  readonly unknownRows: Set<string>;
  allRowsUnknown: boolean;
  /** Locations the body wrote, in a checkable way. */
  readonly touched: Set<Loc>;
}

function modelOf(state: StateView): Model | undefined {
  const { values, rowsKnown } = locValues(state);
  if (!rowsKnown) return undefined;
  const num = (loc: Loc) => {
    const v: unknown = JSON.parse(values.get(loc) ?? 'null');
    return typeof v === 'number' ? v : undefined;
  };
  const rows = new Map<string, Record<string, Json>>();
  (state.ids as Json[]).forEach((key, i) => rows.set(String(key), (state.rows as Json[])[i] as Record<string, Json>));
  return {
    scalars: new Map(['a', 'cfg.p', 'cfg.q'].map((loc) => [loc, num(loc)])),
    rows,
    unknownRows: new Set(),
    allRowsUnknown: false,
    touched: new Set(),
  };
}

function apply(m: Model, w: WriteOp): void {
  const setScalar = (loc: Loc, value: number | undefined): void => {
    m.scalars.set(loc, value);
    m.touched.add(loc);
  };
  const lose = (...keys: string[]): void => {
    for (const k of keys) m.unknownRows.add(k);
  };
  const known = (key: string) => !m.allRowsUnknown && !m.unknownRows.has(key);
  const touchRow = (key: string): void => {
    m.touched.add(rowLoc(key));
  };
  switch (w.kind) {
    case 'setLeaf':
      return setScalar(w.path, w.value);
    case 'updateLeaf': {
      const current = m.scalars.get(w.path);
      return setScalar(w.path, current === undefined ? undefined : current + w.delta);
    }
    case 'setBranch':
      setScalar('cfg.p', w.p);
      return setScalar('cfg.q', w.q);
    case 'addOne':
      if (known(w.row.id) && !m.rows.has(w.row.id)) {
        m.rows.set(w.row.id, { id: w.row.id, n: w.row.n });
        return touchRow(w.row.id);
      }
      return lose(w.row.id);
    case 'updateOne':
    case 'setField': {
      const row = m.rows.get(w.id);
      if (known(w.id) && row) {
        m.rows.set(w.id, { ...row, n: w.n });
        return touchRow(w.id);
      }
      return lose(w.id);
    }
    case 'upsertOne': {
      const row = m.rows.get(w.row.id);
      // Present under its own id, merge and replace agree; otherwise only an absent key is unambiguous.
      if (known(w.row.id) && (!row || row['id'] === w.row.id)) {
        m.rows.set(w.row.id, { ...(row ?? {}), id: w.row.id, n: w.row.n });
        return touchRow(w.row.id);
      }
      return lose(w.row.id);
    }
    case 'removeOne':
      if (known(w.id) && m.rows.has(w.id)) {
        m.rows.delete(w.id);
        return touchRow(w.id);
      }
      return lose(w.id);
    case 'addMany':
    case 'upsertMany':
      return lose(...w.rows.map((r) => r.id));
    case 'updateMany':
    case 'removeMany':
      return lose(...w.ids);
    case 'changeId':
      return lose(w.from, w.to);
    case 'prependOne':
      return lose(w.row.id);
    case 'replaceOne':
      return lose(w.id, w.row.id);
    case 'setAll':
    case 'clear':
      m.allRowsUnknown = true;
      return;
  }
}

const expectedValue = (m: Model, loc: Loc): string | undefined => {
  if (!loc.startsWith('rows.')) {
    const v = m.scalars.get(loc);
    return v === undefined ? undefined : canonical(v);
  }
  const key = loc.slice(5);
  if (m.allRowsUnknown || m.unknownRows.has(key)) return undefined;
  const row = m.rows.get(key);
  return row ? canonical(row) : ABSENT;
};

export const T1 = instanceProperty({
  id: 'T1',
  row: ROW,
  reason:
    'Checks locations written by setLeaf, updateLeaf, setBranch, and by addOne, updateOne, upsertOne, setField and removeOne where the key\'s presence fixes the result; other entity writes have no outcome in the rows.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    for (const s of analysis.steps) {
      if (s.op.kind !== 'transact' || s.outcome.status !== 'ok' || s.unknown || !s.before || !s.after) continue;
      const model = modelOf(s.before);
      if (!model) continue;
      for (const w of s.op.body) apply(model, w);
      const after = locValues(s.after);
      if (!after.rowsKnown) continue;
      const expected: Record<string, Json> = {};
      const observed: Record<string, Json> = {};
      let ok = true;
      for (const loc of model.touched) {
        const want = expectedValue(model, loc);
        if (want === undefined) continue;
        const got = after.values.get(loc) ?? ABSENT;
        expected[loc] = want === ABSENT ? ABSENT : (JSON.parse(want) as Json);
        observed[loc] = got === ABSENT ? ABSENT : (JSON.parse(got) as Json);
        if (want !== got) ok = false;
      }
      if (Object.keys(expected).length === 0) continue;
      found.push(
        verdict(
          ok,
          s.index,
          'write-not-visible',
          expected,
          observed,
          ok
            ? `transact() at step ${s.index} shows its writes before confirm()`
            : `transact() at step ${s.index} returned, but its writes are not all visible`
        )
      );
    }
    return found;
  },
});
