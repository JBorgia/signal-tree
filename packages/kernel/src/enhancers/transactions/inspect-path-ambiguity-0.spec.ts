import { describe, expect, it } from 'vitest';

import { external } from '../../lib/external';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * Independent check of the one claim that speaks to a HUMAN: does
 * `proposal.inspect()` truthfully identify what an agent changed?
 *
 * MEASURED 2026-09-24, independently of docs/audits/2026-09-23-proposal-path.md.
 * The answer is no, and this pins it as a characterization rather than a fix:
 * the public projection cannot distinguish a literal key 'a.b' from the nested
 * path a.b, so a reviewer cannot tell which current value a status belongs to.
 *
 * This is the product-facing surface. Every other defect found in this
 * subsystem misreports state to CODE; this one misreports it to a HUMAN who is
 * being asked to approve an agent's work. Recorded, not repaired — the fix is
 * a lossless public address, which is an architecture decision.
 */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('inspect() path ambiguity', () => {
  it('a literal key and a nested path project to the same public path', async () => {
    const observe = async (target: 'literal' | 'nested') => {
      const tree = signalTree(
        { 'a.b': 0, a: { b: 0 } },
        { enhancers: [transactions()] }
      ) as never as {
        $: Record<string, never> & (() => unknown);
        propose: (fn: () => void) => {
          inspect(): { changes: { path: string; status: string }[] };
          reject(): void;
        };
        destroy(): void;
      };
      try {
        const t = tree as never as {
          $: {
            (): unknown;
            'a.b': (v?: number) => number;
            a: { b: (v?: number) => number };
          };
          propose: (fn: () => void) => {
            inspect(): { changes: { path: string; status: string }[] };
            reject(): void;
          };
          destroy(): void;
        };
        const proposal = t.propose(() => {
          if (target === 'literal') t.$['a.b'](1);
          else t.$.a.b(2);
        });
        external(() => {
          if (target === 'literal') t.$.a.b(2);
          else t.$['a.b'](1);
        });
        await flush();
        const inspection = proposal.inspect();
        return inspection.changes.map((c) => `${c.path}=${c.status}`);
      } finally {
        tree.destroy();
      }
    };

    const literal = await observe('literal');
    const nested = await observe('nested');

    console.log('[inspect] proposal wrote LITERAL key :', literal);
    console.log('[inspect] proposal wrote NESTED path :', nested);

    // Two DIFFERENT proposals, touching two DIFFERENT locations, each with a
    // different concurrent external writer.
    //
    // MEASURED: both project to exactly [ 'a.b=current' ]. A reviewer cannot
    // tell which value the status belongs to, and in one of the two cases the
    // value at the path they would read is the EXTERNAL writer's, not the
    // agent's. Pinned so a future lossless address makes this case fail and
    // demand re-characterization.
    expect(literal).toEqual(['a.b=current']);
    expect(nested).toEqual(['a.b=current']);
    expect(literal).toEqual(nested);
  });
});
