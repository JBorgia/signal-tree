import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * SUBJECT-ADDRESS-0 — is "a whole existing subject" a realizable scalar target?
 *
 * ```text
 * NULL       a genuine causal event exists whose target is an existing subject
 *            AS A WHOLE, distinct from structural lifetime transitions, from
 *            collection-owner notifications, and from field mutations
 * FALSIFIER  no production event needs it; all subject realization is either a
 *            structural lifetime transition or field-relative state
 * ```
 *
 * ## RESULT — the NULL SURVIVES. Whole-subject IS a real target.
 *
 * Instrumenting `deriveFieldPathFromRow`'s OUTPUT across every entity operation
 * at both depths:
 *
 * ```text
 * TOP    updateOne  path=rows.seed       ownerPath=rows       coll=rows  FIELD=""
 * NESTED updateOne  path=data.rows.seed  ownerPath=data.rows  coll=data  FIELD="seed"
 * ```
 *
 * A row update at TOP level legitimately produces `''` — the event addresses
 * the WHOLE ROW `seed`, not a field within it — with the correct collection.
 * So `''` is earned, and CASE A ("delete `''`") is falsified.
 *
 * ⚠️ **And the nested defect is worse than previously recorded.** It does not
 * merely derive the wrong collection: it FABRICATES A FIELD COORDINATE EQUAL TO
 * THE ENTITY KEY. `FIELD="seed"` claims the row has a field called `seed`.
 * Replay would then look for `seed` inside the row.
 *
 * ## ⚠️ Why this was invisible at top level
 *
 * The owner-only ping and a genuine whole-row update produce the SAME derived
 * output at top level:
 *
 * ```text
 * ping           path=rows       ownerPath=rows  struct=undefined  FIELD=""
 * whole-row      path=rows.seed  ownerPath=rows  struct=undefined  FIELD=""
 * ```
 *
 * The ping's bogus `''` is masked by a legitimate `''`. Nothing distinguishes
 * them by derived value — only by what the event actually addressed.
 *
 * ## So the disposition is CASE B, and the three states are all real
 *
 * ```text
 * undefined     this event establishes NO subject address
 * whole         this event targets the entire current subject
 * field 'name'  this event targets a field within the current subject
 * ```
 *
 * They must be REPRESENTED EXPLICITLY rather than encoded as
 * `undefined | '' | string`, because DESCRIPTOR-ROLE-0 measured two consumers
 * already disagreeing about `''`:
 *
 * ```text
 * canResolvePreparedSubjectTarget   if (!fieldPathFromRow) return false;
 *                                   -> '' is FALSY, read as NO ADDRESS
 * assignPreparedSubjectValue        if (fieldPathFromRow === '')
 *                                   -> read as WHOLE SUBJECT
 * ```
 *
 * ⚠️ Do NOT "fix" that by changing the falsy test to an `=== undefined` test.
 * That makes the inconsistency work without deciding whether the state should
 * exist — and it now demonstrably should, so it deserves a representation that
 * cannot be confused with absence.
 *
 * ## The sentence, answered
 *
 * > **A whole existing subject IS a realizable scalar target.**
 *
 * Which means the final model is NOT the two-state one:
 *
 * ```text
 * PositionId  -> owning collection, via the registry
 * SubjectId   -> current entity lifetime and key
 * address     -> WHOLE | FIELD(path) | none
 * structural  -> subject existence and membership transitions
 * ```
 *
 * Three states, not two. The magic empty string goes; the state it encoded
 * stays.
 *
 * ## The remaining case, answered in DESCRIPTOR-MERGE-0
 *
 * "The owner-only ping must establish NO subject address" is confirmed defective
 * there, and by a sharper mechanism than the masking above: `''` is returned on
 * the `path === ownerPath` branch BEFORE `subjectId` is examined at all, so a
 * ping carrying no subject still claims the whole-subject address. See
 * `descriptor-merge-0.spec.ts`.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r) => r.id });

type Rows = {
  addOne(r: Row): void;
  updateOne(id: string, patch: Partial<Row>): void;
  removeOne(id: string): void;
  changeId(from: string, to: string): void;
  byIdOrFail(id: string): { id: () => string; n: () => number };
  all(): Row[];
  ids(): string[];
};

const topTree = () =>
  signalTree({ rows: em() }, { enhancers: [restoration(), transactions()] }) as unknown as {
    $: { rows: Rows };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
  };

const nestedTree = () =>
  signalTree(
    { data: { rows: em() } },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as {
    $: { data: { rows: Rows } };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
  };

describe('SUBJECT-ADDRESS-0: a whole-subject update is a real operation', () => {
  it('updateOne replaces state on an EXISTING subject, not its lifetime', async () => {
    const tree = topTree();
    await flush();
    tree.$.rows.addOne({ id: 'seed', n: 0 });
    await flush();

    tree.$.rows.updateOne('seed', { n: 9 });
    await flush();

    // The subject persists; only its state changed. So this is neither a
    // structural lifetime transition nor a collection-owner notification —
    // it is the whole-subject case the NULL asked about.
    expect(tree.$.rows.ids()).toEqual(['seed']);
    expect(tree.$.rows.byIdOrFail('seed').n()).toBe(9);
  });

  it('and it round-trips through a transaction at TOP level', async () => {
    const tree = topTree();
    await flush();
    tree.$.rows.addOne({ id: 'seed', n: 0 });
    await flush();

    const p = tree.transaction(() => tree.$.rows.updateOne('seed', { n: 99 }));
    await flush();
    p.rollback();
    await flush();

    // Whole-subject replay works where the derived address is correct.
    expect(tree.$.rows.byIdOrFail('seed').n()).toBe(0);
  });

  it('the same round-trip NESTED — closed by ADDRESS-REPAIR-1', async () => {
    const tree = nestedTree();
    await flush();
    tree.$.data.rows.addOne({ id: 'seed', n: 0 });
    await flush();

    const p = tree.transaction(() =>
      tree.$.data.rows.updateOne('seed', { n: 99 })
    );
    await flush();

    // ⚠️ WAS KNOWN RED. The derivation used to produce `FIELD="seed"` — the
    // ENTITY KEY as a field name — and `coll="data"`, the parent branch, so the
    // rollback refused and the speculative state stayed materialized.
    //
    // ADDRESS-REPAIR-1 makes the owner position's REGISTERED collection address
    // the authority, so `data.rows` is never read as `data`, and the key segment
    // is consumed as addressing rather than returned as a coordinate.
    p.rollback();
    await flush();

    expect(tree.$.data.rows.byIdOrFail('seed').n()).toBe(0);
  });
});

describe('SUBJECT-ADDRESS-0: subject identity survives a rekey', () => {
  it('the ORIGINAL key must not be durable identity', async () => {
    const tree = topTree();
    await flush();
    tree.$.rows.addOne({ id: 'u1', n: 1 });
    await flush();

    tree.$.rows.changeId('u1', 'u2');
    await flush();

    // The subject is the same lifetime under a new key. Any address that
    // embedded `u1` would now be stale — which is why a fabricated field
    // coordinate equal to the entity key is especially dangerous.
    expect(tree.$.rows.ids()).toEqual(['u2']);
    expect(tree.$.rows.byIdOrFail('u2').n()).toBe(1);

    tree.$.rows.updateOne('u2', { n: 5 });
    await flush();
    expect(tree.$.rows.byIdOrFail('u2').n()).toBe(5);
  });
});
