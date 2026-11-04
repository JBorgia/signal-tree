import { expect, it } from 'vitest';
import { signalTree, transactions } from '../index';
import { nativeProof, type NativeRequirement } from './experimental-publication/lifecycle';
import {
  EntityPublicationSource,
  type EntityPublicationEdit,
  type EntityPublicationEvidence,
  type EntityPublicationPacket,
  type EntityPublicationParticipant,
  type SourcePointPreparer,
} from './internals/entity-publication';
import { installTerminalRecord, type PreparedPublicationUnit } from './internals/intrinsic-mutation';

type Completion = { facts: EntityPublicationEvidence };
const packet = (ordinary: readonly EntityPublicationEdit[], extra: Partial<EntityPublicationPacket> = {}): EntityPublicationPacket => ({
  owner: 0, id: {}, meta: undefined, ordinary, physical: ordinary, ...extra,
});
function finish(source: EntityPublicationSource, unit: PreparedPublicationUnit | undefined): void {
  if (!unit) throw new Error('Missing source unit');
  unit.finalize?.(); unit.validate?.(); installTerminalRecord(unit.record); source.complete(unit.completion);
}
function fixture() {
  let point: SourcePointPreparer | undefined;
  const source = new EntityPublicationSource(prepare => { point = prepare; });
  const prepare = (subject: number, before: unknown, after: unknown, field = 'x') => {
    if (!point) throw new Error('Missing source-owned point capability');
    return point({ owner: 0, id: {}, meta: undefined, subject, fields: [field],
      physicalBefore: before, physicalAfter: after, ordinaryBefore: before, ordinaryAfter: after });
  };
  const seed = (subject = 1) => finish(source, source.prepare(packet([
    { subject, before: undefined, after: { x: 0, y: 0 }, fields: ['x', 'y'] },
  ])));
  return { source, prepare, seed };
}
function native(source: EntityPublicationSource): EntityPublicationParticipant {
  const participant = (source as unknown as { native?: EntityPublicationParticipant }).native;
  if (!participant) throw new Error('Missing initialized native participant');
  return participant;
}

it('separates physical-only and empty ordinary row populations in the fused store', () => {
  const { source } = fixture();
  try {
    const empty = { subject: 1, before: undefined, after: {}, fields: [] };
    finish(source, source.prepare(packet([], { physical: [empty], meta: { participation: 'inspection' } })));
    expect(source.inspect()).toMatchObject({ rows: 0, fields: 0, viewRows: 1, viewFields: 0 });
    finish(source, source.prepare(packet([empty], { physical: [] })));
    expect(source.inspect()).toMatchObject({ rows: 1, fields: 0, viewRows: 1, viewFields: 0 });
    source.retire(1);
    expect(source.inspect()).toMatchObject({ rows: 0, viewRows: 0 });
  } finally { source.dispose(); }
});

it('invalidates only the exact retained retirement row on an equal-value point support installation', () => {
  const { source, prepare, seed } = fixture();
  try {
    seed(1); seed(2);
    const participant = native(source);
    const plan = participant.prepareRetirement?.(1);
    if (!plan) throw new Error('Missing retirement plan');
    expect(plan.current()).toBe(true);
    finish(source, prepare(2, { x: 0, y: 0 }, { x: 1, y: 0 }));
    expect(plan.current()).toBe(true);
    const previous = source.evidence()?.field(1, 'x', 'ordinary');
    finish(source, prepare(1, { x: 0, y: 0 }, { x: 0, y: 0 }));
    expect(source.evidence()?.field(1, 'x', 'ordinary')).not.toBe(previous);
    expect(plan.current()).toBe(false);
  } finally { source.dispose(); }
});

it('seals an unread native completion before unsubscribe and preserves per-edit versus live physical support', () => {
  const { source, prepare, seed } = fixture();
  let held: Completion | undefined, edit: EntityPublicationEdit | undefined;
  let off = () => { /* No recipient before the seed. */ };
  try {
    seed();
    off = source.subscribe({ prepare(p, completion) {
      edit = p.ordinary[0]; held = completion as Completion; return undefined;
    }, complete() { /* Capture-only participant contributes no unit. */ } });
    finish(source, prepare(1, { x: 0, y: 0 }, { x: 1, y: 0 }));
    const first = source.evidence()?.field(1, 'x', 'ordinary');
    const live = source.captureViews(1, 'x')[0];
    off();
    // Do not read held.facts until after the next in-place-eligible operation.
    finish(source, prepare(1, { x: 1, y: 0 }, { x: 1, y: 0 }));
    const second = source.evidence()?.field(1, 'x', 'ordinary');
    expect(second).not.toBe(first);
    if (!held || !edit || !held.facts.forEdit) throw new Error('Missing held per-edit evidence');
    const saved = held.facts.forEdit(edit);
    expect(saved.field(1, 'x', 'ordinary')).toBe(first);
    expect(saved.field(1, 'x', 'physical')).toBe(first);
    expect(source.captureViews(1, 'x')[0]).toBe(live);
    expect((live as { requirement: object }).requirement).toBe(second);
    finish(source, prepare(1, { x: 1, y: 0 }, { x: 2, y: 0 }));
    expect(source.captureViews(1, 'x')[0]).not.toBe(live);
    expect(saved.field(1, 'x', 'ordinary')).toBe(first);
    expect(saved.field(1, 'x', 'physical')).toBe(first);
  } finally { off(); source.dispose(); }
});

it('preserves a reentrant inner installation and refuses the stale outer point', () => {
  const { source, prepare, seed } = fixture();
  let armed = true;
  try {
    seed();
    const before = { get x() {
      if (armed) { armed = false; finish(source, prepare(1, { x: 0, y: 0 }, { x: 99, y: 0 })); }
      return 0;
    }, y: 0 };
    expect(() => prepare(1, before, { x: 7, y: 0 })).toThrow('source changed during preparation');
    expect(armed).toBe(false);
    let endpoint: unknown;
    source.prepare(packet([], { prepareResponsibility: fields => { endpoint = fields?.before(1, 'x'); return undefined; } }));
    expect(endpoint).toMatchObject({ present: true, value: 99 });
  } finally { source.dispose(); }
});

it('seals point evidence for a recipient enrolled during preparation before refusing the attempt', () => {
  const { source, prepare, seed } = fixture();
  let held: Completion | undefined, edit: EntityPublicationEdit | undefined;
  let off = () => { /* The getter installs the first recipient. */ };
  let armed = true;
  try {
    seed();
    const original = source.evidence()?.field(1, 'x', 'ordinary');
    const before = { get x() {
      if (armed) {
        armed = false;
        off = source.subscribe({ prepare(p, completion) {
          edit = p.ordinary[0]; held = completion as Completion; return undefined;
        }, complete() { /* Capture-only participant contributes no unit. */ } });
      }
      return 0;
    }, y: 0 };
    expect(() => prepare(1, before, { x: 7, y: 0 })).toThrow('recipients changed during preparation');
    expect(source.evidence()?.field(1, 'x', 'ordinary')).toBe(original);
    off();
    finish(source, prepare(1, { x: 0, y: 0 }, { x: 9, y: 0 }));
    if (!held || !edit || !held.facts.forEdit) throw new Error('Missing refused point evidence');
    const saved = held.facts.forEdit(edit);
    expect(saved.field(1, 'x', 'ordinary')).not.toBe(original);
    expect(saved.field(1, 'x', 'ordinary')).not.toBe(source.evidence()?.field(1, 'x', 'ordinary'));
    expect(saved.field(1, 'x', 'physical')).toBe(saved.field(1, 'x', 'ordinary'));
  } finally { off(); source.dispose(); }
});

it('keeps ordinary support dynamic when only physical support was staged', () => {
  const { source, prepare, seed } = fixture();
  const foreign = signalTree({ x: 0 }, { enhancers: [transactions()] });
  let held: { facts: EntityPublicationEvidence; support(subject?: number, field?: string): NativeRequirement } | undefined;
  let off = () => { /* No recipient before the seed. */ };
  let pending: ReturnType<typeof foreign.transact> | undefined;
  try {
    seed();
    off = source.subscribe({ prepare(p, completion) {
      if (!p.ordinary.length) held = completion as typeof held;
      return undefined;
    }, complete() { /* Capture-only participant contributes no unit. */ } });
    finish(source, source.prepare(packet([], { physical: [{ subject: 1, before: { x: 0, y: 0 }, after: { x: 7, y: 0 }, fields: ['x'] }] })));
    if (!held) throw new Error('Missing physical-only completion');
    const physical = held.facts.field(1, 'x', 'physical');
    const ordinary = held.facts.field(1, 'x', 'ordinary');
    off();
    pending = foreign.transact(() => foreign.$.x(1));
    finish(source, prepare(1, { x: 7, y: 0 }, { x: 9, y: 0 }));
    const current = source.evidence()?.field(1, 'x', 'ordinary') as NativeRequirement;
    expect(current).not.toBe(ordinary);
    expect(held.facts.field(1, 'x', 'ordinary')).toBe(current);
    expect(held.facts.field(1, 'x', 'physical')).toBe(physical);
    expect(nativeProof(held.support(1, 'x')).possible).toEqual(nativeProof(current).possible);
    expect(nativeProof(current).possible).toHaveLength(1);
  } finally { off(); pending?.confirm(); foreign.destroy(); source.dispose(); }
});

it('preserves independent ordinary and physical field insertion order', () => {
  const { source } = fixture();
  let support: ((subject?: number, field?: string) => NativeRequirement) | undefined;
  const install = (fields: readonly string[], after: unknown, physicalOnly = false, ordinaryOnly = false) => {
    const edit = { subject: 1, before: undefined, after, fields };
    finish(source, source.prepare(packet(physicalOnly ? [] : [edit], ordinaryOnly ? { physical: [] } : { physical: [edit] })));
  };
  let off = () => { /* Capture only after constructing divergent key order. */ };
  try {
    install(['x'], { x: 1 });
    install(['y'], { x: 1, y: 2 }, true);
    install(['z'], { x: 1, y: 2, z: 3 }, false, true);
    install(['y'], { x: 1, y: 4, z: 3 }, false, true);
    const facts = source.evidence();
    if (!facts) throw new Error('Missing source evidence');
    const x = facts.field(1, 'x', 'ordinary'), y = facts.field(1, 'y', 'ordinary'), z = facts.field(1, 'z', 'ordinary');
    expect(source.captureViews(1).map(view => (view as { requirement: object }).requirement)).toEqual([
      facts.field(1, 'x', 'physical'), facts.field(1, 'y', 'physical'), facts.field(1, 'z', 'physical'),
    ]);
    off = source.subscribe({ prepare(_p, completion) {
      support = (completion as { support: typeof support }).support;
      return undefined;
    }, complete() { /* Capture-only participant contributes no unit. */ } });
    finish(source, source.prepare(packet([])));
    if (!support) throw new Error('Missing ordinary support');
    expect(support(1).components).toEqual([x, z, y]);
  } finally { off(); source.dispose(); }
});
