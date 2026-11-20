// O3 | **Read-path consistency.** After every turn, all read paths (leaf, row
// field, `byId`, `all()`, `ids()`, `count()`, snapshot) agree.
//
// Each operation is its own turn, so every step's observation is checked,
// same-tick steps included. The subject reads every path after the step
// (Observation.paths) and the state view (all(), ids()). They must agree:
// - each leaf read on its own equals the branch read and the snapshot;
// - the snapshot's rows (an entity map snapshots as `{ all }`) equal all();
// - count() equals the length of ids() and of all();
// - byId(key) finds a row exactly for the keys ids() lists; its whole read
//   equals all()'s row at that key's position, and each field read on its own
//   equals that row's field.
// A path that throws while the others read does not agree. Steps after the
// tree is destroyed are D1's: there every read must throw.
import type { Json, Observation, ReadPaths, StateView } from '../model.js';
import { canonical } from '../trace.js';
import { analyze, destroyedAt } from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW = '**Read-path consistency.** After every turn, all read paths (leaf, row field, `byId`, `all()`, `ids()`, `count()`, snapshot) agree.';

const isRecord = (v: unknown): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (x: unknown, y: unknown) => canonical(x) === canonical(y);

/** Where the read paths in an observation disagree; undefined when they were not read. */
export function pathDisagreements(observation: Observation): string[] | undefined {
  const { state, paths } = observation;
  if (!paths || 'readError' in state) return undefined;
  if ('readError' in paths) return [`a read path threw: ${paths.readError.class}: ${paths.readError.message}`];
  return disagreements(state, paths);
}

function disagreements(state: StateView, p: ReadPaths): string[] {
  const out: string[] = [];
  const snap = isRecord(p.snapshot) ? p.snapshot : {};
  const snapCfg = isRecord(snap['cfg']) ? snap['cfg'] : {};
  const branch = isRecord(p.branch) ? p.branch : {};
  if (!same(p.leaves.a, state.a) || !same(p.leaves.a, snap['a'])) out.push('a');
  for (const leaf of ['p', 'q'] as const) {
    const value = p.leaves[`cfg.${leaf}`];
    if (!same(value, branch[leaf]) || !same(value, snapCfg[leaf])) out.push(`cfg.${leaf}`);
  }
  if (!same(p.branch, state.cfg)) out.push('cfg branch');
  const snapRows = isRecord(snap['rows']) ? snap['rows']['all'] : snap['rows'];
  if (!same(snapRows, state.rows)) out.push('snapshot rows vs all()');
  const rows = Array.isArray(state.rows) ? state.rows : [];
  const ids = Array.isArray(state.ids) ? state.ids.map(String) : [];
  if (!same(p.count, ids.length) || !same(p.count, rows.length)) out.push('count() vs ids() and all()');
  for (const [key, read] of Object.entries(p.byId)) {
    const at = ids.indexOf(key);
    if (at < 0) {
      if (read !== null) out.push(`byId(${key}) finds a row ids() does not list`);
      continue;
    }
    if (read === null) {
      out.push(`byId(${key}) finds nothing for a listed key`);
      continue;
    }
    const row = rows[at];
    if (!same(read.row, row)) out.push(`byId(${key}) vs all()`);
    const fields = isRecord(row) ? row : {};
    for (const [field, value] of Object.entries(read.fields)) {
      if (!same(value, fields[field])) out.push(`byId(${key}).${field} vs its row`);
    }
  }
  return out;
}

export const O3 = instanceProperty({
  id: 'O3',
  row: ROW,
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const destroyed = destroyedAt(analysis);
    for (const s of analysis.steps) {
      if (destroyed !== undefined && s.index >= destroyed) break;
      const off = pathDisagreements(s.observation);
      if (!off) continue;
      found.push(
        verdict(
          off.length === 0,
          s.index,
          off[0]?.startsWith('a read path threw') ? 'read-path-threw' : 'read-paths-disagree',
          { disagreements: [] },
          { disagreements: off },
          `read paths after step ${s.index}`
        )
      );
    }
    return found;
  },
});
