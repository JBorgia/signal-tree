import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import {
  EntityPublicationSource,
  getEntityPublicationBinding,
  type EntityPublicationEdit,
  type EntityPublicationParticipant,
} from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; value: number };
type Facets = Record<string, lifecycle.NativeRequirement>;
type Captured = { native: readonly lifecycle.NativeInput[] };
type DeclaringLink = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): unknown;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let step = 0; step < 160; step++) await Promise.resolve();
};
const values = (prefix: string, count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index}`,
    value: offset + index,
  }));
function sourceFor(node: object): EntityPublicationSource {
  const binding = getEntityPublicationBinding(node);
  if (!binding) throw new Error('Missing source binding');
  return binding.source;
}
function subjectFor(node: object): number {
  const subject = getEntityPublicationBinding(node)?.subject;
  if (subject === undefined) throw new Error('Missing exact subject');
  return subject;
}
function facets(source: EntityPublicationSource, subject: number): Facets {
  const evidence = source.evidence();
  if (!evidence) throw new Error('Missing source evidence');
  return {
    ordinaryMember: evidence.member(subject, 'ordinary'),
    physicalMember: evidence.member(subject, 'physical'),
    ordinaryField: evidence.field(subject, 'value', 'ordinary'),
    physicalField: evidence.field(subject, 'value', 'physical'),
    ordinaryPlacement: evidence.placement(subject, 'ordinary'),
    physicalPlacement: evidence.placement(subject, 'physical'),
    ordinaryMapping: evidence.keyMapping(subject, 'ordinary'),
    physicalMapping: evidence.keyMapping(subject, 'physical'),
  } as Facets;
}
function expectSameFacets(actual: Facets, expected: Facets): void {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const key of Object.keys(expected)) expect(actual[key], key).toBe(expected[key]);
}
/** Private source-unit fixture, following integrated-field-facts.spec.ts.
 * External provenance creates real ready-but-blocked requirements. Calling the
 * destructive retire primitive below tests representation bookkeeping, not a
 * new permission to erase blocked evidence in application-owned trees. */
function sparseSourceFixture(subjects: readonly number[]) {
  const source = new EntityPublicationSource();
  const install = (edits: readonly EntityPublicationEdit[], physicalOrder?: readonly number[]) => {
    const unit = source.prepare({
      owner: 0, id: {}, meta: { origin: 'external' }, ordinary: edits, physical: edits, physicalOrder,
    });
    if (!unit) throw new Error('Missing source fixture unit');
    unit.finalize?.();
    unit.validate?.();
    installTerminalRecord(unit.record);
    source.complete(unit.completion);
  };
  install(subjects.map<EntityPublicationEdit>(subject => {
    const row = { id: String(subject), value: subject };
    return {
      subject, before: undefined, after: row, fields: null,
      structural: { kind: 'add', subject, key: subject, value: row },
    };
  }));
  const participant = (source as unknown as { native?: EntityPublicationParticipant }).native;
  if (!participant) throw new Error('Missing native source fixture participant');
  return {
    source,
    remove(ids: readonly number[]) {
      install(ids.map<EntityPublicationEdit>(subject => {
        const row = { id: String(subject), value: subject };
        return {
          subject, before: row, after: undefined, fields: null,
          structural: { kind: 'remove', subject, key: subject, value: row },
        };
      }));
    },
    retainPhysicalPlacement(ids: readonly number[]) {
      // Explicit private publication facts model the full retained tuple. This
      // is not an application reorder of absent rows or a retirement grant.
      install([], ids);
    },
    plan(subject: number) {
      const plan = participant.prepareRetirement?.(subject);
      if (!plan) throw new Error('Missing native source fixture retirement plan');
      return plan;
    },
  };
}
/** The expanded current route is the reference, including first-occurrence
 * order. An absent placement must not contribute a made-up clean requirement. */
function expectWholeCapture(source: EntityPublicationSource, expectedViews: number): Captured {
  const views = source.captureViews() as readonly { requirement: lifecycle.NativeRequirement }[];
  expect(views).toHaveLength(expectedViews);
  const requirements = [...new Set(views.map(view => view.requirement))];
  const representedBefore = source.inspect().wholeInputFactsRepresented;
  const captured = source.captureInput() as Captured;
  expect(source.inspect().wholeInputFactsRepresented - representedBefore).toBe(expectedViews);
  expect(Object.isFrozen(captured.native)).toBe(true);
  expect(captured.native).toHaveLength(requirements.length);
  captured.native.forEach((input, index) => {
    expect(input.requirement).toBe(requirements[index]);
    const reference = lifecycle.captureNativeInput(requirements[index]);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.owners)).toBe(true);
    expect(input.owners).toHaveLength(reference.owners.length);
    input.owners.forEach((owner, ownerIndex) => expect(owner).toBe(reference.owners[ownerIndex]));
    expect(input.terminalRejectedRoles).toBe(reference.terminalRejectedRoles);
  });
  return captured;
}

describe('sparse terminal entity facts', () => {
  it('packs confirmed removals without inventing placement or rewriting issued evidence', async () => {
    const count = 16;
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const rows = tree.$.rows;
    const source = sourceFor(rows);
    const sent: unknown[] = [];
    const connection = link(rows, { set: value => { sent.push(value); } });
    const initial = values('old', count);
    const replacement = values('new', count, 100);
    try {
      const created = tree.transact(() => rows.setAll(initial));
      const held = rows.byIdOrFail('old0');
      const subjects = initial.map(row => subjectFor(rows.byIdOrFail(row.id)));
      const createFacts = subjects.map(subject => facets(source, subject));
      const createOwner = lifecycle.nativeProof(createFacts[0].ordinaryMapping).destination?.[0];
      expect(createOwner?.outcome).toBe('pending');
      await flush();
      expect(sent).toEqual([]);
      created.confirm();
      await flush();
      expect(createOwner?.outcome).toBe('confirmed');
      expect(sent).toEqual([initial]);
      const heldSnapshot = rows.all();

      const removed = tree.transact(() => rows.setAll(replacement));
      const removedFacts = subjects.map(subject => facets(source, subject));
      // Copy the proof shell so a forbidden in-place role rewrite cannot make
      // the saved expectation change with the requirement being checked.
      const removedProofs = removedFacts.map(fact => Object.fromEntries(
        Object.entries(fact).map(([name, requirement]) => [name, { ...lifecycle.nativeProof(requirement) }])
      ));
      const removeOwner = lifecycle.nativeProof(removedFacts[0].ordinaryMember).destination?.[0];
      expect(removeOwner?.outcome).toBe('pending');
      expect(removeOwner).not.toBe(createOwner);
      for (const [index, fact] of removedFacts.entries()) {
        expect(fact.ordinaryMapping).toBe(createFacts[index].ordinaryMapping);
        expect(fact.physicalMapping).toBe(createFacts[index].physicalMapping);
        expect(fact.ordinaryMember).not.toBe(fact.ordinaryMapping);
        expect(lifecycle.nativeProof(fact.ordinaryMember).destination).toEqual([removeOwner]);
        expect(lifecycle.nativeProof(fact.physicalMember).destination).toEqual([removeOwner]);
        for (const name of ['ordinaryField', 'physicalField', 'ordinaryPlacement', 'physicalPlacement']) {
          expect(lifecycle.nativeProof(fact[name]).unavailableInput, name).toBe(true);
          expect(fact[name]).toBe(fact.ordinaryField);
        }
      }
      expect(source.inspect().placementViews).toBe(count);
      const issued = source.captureInput(subjects[0]) as Captured;
      expect(issued.native).toHaveLength(1);
      expect(issued.native[0].requirement).toBe(removedFacts[0].physicalMember);
      const issuedOwners = issued.native[0].owners;
      expect(issuedOwners).toEqual([removeOwner]);
      expectWholeCapture(source, count * 5);
      await flush();
      expect(sent).toEqual([initial]);
      expect(rows.all()).toEqual(replacement);
      const prepared = source.prepare({ owner: 0, id: {}, meta: undefined, physical: [], ordinary: [] });
      if (!prepared) throw new Error('Missing prepared reader');
      removed.confirm();
      await flush();

      expect(sent).toEqual([initial, replacement]);
      expect(rows.all()).toEqual(replacement);
      expect(heldSnapshot).toEqual(initial);
      expect(held()).toBeUndefined();
      expect(held.value()).toBeUndefined();
      expect(removeOwner?.outcome).toBe('confirmed');
      for (const [index, subject] of subjects.entries()) {
        expectSameFacets(facets(source, subject), removedFacts[index]);
        for (const [name, saved] of Object.entries(removedProofs[index])) {
          const actual = lifecycle.nativeProof(removedFacts[index][name]);
          expect(Object.keys(actual)).toEqual(Object.keys(saved));
          for (const [role, value] of Object.entries(saved)) expect(Reflect.get(actual, role), role).toBe(value);
        }
      }
      expect(issued.native[0].owners).toBe(issuedOwners);
      expect(issuedOwners).toEqual([removeOwner]);
      const fresh = source.captureInput(subjects[0]) as Captured;
      expect(fresh.native[0]).not.toBe(issued.native[0]);
      expect(fresh.native[0].requirement).toBe(issued.native[0].requirement);
      expect(fresh.native[0].owners).toEqual([]);
      expectWholeCapture(source, count * 5);
      expect(source.evidence()?.exclusions?.().map(([subject]) => subject).sort((a, b) => a - b))
        .toEqual([...subjects].sort((a, b) => a - b));
      expect(source.inspect()).toMatchObject({
        presence: count * 2, negativePresence: count,
        visible: count * 2, negativeVisible: count,
        placements: count, placementViews: count,
        rows: count, viewRows: count,
        mappings: count * 2, mappingViews: count * 2,
        retirementRequests: 0, retireCalls: 0,
      });

      // Baseline-first storage discriminator, after the useful semantic checks.
      // Baseline has four retained Map facets per old subject and cannot pack it.
      expect(source.inspect()).toMatchObject({
        packedSubjects: count, packedRuns: 1, unpackedSubjectFacets: count * 5,
      });
      // Reached only once the storage discriminator passes: real asynchronous
      // compaction must invalidate a prepared reader even with unchanged values.
      expect(() => prepared.finalize?.()).toThrow('changed before installation');
      rows.addOne({ id: 'old0', value: 999 });
      await flush();
      expect(subjectFor(rows.byIdOrFail('old0'))).not.toBe(subjects[0]);
      expect(rows.byIdOrFail('old0').value()).toBe(999);
      expect(held()).toBeUndefined();
      expectSameFacets(facets(source, subjects[0]), removedFacts[0]);
    } finally { connection.dispose(); tree.destroy(); }
  });

  it('keeps mixed full rollback and sparse confirmed facets useful to a late consumer', async () => {
    const count = 4;
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const target = signalTree({ value: -1 });
    const rows = tree.$.rows;
    const source = sourceFor(rows);
    const sent: number[] = [];
    const delivery = link(target.$.value, { set: value => { sent.push(value); } }) as DeclaringLink;
    try {
      const rejectedValues = values('rejected', count);
      const rejected = tree.transact(() => rows.setAll(rejectedValues));
      const fullSubjects = rejectedValues.map(row => subjectFor(rows.byIdOrFail(row.id)));
      await flush();
      rejected.rollback();
      const fullFacts = fullSubjects.map(subject => facets(source, subject));
      await flush();
      expect(rows.all()).toEqual([]);
      for (const fact of fullFacts) {
        expect(lifecycle.nativeProof(fact.physicalPlacement).unavailableInput).not.toBe(true);
        expect(lifecycle.nativeProof(fact.ordinaryMember).destination?.some(owner => owner.outcome === 'rolled-back')).toBe(true);
      }
      const initial = values('old', count);
      const created = tree.transact(() => rows.setAll(initial));
      const sparseSubjects = initial.map(row => subjectFor(rows.byIdOrFail(row.id)));
      created.confirm();
      await flush();
      const replacement = values('live', count, 100);
      const removed = tree.transact(() => rows.setAll(replacement));
      const sparseFacts = sparseSubjects.map(subject => facets(source, subject));
      for (const fact of sparseFacts) expect(lifecycle.nativeProof(fact.physicalPlacement).unavailableInput).toBe(true);
      removed.confirm();
      await flush();
      expect(rows.all()).toEqual(replacement);
      fullSubjects.forEach((subject, index) => expectSameFacets(facets(source, subject), fullFacts[index]));
      sparseSubjects.forEach((subject, index) => expectSameFacets(facets(source, subject), sparseFacts[index]));
      const captured = expectWholeCapture(source, count * 7);
      expect(captured.native.some(input => input.owners.some(owner => owner.outcome === 'rolled-back'))).toBe(true);
      expect(source.inspect()).toMatchObject({
        presence: count * 3, negativePresence: count * 2,
        visible: count * 3, negativeVisible: count * 2,
        placements: count, placementViews: count * 2,
        mappings: count * 3, mappingViews: count * 3,
        rows: count, viewRows: count,
      });
      let calls = 0;
      expect(() => delivery.declare({ kind: 'independent' }, () => tree.updateAndReport(value => {
        calls++;
        const snapshot = value as unknown as { rows: { all: Row[] } };
        expect(snapshot.rows.all).toEqual(replacement);
        target.$.value(snapshot.rows.all.length);
        return {};
      }))).toThrow(expect.objectContaining({ stage: 'after-callback', reason: 'contradiction' }));
      await flush();
      expect(calls).toBe(1);
      expect(target.$.value()).toBe(count);
      expect(sent).toEqual([count]);
      expectWholeCapture(source, count * 7);

      // Full rollback tuples already pack on baseline. The sparse batch must
      // join them without fabricating its missing physical placement facet.
      expect(source.inspect()).toMatchObject({
        packedSubjects: count * 2, packedRuns: 2, unpackedSubjectFacets: count * 5,
      });
    } finally { delivery.dispose(); target.destroy(); tree.destroy(); }
  });

  it('keeps sparse facet coverage exact through repeated compaction and split retirement', () => {
    const subjects = [10, 11, 12, 13, 14, 20, 21];
    const fullSubjects = [20, 21];
    const fixture = sparseSourceFixture(subjects);
    const { source } = fixture;
    try {
      fixture.remove(subjects);
      fixture.retainPhysicalPlacement(fullSubjects);
      const saved = new Map(subjects.map(subject => [subject, facets(source, subject)]));
      const plans = subjects.map(subject => fixture.plan(subject));
      for (const plan of plans) {
        expectWholeCapture(source, subjects.length + fullSubjects.length);
        expect(plan.ready).toBe(true);
        expect(plan.canRetire).toBe(false);
        expect(plan.current()).toBe(true);
        if (!plan.compact) throw new Error('Sparse fixture must offer compaction');
        expect(plan.compact()).toBe(true);
        expectWholeCapture(source, subjects.length + fullSubjects.length);
      }
      const check = (remaining: readonly number[], runs: number) => {
        const placementCount = remaining.filter(subject => fullSubjects.includes(subject)).length;
        expect(source.inspect()).toMatchObject({
          presence: remaining.length, negativePresence: remaining.length,
          visible: remaining.length, negativeVisible: remaining.length,
          mappings: remaining.length, mappingViews: remaining.length,
          rows: 0, fields: 0, viewRows: 0, viewFields: 0,
          placements: 0, placementViews: placementCount,
          packedSubjects: remaining.length, packedRuns: runs, unpackedSubjectFacets: 0,
        });
        expect(source.evidence()?.exclusions?.().map(([subject]) => subject)).toEqual(remaining);
        for (const subject of remaining) {
          const prior = saved.get(subject);
          if (!prior) throw new Error('Missing saved fixture facts');
          expectSameFacets(facets(source, subject), prior);
          expect(lifecycle.nativeProof(prior.physicalPlacement).unavailableInput === true)
            .toBe(!fullSubjects.includes(subject));
        }
        // Exercise both a rebuilt selection and reuse of its cached coverage.
        expectWholeCapture(source, remaining.length + placementCount);
        expectWholeCapture(source, remaining.length + placementCount);
      };
      check(subjects, 2);
      // Source normally rechecks plan.current before this callback. Repeating
      // the primitive itself must also refuse without incrementing facet counts.
      expect(plans[2].compact?.()).toBe(false);
      expect(fixture.plan(12).compact).toBeUndefined();
      check(subjects, 2);

      source.retire(12);
      check([10, 11, 13, 14, 20, 21], 3);
      const missing = facets(source, 12);
      for (const requirement of Object.values(missing)) {
        expect(lifecycle.nativeProof(requirement).unavailableInput).toBe(true);
      }
      source.retire(12);
      source.retire(999);
      check([10, 11, 13, 14, 20, 21], 3);
      // Full deletion decreases physical placement; sparse deletion must not.
      source.retire(20);
      check([10, 11, 13, 14, 21], 3);
      source.retire(21);
      check([10, 11, 13, 14], 2);
      source.retire(11);
      check([10, 13, 14], 2);
      source.retire(10);
      check([13, 14], 1);
      source.retire(13);
      check([14], 1);
      source.retire(14);
      check([], 0);
    } finally { source.dispose(); }
  });

  it('does not merge adjacent sparse facts whose equal-looking proofs have distinct identities', () => {
    const fixture = sparseSourceFixture([99, 100, 101]);
    const { source } = fixture;
    try {
      fixture.remove([99]);
      fixture.remove([100]);
      fixture.remove([101]);
      const earlier = facets(source, 99);
      const first = facets(source, 100), second = facets(source, 101);
      expect(first.ordinaryMapping).toBe(second.ordinaryMapping);
      expect(first.physicalMapping).toBe(second.physicalMapping);
      expect(first.ordinaryMember).not.toBe(second.ordinaryMember);
      expect(first.physicalMember).not.toBe(second.physicalMember);
      expect(lifecycle.nativeProof(first.ordinaryMember)).toEqual(lifecycle.nativeProof(second.ordinaryMember));
      for (const subject of [100, 101]) {
        expectWholeCapture(source, 3);
        const plan = fixture.plan(subject);
        expect(plan.ready).toBe(true);
        expect(plan.canRetire).toBe(false);
        expect(plan.current()).toBe(true);
        if (!plan.compact) throw new Error('Sparse fixture must offer compaction');
        expect(plan.compact()).toBe(true);
        expectWholeCapture(source, 3);
      }
      expect(source.inspect()).toMatchObject({
        packedSubjects: 2, packedRuns: 2, unpackedSubjectFacets: 4, placementViews: 0,
      });
      expectSameFacets(facets(source, 100), first);
      expectSameFacets(facets(source, 101), second);
      const captured = expectWholeCapture(source, 3);
      expect(captured.native).toHaveLength(3);
      expect(captured.native[0].requirement).toBe(earlier.physicalMember);
      expect(captured.native[1].requirement).toBe(first.physicalMember);
      expect(captured.native[2].requirement).toBe(second.physicalMember);
      const reverse = fixture.plan(99);
      expect(reverse.ready).toBe(true);
      expect(reverse.canRetire).toBe(false);
      expect(reverse.current()).toBe(true);
      if (!reverse.compact) throw new Error('Missing out-of-order compact attempt');
      // This exact sparse tuple cannot append behind the two later distinct
      // runs. Refusal must keep its ordinary maps and missing-facet count intact.
      expect(reverse.compact()).toBe(false);
      expectSameFacets(facets(source, 99), earlier);
      expect(source.inspect()).toMatchObject({
        packedSubjects: 2, packedRuns: 2, unpackedSubjectFacets: 4, placementViews: 0,
      });
      expectWholeCapture(source, 3);
      source.retire(100);
      expectSameFacets(facets(source, 101), second);
      const remaining = expectWholeCapture(source, 2);
      expect(remaining.native).toHaveLength(2);
      expect(remaining.native[0].requirement).toBe(earlier.physicalMember);
      expect(remaining.native[1].requirement).toBe(second.physicalMember);
      source.retire(101);
      expectWholeCapture(source, 1);
      // The refused tuple can be admitted once the range set is empty. Only
      // this successful append may increment the missing-placement count.
      expect(reverse.current()).toBe(true);
      expect(reverse.compact()).toBe(true);
      expect(source.inspect()).toMatchObject({
        packedSubjects: 1, packedRuns: 1, unpackedSubjectFacets: 0, placementViews: 0,
      });
      expectSameFacets(facets(source, 99), earlier);
      expectWholeCapture(source, 1);
    } finally { source.dispose(); }
  });
});
