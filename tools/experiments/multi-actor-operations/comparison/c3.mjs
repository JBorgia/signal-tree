import { createCollection, localOnlyCollectionOptions, createTransaction } from '@tanstack/db';
import { frozen } from './data.mjs';

// Independent application glue. Actual TanStack collection is the proposal store;
// manual transactions own the optimistic delivering transition and its rollback.
export class TanStackApp {
  #rows;
  #transport;
  #disposed = false;
  #generations = new Map();
  #reviews = new WeakMap();
  #commands = new Map();
  #flights = new Map();
  constructor(transport) {
    this.#transport = transport;
    this.#rows = createCollection(localOnlyCollectionOptions({ getKey: row => row.id }));
  }
  #get(id) { if (this.#disposed) throw new Error('Disposed'); const row = this.#rows.get(id); if (!row) throw new Error('Unknown operation'); return row; }
  inspect(id) { return frozen(this.#get(id)); }
  create(id, proposal, actor = { kind: 'unknown' }) {
    if (this.#disposed) throw new Error('Disposed');
    if (this.#rows.has(id)) throw new Error('Duplicate operation');
    this.#rows.insert(structuredClone(frozen({ id, revision: 1, proposal, actor, status: 'draft', attempts: 0 })));
    this.#generations.set(id, Symbol(id));
  }
  revise(id, proposal) {
    const row = this.#get(id);
    if (!['draft', 'reviewed'].includes(row.status)) throw new Error('Cannot revise');
    const copy = structuredClone(frozen(proposal));
    this.#rows.update(id, draft => { draft.proposal = copy; draft.revision++; draft.status = 'draft'; });
  }
  review(id) {
    const row = this.#get(id);
    if (!['draft', 'reviewed'].includes(row.status)) throw new Error('Cannot review');
    const binding = frozen({ operationId: id, revision: row.revision, proposal: row.proposal, actor: row.actor });
    this.#reviews.set(binding, { id, revision: row.revision, generation: this.#generations.get(id) });
    this.#rows.update(id, draft => { draft.status = 'reviewed'; });
    return binding;
  }
  approve(binding) {
    const known = this.#reviews.get(binding);
    if (!known) throw new Error('Foreign review');
    const row = this.#get(known.id);
    if (row.status !== 'reviewed' || row.revision !== known.revision || this.#generations.get(row.id) !== known.generation) throw new Error('Stale review');
    this.#commands.set(row.id, frozen({ ...binding, commandId: JSON.stringify([row.id, row.revision]) }));
    this.#rows.update(row.id, draft => { draft.status = 'approved'; });
  }
  reject(id) {
    if (!['draft', 'reviewed', 'approved'].includes(this.#get(id).status)) throw new Error('Cannot withdraw');
    this.#rows.update(id, draft => { draft.status = 'rejected'; });
  }
  deliver(id) {
    if (this.#flights.has(id)) return this.#flights.get(id);
    const row = this.#get(id);
    if (!['approved', 'uncertain'].includes(row.status)) throw new Error('Cannot deliver');
    const command = this.#commands.get(id);
    const attempts = row.attempts + 1;
    const context = frozen({ operationId: id, revision: row.revision, attemptId: JSON.stringify([id, row.revision, attempts]) });
    let receipt;
    const transaction = createTransaction({ autoCommit: false, mutationFn: async () => {
      receipt = await this.#transport.apply(command, context);
      if (receipt?.commandId !== command.commandId || !['applied', 'rejected'].includes(receipt.status)) { receipt = undefined; throw new Error('Unrelated receipt'); }
      if (receipt.status === 'rejected') throw new Error('Backend rejected');
    } });
    transaction.mutate(() => this.#rows.update(id, draft => { draft.status = 'delivering'; }));
    const flight = Promise.resolve().then(() => transaction.commit()).then(() => {
      this.#rows.update(id, draft => { draft.status = 'succeeded'; draft.receipt = structuredClone(receipt); draft.attempts = attempts; });
    }).catch(error => {
      // TanStack rolled back only the local delivering marker; backend outcome
      // still determines failure vs uncertainty, never optimistic rollback alone.
      this.#rows.update(id, draft => {
        draft.status = receipt?.status === 'rejected' ? 'failed' : 'uncertain';
        draft.attempts = attempts;
        if (receipt) draft.receipt = structuredClone(receipt);
        draft.error = String(error.message);
      });
    }).then(() => { this.#flights.delete(id); return this.inspect(id); });
    this.#flights.set(id, flight);
    return flight;
  }
  forget(id) {
    if (!['succeeded', 'failed', 'rejected'].includes(this.#get(id).status)) throw new Error('Unresolved operation');
    this.#rows.delete(id); this.#commands.delete(id); this.#generations.delete(id);
  }
  async dispose() {
    if (this.#disposed) return;
    if ([...this.#rows.values()].some(row => !['succeeded', 'failed', 'rejected'].includes(row.status))) throw new Error('Unresolved operations');
    for (const id of [...this.#rows.keys()]) this.#rows.delete(id);
    this.#commands.clear(); this.#generations.clear(); this.#reviews = new WeakMap();
    this.#disposed = true; await this.#rows.cleanup();
  }

}
