import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { getTreeRealizationDescriptors } from './internals/causal-runtime/tree-realization-adapter';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * SUBJECT-ADDRESS-CARDINALITY-0 — is one retained coordinate per SubjectId
 * structurally sufficient?
 *
 * ```text
 * NULL       within one causal/restoration frame a subject requires at most one
 *            ADDRESSLESS fallback coordinate; multiple subject mutations either
 *            coalesce to whole-subject state or carry their own inline address
 * FALSIFIER  two effects for the SAME owner PositionId and SubjectId
 *            simultaneously require two different retained coordinates AND
 *            cannot be distinguished from the effects themselves
 * ```
 *
 * ## RESULT — the NULL SURVIVES, on the falsifier's second clause
 *
 * Two different coordinates ARE simultaneously required. They are NOT retained,
 * because every effect that needs a field coordinate carries its own complete
 * inline address. Captured `ReversalEffect`s for a two-field update:
 *
 * ```text
 * EFFECT owner=2 subj=1 struct=undefined path=rows.r1.name    ownerPath=rows
 * EFFECT owner=2 subj=1 struct=undefined path=rows.r1.enabled ownerPath=rows
 * ```
 *
 * Same owner, same subject, two distinct complete paths. And at resolution the
 * inline term wins every time — the retained coordinate is never read:
 *
 * ```text
 * RESOLVE inlineField="name"    descField="" => field="name"
 * RESOLVE inlineField="enabled" descField="" => field="enabled"
 * ```
 *
 * ⚠️ Note `descField=""` on BOTH lines. The single retained slot holds neither
 * of the two coordinates that were actually needed and correctly applied. That
 * is the discriminator, and it is asserted below without instrumentation.
 *
 * ## Which effects are actually addressless
 *
 * Exactly one kind, across every operation probed:
 *
 * ```text
 * EFFECT owner=2 subj=1 struct=rekey path=undefined ownerPath=undefined
 * ```
 *
 * Structural effects. And a structural effect needs a COLLECTION path, never a
 * subject FIELD coordinate — `deriveFieldPathFromRow` returns `undefined` for
 * anything structural by its first branch. So the addressless case never needs
 * the slot the falsifier was about.
 *
 * > **`Map<SubjectId, one address>` is not the wrong data structure.** Field
 * > coordinates travel with their effects; the retained entry is a fallback for
 * > effects that carry no address, and those need only a collection.
 *
 * ## ⚠️ THIS CORRECTS DESCRIPTOR-MERGE-0's MECHANISM CLAIM
 *
 * That record stated the nested failure's mechanism as:
 *
 * > "Last-write-wins at the subject level means the FABRICATED address wins.
 * > Had that level been first-write-wins, the correct `''` would have survived
 * > and the nested rollback would have worked by accident."
 *
 * **That is wrong, and this measurement is why.** The descriptor is never
 * consulted for these effects — the inline term short-circuits the `??` chain
 * before either descriptor level is reached. Neither merge policy participates
 * in the nested failure.
 *
 * The merge asymmetry DESCRIPTOR-MERGE-0 measured is real and still stands as a
 * fact about the two levels. What does not stand is the claim that it explains
 * the nested defect.
 *
 * ## The corrected mechanism
 *
 * Nested rollback fails entirely inside the INLINE derivation:
 *
 * ```text
 * deriveCollectionPathFromEffect(path=data.rows.r1.name, ownerPath=data.rows)
 *   ownerPath.includes('.') -> parentPath('data.rows') -> 'data'
 * ```
 *
 * `data` is a branch, not a collection, so resolution bails at
 * `isCollectionNode` before a field coordinate is even considered. The nested
 * probes produce NO resolve line at all, which is how this was located.
 *
 * ⚠️ And the inline derivation calls the SAME two helpers as the descriptor
 * path — `deriveCollectionPath` / `deriveFieldPathFromRow`. Inline is not an
 * independent address; it is the same guess applied to the effect's own strings.
 * So correcting the derivation corrects both, and the registry rule must be
 * reachable from the INLINE path, not only from descriptor capture.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; name: string; enabled: boolean };
const em = () => entityMap<Row, string>({ selectId: (r: Row) => r.id });

type Rows = {
  addOne(r: Row): void;
  updateOne(id: string, patch: Partial<Row>): void;
  changeId(from: string, to: string): void;
  byIdOrFail(id: string): {
    name: { (): string; set(v: string): void };
    enabled: { (): boolean; set(v: boolean): void };
  };
  ids(): string[];
};

const topTree = () =>
  signalTree({ rows: em() }, { enhancers: [restoration(), transactions()] }) as unknown as {
    $: { rows: Rows };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
  };

const retainedSlots = (root: object) => {
  const out: Array<{ field: string | undefined; count: number }> = [];
  for (const [, desc] of getTreeRealizationDescriptors(root) ?? []) {
    const subs = desc.subjectDescriptors;
    if (!subs?.size) continue;
    for (const [, v] of subs) {
      out.push({ field: v.fieldPathFromRow, count: subs.size });
    }
  }
  return out;
};

describe('SUBJECT-ADDRESS-CARDINALITY-0: two coordinates, one slot', () => {
  it('⚠️ two fields on ONE subject both roll back, while ONE slot is retained', async () => {
    const tree = topTree();
    await flush();
    tree.$.rows.addOne({ id: 'r1', name: 'before', enabled: false });
    await flush();

    const p = tree.transaction(() => {
      tree.$.rows.byIdOrFail('r1').name.set('after');
      tree.$.rows.byIdOrFail('r1').enabled.set(true);
    });
    await flush();

    // Both coordinates genuinely took effect — the control, so the rollback
    // below is restoring something rather than asserting a no-op.
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('after');
    expect(tree.$.rows.byIdOrFail('r1').enabled()).toBe(true);

    p.rollback();
    await flush();

    // BOTH are restored. Two different coordinates were required at once.
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('before');
    expect(tree.$.rows.byIdOrFail('r1').enabled()).toBe(false);

    // No fallback coordinate is retained. The two inline effects carried the
    // exact coordinates required by rollback.
    const slots = retainedSlots(tree.$ as unknown as object);
    expect(slots).toEqual([]);
  });

  it('the same holds with the two writes in the opposite order', async () => {
    const tree = topTree();
    await flush();
    tree.$.rows.addOne({ id: 'r1', name: 'before', enabled: false });
    await flush();

    const p = tree.transaction(() => {
      tree.$.rows.byIdOrFail('r1').enabled.set(true);
      tree.$.rows.byIdOrFail('r1').name.set('after');
    });
    await flush();
    p.rollback();
    await flush();

    // Order-independent, which a one-slot contest could not be.
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('before');
    expect(tree.$.rows.byIdOrFail('r1').enabled()).toBe(false);
  });

  it('a field write, a rekey, and another field write coexist in one frame', async () => {
    const tree = topTree();
    await flush();
    tree.$.rows.addOne({ id: 'r1', name: 'before', enabled: false });
    await flush();

    const p = tree.transaction(() => {
      tree.$.rows.byIdOrFail('r1').name.set('after');
      tree.$.rows.changeId('r1', 'r9');
      tree.$.rows.byIdOrFail('r9').enabled.set(true);
    });
    await flush();
    expect(tree.$.rows.ids()).toEqual(['r9']);

    p.rollback();
    await flush();

    // The structural effect is the ONLY addressless one in the frame, and it
    // needs a collection rather than a field coordinate — so it does not
    // contend for the retained slot either.
    expect(tree.$.rows.ids()).toEqual(['r1']);
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('before');
    expect(tree.$.rows.byIdOrFail('r1').enabled()).toBe(false);
  });
});
