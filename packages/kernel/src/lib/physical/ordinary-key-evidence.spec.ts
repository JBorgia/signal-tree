import { StructuralStore } from './structural-store';
import { ordinaryAdmissionKey } from './ordinary-key-evidence';
import type { StructuralEffect } from '../mutation-types';

describe('ordinary admission source key evidence', () => {
  for (const key of [undefined, null, 'undefined', 1, '1']) {
    it(`preserves explicit add key ${String(key)} (${typeof key})`, () => {
      const effect = { kind: 'add', subject: 1, key, value: {} } as StructuralEffect;
      expect(ordinaryAdmissionKey(effect, { present: true, key: 'other' })).toBe(key);
    });
    it(`preserves explicit placement key ${String(key)} (${typeof key})`, () => {
      expect(ordinaryAdmissionKey(undefined, { present: true, key: key as string | number })).toBe(key);
    });
  }
  it('uses the rekey destination', () => {
    expect(ordinaryAdmissionKey({kind:'rekey',subject:1,beforeKey:'old',afterKey:'new'}, {present:true,key:'old'})).toBe('new');
  });
  it('refuses missing source evidence', () => {
    expect(() => ordinaryAdmissionKey(undefined, {present:false})).toThrow('Ordinary entity admission lacks a key');
    const malformed = {kind:'add',subject:1,value:{}} as StructuralEffect;
    expect(() => ordinaryAdmissionKey(malformed, {present:false})).toThrow('Ordinary entity admission lacks a key');
  });
});

it('preserves the existing unsupported undefined-key handle refusal', () => {
  const store = new StructuralStore<string>();
  const key = undefined as unknown as string;
  store.createSubject(1, key);
  const handle = store.acquireSubjectHandleForKey(key);
  expect(handle).toBeDefined();
  expect(() => store.resolveSubjectHandle(handle!)).toThrow('missing its active key');
});
