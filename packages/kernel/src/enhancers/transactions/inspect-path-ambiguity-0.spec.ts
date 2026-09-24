import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { external } from '../../lib/external';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * Independent check of the one claim that speaks to a HUMAN: does
 * `proposal.inspect()` truthfully identify what an agent changed?
 *
 * MEASURED 2026-09-24, independently of docs/audits/2026-09-23-proposal-path.md.
 * Originally the answer was NO and this file pinned the ambiguity. It is now
 * the proof of the fix: `path` stays ambiguous by design because it is
 * presentation, and `address` carries lossless typed segments (L17).
 *
 * Original characterization, retained so the defect is not forgotten:
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
        return {
          byPath: inspection.changes.map((c) => `${c.path}=${c.status}`),
          byAddress: inspection.changes.map(
            (c) =>
              `${JSON.stringify(
                (c as unknown as { address?: readonly string[] }).address
              )}=${c.status}`
          ),
        };
      } finally {
        tree.destroy();
      }
    };

    const literal = await observe('literal');
    const nested = await observe('nested');

    console.log('[inspect] LITERAL path :', literal.byPath, 'addr:', literal.byAddress);
    console.log('[inspect] NESTED  path :', nested.byPath, 'addr:', nested.byAddress);

    // Two DIFFERENT proposals, touching two DIFFERENT locations, each with a
    // different concurrent external writer.
    //
    // MEASURED: both project to exactly [ 'a.b=current' ]. A reviewer cannot
    // tell which value the status belongs to, and in one of the two cases the
    // value at the path they would read is the EXTERNAL writer's, not the
    // agent's. Pinned so a future lossless address makes this case fail and
    // demand re-characterization.
    // The dotted STRING still collides — that is what makes it presentation.
    expect(literal.byPath).toEqual(['a.b=current']);
    expect(nested.byPath).toEqual(['a.b=current']);
    expect(literal.byPath).toEqual(nested.byPath);

    // The structured ADDRESS must not. A literal key is one segment; a nested
    // path is two. This is what lets a reviewer be told the truth about which
    // location an agent changed.
    expect(literal.byAddress).not.toEqual(nested.byAddress);
    expect(literal.byAddress).toEqual(['["a.b"]=current']);
    expect(nested.byAddress).toEqual(['["a","b"]=current']);
  });
});

describe('inspect() address — the ENTITY-FIELD case is NOT yet lossless', () => {
  /**
   * The root-level fix above is real: a literal key and a nested path now read
   * differently. Inside an ENTITY ROW they do not.
   *
   * A row with both a literal `'n.a'` field and a nested `n: { a }` produces two
   * changes whose address is the COLLECTION position and whose subject is the
   * same row, so address + subject cannot tell them apart. Only `path` does,
   * and `path` is the thing that is explicitly not identity.
   *
   * Pinned as a known gap rather than left implied-fixed. Closing it needs the
   * field segments WITHIN a subject, which the effect does not currently carry
   * structurally — the relative part of `rows.A.n.a` is still a flattened
   * string. That is the same L17 work one level down, and it belongs with the
   * ownership model rather than bolted on here.
   */
  it('a literal and a nested entity field share address and subject', async () => {
    type Row = { id: string; 'n.a': number; n: { a: number } };
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    ) as never as {
      $: { rows: { addOne(r: Row): void; updateOne(id: string, p: unknown): void } };
      propose: (fn: () => void) => {
        inspect(): {
          changes: {
            path: string;
            address?: readonly string[];
            subject?: number;
          }[];
        };
      };
      destroy(): void;
    };
    try {
      tree.$.rows.addOne({ id: 'A', 'n.a': 0, n: { a: 0 } });
      await flush();
      const proposal = tree.propose(() => {
        tree.$.rows.updateOne('A', { 'n.a': 1, n: { a: 1 } });
      });
      await flush();

      const changes = proposal.inspect().changes;
      const keys = changes.map(
        (c) => `${JSON.stringify(c.address)}#${String(c.subject)}`
      );
      console.log('[entity-addr]', JSON.stringify(changes));

      // MEASURED: identical identity for two genuinely different locations.
      // When this starts failing, the entity-field address became lossless and
      // this case should be rewritten as the proof rather than the gap.
      expect(new Set(keys).size).toBe(1);
      expect(changes.map((c) => c.path)).toEqual(['rows.A.n.a', 'rows.A.n']);
    } finally {
      tree.destroy();
    }
  });
});
