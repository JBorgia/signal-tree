import { TransferState, makeStateKey } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

type Row = { id: number; name: string };
type TransferPayload = {
  user: { name: string; role: string };
  rows: { all: Row[] };
  counter: number;
};
const KEY = makeStateKey<string>('signaltree');

// JSON and schema validation belong to the application. This recipe transfers
// the application's known plain-data shape, then initializes a fresh tree through
// the Angular facade. Entity declarations are constructed, never serialized.
const makeTree = (payload?: TransferPayload) => {
  const tree = signalTree({
    user: payload?.user ?? { name: '', role: '' },
    rows: entityMap<Row, number>({ selectId: (row) => row.id }),
    counter: payload?.counter ?? 0,
  });
  if (payload) tree.$.rows.setAll(payload.rows.all);
  return tree;
};

const fromTransferState = (state: TransferState) =>
  makeTree(JSON.parse(state.get(KEY, '{}')) as TransferPayload);

describe('C3 — server snapshot → TransferState → client initialization', () => {
  it('round-trips plain state across two independent trees', () => {
    const server = makeTree();
    const state = new TransferState();
    server.$.user.name.set('Ada');
    server.$.counter.set(7);
    state.set(KEY, JSON.stringify(server.$()));

    const client = fromTransferState(state);
    try {
      expect(client.$.user.name()).toBe('Ada');
      expect(client.$.counter()).toBe(7);
      client.$.user.name.set('Grace');
      expect(server.$.user.name()).toBe('Ada');
    } finally {
      client.destroy();
      server.destroy();
    }
  });

  it('initializes an entityMap collection from the transferred rows', () => {
    const server = makeTree();
    const state = new TransferState();
    server.$.rows.setAll([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
    state.set(KEY, JSON.stringify(server.$()));

    const client = fromTransferState(state);
    try {
      expect(client.$.rows.all()).toEqual(server.$.rows.all());
      expect(client.$.rows.ids()).toEqual([1, 2]);
    } finally {
      client.destroy();
      server.destroy();
    }
  });

  it('produces plain JSON containing materialized values only', () => {
    const server = makeTree();
    try {
      server.$.user.name.set('Ada');
      const json = JSON.stringify(server.$());
      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual({
        user: { name: 'Ada', role: '' },
        rows: { all: [] },
        counter: 0,
      });
    } finally {
      server.destroy();
    }
  });
});
