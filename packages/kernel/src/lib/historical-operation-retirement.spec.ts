import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import * as life from './experimental-publication/lifecycle';
import * as publication from './experimental-publication/private';
import { getEntityPublicationBinding } from './internals/entity-publication';
import { getPathNotifier } from './path-notifier';
import { getPositionRegistry } from './internals/position-registry';
import { writeDiagnostic } from '../../test/optional-diagnostic';

type Row = { id: string; v: number };
type Operation = life.OwnerCell['dependents'] extends Set<infer T> ? T : never;
type Unit = { fact: object; previous?: object; complete: boolean };
type Binding = { source?: object; current?: object; pending: Set<Unit>; index: object;
  delivery: { reducing: boolean; projected?: { fact: object } }; legacyScalars: unknown[] };
type Connection = { ops: Map<object, Operation>; disposed: boolean };
type DeclaringLink = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' | 'unknown' } | { kind: 'dependent'; owners: readonly object[] },
    work: () => unknown): { read(): { state: string; reason?: string } };
};
const roles = ['owners', 'destination', 'input', 'validation', 'possible'] as const;
const flags = ['unknown', 'invalid', 'unavailableInput', 'historicalWindow', 'terminalRejectedRoles'] as const;
const drain = async () => { getPathNotifier().flushSync(); for (let n = 0; n < 160; n++) await Promise.resolve(); };
async function settled(c: ReturnType<typeof link>) {
  let done = false; const wait = c.settled().then(() => { done = true; });
  await drain(); expect(done, 'actual Link settlement after fixed drain').toBe(true); await wait;
}
function proofSnapshot(p: Readonly<life.Proof>) {
  return { roles: roles.map(k => [...(p[k] ?? [])]), flags: flags.map(k => ({ present: Object.prototype.hasOwnProperty.call(p, k), value: p[k] })) };
}
function expectProof(p: Readonly<life.Proof>, saved: ReturnType<typeof proofSnapshot>) {
  roles.forEach((k, i) => { const values = p[k] ?? []; expect(values).toHaveLength(saved.roles[i].length);
    values.forEach((cell, n) => expect(cell).toBe(saved.roles[i][n])); });
  expect(flags.map(k => ({ present: Object.prototype.hasOwnProperty.call(p, k), value: p[k] }))).toEqual(saved.flags);
}
const record = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object';
function isBinding(x: unknown): x is Binding {
  return record(x) && x.pending instanceof Set && record(x.delivery) && record(x.index) && Array.isArray(x.legacyScalars);
}
function isConnection(x: unknown): x is Connection {
  return record(x) && x.ops instanceof Map && typeof x.disposed === 'boolean' && typeof x.wake === 'function';
}
function isUnit(x: unknown): x is Unit {
  return record(x) && record(x.fact) && typeof x.complete === 'boolean';
}

// Test-local observation of existing private maps. No production export/counter,
// no registry mutation, no timer, and no collection or heap claim. Strong test
// references deliberately preserve exact identities for the assertions.
function observeRegistries() {
  const mapDescriptor = Object.getOwnPropertyDescriptor(Map.prototype, 'set');
  const deleteDescriptor = Object.getOwnPropertyDescriptor(Set.prototype, 'delete');
  if (!mapDescriptor || !deleteDescriptor) throw new Error('Missing intrinsic descriptor');
  const originalSet = Map.prototype.set, originalDelete = Set.prototype.delete;
  const bindingMaps: Array<{ map: Map<unknown, unknown>; channel: object }> = [];
  const connections: Array<{ map: Map<unknown, unknown>; channel: object; connection: Connection }> = [];
  const pendingSets = new WeakMap<object, { map: Map<unknown, unknown>; channel: object; binding: Binding }>();
  const tokens = new WeakMap<object, number>(); let serial = 0;
  const token = (x: object | undefined) => { if (!x) return null; let n = tokens.get(x); if (n === undefined) tokens.set(x, n = ++serial); return n; };
  const completedOperations: Array<{ channel: object; fact: object; operation: Operation;
    proof?: Readonly<life.Proof>; meaning?: ReturnType<typeof proofSnapshot> }> = [];
  const completed: Array<{ fact: number | null; previous: number | null; current: number | null; selected: number | null; remaining: Array<{ fact: number | null; previous: number | null }> }> = [];
  Object.defineProperty(Map.prototype, 'set', { ...mapDescriptor, value: function(this: Map<unknown, unknown>, key: unknown, value: unknown) {
    const answer = originalSet.call(this, key, value);
    if (record(key) && isBinding(value)) {
      if (!bindingMaps.some(x => x.map === this && x.channel === key)) bindingMaps.push({ map: this, channel: key });
      pendingSets.set(value.pending, { map: this, channel: key, binding: value });
    }
    if (record(key) && isConnection(value) && !connections.some(x => x.connection === value)) connections.push({ map: this, channel: key, connection: value });
    return answer;
  } });
  Object.defineProperty(Set.prototype, 'delete', { ...deleteDescriptor, value: function(this: Set<unknown>, value: unknown) {
    const owner = pendingSets.get(this), answer = originalDelete.call(this, value);
    if (answer && owner && isUnit(value) && value.complete) {
      const actual = owner.map.get(owner.channel);
      if (isBinding(actual) && actual.pending === this && actual.index === owner.binding.index) {
        const connection = connections.find(x => x.channel === owner.channel && x.map.get(x.channel) === x.connection)?.connection;
        const operation = connection?.ops.get(value.fact);
        if (operation) {
          const proof = operation.proof;
          completedOperations.push({ channel: owner.channel, fact: value.fact, operation,
            proof, meaning: proof && proofSnapshot(proof) });
        }
        completed.push({
        fact: token(value.fact), previous: token(value.previous), current: token(actual.current), selected: token(actual.delivery.projected?.fact),
        remaining: [...actual.pending].map(u => ({ fact: token(u.fact), previous: token(u.previous) })),
      });
      }
    }
    return answer;
  } });
  return {
    completed, completedOperations, token,
    at(source: object) {
      const matches = bindingMaps.flatMap(x => { const b = x.map.get(x.channel); return isBinding(b) && b.source === source ? [{ ...x, binding: b }] : []; });
      expect(matches).toHaveLength(1); const found = matches[0]; if (!found) throw new Error('No actual source Binding');
      const cs = connections.filter(x => x.channel === found.channel && x.map.get(x.channel) === x.connection);
      expect(cs).toHaveLength(1); const c = cs[0]; if (!c) throw new Error('No actual Connection');
      return { ...found, connection: c.connection, ops: [...c.connection.ops.values()] };
    },
    restore() { Object.defineProperty(Map.prototype, 'set', mapDescriptor); Object.defineProperty(Set.prototype, 'delete', deleteDescriptor); },
  };
}

describe('completed obsolete operation registry ownership', () => {
  it('4 × 4 rollback aging preserves issued rejection, exact old facts and late consumers before checking obsolete registry work', async () => {
    const observed = observeRegistries();
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const rows = tree.$.rows, source = getEntityPublicationBinding(rows)!.source;
    const sent: Row[][] = [], lateSent: Row[][] = [];
    const c = link(rows, { set: value => { sent.push(value.map(r => ({ ...r }))); } });
    let late: ReturnType<typeof link> | undefined, pending: { rollback(): unknown } | undefined;
    const held: Array<() => Row | undefined> = [], subjects: number[] = [], issued: life.NativeInput[] = [];
    const issuedOriginal: Array<{ input: life.NativeInput; requirement: life.NativeRequirement; owners: readonly life.OwnerCell[] }> = [];
    const counts: Array<{ current: number; obsolete: number }> = [];
    try {
      await drain(); expect(sent).toEqual([]);
      for (let k = 1; k <= 4; k++) {
        const values = Array.from({ length: 4 }, (_, i) => ({ id: `R-${k}-${i}`, v: k * 10 + i }));
        const beforeOwners = new Set(life.pendingOwners()); pending = tree.transact(() => rows.setAll(values));
        expect(rows.all()).toEqual(values); await drain(); expect(sent).toEqual(k === 1 ? [] : [[]]);
        const owners = life.pendingOwners().filter(o => !beforeOwners.has(o)); expect(owners).toHaveLength(1);
        expect(owners[0].dependents.size, 'real pending operation subscriptions').toBeGreaterThan(0);
        for (const r of values) { const handle = rows.byIdOrFail(r.id); subjects.push(getEntityPublicationBinding(handle)!.subject!); }
        held.push(rows.byIdOrFail(values[0].id));
        const captured = source.captureInput() as { native: readonly life.NativeInput[] };
        expect(captured.native.length).toBeGreaterThan(0);
        for (const input of captured.native) { issued.push(input); issuedOriginal.push({ input, requirement: input.requirement, owners: input.owners }); }
        pending.rollback(); pending = undefined; await drain(); await settled(c);
        expect(rows.all()).toEqual([]); expect(sent).toEqual([[]]); expect(held.every(h => h() === undefined)).toBe(true);
        expect(owners[0].outcome).toBe('rolled-back');
        const actual = observed.at(rows);
        expect(actual.binding.pending.size).toBe(0);
        counts.push({ current: actual.ops.filter(o => o.revision === actual.binding.current).length, obsolete: actual.ops.filter(o => o.revision !== actual.binding.current).length });
      }
      expect(counts.at(-1)?.current, 'real current registered operation is protected').toBe(1);
      expect(observed.completed.length, 'actual completed Unit reductions observed').toBeGreaterThan(4);
      const evidence = source.evidence()!;
      const facets = (subject: number) => (['physical', 'ordinary'] as const).flatMap(view => [evidence.member(subject, view), evidence.field(subject, 'v', view), evidence.placement(subject, view), evidence.keyMapping(subject, view)] as life.NativeRequirement[]);
      const saved = subjects.map(subject => facets(subject).map(requirement => ({ requirement, proof: proofSnapshot(life.nativeProof(requirement)) })));
      expect(new Set(issued.flatMap(x => x.owners).filter(o => o.outcome === 'rolled-back')).size).toBe(4);
      for (const x of issuedOriginal) { expect(x.input.requirement).toBe(x.requirement); expect(x.input.owners).toBe(x.owners); }
      const consumed = life.prepareNativeRequirement([], false, issued);
      expect(consumed.record.adds).toHaveLength(0); life.finalizeNativeRequirement(consumed.requirement);
      const consumedProof = life.nativeProof(consumed.requirement);
      for (const owner of new Set(issued.flatMap(x => x.owners))) expect(consumedProof.input).toContain(owner);
      expect(consumedProof.input?.some(o => o.outcome === 'rolled-back')).toBe(true);
      life.deliverNativeRequirementReady(consumed.requirement);
      late = link(rows, { set: value => { lateSent.push(value.map(r => ({ ...r }))); } });
      await drain(); expect(lateSent).toEqual([]);
      rows.addOne({ id: 'R-1-0', v: 999 }); await drain(); await settled(c); await settled(late);
      expect(sent).toEqual([[], [{ id: 'R-1-0', v: 999 }]]); expect(lateSent).toEqual([[{ id: 'R-1-0', v: 999 }]]);
      expect(held.every(h => h() === undefined)).toBe(true);
      subjects.forEach((subject, i) => facets(subject).forEach((requirement, n) => { expect(requirement).toBe(saved[i][n].requirement); expectProof(life.nativeProof(requirement), saved[i][n].proof); }));
      // Sole baseline-expected cost failure, after all useful public/evidence
      // assertions. Preserve the exact prefix counts; never infer heap bytes.
      expect(counts.map(x => x.obsolete), 'completed noncurrent registry entries').toEqual([0, 0, 0, 0]);
    } finally {
      writeDiagnostic(process.env['ST_I_RETIREMENT_TRACE'], JSON.stringify({ counts, completed: observed.completed }, null, 2) + '\n');
      late?.dispose(); c.dispose(); pending?.rollback(); tree.destroy(); observed.restore();
    }
  });

  it('protects actual queued current and incoming equal-write fallback until useful pending confirmation', async () => {
    const observed = observeRegistries(), tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = []; const c = link(tree.$.y, { set: v => { sent.push(v); } }) as DeclaringLink;
    const p = tree.transact(() => tree.$.x(7)); let ended = false;
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => {
        tree.$.y(7); tree.$.y(7);
        const s = observed.at(tree.$.y), pending = [...s.binding.pending];
        expect(pending).toHaveLength(2); expect(pending.every(u => u.complete)).toBe(true);
        expect(pending[1].previous).toBe(pending[0].fact); expect(s.binding.current).toBe(pending[1].fact);
        const newer = s.connection.ops.get(pending[1].fact), older = s.connection.ops.get(pending[0].fact);
        expect(newer).toBeDefined(); expect(older).toBeDefined();
        if (!newer || !older) throw new Error('Missing actual fallback operations');
        expect([...newer.noopFallbacks.values()]).toContain(older); expect(older.declared).toBe(true);
        publication.refreshSource(s.channel);
        expect(s.connection.ops.get(older.revision)).toBe(older); expect(s.connection.ops.get(newer.revision)).toBe(newer);
      });
      await drain(); expect(tree.$.y()).toBe(7); expect(sent).toEqual([]);
      expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' });
      p.confirm(); ended = true; await drain(); await settled(c);
      expect(sent).toEqual([7]); expect(receipt.read().state).toBe('started');
      const noop = c.declare({ kind: 'independent' }, () => tree.$.y(7)); await drain();
      expect(noop.read()).toEqual({ state: 'no-write' }); expect(sent).toEqual([7]); expect(receipt.read().state).toBe('started');
    } finally { c.dispose(); if (!ended) p.rollback(); tree.destroy(); observed.restore(); }
  });

  it('retains a rejected declared receipt and unresolved waiter until explicit disposal', async () => {
    const tree = signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [transactions()] });
    const sent: number[] = []; const c = link(tree.$.y, { set: v => { sent.push(v); } }) as DeclaringLink;
    const p = tree.transact(() => tree.$.x(7)), q = tree.transact(() => tree.$.z(9)); let ended = false;
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(tree.$.x()));
      await drain(); expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' }); expect(sent).toEqual([]);
      let done = false; const wait = c.settled().then(() => { done = true; });
      p.rollback(); ended = true; await drain();
      expect(tree.$.x()).toBe(0); expect(tree.$.y()).toBe(7); expect(done).toBe(false);
      expect(receipt.read()).toEqual({ state: 'conservative', reason: 'rejected-dependency' }); expect(sent).toEqual([]);
      c.dispose(); await drain(); expect(done).toBe(true); await wait;
      expect(receipt.read()).toEqual({ state: 'disposed' }); expect(sent).toEqual([]);
    } finally { c.dispose(); if (!ended) p.rollback(); q.rollback(); tree.destroy(); }
  });

  it('preserves active declaration frames and the newer value when settlement reenters from a returned getter', async () => {
    const observed = observeRegistries(), tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = []; const c = link(tree.$.y, { set: v => { sent.push(v); } }) as DeclaringLink;
    const p = tree.transact(() => tree.$.x(7)); let ended = false, getters = 0;
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => {
        tree.$.y(7);
        return Object.defineProperty({}, 'then', { get() {
          getters++; p.confirm(); ended = true; tree.$.y(8);
          const s = observed.at(tree.$.y); expect(life.isValidating()).toBe(true);
          expect(s.binding.pending.size).toBeGreaterThan(0); expect(s.ops.some(o => o.frames.size > 0 && o.revision === s.binding.current)).toBe(true);
          publication.refreshSource(s.channel); expect(s.connection.ops.has(s.binding.current!)).toBe(true); expect(sent).toEqual([]);
          return undefined;
        } });
      });
      expect(getters).toBe(1); await drain(); await settled(c);
      expect(tree.$.x()).toBe(7); expect(tree.$.y()).toBe(8); expect(sent).toEqual([8]); expect(receipt.read().state).toBe('started');
    } finally { c.dispose(); if (!ended) p.rollback(); tree.destroy(); observed.restore(); }
  });

  it('does not retire an installed but uncompleted recipient unit when an earlier participant requests readiness', async () => {
    const observed = observeRegistries(), tree = signalTree({ rows: entityMap<Row, string>() });
    const rows = tree.$.rows, source = getEntityPublicationBinding(rows)!.source, sent: Row[][] = [];
    let checked = 0;
    // Registration order is deliberate: the Link's record is installed before
    // source completion, but this participant completes before the Link does.
    const off = source.subscribe({
      prepare: packet => packet.physical.length ? { record: { writes: [], adds: [] }, completion: {} } : undefined,
      complete() {
        const s = observed.at(rows), pending = [...s.binding.pending].filter(u => !u.complete);
        expect(pending.length, 'actual installed, incomplete Link unit').toBeGreaterThan(0);
        const unit = pending[0], operation = s.connection.ops.get(unit.fact);
        expect(operation).toBeDefined(); expect(unit.complete).toBe(false);
        publication.refreshSource(s.channel);
        expect(s.binding.pending.has(unit)).toBe(true); expect(unit.complete).toBe(false);
        expect(s.connection.ops.get(unit.fact)).toBe(operation); checked++;
      },
    });
    const c = link(rows, { set: value => { sent.push(value.map(r => ({ ...r }))); } });
    try {
      rows.addOne({ id: 'one', v: 7 }); await drain(); await settled(c);
      expect(checked).toBeGreaterThan(0); expect(rows.all()).toEqual([{ id: 'one', v: 7 }]); expect(sent).toEqual([[{ id: 'one', v: 7 }]]);
      expect(observed.at(rows).binding.pending.size).toBe(0);
    } finally { off(); c.dispose(); tree.destroy(); observed.restore(); }
  });

  it('protects an undeclared first fact restored by a queued equal second write', async () => {
    const observed = observeRegistries(), tree = signalTree({ target: 0, foreign: 0 });
    const sent: number[] = [], unrelated: number[] = [];
    const c = link(tree.$.target, { set: v => { sent.push(v); } });
    const other = link(tree.$.foreign, { set: v => { unrelated.push(v); } }) as DeclaringLink;
    const queued: { first?: Unit; second?: Unit; channel?: object } = {};
    try {
      // A foreign frame forces meaningful equal-write publication but is not a
      // matching declaration for either target operation. The declared guard
      // must not mask an accidentally removed final-current check.
      const receipt = other.declare({ kind: 'unknown' }, () => {
        tree.$.target(7); tree.$.target(7);
        const actual = observed.at(tree.$.target), units = [...actual.binding.pending];
        expect(units).toHaveLength(2); const [first, second] = units;
        if (!first || !second) throw new Error('Missing actual two target units');
        queued.first = first; queued.second = second; queued.channel = actual.channel;
        expect(second.previous).toBe(first.fact); expect(actual.binding.current).toBe(second.fact);
        expect(actual.connection.ops.get(first.fact)?.declared).toBe(false);
        expect(actual.connection.ops.get(second.fact)?.declared).toBe(false);
        expect(sent).toEqual([]);
      });
      expect(receipt.read()).toEqual({ state: 'no-write' });
      const { first, second, channel } = queued;
      if (!first || !second || !channel) throw new Error('Missing actual queued target facts');
      const selected = publication.refreshSource(channel), actual = observed.at(tree.$.target);
      expect(actual.binding.pending.size).toBe(0);
      expect(actual.binding.current, 'actual no-write restoration selects the first fact').toBe(first.fact);
      expect(selected?.fact).toBe(first.fact); expect(selected?.payload).toBe(7);
      const proof = life.proof(channel, first.fact);
      expect(proof, 'current undecorated proof remains registered before its actual send').toBeDefined();
      expect(actual.connection.ops.get(first.fact)?.declared).toBe(false);
      expect(life.hasDeclaration(channel, first.fact)).toBe(false);
      await drain(); await settled(c);
      expect(tree.$.target()).toBe(7); expect(sent).toEqual([7]); expect(unrelated).toEqual([]);
      expect(receipt.read()).toEqual({ state: 'no-write' });
    } finally { other.dispose(); c.dispose(); tree.destroy(); observed.restore(); }
  });

  it('rechecks the same recipient after a real payload getter replaces its Binding during reduction', async () => {
    const observed = observeRegistries(), tree = signalTree({ a: 0, b: 0 });
    const registry = getPositionRegistry(tree.$)!, channel = {}, reports: unknown[] = [];
    let armed = false, reentries = 0, installedCurrent: object | undefined;
    // Supported private producer-boundary fixture, like the existing terminal
    // consumer tests. This is not a public snapshot getter reachability claim.
    const payload = Object.defineProperty({ b: 0 }, 'a', { enumerable: true, configurable: true, get() {
      if (armed) {
        armed = false; reentries++;
        const before = observed.at(tree.$);
        expect(before.binding.delivery.reducing).toBe(true);
        tree.$.a(7);
        const after = observed.at(tree.$);
        expect(after.binding).not.toBe(before.binding);
        expect(after.binding.index).toBe(before.binding.index);
        expect(after.binding.pending).toBe(before.binding.pending);
        expect(after.binding.delivery).toBe(before.binding.delivery);
        expect(after.binding.current).not.toBe(before.binding.current);
        installedCurrent = after.binding.current;
        expect(after.connection.ops.get(installedCurrent!)?.declared).toBe(false);
      }
      return 0;
    } });
    publication.bindSource(channel, registry.id, 1, { supported: true }, error => { reports.push(error); }, tree.$,
      { registry, address: [], value: payload, aggregate: true, presence: [] });
    try {
      armed = true; tree.$.b(1);
      const selected = publication.refreshSource(channel), actual = observed.at(tree.$);
      expect(reentries).toBe(1); expect(installedCurrent).toBeDefined();
      expect(actual.binding.current).toBe(installedCurrent); expect(actual.binding.pending.size).toBe(0);
      expect(selected?.fact).toBe(installedCurrent); expect(selected?.payload).toEqual({ a: 7, b: 1 });
      expect(life.proof(channel, installedCurrent!), 'new current proof survives cleanup on the stale wrapper').toBeDefined();
      expect(actual.connection.ops.get(installedCurrent!)?.declared).toBe(false);
      expect(tree.$.a()).toBe(7); expect(tree.$.b()).toBe(1); expect(reports).toEqual([]);
      if (!selected) throw new Error('Missing selected replacement projection');
      publication.acknowledgeProjection(channel, selected);
      expect(publication.refreshSource(channel)?.changed).toBe(false);
      await drain(); expect(reports).toEqual([]);
    } finally { publication.dispose(channel, {}); tree.destroy(); observed.restore(); }
  });

  it('preserves a ready native proof with an exact foreign pending window after that owner source is destroyed', async () => {
    const observed = observeRegistries();
    const foreign = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const rows = tree.$.rows, source = getEntityPublicationBinding(rows)!.source, sent: Row[][] = [];
    const c = link(rows, { set: value => { sent.push(value.map(r => ({ ...r }))); } });
    let pending: { rollback(): unknown } | undefined;
    const pendingFactTrace: unknown[] = [];
    try {
      const before = new Set(life.pendingOwners()); foreign.transact(() => foreign.$.x(91));
      const cells = life.pendingOwners().filter(cell => !before.has(cell)); expect(cells).toHaveLength(1);
      const foreignOwner = cells[0]; const subjects: number[] = [];
      for (let i = 1; i <= 2; i++) {
        const value = { id: `pending-${i}`, v: i }; pending = tree.transact(() => rows.setAll([value]));
        expect(rows.all()).toEqual([value]); subjects.push(getEntityPublicationBinding(rows.byIdOrFail(value.id))!.subject!);
        pending.rollback(); pending = undefined; await drain(); expect(rows.all()).toEqual([]); expect(sent).toEqual([]);
      }
      const actual = observed.at(rows); expect(actual.binding.pending.size).toBe(0);
      const current = actual.connection.ops.get(actual.binding.current!); expect(current).toBeDefined();
      if (!current?.proof) throw new Error('Expected actual current ready proof');
      expect(current.projectionPending).toBe(false); expect(current.proof.possible).toContain(foreignOwner);
      const requirements = subjects.map(subject => source.evidence()!.member(subject, 'physical') as life.NativeRequirement);
      for (const requirement of requirements) {
        expect(life.nativeRequirementReady(requirement)).toBe(true);
        expect(life.nativeProof(requirement).possible).toContain(foreignOwner);
      }
      const saved = requirements.map(r => proofSnapshot(life.nativeProof(r)));
      // Capture all qualifying historical facts by their actual completion proof,
      // not one completion-order entry or a chosen retired registry token. The
      // old first-entry check missed the newly retired sibling in a rollback.
      const historical = observed.completedOperations.filter((x, i, all) =>
        x.channel === actual.channel && x.fact !== actual.binding.current && !x.operation.declared &&
        x.proof?.possible?.includes(foreignOwner) && all.findIndex(y => y.channel === x.channel && y.fact === x.fact) === i);
      expect(historical.length, 'completed noncurrent facts carrying the exact foreign pending owner').toBeGreaterThan(0);
      const checkHistorical = (phase: string) => {
        const state = observed.at(rows);
        // With no Fact this is precisely the queue/index fallback. It must be
        // false so the per-fact true decisions cannot pass through that mask.
        const pendingWithoutFact = publication.pendingDecision(undefined, actual.channel);
        const decisions = historical.map(x => {
          const fact = x.fact as Parameters<typeof publication.pendingDecision>[0];
          return { entry: x, pending: publication.pendingDecision(fact, actual.channel),
            allowed: publication.allowed(fact, 0, 0, actual.channel) };
        });
        // Serialize the entire population before any assertion can stop the
        // test. Tokens are diagnostic identities only, never selection rules.
        pendingFactTrace.push({ phase, pendingWithoutFact,
          foreignOwner: { owner: foreignOwner.owner, id: foreignOwner.id, outcome: foreignOwner.outcome },
          facts: decisions.map(({ entry: x, pending, allowed }) => ({
            fact: observed.token(x.fact), registered: state.connection.ops.get(x.fact) === x.operation,
            current: x.fact === state.binding.current, pending, allowed,
            sameProof: x.operation.proof === x.proof,
            completionRoles: roles.map((role, i) => ({ role, cells: (x.meaning?.roles[i] ?? []).map(cell =>
              ({ owner: cell.owner, id: cell.id, outcome: cell.outcome })) })),
          })) });
        expect(pendingWithoutFact, 'historical decisions have no queued or unresolved fallback mask').toBe(false);
        for (const { entry: x, pending, allowed } of decisions) {
          expect(x.proof).toBeDefined(); expect(x.meaning).toBeDefined();
          if (!x.proof || !x.meaning) throw new Error('Missing actual completion proof snapshot');
          expect(x.operation.proof, 'completed historical operation retains its exact proof').toBe(x.proof);
          expectProof(x.operation.proof!, x.meaning);
          expect(x.proof.possible).toContain(foreignOwner);
          expect(pending, 'every historical fact keeps its cached foreign pending decision').toBe(true);
          expect(allowed, 'noncurrent historical facts cannot send').toBe(false);
        }
      };
      checkHistorical('before-foreign-source-destruction');
      let done = false; const wait = c.settled().then(() => { done = true; }); await drain(); expect(done).toBe(false);
      foreign.destroy(); await drain();
      // This removes the foreign store's durable-scope masking while preserving
      // the actual unknown outcome. Readiness is not owner confirmation.
      expect(foreignOwner.outcome).toBe('pending'); expect(done).toBe(false); expect(sent).toEqual([]);
      checkHistorical('after-foreign-source-destruction');
      subjects.forEach((subject, i) => {
        const currentRequirement = source.evidence()!.member(subject, 'physical') as life.NativeRequirement;
        expect(currentRequirement).toBe(requirements[i]); expectProof(life.nativeProof(currentRequirement), saved[i]);
      });
      expect(observed.at(rows).connection.ops.get(actual.binding.current!)?.proof?.possible).toContain(foreignOwner);
      c.dispose(); await drain(); expect(done).toBe(true); await wait; expect(sent).toEqual([]);
    } finally {
      writeDiagnostic(process.env['ST_I_PENDING_FACT_TRACE'], JSON.stringify({ phases: pendingFactTrace }, null, 2) + '\n');
      c.dispose(); pending?.rollback(); tree.destroy(); foreign.destroy(); observed.restore();
    }
  });
});
