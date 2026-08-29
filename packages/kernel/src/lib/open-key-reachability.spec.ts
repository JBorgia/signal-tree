import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';

/**
 * ⚠️ AN UNREACHABLE CAPABILITY IS A FALSE CLAIM, NOT A STALE DOC.
 *
 * The typing above compiles `open.$.rows['neverMaterialised']` as a descendant
 * location. At runtime it is `undefined`, and calling it throws
 * "loc is not a function" — measured. So the PUBLIC TYPE SURFACE currently
 * promises a capability the runtime cannot deliver, for every open-key object.
 *
 * That is stronger evidence than the whole-value `{b}` discard, because it needs
 * no assignment at all: merely reading the promised location fails.
 */
describe('open-key ownership — is the promise REACHABLE?', () => {
  it.fails('a promised arbitrary descendant is a usable location', () => {
    type R = { id: string; n: number };
    const tree = signalTree({ rows: { a: { id: 'a', n: 1 } } as Record<string, R> });

    const promised = tree.$.rows['neverMaterialised'];

    expect(typeof promised).toBe('function');
  });
});
