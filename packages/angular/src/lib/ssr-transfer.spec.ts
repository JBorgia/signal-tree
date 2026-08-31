import { TransferState, makeStateKey } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';
// This historical recipe measures an internal enhancer that is deliberately not public.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { serialization } from '../../../kernel/src/enhancers/serialization/serialization';

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
