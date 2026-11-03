// Workflow metadata only: the adapter owns accepted entity state and application.
export function immutable(value) {
  const ancestors = new Set();
  function copy(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (!item || typeof item !== 'object') throw new Error('Expected plain JSON-like data');
    const array = Array.isArray(item);
    if (array && Object.getPrototypeOf(item) !== Array.prototype) throw new Error('Expected plain JSON-like arrays');
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new Error('Expected plain JSON-like data');
    }
    if (ancestors.has(item)) throw new Error('Cyclic data is unsupported');
    ancestors.add(item);
    const result = array ? [] : {};
    const keys = Reflect.ownKeys(item).filter(key => !(array && key === 'length'));
    if (array && keys.length !== item.length) throw new Error('Sparse or decorated arrays are unsupported');
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
          (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length))) {
        throw new Error('Expected plain JSON-like data properties');
      }
      Object.defineProperty(result, key, { value: copy(descriptor.value), enumerable: true });
    }
    ancestors.delete(item);
    return Object.freeze(result);
  }
  return copy(value);
}

export class OperationCoordinator {
  #operations = new Map();
  #reviews = new WeakMap();
  #adapter;
  #disposed = false;

  constructor(adapter) { this.#adapter = adapter; }

  create(id, proposal, actor = { kind: 'unknown' }) {
    if (this.#disposed) throw new Error('Coordinator disposed');
    if (typeof id !== 'string' || !id || this.#operations.has(id)) throw new Error('Invalid or duplicate operation ID');
    if (actor.kind !== 'unknown' && !(actor.kind === 'declared' && typeof actor.label === 'string' && actor.label)) {
      throw new Error('Actor must be unknown or explicitly declared');
    }
    const context = actor.kind === 'unknown' ? { kind: 'unknown' } : { kind: 'declared', label: actor.label };
    this.#operations.set(id, { id, token: Symbol(id), revision: 1, proposal: immutable(proposal), actor: immutable(context), status: 'draft', attempts: 0 });
    return this.inspect(id);
  }

  #get(id) {
    if (this.#disposed) throw new Error('Coordinator disposed');
    const operation = this.#operations.get(id);
    if (!operation) throw new Error('Unknown operation');
    return operation;
  }

  forget(id) {
    const op = this.#get(id);
    if (!['succeeded', 'failed', 'rejected'].includes(op.status)) throw new Error('Cannot forget unresolved operation');
    this.#operations.delete(id);
  }

  dispose() {
    for (const op of this.#operations.values()) {
      if (!['succeeded', 'failed', 'rejected'].includes(op.status)) throw new Error('Cannot dispose unresolved operations');
    }
    this.#operations.clear();
    this.#reviews = new WeakMap();
    // Once no operation remains unresolved, the coordinator no longer owns
    // transport/application closures. Retained reviews are immutable data only.
    this.#adapter = undefined;
    this.#disposed = true;
  }

  inspect(id) {
    const { flight, command, token, ...publicState } = this.#get(id);
    return immutable(publicState);
  }

  revise(id, proposal) {
    const op = this.#get(id);
    if (!['draft', 'reviewed'].includes(op.status)) throw new Error('Operation cannot be revised');
    op.proposal = immutable(proposal);
    op.revision++;
    op.status = 'draft';
    return this.inspect(id);
  }

  review(id) {
    const op = this.#get(id);
    if (!['draft', 'reviewed'].includes(op.status)) throw new Error('Operation cannot be reviewed');
    const binding = immutable({ operationId: id, revision: op.revision, actor: op.actor, proposal: op.proposal });
    this.#reviews.set(binding, { id, revision: op.revision, token: op.token });
    op.status = 'reviewed';
    return binding;
  }

  approve(binding) {
    const known = this.#reviews.get(binding);
    if (!known) throw new Error('Unknown review binding');
    const op = this.#get(known.id);
    if (op.token !== known.token || op.status !== 'reviewed' || op.revision !== known.revision) throw new Error('Stale review');
    // This is local review consent, never a server permission credential.
    op.command = immutable({ ...binding, commandId: JSON.stringify([op.id, op.revision]) });
    op.status = 'approved';
    return this.inspect(op.id);
  }

  reject(id) {
    const op = this.#get(id);
    if (!['draft', 'reviewed', 'approved'].includes(op.status)) throw new Error('Cannot withdraw potentially delivered command');
    op.status = 'rejected';
    return this.inspect(id);
  }

  deliver(id) {
    const op = this.#get(id);
    if (op.flight) return op.flight;
    if (!['approved', 'uncertain'].includes(op.status)) throw new Error('Operation cannot be delivered');
    op.status = 'delivering';
    const attemptId = JSON.stringify([id, op.revision, ++op.attempts]);
    op.flight = Promise.resolve().then(async () => {
      try {
        const receipt = await this.#adapter.apply(op.command, immutable({ operationId: id, revision: op.revision, attemptId }));
        if (receipt?.commandId !== op.command.commandId || !['applied', 'rejected'].includes(receipt.status)) {
          throw new Error('Invalid or unrelated acknowledgment');
        }
        op.receipt = immutable(receipt);
        op.status = receipt.status === 'applied' ? 'succeeded' : 'failed';
        delete op.deliveryError;
      } catch (error) {
        // Transport failure cannot prove that the server did not commit.
        op.status = 'uncertain';
        op.deliveryError = String(error?.message ?? error);
      } finally {
        delete op.flight;
      }
      return this.inspect(id);
    });
    return op.flight;
  }
}
