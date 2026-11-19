import { immutable } from './coordinator.mjs';

// A single-process backend stand-in. Validation, persistence decision, entity
// update and command receipt happen without an await: one atomic fixture step.
export class DispatchBackend {
  #values = { route: 'north', note: '', window: '09:00', capacity: 10 };
  #versions = { route: 0, note: 0, window: 0, capacity: 0 };
  #receipts = new Map();
  #failNext = false;
  #allowed = true;
  commits = 0;

  snapshot() { return immutable({ values: this.#values, versions: this.#versions }); }
  failNextPersistence() { this.#failNext = true; }
  setAllowed(allowed) { this.#allowed = allowed; }

  proposal(patch, reads = Object.keys(patch), observation = this.snapshot()) {
    const fields = [...new Set([...Object.keys(patch), ...reads])];
    // A delayed producer must pass the snapshot it actually observed. The
    // default is only a fresh synchronous proposal, not inferred old evidence.
    return immutable({ entityId: 'delivery-1', patch, expected: Object.fromEntries(fields.map(key => [key, observation.versions[key]])) });
  }

  apply(command) {
    const signature = JSON.stringify(command);
    const prior = this.#receipts.get(command.commandId);
    if (prior) {
      if (prior.signature !== signature) throw new Error('Idempotency key reused with different content');
      return prior.receipt;
    }
    const finish = (status, reason) => {
      const receipt = immutable({ commandId: command.commandId, status, ...(reason ? { reason } : {}) });
      this.#receipts.set(command.commandId, { signature, receipt });
      return receipt;
    };
    if (!this.#allowed) return finish('rejected', 'permission');
    const { entityId, patch, expected } = command.proposal ?? {};
    if (entityId !== 'delivery-1' || !patch || !expected || Object.keys(patch).length === 0) return finish('rejected', 'invalid');
    for (const [key, value] of Object.entries(patch)) {
      if (!Object.hasOwn(this.#values, key) || !Object.hasOwn(expected, key) || typeof value !== typeof this.#values[key] || (typeof value === 'number' && !Number.isFinite(value))) return finish('rejected', 'invalid');
    }
    for (const [key, version] of Object.entries(expected)) {
      if (!Object.hasOwn(this.#versions, key) || version !== this.#versions[key]) return finish('rejected', 'conflict');
    }
    if (this.#failNext) {
      this.#failNext = false;
      return finish('rejected', 'persistence');
    }
    for (const [key, value] of Object.entries(patch)) {
      this.#values[key] = value;
      this.#versions[key]++;
    }
    this.commits++;
    return finish('applied');
  }
}
