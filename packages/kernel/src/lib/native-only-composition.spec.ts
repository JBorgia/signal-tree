import { expect, it } from 'vitest';
import {
  registerNativePublicationFactory, registerIntrinsicMutationSource,
  preparePublicationMutations, installTerminalRecord, completePreparedPublication,
  type NativePublicationParticipant,
} from './internals/intrinsic-mutation';
const participants = new WeakMap<object, NativePublicationParticipant>();
registerNativePublicationFactory(node => {
  const participant = participants.get(node);
  if (!participant) throw Error('fixture participant missing');
  return participant;
});
const mutation = { intent: 'replace' as const, before: 0, after: 1, changed: true };
for (const phase of ['prepare', 'finalize'] as const)
  for (const empty of [false, true])
    it(`refuses enrollment during ${phase}, empty=${empty}`, () => {
      const node = {}, records = new Map();
      let release: (() => void) | undefined;
      const enroll = () => { release = preparePublicationMutations(node, () => undefined,
        () => { /* No recipient unit is produced in this refusal fixture. */ }); };
      participants.set(node, {
        captureInput: () => undefined,
        prepare() {
          if (phase === 'prepare') enroll();
          if (empty) return undefined;
          return { record: { writes: [{ map: records, key: node, value: 1 }], adds: [] },
            completion: {}, finalize() { expect(this).toBeUndefined(); if (phase === 'finalize') enroll(); } };
        },
        complete() { throw Error('refused unit must not complete'); },
      });
      const source = registerIntrinsicMutationSource(node);
      try {
        // An empty unit has no finalizer, hence no enrollment in that cell.
        if (empty && phase === 'finalize') expect(source.preparePublication?.(mutation)).toBeUndefined();
        else expect(() => source.preparePublication?.(mutation)).toThrow('enrollment changed');
        expect(records.size).toBe(0);
      } finally { release?.(); }
    });
it.each([false, true])('deferred sealing and reentrant completion preserve thrown undefined=%s', throws => {
  const node = {}, records = new Map();
  let seals = 0, completes = 0;
  participants.set(node, {
    captureInput: () => undefined,
    prepare: () => ({ record: { writes: [{ map: records, key: node, value: 1 }], adds: [] }, completion: {},
      finalize() { expect(this).toBeUndefined(); seals++; } }),
    complete() {
      completes++;
      completePreparedPublication(completion);
      if (throws) throw undefined;
    },
  });
  const source = registerIntrinsicMutationSource(node);
  const unit = source.preparePublication?.({ ...mutation, deferPublicationFinalization: true });
  if (!unit) throw Error('missing unit');
  const completion = unit.completion;
  completePreparedPublication(completion);
  expect(completes).toBe(0);
  expect(seals).toBe(0);
  unit.finalize?.(); unit.finalize?.(); expect(seals).toBe(1);
  installTerminalRecord(unit.record); expect(records.get(node)).toBe(1);
  let failed = false, error: unknown = 'unset';
  try { completePreparedPublication(completion); } catch (caught) { failed = true; error = caught; }
  expect(failed).toBe(throws);
  if (throws) expect(error).toBeUndefined();
  completePreparedPublication(completion); expect(completes).toBe(1);
});
