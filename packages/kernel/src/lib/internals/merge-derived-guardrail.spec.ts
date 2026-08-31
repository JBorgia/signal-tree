import { describe, expect, it, vi } from 'vitest';

import { signalTree } from '../../index';

describe('[ST2007] derived value dropped — dev-mode guardrail', () => {
  it('warns generically for a plainly invalid derived value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const tree = signalTree(
        { w: { n: 1 } },
        {
          derived: () => ({
            w: { bad: 42 as never },
          }),
        }
      );
      // Touch `$` so markers materialize and the derived queue is applied.
      expect(tree.$.w).toBeDefined();
      const hit = warn.mock.calls
        .map((c) => String(c[0]))
        .find((m) => m.includes('ST2007'));
      expect(hit).toBeDefined();
      expect(hit).toContain('could not be realized by this tree');
    } finally {
      warn.mockRestore();
    }
  });

  it('does NOT warn for a computation recipe', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const t = signalTree(
        { w: { ids: ['a'] } },
        {
          derived: ($) => ({
            w: { count: () => $.w.ids().length },
          }),
        }
      );
      expect(t.$.w.count()).toBe(1);
      expect(
        warn.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('ST2007'))
      ).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
