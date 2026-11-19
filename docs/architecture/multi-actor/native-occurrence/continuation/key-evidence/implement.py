from pathlib import Path
r=Path(__file__).parent/'candidate/packages/kernel/src/lib'
(r/'physical/ordinary-key-evidence.ts').write_text('''import type { StructuralEffect } from '../mutation-types';
import type { EntityPlacement } from './entity-placement-stage';

/** A key value is not a presence sentinel. Legacy malformed input can carry
 * null/undefined at runtime without granting authority to an absent subject. */
export function ordinaryAdmissionKey(
  effect: StructuralEffect | undefined,
  placement: EntityPlacement<string | number>
): string | number {
  if (effect) {
    const field = effect.kind === 'rekey' ? 'afterKey' : 'key';
    if (Object.prototype.hasOwnProperty.call(effect, field))
      return effect.kind === 'rekey' ? effect.afterKey : effect.key;
  }
  if (placement.present) return placement.key;
  throw new Error('Ordinary entity admission lacks a key');
}
''')
p=r/'entity-signal.ts';s=p.read_text();s="import { ordinaryAdmissionKey } from './physical/ordinary-key-evidence';\n"+s
s=s.replace('''      const physicalKey =
        ((effect?.kind === 'rekey' ? effect.beforeKey : effect?.key) as
          | K
          | undefined) ?? structuralStore.activeKeyForSubject(change.subject);
''','')
s=s.replace('''        const key =
          effect?.kind === 'rekey' ? (effect.afterKey as K) : physicalKey;
''','')
s=s.replace('''          if (key === undefined)
            throw new Error('Ordinary entity admission lacks a key');
''','''          // Source record or prepared placement proves presence independently
          // of the raw key value; do not replace an explicit nullish key.
          const key = ordinaryAdmissionKey(
            effect,
            physical.read(change.subject)
          ) as K;
''')
p.write_text(s)
(r/'physical/ordinary-key-evidence.spec.ts').write_text('''import { ordinaryAdmissionKey } from './ordinary-key-evidence';
import type { StructuralEffect } from '../mutation-types';
import { StructuralStore } from './structural-store';

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
'''.replace("import { StructuralStore } from './structural-store';\n",''))
