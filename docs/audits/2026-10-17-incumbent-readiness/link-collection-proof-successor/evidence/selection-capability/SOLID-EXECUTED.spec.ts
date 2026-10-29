// Private capability falsifier; raw assignment is not a public write operation.
// First observations are logged before assertions; no app-owned computed is used.
import { expect, it } from 'vitest';
import { createNativeLocationRuntime } from '../../../kernel/src/lib/internals/native-location-realization';
import { createComputed, createRoot } from 'solid-js';
import { createSolidObservationAdapter } from './solid-observation';

it('existing solid projection exposes prepared raw selection without early observer publication', async () => {
  const runtime = createNativeLocationRuntime(createSolidObservationAdapter());
  if (!runtime.createEpoch || !runtime.advanceEpoch || !runtime.createWritableProjection) throw new Error('Existing projection capability unavailable');
  const epoch = runtime.createEpoch();
  let raw = 'A';
  const projection = runtime.createWritableProjection(() => { epoch(); return raw; }, value => { raw = value; runtime.advanceEpoch!(epoch); });
  const readonly = projection.asReadonly();
  expect(projection()).toBe('A'); expect(readonly()).toBe('A');
  const seen: string[] = [];
  const stop = createRoot(dispose => { createComputed(() => { seen.push(readonly()); }); return dispose; });
  try {
    expect(seen).toEqual(['A']);
    raw = 'B';
    const before = { writable: projection(), readonly: readonly(), seen: [...seen] };
    runtime.runInvalidationGroup(() => runtime.advanceEpoch!(epoch));
    await Promise.resolve();
    const after = { writable: projection(), readonly: readonly(), seen: [...seen] };
    console.log('selection-capability-solid', JSON.stringify({ before, after }));
    expect(after.writable).toBe('B'); expect(after.readonly).toBe('B'); expect(after.seen.at(-1)).toBe('B');
    expect(before).toEqual({ writable: 'B', readonly: 'B', seen: ['A'] });
  } finally { stop(); }
});
