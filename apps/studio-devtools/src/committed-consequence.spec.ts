import {
  captureConfirmedTurns,
  createTreeIdentityRegistry,
} from '@signal-tree/studio-adapter';
import { createStudioSession } from '@signal-tree/studio-query';
import { describe, expect, it } from 'vitest';

import { committedConsequence, formatConsequence, transactionList } from './index';

/** End to end over the S1 vertical: kernel record shape -> adapter -> query -> UI. */
const session = () => {
  const s = createStudioSession();
  captureConfirmedTurns({
    session: s,
    identities: createTreeIdentityRegistry(),
    reader: {
      treeId: {},
      readConfirmedTurns: () => ({ retention: { truncated: false, firstAvailableTurnId: 31 }, turns: [
        {
          id: 31,
          positions: [1, 2, 3],
          effects: [
            { position: 1, path: 'cart.promoCode', ownerPath: 'cart', kind: 'set', before: null, after: 'SAVE20' },
            { position: 2, path: 'cart.discount', ownerPath: 'cart', kind: 'set', before: 0, after: 2400 },
            { position: 3, path: 'cart.total', ownerPath: 'cart', kind: 'set', before: 12000, after: 9600 },
          ],
        },
      ] }),
    },
  });
  return s;
};

describe('committed consequence view', () => {
  it('answers "what did this transaction cause state to become?"', () => {
    const turn = session().turns()[0];
    expect(turn).toBeDefined();

    const view = committedConsequence(turn!);
    expect(view.rows).toEqual([
      { path: 'cart.promoCode', before: 'null', after: '"SAVE20"' },
      { path: 'cart.discount', before: '0', after: '2400' },
      { path: 'cart.total', before: '12000', after: '9600' },
    ]);
  });

  it('lists transactions with how much each changed', () => {
    expect(transactionList(session())).toEqual([
      { treeId: 'tree-0001', id: 31, changed: 3 },
    ]);
  });

  /**
   * §22.1.11 — unsupported compositions are refused, never silently omitted. A
   * newcomer who trusts a confident partial answer is worse off than one who
   * got none, so the view states its own edges.
   */
  it('names what the slice did not observe rather than omitting it', () => {
    const view = committedConsequence(session().turns()[0]!);
    expect(view.notObserved.length).toBeGreaterThan(0);
    expect(view.notObserved.join(' ')).toContain('did not survive');
    expect(view.notObserved.join(' ')).toContain('restoration');
  });

  it('renders the panel body', () => {
    const text = formatConsequence(committedConsequence(session().turns()[0]!));
    expect(text).toContain('COMMITTED NET CONSEQUENCE');
    expect(text).toContain('cart.total');
    expect(text).toContain('12000 -> 9600');
    expect(text).toContain('NOT OBSERVED BY THIS SLICE');
  });
});
