import { describe, expect, it } from 'vitest';
import { markMetaDesignated } from './restoration-eligibility';

describe('restoration designation metadata', () => {
  it('preserves enumerable internal evidence without materializing absent metadata', () => {
    const evidenceKey = Symbol('evidence');
    const hiddenKey = Symbol('hidden');
    const absentKey = Symbol('absent');
    const evidence = { present: false };
    const meta = {
      origin: undefined,
      [evidenceKey]: evidence,
      [absentKey]: undefined,
    };
    Object.defineProperty(meta, hiddenKey, {
      value: 'private',
      enumerable: false,
    });
    const stamped = markMetaDesignated(meta);
    expect(Reflect.get(stamped, evidenceKey)).toBe(evidence);
    expect(Object.prototype.hasOwnProperty.call(stamped, 'origin')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(stamped, absentKey)).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(stamped, hiddenKey)).toBe(false);
    expect(Reflect.get(stamped, 'restorationDesignated')).toBe(true);
  });
});
