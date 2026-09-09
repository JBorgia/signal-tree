import { createStudioSession } from '@signal-tree/studio-query';
import { describe, expect, it } from 'vitest';

import {
  captureConfirmedTurns,
  createTreeIdentityRegistry,
  type ConfirmedTurnReader,
} from './index';

/** The frozen Cart 88213 promo transaction, in kernel record shape. */
const promoReader = (runtimeTreeId: unknown): ConfirmedTurnReader => ({
  treeId: runtimeTreeId,
  readConfirmedTurns: () => [
    {
      id: 31,
      positions: [1, 2, 3],
      effects: [
        { position: 1, path: 'cart.promoCode', ownerPath: 'cart', kind: 'set', before: null, after: 'SAVE20' },
        { position: 2, path: 'cart.discount', ownerPath: 'cart', kind: 'set', before: 0, after: 2400 },
        { position: 3, path: 'cart.total', ownerPath: 'cart', kind: 'set', before: 12000, after: 9600 },
      ],
    },
  ],
});

describe('captureConfirmedTurns', () => {
  it('normalizes a committed transaction into addressed net effects', () => {
    const session = createStudioSession();
    const identities = createTreeIdentityRegistry();

    expect(captureConfirmedTurns({ reader: promoReader({}), session, identities })).toBe(1);

    const [turn] = session.turns();
    expect(turn?.disposition).toBe('committed');
    expect(turn?.participants).toEqual([1, 2, 3]);
    expect(turn?.effects.map((e) => [e.path, e.before, e.after])).toEqual([
      ['cart.promoCode', null, 'SAVE20'],
      ['cart.discount', 0, 2400],
      ['cart.total', 12000, 9600],
    ]);
  });

  it('is idempotent — re-reading the same retained history adds nothing', () => {
    const session = createStudioSession();
    const identities = createTreeIdentityRegistry();
    const reader = promoReader({});

    expect(captureConfirmedTurns({ reader, session, identities })).toBe(1);
    expect(captureConfirmedTurns({ reader, session, identities })).toBe(0);
    expect(session.turns()).toHaveLength(1);
  });

  /**
   * Two live trees each have a turn 31 whose effects own positions 1..3.
   * Keying on the kernel id alone merges them — the NOTIFIER-SCOPE-0 bug,
   * reproduced inside the inspector.
   */
  it('keeps two trees separate when their turn and position ids collide', () => {
    const session = createStudioSession();
    const identities = createTreeIdentityRegistry();

    captureConfirmedTurns({ reader: promoReader({}), session, identities });
    captureConfirmedTurns({ reader: promoReader({}), session, identities });

    expect(session.turns()).toHaveLength(2);
    expect(session.trees()).toEqual(['tree-0001', 'tree-0002']);
  });

  it('assigns a stable session id per runtime tree, and never leaks the runtime one', () => {
    const identities = createTreeIdentityRegistry();
    const runtime = {};

    const first = identities.assign(runtime);
    expect(identities.assign(runtime)).toBe(first);
    expect(identities.size()).toBe(1);
    // Session ids are serializable strings; the runtime identity is not.
    expect(typeof first).toBe('string');
    expect(JSON.parse(JSON.stringify({ treeId: first })).treeId).toBe(first);
  });

  it('carries the structural kind as a fact rather than inferring it', () => {
    const session = createStudioSession();
    captureConfirmedTurns({
      session,
      identities: createTreeIdentityRegistry(),
      reader: {
        treeId: {},
        readConfirmedTurns: () => [
          {
            id: 1,
            positions: [4],
            effects: [
              { position: 4, path: 'rows.A', ownerPath: 'rows', kind: 'remove', before: 'A', after: undefined, subject: 1 },
            ],
          },
        ],
      },
    });

    expect(session.turns()[0]?.effects[0]?.structural).toBe('remove');
    expect(session.turns()[0]?.effects[0]?.subjectId).toBe(1);
  });
});
