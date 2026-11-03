import { expect, it } from 'vitest';
import '../index';
import {
  EntityPublicationSource,
  type EntityPublicationEdit as Edit,
  type EntityPublicationPacket as Packet,
  type EntityPublicationEvidence as Evidence,
} from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import { initialRequirement } from './experimental-publication/lifecycle';
const edit = (
  subject: number,
  fields: string[],
  after: unknown,
  before: unknown = { x: 0, y: 0 }
): Edit => ({ subject, fields, after, before });
const packet = (
  ordinary: Edit[],
  physical: Edit[],
  extra: Partial<Packet> = {}
): Packet => ({
  owner: 1,
  id: {},
  meta: undefined,
  ordinary,
  physical,
  ...extra,
});
function install(source: EntityPublicationSource, p: Packet) {
  const unit = source.prepare(p);
  if (!unit) throw Error('native preparation missing');
  unit.finalize?.();
  installTerminalRecord(unit.record);
  source.complete(unit.completion);
}
function seeded() {
  const source = new EntityPublicationSource();
  const seed = edit(1, ['x', 'y'], { x: 0, y: 0 }, undefined);
  install(source, packet([seed], [seed]));
  return source;
}

it('unstepped duplicate physical subjects pair the first identity for every ordinary duplicate', () => {
  const source = seeded(),
    prior = source.evidence()!.field(1, 'y', 'physical');
  const p1 = edit(1, ['x'], { x: 1, y: 0 }),
    p2 = edit(1, ['y'], { x: 1, y: 42 });
  const a = edit(1, ['x'], { x: 1, y: 0 }),
    b = edit(1, ['x'], { x: 2, y: 0 }),
    other = edit(2, ['x'], { x: 3 });
  const first = initialRequirement(),
    last = initialRequirement();
  const aa: Edit = {
    ...a,
    restoredFields: new Map([
      ['x', { present: true, value: 1, requirement: first }],
    ]),
  };
  const bb: Edit = {
    ...b,
    restoredFields: new Map([
      ['x', { present: true, value: 2, requirement: last }],
    ]),
  };
  let calls = 0;
  const off = source.subscribe({
    prepare(p, native) {
      calls++;
      const facts = (native as { facts: Evidence }).facts;
      expect(p.ordinary[0]).toBe(aa);
      for (const e of [aa, bb])
        expect(facts.forEdit!(e).field(1, 'y', 'physical')).toBe(prior);
      expect(facts.forEdit!(aa).field(1, 'x', 'ordinary')).toBe(first);
      expect(facts.forEdit!(bb).field(1, 'x', 'ordinary')).toBe(last);
      expect(facts.field(1, 'y', 'physical')).not.toBe(prior);
      return undefined;
    },
    complete() { /* This participant has no completion side effect. */ },
  });
  try {
    install(source, packet([aa, other, bb], [p1, p2, other]));
    expect(calls).toBe(1);
  } finally {
    off();
    source.dispose();
  }
});

for (const mode of ['distinct', 'reused', 'later-missing'] as const)
  it(`steps keep local first-match and edit identity overwrite rules: ${mode}`, () => {
    const source = seeded(),
      prior = source.evidence()!.field(1, 'y', 'physical');
    const p1 = edit(1, ['x'], { x: 1, y: 0 }),
      p2 = edit(1, ['y'], { x: 1, y: 42 }),
      p3 = edit(1, ['y'], { x: 1, y: 99 });
    const a = edit(1, ['x'], { x: 1, y: 0 }),
      b = mode === 'distinct' ? edit(1, ['x'], { x: 2, y: 0 }) : a,
      other = edit(2, ['x'], { x: 3 });
    let calls = 0;
    const off = source.subscribe({
      prepare(_p, native) {
        calls++;
        const facts = (native as { facts: Evidence }).facts;
        if (mode === 'reused')
          expect(facts.forEdit!(a).field(1, 'y', 'physical')).not.toBe(prior);
        else expect(facts.forEdit!(a).field(1, 'y', 'physical')).toBe(prior);
        if (mode === 'distinct')
          expect(facts.forEdit!(b).field(1, 'y', 'physical')).not.toBe(prior);
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      install(
        source,
        packet([edit(1, ['x'], { x: 999 })], [p1, p2, p3, other], {
          steps: [
            { ordinal: 8, ordinary: [a, other], physical: [p1, other] },
            {
              ordinal: 1,
              ordinary: [b, other],
              physical: mode === 'later-missing' ? [other] : [p2, p3, other],
            },
          ],
        })
      );
      expect(calls).toBe(1);
    } finally {
      off();
      source.dispose();
    }
  });

it('a step with no physical list does not borrow the packet physical match', () => {
  const source = seeded(),
    prior = source.evidence()!.field(1, 'y', 'physical');
  const p1 = edit(1, ['x'], { x: 1, y: 0 }),
    p2 = edit(1, ['y'], { x: 1, y: 42 });
  const a = edit(1, ['x'], { x: 1 }),
    other = edit(2, ['x'], { x: 3 });
  let calls = 0;
  const off = source.subscribe({
    prepare(_p, native) {
      calls++;
      const facts = (native as { facts: Evidence }).facts;
      expect(facts.forEdit!(a).field(1, 'y', 'physical')).not.toBe(prior);
      return undefined;
    },
    complete() { /* This participant has no completion side effect. */ },
  });
  try {
    install(
      source,
      packet([a, other], [p1, p2, other], {
        steps: [{ ordinal: 0, ordinary: [a, other] }],
      })
    );
    expect(calls).toBe(1);
  } finally {
    off();
    source.dispose();
  }
});

it('authoredRemoval followed by same-subject restore keeps the restored edit physical pairing', () => {
  const source = seeded(),
    prior = source.evidence()!.field(1, 'y', 'physical');
  const remove: Edit = {
    subject: 1,
    before: { x: 0, y: 0 },
    after: undefined,
    fields: [],
    structural: { kind: 'remove', subject: 1 },
  };
  const restore: Edit = {
    ...edit(1, ['x'], { x: 5 }),
    structural: { kind: 'add', subject: 1 },
  };
  const other = edit(2, ['x'], { x: 3 });
  const physicalRestore = edit(1, ['x', 'y'], { x: 5, y: 22 }, undefined);
  let calls = 0;
  const off = source.subscribe({
    prepare(p, native) {
      calls++;
      expect(p.steps![0].authoredRemoval).toBe(remove);
      const facts = (native as { facts: Evidence }).facts;
      expect(facts.forEdit!(restore).field(1, 'y', 'physical')).not.toBe(prior);
      return undefined;
    },
    complete() { /* This participant has no completion side effect. */ },
  });
  try {
    install(
      source,
      packet([], [remove, physicalRestore, other], {
        steps: [
          {
            ordinal: 0,
            ordinary: [other],
            authoredRemoval: remove,
            physical: [remove, other],
          },
          {
            ordinal: 0,
            ordinary: [restore, other],
            physical: [physicalRestore, other],
          },
        ],
      })
    );
    expect(calls).toBe(1);
    expect(source.inspect().negativePresence).toBe(0);
  } finally {
    off();
    source.dispose();
  }
});

it('unique-subject prepared readers survive installation, refused preparation and later writes', () => {
  const source = new EntityPublicationSource();
  const first = initialRequirement(), second = initialRequirement(), later = initialRequirement();
  const a: Edit = { ...edit(1, ['x'], { x: 1 }, undefined),
    restoredFields: new Map([['x', { present: true, value: 1, requirement: first }]]) };
  const b: Edit = { ...edit(2, ['x'], { x: 2 }, undefined),
    restoredFields: new Map([['x', { present: true, value: 2, requirement: second }]]) };
  let saved: Evidence | undefined;
  const off = source.subscribe({ prepare(_packet, native) {
    saved ??= (native as { facts: Evidence }).facts;
    return undefined;
  }, complete() { /* This participant only captures prepared readers. */ } });
  const check = () => {
    if (!saved?.forEdit) throw Error('missing per-edit readers');
    expect(saved.forEdit(a).field(1, 'x', 'ordinary')).toBe(first);
    expect(saved.forEdit(b).field(2, 'x', 'ordinary')).toBe(second);
  };
  try {
    const unit = source.prepare(packet([a, b], [a, b]));
    if (!unit) throw Error('missing native unit');
    check(); unit.finalize?.(); installTerminalRecord(unit.record); source.complete(unit.completion); check();
    const c: Edit = { ...edit(1, ['x'], { x: 3 }, { x: 1 }),
      restoredFields: new Map([['x', { present: true, value: 3, requirement: later }]]) };
    const refused = source.subscribe({ prepare() { throw Error('refusal'); },
      complete() { throw Error('refused preparation cannot complete'); } });
    try { expect(() => source.prepare(packet([c], [c]))).toThrow('refusal'); }
    finally { refused(); }
    check(); install(source, packet([c], [c])); check();
    expect(source.evidence()?.field(1, 'x', 'ordinary')).toBe(later);
  } finally { off(); source.dispose(); }
});
