import { entityMap, signalTree } from '@signal-tree/kernel';
import { frozen } from './data.mjs';

type Actor = { kind: 'unknown' } | { kind: 'declared'; label: string };
type Proposal = { entityId: string; patch: Record<string, string | number>; expected: Record<string, number> };
type Status = 'draft' | 'reviewed' | 'approved' | 'delivering' | 'uncertain' | 'succeeded' | 'failed' | 'rejected';
type Receipt = { commandId: string; status: 'applied' | 'rejected'; reason?: string };
type Review = { operationId: string; revision: number; actor: Actor; proposal: Proposal };
type Command = Review & { commandId: string };
type Attempt = { operationId: string; revision: number; attemptId: string };
type Row = { id: string; revision: number; actor: Actor; proposal: Proposal; status: Status; attempts: number; receipt?: Receipt; error?: string };
type Transport = { apply(command: Readonly<Command>, context: Readonly<Attempt>): unknown | Promise<unknown> };

// Public installed EntityMap owns operation rows. Application code owns review
// consent, delivery correlation and server command semantics. No coordinator import.
export class SignalTreeApp {
  #tree = signalTree({ operations: entityMap<Row, string>() });
  #transport: Transport;
  #reviews = new WeakMap<Readonly<Review>, { id: string; revision: number; generation: symbol }>();
  #generations = new Map<string, symbol>();
  #commands = new Map<string, Readonly<Command>>();
  #flights = new Map<string, Promise<Readonly<Row>>>();
  #disposed = false;

  constructor(transport: Transport) { this.#transport = transport; }
  #open() { if (this.#disposed) throw new Error('Disposed'); }
  #row(id: string): Row {
    this.#open();
    const row = this.#tree.$.operations.byId(id)?.();
    if (!row) throw new Error('Unknown operation');
    return row;
  }
  inspect(id: string): Readonly<Row> { return frozen(this.#row(id)); }
  create(id: string, proposal: Proposal, actor: Actor = { kind: 'unknown' }) {
    this.#open();
    if (this.#generations.has(id)) throw new Error('Duplicate operation');
    const row: Row = { id, revision: 1, proposal, actor, status: 'draft', attempts: 0 };
    this.#tree.$.operations.addOne(structuredClone(frozen(row)));
    this.#generations.set(id, Symbol(id));
  }
  revise(id: string, proposal: Proposal) {
    const row = this.#row(id);
    if (!['draft', 'reviewed'].includes(row.status)) throw new Error('Cannot revise');
    this.#tree.$.operations.updateOne(id, { proposal: structuredClone(frozen(proposal)), revision: row.revision + 1, status: 'draft' });
  }
  review(id: string): Readonly<Review> {
    const row = this.#row(id);
    if (!['draft', 'reviewed'].includes(row.status)) throw new Error('Cannot review');
    const binding = frozen({ operationId: id, revision: row.revision, proposal: row.proposal, actor: row.actor });
    this.#reviews.set(binding, { id, revision: row.revision, generation: this.#generations.get(id)! });
    this.#tree.$.operations.updateOne(id, { status: 'reviewed' });
    return binding;
  }
  approve(binding: Readonly<Review>) {
    const known = this.#reviews.get(binding);
    if (!known) throw new Error('Foreign review');
    const row = this.#row(known.id);
    if (row.status !== 'reviewed' || row.revision !== known.revision || this.#generations.get(row.id) !== known.generation) throw new Error('Stale review');
    this.#commands.set(row.id, frozen({ ...binding, commandId: JSON.stringify([row.id, row.revision]) }));
    this.#tree.$.operations.updateOne(row.id, { status: 'approved' });
  }
  reject(id: string) {
    if (!['draft', 'reviewed', 'approved'].includes(this.#row(id).status)) throw new Error('Cannot withdraw');
    this.#tree.$.operations.updateOne(id, { status: 'rejected' });
  }
  deliver(id: string): Promise<Readonly<Row>> {
    this.#open();
    const existing = this.#flights.get(id);
    if (existing) return existing;
    const row = this.#row(id);
    if (!['approved', 'uncertain'].includes(row.status)) throw new Error('Cannot deliver');
    const command = this.#commands.get(id)!;
    const attempts = row.attempts + 1;
    const context = frozen({ operationId: id, revision: row.revision, attemptId: JSON.stringify([id, row.revision, attempts]) });
    this.#tree.$.operations.updateOne(id, { status: 'delivering', attempts });
    const flight = Promise.resolve().then(async () => {
      try {
        const result = await this.#transport.apply(command, context);
        if (!result || typeof result !== 'object' || !('commandId' in result) || result.commandId !== command.commandId || !('status' in result) || !['applied', 'rejected'].includes(String(result.status))) throw new Error('Unrelated receipt');
        const receipt = frozen(result as Receipt);
        this.#tree.$.operations.updateOne(id, { receipt: structuredClone(receipt), status: receipt.status === 'applied' ? 'succeeded' : 'failed' });
      } catch (error) {
        this.#tree.$.operations.updateOne(id, { status: 'uncertain', error: error instanceof Error ? error.message : String(error) });
      } finally { this.#flights.delete(id); }
      return this.inspect(id);
    });
    this.#flights.set(id, flight);
    return flight;
  }
  forget(id: string) {
    if (!['succeeded', 'failed', 'rejected'].includes(this.#row(id).status)) throw new Error('Unresolved operation');
    this.#tree.$.operations.removeOne(id);
    this.#commands.delete(id); this.#generations.delete(id);
  }
  dispose() {
    if (this.#disposed) return;
    if (this.#tree.$.operations.all().some(row => !['succeeded', 'failed', 'rejected'].includes(row.status))) throw new Error('Unresolved operations');
    for (const id of this.#tree.$.operations.ids()) this.#tree.$.operations.removeOne(id);
    this.#commands.clear(); this.#generations.clear(); this.#reviews = new WeakMap();
    this.#tree.destroy(); this.#disposed = true;
  }
}
