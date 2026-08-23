import { describe, expect, it } from 'vitest';
import { signalTree } from '../signal-tree';
import { security } from '../../security';
import { SecurityValidator } from './security-validator';

/**
 * SEC-0 — what would become impossible WITHOUT `./security`?
 *
 * The subpath's three protections are prototype pollution, XSS sanitisation and
 * blocking function values. This asks what core already does unaided.
 */
describe('SEC-0: core WITHOUT the security feature', () => {
  it('prototype pollution via a JSON-parsed __proto__ key', () => {
    const hostile = JSON.parse('{"a": 1, "__proto__": {"polluted": true}}');
    const tree = signalTree(hostile) as any;
    const snapshot = tree();
    console.log(`SEC0-PROTO keys=${JSON.stringify(Object.keys(snapshot))} objectPolluted=${({} as any).polluted === true}`);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('a literal constructor / prototype key', () => {
    const tree = signalTree({ a: 1, constructor: 'x', prototype: 'y' } as any) as any;
    console.log(`SEC0-KEYS snapshot=${JSON.stringify(Object.keys(tree()))}`);
    expect(true).toBe(true);
  });

  it('a function value in state', () => {
    let threw = 'none';
    try {
      const tree = signalTree({ fn: () => 1, a: 1 } as any) as any;
      console.log(`SEC0-FN accepted, snapshotKeys=${JSON.stringify(Object.keys(tree()))}`);
    } catch (e) { threw = (e as Error).message.slice(0, 70); }
    console.log(`SEC0-FN threw="${threw}"`);
    expect(true).toBe(true);
  });

  it('an XSS-shaped string value is stored verbatim', () => {
    const tree = signalTree({ bio: '<script>alert(1)</script>' }) as unknown as {
      (): { bio: string };
    };
    expect(tree().bio).toBe('<script>alert(1)</script>');
  });
});

/**
 * ⚠️ PINS A LIVE DEFECT. `security({ preventXSS: true })` advertises XSS
 * protection and provides NONE.
 *
 * `SecurityValidator.validateValue()` RETURNS a sanitised string, and the
 * `security()` walk in `src/security.ts` calls it for its throw behaviour and
 * discards the return value. The walk also runs only at construction, so a
 * later write is never examined at all.
 *
 * This is worse than a no-op: a consumer who enables it may reasonably believe
 * stored values are sanitised. Recorded rather than fixed, because SEC-0
 * concluded the boundary itself is wrong — sanitising on the way INTO state
 * corrupts data and does not protect the rendering sink, which is where XSS is
 * actually decided and which Angular already escapes.
 */
describe('SEC-0: preventXSS is inert through the public feature', () => {
  it('the validator sanitises when called directly', () => {
    const validator = new SecurityValidator({
      preventXSS: true,
      sanitizationMode: 'strict',
    });
    expect(validator.validateValue('<script>alert(1)</script>hi')).toBe('hi');
  });

  it('but the tree stores the UNSANITISED value at construction', () => {
    const tree = signalTree(
      { bio: '<script>alert(1)</script>hi' },
      { security: security({ preventXSS: true, sanitizationMode: 'strict' }) }
    ) as unknown as { (): { bio: string } };
    expect(tree().bio).toBe('<script>alert(1)</script>hi');
  });

  it('and never examines a post-construction write', () => {
    const tree = signalTree(
      { bio: 'clean' },
      { security: security({ preventXSS: true, sanitizationMode: 'strict' }) }
    ) as unknown as { (): { bio: string }; $: { bio: { set(v: string): void } } };
    tree.$.bio.set('<script>alert(1)</script>later');
    expect(tree().bio).toBe('<script>alert(1)</script>later');
  });

  it('meanwhile it REJECTS a legitimate key named constructor', () => {
    expect(() =>
      signalTree({ constructor: 'Acme Constructor Co' } as never, {
        security: security({ preventPrototypePollution: true }),
      })
    ).toThrow(/Dangerous key "constructor"/);
  });
});
