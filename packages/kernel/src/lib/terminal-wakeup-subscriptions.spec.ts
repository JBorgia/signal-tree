import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import * as life from './experimental-publication/lifecycle';
import { EntityPublicationSource } from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import { getPathNotifier } from './path-notifier';

type Operation = life.OwnerCell['dependents'] extends Set<infer T> ? T : never;
type Terminal = Exclude<life.Outcome, 'pending'>;
type DeclaringLink = ReturnType<typeof link> & {
  declare(
    input: { kind: 'independent' } | { kind: 'dependent'; owners: readonly object[] },
    work: () => unknown
  ): { read(): { state: string; reason?: string } };
};
const roles = ['owners', 'destination', 'input', 'validation', 'possible'] as const;
const flags = ['unknown', 'invalid', 'unavailableInput', 'historicalWindow', 'terminalRejectedRoles'] as const;
const drain = async () => {
  getPathNotifier().flushSync();
  for (let step = 0; step < 160; step++) await Promise.resolve();
};
const proofOf = (cell: life.OwnerCell): life.Proof => ({
  owners: [cell], destination: [cell], input: [cell], validation: [cell],
  possible: [cell], unknown: false, invalid: false,
});
function snapshotProof(proof: Readonly<life.Proof>) {
  return {
    roles: roles.map(role => [...(proof[role] ?? [])]),
    flags: flags.map(key => ({ present: Object.prototype.hasOwnProperty.call(proof, key), value: proof[key] })),
  };
}
function expectProof(proof: Readonly<life.Proof>, saved: ReturnType<typeof snapshotProof>) {
  roles.forEach((role, index) => {
    const actual = proof[role] ?? [];
    expect(actual).toHaveLength(saved.roles[index].length);
    actual.forEach((cell, position) => expect(cell).toBe(saved.roles[index][position]));
  });
  expect(flags.map(key => ({ present: Object.prototype.hasOwnProperty.call(proof, key), value: proof[key] }))).toEqual(saved.flags);
}
function newPublicCell(previous: ReadonlySet<life.OwnerCell>): life.OwnerCell {
  const added = life.pendingOwners().filter(cell => !previous.has(cell));
  expect(added).toHaveLength(1);
  const cell = added[0];
  if (!cell) throw new Error('Expected one newly opened public owner');
  return cell;
}
function operationWithView(cell: life.OwnerCell): Operation {
  const operation = [...cell.dependents].find(item => item.views.size > 0);
  if (!operation) throw new Error('Expected actual declared operation with a receipt view');
  return operation;
}
let serial = 1_920_000;
function fixture() {
  const owner = ++serial, channel = {}, revision = {};
  let wakes = 0;
  const reports: unknown[] = [];
  life.registerOwnerSource(owner, {});
  life.ownerTransition(owner, { kind: 'opened', transactionId: 1 });
  const cell = life.ownerCell(owner, 1);
  if (!cell) throw new Error('Expected registered pending owner');
  const handle = life.enroll({}, owner, 1);
  life.registerConnection(channel, {
    supported: true,
    report: error => { reports.push(error); },
    wake: () => { wakes++; },
  });
  return {
    cell, handle, channel, revision, reports,
    wakes: () => wakes,
    end(outcome: Terminal) { life.ownerTransition(owner, { kind: outcome, transactionId: 1 }); },
    dispose() { life.disposeConnection(channel); life.abandonOwnerSource(owner); },
  };
}

// Private lifecycle/source fixtures exercise registration ordering. They do not
// simulate an application write, invent proof-erasure permission, or require a
// particular terminal-record adapter implementation.
describe('terminal notification indexes: private lifecycle fixtures', () => {
  for (const action of ['supersede', 'dispose'] as const) {
    it(`clears a retained retired operation subscription index on ${action} without erasing separately held evidence`, () => {
      const f = fixture();
      try {
        const prepared = life.prepareNativeRequirement([f.cell], false, []);
        const native = prepared.requirement;
        installTerminalRecord(prepared.record);
        life.finalizeNativeRequirement(native);
        life.completeScalarNativeRequirement(native, native);
        const issued = life.captureNativeInput(native), issuedOwners = issued.owners;
        const nativeProof = life.nativeProof(native), saved = snapshotProof(nativeProof);
        const receipt = life.runDeclaration(f.channel, { kind: 'dependent', owners: [f.handle] }, () => {
          const plan = life.prepareRevision(f.channel, f.revision, [], {}, [], native);
          plan.finalize?.(); installTerminalRecord(plan);
        });
        expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' });
        const operation = operationWithView(f.cell);
        expect(operation.native).toBe(native);
        expect(operation.dependencies.has(f.cell)).toBe(true);
        if (action === 'supersede') life.supersede(f.channel, f.revision);
        else life.disposeConnection(f.channel);
        expect(receipt.read()).toEqual({ state: action === 'supersede' ? 'superseded' : 'disposed' });
        expect(life.proof(f.channel, f.revision)).toBeUndefined();
        expect(f.cell.outcome).toBe('pending');
        expect(f.cell.dependents.has(operation)).toBe(false);
        expect(life.nativeProof(native)).toBe(nativeProof);
        expectProof(life.nativeProof(native), saved);
        expect(issued.requirement).toBe(native);
        expect(issued.owners).toBe(issuedOwners);
        expect(issued.owners[0]).toBe(f.cell);
        // Explicitly retained private operation, not a claim about public GC or
        // permission to erase its separately held proof/native evidence.
        expect(operation.dependencies.size, 'retired forward notification index').toBe(0);
      } finally { f.dispose(); }
    });
  }

  it('queues every affected channel before clearing a terminal owner notification index', async () => {
    const f = fixture(), second = {}, revision = {};
    let secondWakes = 0;
    const reports: unknown[] = [];
    life.registerConnection(second, {
      supported: true,
      report: error => { reports.push(error); },
      wake: () => { secondWakes++; },
    });
    try {
      const proof = proofOf(f.cell), saved = snapshotProof(proof);
      life.observeRevision(f.channel, f.revision, proof, false);
      life.observeRevision(second, revision, proof, false);
      expect(f.cell.dependents.size).toBe(2);
      f.end('confirmed'); await drain();
      expect([f.wakes(), secondWakes]).toEqual([1, 1]);
      expect(f.reports).toEqual([]); expect(reports).toEqual([]);
      expect(life.proof(f.channel, f.revision)).toBe(proof);
      expect(life.proof(second, revision)).toBe(proof);
      expectProof(proof, saved);
      expect(f.cell.dependents.size, 'terminal subscriptions after all channel wakes').toBe(0);
    } finally { life.disposeConnection(second); f.dispose(); }
  });

  for (const outcome of ['confirmed', 'rolled-back', 'abandoned'] as const) {
    it(`queues the pending wake on ${outcome} while retaining exact required evidence`, async () => {
      const f = fixture();
      try {
        const proof = proofOf(f.cell), saved = snapshotProof(proof);
        life.observeRevision(f.channel, f.revision, proof, false);
        expect(f.cell.dependents.size).toBe(1);
        const operation = [...f.cell.dependents][0];
        expect(operation.dependencies.has(f.cell)).toBe(true);
        expect(life.decision(f.channel, f.revision).pending).toBe(true);
        expect(f.wakes()).toBe(0);
        f.end(outcome);
        await drain();
        expect(f.wakes()).toBe(1);
        expect(f.reports).toEqual([]);
        expect(f.cell.outcome).toBe(outcome);
        expect(life.proof(f.channel, f.revision)).toBe(proof);
        expectProof(proof, saved);
        expect(life.comparisonRevisionReady(f.channel, f.revision)).toBe(true);
        expect(life.decision(f.channel, f.revision)).toEqual({ early: outcome === 'confirmed', pending: outcome === 'abandoned' });
        // Cost expectation follows useful wake/readiness/identity assertions.
        expect(f.cell.dependents.size, 'terminal reverse notification memberships').toBe(0);
        expect(operation.dependencies.has(f.cell), 'terminal forward notification membership').toBe(false);
      } finally { f.dispose(); }
    });

    it(`does not register already-${outcome} support during preparation`, () => {
      const f = fixture();
      try {
        f.end(outcome);
        const native = life.initialRequirement();
        const plan = life.prepareRevision(f.channel, f.revision, [f.cell], {}, [], native);
        plan.finalize?.();
        expect(life.proof(f.channel, f.revision)).toBeUndefined();
        installTerminalRecord(plan);
        const proof = life.proof(f.channel, f.revision);
        expect(proof?.owners).toHaveLength(1);
        expect(proof?.owners[0]).toBe(f.cell);
        expect(proof?.destination?.[0]).toBe(f.cell);
        expect(life.decision(f.channel, f.revision)).toEqual({ early: outcome === 'confirmed', pending: outcome === 'abandoned' });
        expect(f.reports).toEqual([]);
        expect(f.cell.dependents.size, 'already-terminal preparation subscriptions').toBe(0);
      } finally { f.dispose(); }
    });

    it(`does not install stale subscriptions after a later foreign finalizer ${outcome}`, () => {
      const f = fixture(), source = new EntityPublicationSource();
      let prepared = 0, earlierFinalized = 0, laterFinalized = 0, completed = 0;
      const offFirst = source.subscribe({
        prepare() {
          prepared++;
          const plan = life.prepareRevision(f.channel, f.revision, [f.cell], {}, [], life.initialRequirement());
          return { record: plan, completion: {}, finalize() { earlierFinalized++; plan.finalize?.(); } };
        },
        complete() { completed++; },
      });
      const offLast = source.subscribe({
        prepare() {
          return { record: { writes: [], adds: [] }, completion: {}, finalize() {
            laterFinalized++;
            expect(earlierFinalized).toBe(1);
            f.end(outcome);
          } };
        },
        complete() { completed++; },
      });
      try {
        const revision = source.revision();
        const unit = source.prepare({ owner: 0, id: {}, meta: undefined, physical: [], ordinary: [] });
        if (!unit) throw new Error('Expected composed source preparation');
        expect(prepared).toBe(1);
        expect(f.cell.outcome).toBe('pending');
        expect(f.cell.dependents.size).toBe(0);
        unit.finalize?.();
        expect([earlierFinalized, laterFinalized]).toEqual([1, 1]);
        expect(source.revision()).toBe(revision);
        expect(f.cell.outcome).toBe(outcome);
        unit.validate?.();
        installTerminalRecord(unit.record);
        source.complete(unit.completion);
        expect(completed).toBe(2);
        const proof = life.proof(f.channel, f.revision);
        expect(proof?.owners[0]).toBe(f.cell);
        expect(proof?.destination?.[0]).toBe(f.cell);
        expect(life.decision(f.channel, f.revision)).toEqual({ early: outcome === 'confirmed', pending: outcome === 'abandoned' });
        expect(f.reports).toEqual([]);
        // Record composition happens before the later finalizer. Filtering only
        // preparation or the first finalizer cannot satisfy this race.
        expect(f.cell.dependents.size, 'terminal subscription installed after foreign finalizer').toBe(0);
      } finally { offFirst(); offLast(); source.dispose(); f.dispose(); }
    });
  }

  for (const outcome of ['confirmed', 'rolled-back'] as const) {
    it(`finishes a validating declaration after ${outcome} without readding terminal notifications`, async () => {
      const f = fixture();
      try {
        const receipt = life.runDeclaration(f.channel, { kind: 'dependent', owners: [f.handle] }, () => {
          const plan = life.prepareRevision(f.channel, f.revision, [], {}, [], life.initialRequirement());
          plan.finalize?.();
          installTerminalRecord(plan);
          expect(life.proof(f.channel, f.revision)).toBeUndefined();
          expect(life.isValidating()).toBe(true);
          expect(f.cell.dependents.size).toBeGreaterThan(0);
          f.end(outcome);
        });
        const proof = life.proof(f.channel, f.revision);
        expect(proof?.owners[0]).toBe(f.cell);
        expect(proof?.validation?.[0]).toBe(f.cell);
        expect(receipt.read().state).toBe(outcome === 'confirmed' ? 'eligible' : 'conservative');
        await drain();
        expect(f.wakes()).toBeGreaterThan(0);
        expect(f.reports).toEqual([]);
        expect(life.proof(f.channel, f.revision)).toBe(proof);
        expect(f.cell.dependents.size, 'terminal finish subscriptions').toBe(0);
      } finally { f.dispose(); }
    });
  }

  it('projects exact terminal roles and flags without turning them into notification subscriptions', () => {
    const f = fixture();
    try {
      life.observeRevision(f.channel, f.revision, proofOf(f.cell), false);
      expect(f.cell.dependents.size).toBe(1);
      f.end('confirmed');
      const proof: life.Proof = { ...proofOf(f.cell), unknown: true, invalid: true, unavailableInput: true, historicalWindow: true, terminalRejectedRoles: 15 };
      const saved = snapshotProof(proof);
      expect(life.projectRevision(f.channel, f.revision, proof)).toBe(proof);
      expect(life.proof(f.channel, f.revision)).toBe(proof);
      expectProof(proof, saved);
      expect(life.decision(f.channel, f.revision)).toEqual({ early: false, pending: false });
      expect(f.cell.dependents.size, 'terminal projection subscriptions').toBe(0);
    } finally { f.dispose(); }
  });
});

describe('terminal notification indexes: actual public workflows', () => {
  it('keeps unavailable-source evidence pending and held without inventing a terminal outcome or delivery', async () => {
    const owner = signalTree({ x: 0 }, { enhancers: [transactions()] });
    const target = signalTree({ y: 0 });
    const sent: number[] = [];
    const connection = link(target.$.y, { set: value => { sent.push(value); } }) as DeclaringLink;
    try {
      const before = new Set(life.pendingOwners());
      const pending = owner.transact(() => owner.$.x(7)), cell = newPublicCell(before);
      const receipt = connection.declare({ kind: 'dependent', owners: [pending] }, () => target.$.y(owner.$.x()));
      await drain();
      expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' });
      expect(sent).toEqual([]);
      const operation = operationWithView(cell);
      const proof = life.proof(operation.channel, operation.revision);
      if (!proof || !operation.native) throw new Error('Expected actual held native proof');
      const saved = snapshotProof(proof), native = operation.native;
      let settled = false;
      const wait = connection.settled().then(() => { settled = true; });
      owner.destroy(); await drain();
      expect(life.ownerCellCanTransition(cell)).toBe(false);
      expect(cell.outcome).toBe('pending');
      expect(target.$.y()).toBe(7); expect(sent).toEqual([]);
      expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' });
      expect(settled).toBe(false);
      expect(operation.native).toBe(native);
      expectProof(life.proof(operation.channel, operation.revision)!, saved);
      expect(life.comparisonRevisionReady(operation.channel, operation.revision)).toBe(true);
      // Source disappearance is not settlement. No assertion requires a dead
      // notification edge: this exact cell has no demonstrated future wake.
      connection.dispose(); await drain(); await wait;
      expect(settled).toBe(true); expect(receipt.read()).toEqual({ state: 'disposed' });
      expect(sent).toEqual([]); expect(target.$.y()).toBe(7);
    } finally { connection.dispose(); target.destroy(); owner.destroy(); }
  });

  it('keeps the real no-write fallback, pending wake and one useful delivery', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const connection = link(tree.$.y, { set: value => { sent.push(value); } }) as DeclaringLink;
    try {
      const before = new Set(life.pendingOwners());
      const pending = tree.transact(() => tree.$.x(7));
      const cell = newPublicCell(before);
      let fallbacks = 0;
      const receipt = connection.declare({ kind: 'dependent', owners: [pending] }, () => {
        tree.$.y(7); tree.$.y(7);
        fallbacks = [...cell.dependents].filter(operation => operation.noopFallbacks.size > 0).length;
      });
      expect(fallbacks).toBeGreaterThan(0);
      await drain();
      expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' });
      expect(sent).toEqual([]);
      const operation = operationWithView(cell);
      if (!operation.native) throw new Error('Expected actual native source requirement');
      const native = operation.native, saved = snapshotProof(life.nativeProof(native));
      pending.confirm(); await drain(); await connection.settled();
      expect(tree.$.y()).toBe(7);
      expect(sent).toEqual([7]);
      expect(receipt.read().state).toBe('started');
      expectProof(life.nativeProof(native), saved);
      const noop = connection.declare({ kind: 'independent' }, () => tree.$.y(7));
      await drain();
      expect(noop.read()).toEqual({ state: 'no-write' });
      expect(sent).toEqual([7]);
      expect(cell.dependents.size).toBe(0);
    } finally { connection.dispose(); tree.destroy(); }
  });

  it('retains rejected proof and held receipt semantics while releasing terminal wake memberships', async () => {
    const tree = signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const connection = link(tree.$.y, { set: value => { sent.push(value); } }) as DeclaringLink;
    try {
      const before = new Set(life.pendingOwners());
      const pending = tree.transact(() => tree.$.x(7)), cell = newPublicCell(before);
      const other = tree.transact(() => tree.$.z(9));
      const receipt = connection.declare({ kind: 'dependent', owners: [pending] }, () => tree.$.y(tree.$.x()));
      await drain();
      expect(receipt.read()).toEqual({ state: 'held', reason: 'pending-dependency' });
      const operation = operationWithView(cell);
      const proof = life.proof(operation.channel, operation.revision);
      if (!proof || !operation.native) throw new Error('Expected held proof/native support');
      const saved = snapshotProof(proof), native = operation.native;
      let settled = false;
      const wait = connection.settled().then(() => { settled = true; });
      pending.rollback(); await drain();
      expect(tree.$.x()).toBe(0); expect(tree.$.y()).toBe(7);
      expect(sent).toEqual([]); expect(settled).toBe(false);
      expect(receipt.read().state).toBe('conservative');
      expect(operation.native).toBe(native);
      expectProof(life.proof(operation.channel, operation.revision)!, saved);
      const terminalReverse = cell.dependents.size, terminalForward = operation.dependencies.has(cell);
      connection.dispose(); await drain(); await wait;
      expect(settled).toBe(true); expect(receipt.read()).toEqual({ state: 'disposed' });
      other.rollback(); await drain();
      expect(sent).toEqual([]); expect(tree.$.y()).toBe(7);
      expect(terminalReverse, 'terminal reverse membership before explicit disposal').toBe(0);
      expect(terminalForward, 'terminal forward membership before explicit disposal').toBe(false);
    } finally { connection.dispose(); tree.destroy(); }
  });

  it('settles inside the returned getter without losing validation or publishing early', async () => {
    const tree = signalTree({ x: 0, y: 0 }, { enhancers: [transactions()] });
    const sent: number[] = [];
    const connection = link(tree.$.y, { set: value => { sent.push(value); } }) as DeclaringLink;
    try {
      const before = new Set(life.pendingOwners());
      const pending = tree.transact(() => tree.$.x(7)), cell = newPublicCell(before);
      let getterCalls = 0;
      const receipt = connection.declare({ kind: 'dependent', owners: [pending] }, () => {
        tree.$.y(7);
        return Object.defineProperty({}, 'then', { get() {
          getterCalls++; expect(life.isValidating()).toBe(true);
          pending.confirm(); tree.$.y(8);
          expect(sent).toEqual([]);
          return undefined;
        } });
      });
      const terminalMembershipsAfterFinish = cell.dependents.size;
      expect(getterCalls).toBe(1); expect(sent).toEqual([]);
      await drain(); await connection.settled();
      expect(tree.$.x()).toBe(7); expect(tree.$.y()).toBe(8);
      expect(receipt.read().state).toBe('started'); expect(sent).toEqual([8]);
      expect(terminalMembershipsAfterFinish, 'terminal subscriptions after reentrant horizon finish').toBe(0);
    } finally { connection.dispose(); tree.destroy(); }
  });
});
