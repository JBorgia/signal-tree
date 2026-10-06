import { describe, expect, it } from 'vitest';

import {
  checkRejection,
  generateRejection,
  random,
  type RejectionOp,
} from '../test-helpers/reversal-fuzz-harness';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Order-delta review of d27e55c8, item 3 (MAJOR, pre-existing): 735b8ccd
 * re-based later records only for rows the rejected transaction ADDED. Rows
 * it REMOVED come back with the rollback into orders the later records never
 * had them in; rows it added were the anchors of later rows even after later
 * reorders moved them; and two open transactions rejected one after another
 * compounded both. History threw ("collection order frontier does not match
 * the transition endpoint", "no live placement anchor") and undo/redo landed
 * elsewhere. Repaired:
 *
 *   - rows a rejection restored are HELD out of the order while records made
 *     before it reverse, and put back by the neighbours the rollback
 *     restored them next to (`HeldRow`): a function of the other rows'
 *     order, so undo, redo and jumpTo round-trip exactly;
 *   - an anchor that is a row an open transaction created records the rows
 *     beyond it (`AnchorChains`), read from the order when the record is
 *     made; a rejection follows the chain to the nearest surviving row, and
 *     prunes its rows from every chain;
 *   - a rollback's own compensation is never captured as later history: the
 *     declarative rollback (two or more rows, or an order change) wrote
 *     without `realized` and became a gap the history walk then reversed;
 *   - a token-only transition already settled by another capture of the
 *     same turn is dropped there, not kept as a stale start.
 *
 * The random sweep is the review's generator (`generateRejection`); scale it
 * with REJECTION_FUZZ_ITERATIONS / REJECTION_FUZZ_SEED.
 */
const configurations = {
  'transactions(), restoration()': () => [transactions(), restoration()],
  'restoration(), transactions()': () => [restoration(), transactions()],
};

const shapes: Array<
  [
    string,
    {
      tx: RejectionOp[];
      second?: RejectionOp[];
      later: RejectionOp[][];
    }
  ]
> = [
  [
    'removed a row, later reorder',
    { tx: [['rm', 'c']], later: [[['reorder']]] },
  ],
  [
    'removed two rows, later reorder (declarative compensation)',
    {
      tx: [
        ['rm', 'b'],
        ['rm', 'a'],
      ],
      later: [[['shuffle', 'a,d,b,c']]],
    },
  ],
  [
    'removed a row, later removal and add beside it',
    {
      tx: [['rm', 'c']],
      later: [
        [
          ['rm', 'd'],
          ['add', 'r0'],
        ],
      ],
    },
  ],
  [
    'removed a row, later reorder and adds around it',
    {
      tx: [['rm', 'a']],
      later: [
        [
          ['shuffle', 'b,a,c,d'],
          ['add', 'r0'],
        ],
        [['add', 'r1']],
        [['rm', 'r1'], ['reorder']],
      ],
    },
  ],
  [
    'added a row a later reorder moved, later removal anchored to it',
    {
      tx: [['add', 'r0']],
      later: [
        [['shuffle', 'c,r0,b,d,a']],
        [
          ['add', 'r1'],
          ['rm', 'c'],
        ],
      ],
    },
  ],
  [
    'added two rows, later reorder, later add anchored to them',
    {
      tx: [
        ['add', 'r0'],
        ['add', 'r1'],
      ],
      later: [[['shuffle', 'a,d,c,b,r0,r1']], [['add', 'r2']]],
    },
  ],
  [
    'renamed and removed, later adds and a reorder',
    {
      tx: [
        ['rename', 'a', 'r0'],
        ['rm', 'r0'],
      ],
      later: [
        [
          ['add', 'r1'],
          ['add', 'r2'],
        ],
        [['rm', 'b'], ['reorder']],
      ],
    },
  ],
  [
    'renamed, later add and removal beside it',
    { tx: [['rename', 'b', 'r0']], later: [[['add', 'r1']], [['rm', 'c']]] },
  ],
  [
    'mixed: added, removed and added, later reorder',
    {
      tx: [
        ['add', 'r0'],
        ['rm', 'a'],
        ['add', 'r1'],
      ],
      later: [
        [
          ['shuffle', 'd,a,r0,r1,c,b'],
          ['rm', 'r1'],
        ],
        [['reorder'], ['reorder']],
      ],
    },
  ],
  [
    'removed two rows, later turns whose reorders cancel',
    {
      tx: [
        ['rm', 'b'],
        ['rm', 'c'],
      ],
      later: [
        [['shuffle', 'd,a,b,c'], ['reorder']],
        [['shuffle', 'c,d,a,b']],
        [
          ['shuffle', 'a,c,b,d'],
          ['shuffle', 'c,b,d,a'],
        ],
      ],
    },
  ],
  [
    'two open transactions, later work anchored to both',
    {
      tx: [['add', 'r0']],
      second: [
        ['rm', 'd'],
        ['add', 'r1'],
      ],
      later: [
        [['add', 'r2']],
        [['shuffle', 'r0,a,b,c,r2,d,r1']],
        [['shuffle', 'r1,a,b,d,c,r2,r0']],
      ],
    },
  ],
];

describe.each(Object.entries(configurations))(
  'a rejected transaction under later work, every direction (%s)',
  (_name, enhancers) => {
    it.each(shapes)('%s', async (_case, scenario) => {
      expect(await checkRejection(enhancers, scenario)).toBe('ok');
    });

    const iterations = Number(process.env['REJECTION_FUZZ_ITERATIONS'] ?? 40);
    const seed = Number(process.env['REJECTION_FUZZ_SEED'] ?? 1);
    it(`${iterations} random scenarios: no throw, no wrong state`, async () => {
      const next = random(seed);
      const failures: string[] = [];
      for (let at = 0; at < iterations; at++) {
        const scenario = generateRejection(next);
        const result = await checkRejection(enhancers, scenario);
        if (result !== 'ok' && !result.startsWith('refused:')) {
          failures.push(`${JSON.stringify(scenario)} => ${result}`);
        }
      }
      expect(failures).toStrictEqual([]);
    }, 300_000);
  }
);
