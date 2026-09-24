import { TransferState, makeStateKey } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree } from '../index';

type Row = { id: number; name: string };
const KEY = makeStateKey<string>('signaltree');
const makeTree = () =>
  signalTree({
    user: { name: '', role: '' },
    rows: entityMap<Row, number>(),
    counter: 0,
  });

// Application JSON policy, no internal codec or cross-framework import.
describe('C3 — server → TransferState → public Link → client', () => {
  it('round-trips plain state across two independent trees', async () => {
    const server = makeTree();
    const client = makeTree();
    server.$.user.name.set('Ada');
    server.$.counter.set(7);
    const ts = new TransferState();
    ts.set(KEY, JSON.stringify(server.$()));
    const payload = JSON.parse(ts.get(KEY, '{}')) as {
      user: { name: string; role: string };
      counter: number;
    };
    const user = link(client.$.user, { get: () => payload.user });
    const counter = link(client.$.counter, { get: () => payload.counter });
    try {
      await user.retrieve();
      await counter.retrieve();
      expect(client.$.user.name()).toBe('Ada');
      expect(client.$.counter()).toBe(7);
    } finally {
      user.dispose();
      counter.dispose();
      client.destroy();
      server.destroy();
    }
  });
  it('carries an entityMap collection across the boundary', async () => {
    const server = makeTree();
    const client = makeTree();
    server.$.rows.setAll([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
    const payload = JSON.parse(JSON.stringify(server.$())) as {
      rows: { all: Row[] };
    };
    const connection = link(client.$.rows, { get: () => payload.rows.all });
    try {
      await connection.retrieve();
      expect(client.$.rows.all().map((r) => r.name)).toEqual(['a', 'b']);
    } finally {
      connection.dispose();
      client.destroy();
      server.destroy();
    }
  });
  it('the application payload is a plain JSON string TransferState can hold', () => {
    const server = makeTree();
    try {
      server.$.user.name.set('Ada');
      const json = JSON.stringify(server.$());
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    } finally {
      server.destroy();
    }
  });
});
