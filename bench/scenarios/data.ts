/**
 * Deterministic data for the scenarios. Shared by the Node micro gates and the
 * reference app, so every subject sees the same shapes and values.
 */

/** mulberry32: a small seeded PRNG; returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Field names of a collection row: `id` plus f1..f(fields-1), so `fields` counts the id. */
export function rowFieldNames(fields: number): string[] {
  const names = ['id'];
  for (let f = 1; f < fields; f++) names.push(`f${f}`);
  return names;
}

/** Odd fields hold numbers, even fields hold short strings. */
function fieldValue(row: number, field: number, salt: number): number | string {
  return field % 2 === 1 ? (row * 7 + field * 13 + salt) % 100000 : `s${(row * 31 + field * 17 + salt) % 99991}`;
}

export type PlainRow = { id: number } & Record<string, number | string>;

/** `rows` plain row objects with `fields` fields each (id included). */
export function makeRows(rows: number, fields: number, salt = 0): PlainRow[] {
  const names = rowFieldNames(fields);
  const out: PlainRow[] = new Array(rows);
  for (let i = 0; i < rows; i++) {
    const row: Record<string, number | string> = { id: i };
    for (let f = 1; f < fields; f++) row[names[f]!] = fieldValue(i, f, salt);
    out[i] = row as PlainRow;
  }
  return out;
}

/** The changes of one server row update: new values for the first `count` non-id fields. */
export function rowUpdate(random: () => number, count: number): Record<string, number | string> {
  const changes: Record<string, number | string> = {};
  for (let f = 1; f <= count; f++) {
    const n = Math.floor(random() * 100000);
    changes[`f${f}`] = f % 2 === 1 ? n : `s${n}`;
  }
  return changes;
}

/** Form state: `fields` string leaves split into sections of `perSection`. Returns state and leaf paths. */
export function makeFormState(fields: number, perSection: number): { state: Record<string, Record<string, string>>; paths: string[][] } {
  const state: Record<string, Record<string, string>> = {};
  const paths: string[][] = [];
  for (let i = 0; i < fields; i++) {
    const section = `s${Math.floor(i / perSection)}`;
    const key = `f${i % perSection}`;
    (state[section] ??= {})[key] = '';
    paths.push([section, key]);
  }
  return { state, paths };
}

/**
 * M3 state: `leaves` numeric leaves in branches of `perBranch`. Returns the
 * state and the paths of `accessed` leaves spread evenly across it.
 */
export function makeLeafState(leaves: number, perBranch: number, accessed: number): { state: Record<string, Record<string, number>>; accessedPaths: string[][] } {
  const state: Record<string, Record<string, number>> = {};
  for (let i = 0; i < leaves; i++) {
    const branch = `b${Math.floor(i / perBranch)}`;
    (state[branch] ??= {})[`l${i % perBranch}`] = i;
  }
  const accessedPaths: string[][] = [];
  const step = Math.floor(leaves / accessed);
  for (let k = 0; k < accessed; k++) {
    const i = k * step + (k % perBranch);
    accessedPaths.push([`b${Math.floor(i / perBranch)}`, `l${i % perBranch}`]);
  }
  return { state, accessedPaths };
}
