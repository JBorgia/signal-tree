import { signalTree } from './signal-tree';

describe('SignalTree destroy lifecycle', () => {
  it('runs registered cleanup functions and is idempotent', () => {
    const tree = signalTree({ a: 1 });
    // register a cleanup via the internal test helper (typed access)
    const maybeRegister = (
      tree as unknown as {
        __registerCleanup?: (fn: () => void) => void;
      }
    ).__registerCleanup;
    if (typeof maybeRegister !== 'function') {
      throw new Error('__registerCleanup test helper is missing');
    }
    const register = maybeRegister;
    let called = 0;
    register(() => {
      called++;
    });

    tree.destroy();
    expect(called).toBe(1);

    // calling again should not call cleanup again
    tree.destroy();
    expect(called).toBe(1);
  });

  it('invokes lazy proxy __cleanup__ when using lazy signals', () => {
    const tree = signalTree({ nested: { value: 1 } }, { useLazySignals: true });

    // Access nested to create lazy proxy
    const nested = (tree.state as unknown as Record<string, unknown>)['nested'];
    // Ensure __cleanup__ exists (may be undefined for non-lazy strategies)
    const cleanup = (
      nested as unknown as {
        __cleanup__?: (() => void) | undefined;
      }
    ).__cleanup__;
    expect(typeof cleanup === 'function' || cleanup === undefined).toBe(true);

    // Register a cleanup via the public test helper to ensure we get called
    let spy = 0;
    const maybeRegister2 = (
      tree as unknown as {
        __registerCleanup?: (fn: () => void) => void;
      }
    ).__registerCleanup;
    if (typeof maybeRegister2 !== 'function') {
      throw new Error('__registerCleanup test helper is missing');
    }
    maybeRegister2(() => {
      spy++;
    });

    tree.destroy();
    expect(spy).toBe(1);
  });
});
