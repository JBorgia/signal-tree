import { describe, expect, it } from 'vitest';

import { checkRollback, type Op } from '../test-helpers/reversal-fuzz-harness';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * A changeId after another row's structural change (or another changeId) in
 * the same transaction: rollback put every row back but left the renamed
 * KEY in place, silently (npm 15.4.3 and every 15.4.4 commit before this).
 * The pending-rollback plan kept only the first effect per collection for
 * effects without a field address, a rule meant for plain values, so a rekey
 * that followed an add, a remove or another rekey on the collection was
 * dropped. The differential fuzz found it once its oracle compared keys as
 * well as rows.
 */
const shapes: Array<[string, Op[]]> = [
  [
    'addOne, then changeId',
    [
      ['add', 'x'],
      ['rename', 'b', 'r0'],
    ],
  ],
  [
    'addMany, then changeId',
    [
      ['addMany', 'x', 'y'],
      ['rename', 'b', 'r0'],
    ],
  ],
  [
    'prependOne, then changeId',
    [
      ['pre', 'x'],
      ['rename', 'd', 'r0'],
    ],
  ],
  [
    'removeOne, then changeId',
    [
      ['rm', 'e'],
      ['rename', 'b', 'r0'],
    ],
  ],
  [
    'two changeIds',
    [
      ['rename', 'a', 'r0'],
      ['rename', 'b', 'r1'],
    ],
  ],
  [
    'changeId, addOne, changeId',
    [
      ['rename', 'a', 'r0'],
      ['add', 'x'],
      ['rename', 'c', 'r1'],
    ],
  ],
];

describe.each([
  ['transactions()', () => [transactions()]],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const)('rollback restores renamed keys (%s)', (_name, enhancers) => {
  it.each(shapes)('%s', async (_case, ops) => {
    expect(await checkRollback(enhancers, ops)).toBe('ok');
  });
});
