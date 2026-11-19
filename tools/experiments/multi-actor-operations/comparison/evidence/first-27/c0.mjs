import { frozen } from './data.mjs';

// Ordinary application glue: Map state, immutable proposals, explicit commands.
export class OrdinaryApp {
  #rows = new Map();
  #tickets = new WeakMap();
  #transport;
  constructor(transport) { this.#transport = transport; }
  #row(id) { const row = this.#rows.get(id); if (!row) throw new Error('Unknown operation'); return row; }
  inspect(id) {
    const { pending, command, ...view } = this.#row(id);
    return frozen(view);
  }
  create(id, proposal, actor = { kind: 'unknown' }) {
    if (this.#rows.has(id)) throw new Error('Duplicate operation');
    this.#rows.set(id, { id, revision: 1, proposal: frozen(proposal), actor: frozen(actor), status: 'draft', attempts: 0 });
  }
  revise(id, proposal) {
    const row = this.#row(id);
    if (!['draft', 'reviewed'].includes(row.status)) throw new Error('Cannot revise');
    const next = frozen(proposal);
    row.proposal = next; row.revision++; row.status = 'draft';
  }
  review(id) {
    const row = this.#row(id);
    if (!['draft', 'reviewed'].includes(row.status)) throw new Error('Cannot review');
    const ticket = frozen({ operationId: id, revision: row.revision, proposal: row.proposal, actor: row.actor });
    this.#tickets.set(ticket, row);
    row.status = 'reviewed';
    return ticket;
  }
  approve(ticket) {
    const row = this.#tickets.get(ticket);
    if (!row || row.revision !== ticket.revision || row.status !== 'reviewed') throw new Error('Stale or foreign review');
    row.command = frozen({ ...ticket, commandId: JSON.stringify([row.id, row.revision]) });
    row.status = 'approved';
  }
  reject(id) {
    const row = this.#row(id);
    if (!['draft', 'reviewed', 'approved'].includes(row.status)) throw new Error('Cannot withdraw');
    row.status = 'rejected';
  }
  deliver(id) {
    const row = this.#row(id);
    if (row.pending) return row.pending;
    if (!['approved', 'uncertain'].includes(row.status)) throw new Error('Cannot deliver');
    row.status = 'delivering';
    const context = frozen({ operationId: id, revision: row.revision, attemptId: JSON.stringify([id, row.revision, ++row.attempts]) });
    row.pending = Promise.resolve().then(() => this.#transport.apply(row.command, context)).then(receipt => {
      if (receipt?.commandId !== row.command.commandId || !['applied', 'rejected'].includes(receipt.status)) throw new Error('Unrelated receipt');
      row.receipt = frozen(receipt);
      row.status = receipt.status === 'applied' ? 'succeeded' : 'failed';
    }).catch(error => { row.status = 'uncertain'; row.error = String(error.message); }).then(() => {
      delete row.pending;
      return this.inspect(id);
    });
    return row.pending;
  }
}
