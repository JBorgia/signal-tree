import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEnhancer } from '../enhancers';
import { signalTree } from './signal-tree';

/**
 * The three kernel messages that survived the deletion of
 * `SIGNAL_TREE_MESSAGES` (15.4). The table held 29 entries; these are the only
 * three that anything could emit, and they are pinned byte for byte here so
 * that inlining them cannot drift a code a user greps for.
 */
describe('surviving kernel messages', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ST1001 — a null or undefined initial state throws the exact message', () => {
    expect(() => signalTree(null as unknown as object)).toThrow(
      new Error('null/undefined [ST1001]')
    );
    expect(() => signalTree(undefined as unknown as object)).toThrow(
      new Error('null/undefined [ST1001]')
    );
  });

  it('ST1012 — destroy() under debugMode logs the exact message once', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const tree = signalTree({ count: 0 }, { debugMode: true });
    tree.destroy();
    tree.destroy();
    expect(log.mock.calls).toEqual([['destroyed [ST1012]']]);
  });

  it('ST1012 — destroy() without debugMode logs nothing', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    signalTree({ count: 0 }).destroy();
    expect(log).not.toHaveBeenCalled();
  });

  it('ST1024 — an enhancer cycle under debugMode warns the exact message and keeps declared order', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const applied: string[] = [];
    const a = createEnhancer(
      { name: 'cycle-a', provides: ['a'], requires: ['b'] },
      (tree) => {
        applied.push('a');
        return tree;
      }
    );
    const b = createEnhancer(
      { name: 'cycle-b', provides: ['b'], requires: ['a'] },
      (tree) => {
        applied.push('b');
        return tree;
      }
    );
    signalTree({ count: 0 }, { enhancers: [a, b], debugMode: true }).destroy();
    expect(warn.mock.calls).toEqual([['enhancer cycle [ST1024]']]);
    expect(applied).toEqual(['a', 'b']);
  });
});
