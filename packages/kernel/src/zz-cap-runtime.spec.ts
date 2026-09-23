import { describe, expect, it } from 'vitest';
import { signalTree } from './lib/signal-tree';
import { transact } from './lib/transact';
import { propose } from './lib/propose';

describe('CAPABILITY-SURFACE-0 arm B — runtime failure', () => {
  it('fails explicitly, not silently, without the enhancer', () => {
    const tree = signalTree({ x: 0 }) as never;
    expect(() => transact(tree, () => undefined)).toThrow(
      /requires the transactions\(\) enhancer/
    );
    expect(() => propose(tree, () => undefined)).toThrow(
      /requires the transactions\(\) enhancer/
    );
  });
});
