/**
 * ENHANCER METADATA AUTHORITY — the frozen contract.
 *
 * Every concept has exactly one semantic owner:
 *
 *   name                      enhancer IDENTITY — duplicate detection, diagnostics
 *   provides: string[]        CAPABILITY TOKENS this enhancer satisfies
 *   requires: string[]        CAPABILITY TOKENS that must be satisfied
 *   capabilities: TreeCapability[]
 *                             tree SUBSTRATE requirements (`buildTreePlan`) —
 *                             a separate axis. Do NOT merge it with `provides`
 *                             just because both say "capability": one answers
 *                             "what enhancer-level prerequisite do I satisfy?",
 *                             the other "what physical runtime substrate must
 *                             exist?".
 *
 * Both mechanisms that read `requires` answer the SAME question:
 *
 *     requires.every((req) => providedCapabilities.has(req))
 *
 * `resolveEnhancerOrder` uses that relation to ORDER; configuration validation
 * uses it to ENFORCE, fail-closed. Neither translates `requires` through `name`.
 *
 * WHAT THIS REPLACED. A requirement used to be satisfiable only when the
 * provider was BOTH named `x` AND declared `provides: ['x']` — the sorter
 * matched capabilities, the guard matched names, and only their accidental
 * intersection worked. Every built-in happens to declare `name === provides[0]`,
 * so nothing in-repo failed; meanwhile two of the three DOCUMENTED authoring
 * examples could not work.
 *
 * DO NOT "FIX" A FAILURE HERE WITH A NAME FALLBACK. Writing
 * `provided.has(req) || appliedNames.has(req)` restores the ambiguity instead
 * of resolving it, and case 3 below exists specifically to fail if you do.
 *
 * ⚠️ WHAT CHANGED IN v15. Enhancers are declared up front, so validation moved
 * from "each `.with()` call, against what has been applied so far" to "the
 * whole configuration, once, before anything is built". Two consequences are
 * pinned below: declaration ORDER no longer matters, and every problem is
 * reported together rather than one construction error at a time.
 */
import { describe, expect, it } from 'vitest';

import { createEnhancer } from '../enhancers/index';
import { signalTree } from './signal-tree';

/** An enhancer that records when it runs and adds nothing. */
function tracer(meta: Record<string, unknown>, log: string[]) {
  return createEnhancer(meta as never, <TTree>(tree: TTree): TTree => {
    log.push(String(meta['name'] ?? 'anonymous'));
    return tree;
  });
}

describe('enhancer metadata authority', () => {
  it('1. the pre-existing convention still works (name === provides[0])', () => {
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'batching', provides: ['batching'] }, log) as never,
            tracer({ name: 'consumer', requires: ['batching'] }, log) as never,
          ],
        }
      )
    ).not.toThrow();
    expect(log).toEqual(['batching', 'consumer']);
  });

  it('2. a capability satisfies a requirement even when name !== provides', () => {
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'anything', provides: ['storage'] }, log) as never,
            tracer({ name: 'consumer', requires: ['storage'] }, log) as never,
          ],
        }
      )
    ).not.toThrow();
    expect(log).toEqual(['anything', 'consumer']);
  });

  it('3. IDENTITY ALONE DOES NOT SATISFY A REQUIREMENT — no name fallback', () => {
    const log: string[] = [];
    // `storage` is a NAME here, not a provided capability. A name fallback
    // would make this pass, which is exactly the ambiguity being refused.
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'storage' }, log) as never,
            tracer({ name: 'consumer', requires: ['storage'] }, log) as never,
          ],
        }
      )
    ).toThrow(/requires capability "storage"/);
    expect(log).toEqual([]);
  });

  it('4. a SECONDARY capability satisfies a requirement (the persistence shape)', () => {
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer(
              { name: 'persistence', provides: ['persistence', 'serialization'] },
              log
            ) as never,
            tracer({ name: 'consumer', requires: ['serialization'] }, log) as never,
          ],
        }
      )
    ).not.toThrow();
    expect(log).toEqual(['persistence', 'consumer']);
  });

  it('5. an unsatisfied requirement fails CLOSED before ANY enhancer runs', () => {
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'harmless' }, log) as never,
            tracer({ name: 'consumer', requires: ['absent'] }, log) as never,
          ],
        }
      )
    ).toThrow(/requires capability "absent"/);
    // Validation precedes construction, so even the satisfiable enhancer in the
    // same configuration never ran.
    expect(log).toEqual([]);
  });

  it('6. duplicate detection is by NAME and independent of capabilities', () => {
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'dup', provides: ['a'] }, log) as never,
            tracer({ name: 'dup', provides: ['b'] }, log) as never,
          ],
        }
      )
    ).toThrow(/"dup" is configured 2 times/);
  });

  it('DECLARATION ORDER DOES NOT MATTER — the consumer may be listed first', () => {
    // Under the chained builder this was an error: `.with()` validated against
    // enhancers applied so far, so typing the consumer first failed even though
    // the configuration was satisfiable. The whole set is known now, so the
    // requirement resolves and the ordering pass runs the provider first.
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'consumer', requires: ['late-cap'] }, log) as never,
            tracer({ name: 'provider', provides: ['late-cap'] }, log) as never,
          ],
        }
      )
    ).not.toThrow();
    expect(log).toEqual(['provider', 'consumer']);
  });

  it('reports EVERY unsatisfied requirement in one failure', () => {
    // A configuration is a set, so its failures are a set. Fixing them one
    // construction error at a time is a worse loop than seeing all of them.
    const log: string[] = [];
    let message = '';
    try {
      signalTree(
        { count: 0 },
        {
          enhancers: [
            tracer({ name: 'alpha', requires: ['missing-one'] }, log) as never,
            tracer({ name: 'beta', requires: ['missing-two'] }, log) as never,
          ],
        }
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('missing-one');
    expect(message).toContain('missing-two');
  });

  it('a THROWING enhancer aborts construction and contributes nothing', () => {
    const log: string[] = [];
    const exploding = createEnhancer(
      { name: 'exploding', provides: ['exploded'] } as never,
      () => {
        throw new Error('enhancer body failed');
      }
    );

    expect(() =>
      signalTree({ count: 0 }, { enhancers: [exploding as never] })
    ).toThrow('enhancer body failed');
    expect(log).toEqual([]);
  });

  it('an ANONYMOUS enhancer still has its requirements validated', () => {
    // The eager guard once gated the whole check on `meta.name`, so an unnamed
    // enhancer's requirements were silently ignored.
    const log: string[] = [];
    expect(() =>
      signalTree(
        { count: 0 },
        { enhancers: [tracer({ requires: ['absent'] }, log) as never] }
      )
    ).toThrow(/an unnamed enhancer requires capability "absent"/);
  });
});
