import { TransferState, makeStateKey } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { entityMap } from './types';
import { signalTree } from './signal-tree';
import { serialization } from '../enhancers/serialization/serialization';
import { loader } from './markers/loader';

/**
 * C3 — can an Angular app move server-built state to the client TODAY?
 *
 * Not a theory about the gap: an attempt to write the recipe with what ships.
 * SSR is exactly two trees in two processes, so it is simulated honestly here —
 * a SERVER tree that is populated and serialised, and a separate CLIENT tree,
 * freshly constructed, that must come up holding the same state. Nothing is
 * shared between them but a string, which is all `TransferState` carries.
 */
type Row = { id: number; name: string };
const KEY = makeStateKey<string>('signaltree');

const makeTree = () =>
  signalTree(
    {
      user: { name: '', role: '' },
      rows: entityMap<Row, number>({ selectId: (r) => r.id }),
      counter: 0,
    },
    { enhancers: [serialization()] }
  );

describe('C3 — server → TransferState → client', () => {
  it('THE RECIPE: round-trips plain state across two tree instances', () => {
    const server = makeTree();
    server.$.user.name.set('Ada');
    server.$.counter.set(7);
    const ts = new TransferState();
    ts.set(KEY, server.serialize());

    const client = makeTree();
    client.deserialize(ts.get(KEY, '{}'));

    expect(client.$.user.name()).toBe('Ada');
    expect(client.$.counter()).toBe(7);
  });

  it('carries an entityMap collection across the boundary', () => {
    const server = makeTree();
    server.$.rows.setAll([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
    const json = server.serialize();

    const client = makeTree();
    client.deserialize(json);

    expect(client.$.rows.all().map((r) => r.name)).toEqual(['a', 'b']);
  });

  // WITHDRAWN WITH STATUS-DEL — "normalises an in-flight status". The subject is
  // generic marker rehydrate NORMALISATION, which is UNPROVEN. The plain-state
  // and entityMap transfer cases in this file are untouched.

  it('the payload is a plain JSON string TransferState can hold', () => {
    const server = makeTree();
    server.$.user.name.set('Ada');
    const json = server.serialize();
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

/**
 * The gap this investigation found — pinned so it cannot change silently.
 *
 * SSR exists to ship SERVER-FETCHED data to the client so the user does not
 * watch a spinner for something the server already had. `asyncSource` is where
 * fetched data lives, and it is the one thing that does NOT cross.
 *
 * Its `snapshot` captures always (correct — undo must replay what was on
 * screen), but its `hydrate` DECLINES `rehydrate`, reasoning that "the loader
 * has already re-run, so the fresh result wins". That is right for a
 * localStorage restore hours later. It is false at SSR hydration: the payload
 * is milliseconds old and the client's loader has not run yet.
 *
 * The cost is paid twice — the bytes ship AND the client refetches. See
 * RFC 0014.
 */
/**
 * ⚠️ THE C3 GAP IS GONE BECAUSE ITS SUBJECT IS.
 *
 * This block recorded that `asyncSource` shipped its SSR payload and then
 * dropped it. ASYNC-SOURCE-RETIRE-1 deleted the primitive, so the defect has no
 * remaining expression — it is not a defect that was FIXED, it is one whose
 * carrier was removed. Recorded in the audit rather than silently dropped.
 */

/**
 * RFC 0014 — `{ transfer: true }`, the fix for the gap pinned above.
 *
 * Same payload, same markers, one flag. What changes is only the decision a
 * source-owning marker makes about whose data is fresher.
 */
describe('RFC 0014 — deserialize({ transfer: true })', () => {
  // ⚠️ SUBJECT MIGRATED from asyncSource to a loader-backed entityMap. The RFC
  // 0014 invariant needs A source-owning marker that declines `rehydrate`, and
  // entityMap is the surviving one — not asyncSource specifically.
  const make = () => ({
    feed: entityMap<{ id: string }, string>({
      selectId: (x) => x.id,
      load: loader(async () => []),
    }),
    n: 0,
  });

  it('DELIVERS the server payload that rehydrate drops', () => {
    const server = signalTree(make(), { enhancers: [serialization()] });
    server.$.feed.setAll([{ id: 'SERVER' }]);
    const payload = server.serialize();

    const dropped = signalTree(make(), { enhancers: [serialization()] });
    dropped.deserialize(payload);
    expect(dropped.$.feed.count()).toBe(0);

    const delivered = signalTree(make(), { enhancers: [serialization()] });
    delivered.deserialize(payload, { transfer: true });
    expect(delivered.$.feed.ids()).toEqual([
      'SERVER',
    ]);
  });

  // WITHDRAWN WITH STATUS-DEL — same subject, freshness variant.

  it('leaves the storage path alone — no flag, no change in behaviour', () => {
    const server = signalTree(make(), { enhancers: [serialization()] });
    server.$.feed.setAll([{ id: 'STALE' }]);
    const payload = server.serialize();

    const client = signalTree(make(), { enhancers: [serialization()] });
    client.deserialize(payload, { transfer: false });
    expect(client.$.feed.count()).toBe(0);
  });

  it('the mode does not leak into a later deserialize', () => {
    // `hydrateMode` is closure state restored in a `finally`; this is the test
    // that keeps that honest.
    const server = signalTree(make(), { enhancers: [serialization()] });
    server.$.feed.setAll([{ id: 'X' }]);
    const payload = server.serialize();

    const client = signalTree(make(), { enhancers: [serialization()] });
    client.deserialize(payload, { transfer: true });
    expect(client.$.feed.ids()).toEqual(['X']);

    const after = signalTree(make(), { enhancers: [serialization()] });
    after.deserialize(payload); // default: rehydrate
    expect(after.$.feed.count()).toBe(0);
  });
});
