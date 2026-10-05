import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signalTree, transactions } from '@signal-tree/kernel';
import { useSignalTree } from './use-signal-tree';

/**
 * PLAIN-MEMBER ABSENCE OBSERVATION — React realization.
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *
 * Kernel carrier: `packages/kernel/src/lib/plain-member-absence-observation.spec.ts`.
 * React rereads selectors on owner invalidation, so a direct leaf selector was
 * already correct. A selector over a kernel-DERIVED location (the tree's
 * `derived` option) was not: without `position-topology` the removed leaf's
 * token was never published, the derived kept the retained value, and the
 * rerender showed it. The position-topology and `transactions()`
 * configurations are the reference.
 */

const settleKernel = async (): Promise<void> => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

type Person = { name: string; age?: number };
type View = {
  readonly p: { (): Person; (value: Person): void; age(): number | undefined };
  readonly ageView: () => number | undefined;
};

const CONFIGURATIONS = [
  ['no enhancers', () => ({})],
  [
    'position-topology capability',
    () => ({ capabilities: ['position-topology'] }),
  ],
  ['transactions()', () => ({ enhancers: [transactions()] })],
] as const;

describe.each(CONFIGURATIONS)(
  'plain-member absence observation — React (%s)',
  (label, options) => {
    it('a membership-only removal and re-add reach direct, derived and branch selectors', async () => {
      const tree = signalTree({ p: { name: 'a', age: 1 } as Person }, {
        ...options(),
        derived: ($: { p: { age: () => number | undefined } }) => ({
          ageView: () => $.p.age(),
        }),
      } as never);
      const owner = tree as unknown as {
        readonly $: View;
        readonly destroyed: () => boolean;
      };

      function Person() {
        const direct = useSignalTree(owner, ($) => String($.p.age()));
        const derived = useSignalTree(owner, ($) => String($.ageView()));
        const branch = useSignalTree(owner, ($) => JSON.stringify($.p()));
        return (
          <output
            data-testid={label}
          >{`${direct}|${derived}|${branch}`}</output>
        );
      }

      try {
        render(<Person />);
        expect(screen.getByTestId(label).textContent).toBe(
          '1|1|{"name":"a","age":1}'
        );

        await act(async () => {
          owner.$.p({ name: 'a' });
          await settleKernel();
        });
        expect(screen.getByTestId(label).textContent).toBe(
          'undefined|undefined|{"name":"a"}'
        );

        await act(async () => {
          owner.$.p({ name: 'a', age: 1 });
          await settleKernel();
        });
        expect(screen.getByTestId(label).textContent).toBe(
          '1|1|{"name":"a","age":1}'
        );
      } finally {
        tree.destroy();
      }
    });
  }
);
