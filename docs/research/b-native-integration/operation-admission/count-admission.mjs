import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const path = new URL('../../../../packages/kernel/src/lib/internals/native-order-admission-experiment.ts', import.meta.url).pathname;
const { admitNativeOrder } = await import(path);
const NativeMap = globalThis.Map;
let copiedEntries = 0;
class CountedMap extends NativeMap {
  constructor(iterable) {
    super(iterable === undefined ? undefined : (function* () {
      for (const entry of iterable) { copiedEntries++; yield entry; }
    })());
  }
}
globalThis.Map = CountedMap;
const result = [];
for (const count of [128, 256, 512]) {
  copiedEntries = 0;
  let state;
  for (let i = 0; i < count; i++)
    state = admitNativeOrder(state, [], {kind: 'append', subjects: [i]}, 1, i + 1);
  result.push({ operations: count, mapEntriesConstructed: copiedEntries, contributions: state.contributions.length });
}
globalThis.Map = NativeMap;
console.log(JSON.stringify({ source: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), workload: 'N one-subject append admissions under one pending author; Map constructor input entries counted; no native store or timings', result }, null, 2));
