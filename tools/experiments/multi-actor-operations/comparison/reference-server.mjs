import { frozen } from './data.mjs';

// Independent reference backend used by C0/C3, not the C2 DispatchBackend.
// One synchronous compare-and-apply step models the shared server contract.
export class ReferenceServer {
  #fields = new Map(Object.entries({ route: 'north', note: '', window: '09:00', capacity: 10 }).map(([key, value]) => [key, { value, version: 0 }]));
  #commands = new Map();
  #fail = false;
  commits = 0;
  snapshot() {
    return frozen({ values: Object.fromEntries([...this.#fields].map(([k, v]) => [k, v.value])), versions: Object.fromEntries([...this.#fields].map(([k, v]) => [k, v.version])) });
  }
  proposal(patch, reads = []) {
    const expected = {};
    for (const key of new Set([...Object.keys(patch), ...reads])) {
      if (!this.#fields.has(key)) throw new Error('Unknown field');
      expected[key] = this.#fields.get(key).version;
    }
    return frozen({ entityId: 'delivery-1', patch, expected });
  }
  failNextPersistence() { this.#fail = true; }
  apply(command) {
    const body = JSON.stringify(command);
    const cached = this.#commands.get(command.commandId);
    if (cached) {
      if (cached.body !== body) throw new Error('Command key reused');
      return cached.receipt;
    }
    const finish = (status, reason) => {
      const receipt = frozen({ commandId: command.commandId, status, ...(reason ? { reason } : {}) });
      this.#commands.set(command.commandId, { body, receipt });
      return receipt;
    };
    const { patch, expected, entityId } = command.proposal;
    if (entityId !== 'delivery-1' || !Object.keys(patch).length) return finish('rejected', 'invalid');
    for (const [key, value] of Object.entries(patch)) {
      const current = this.#fields.get(key);
      if (!current || !Object.hasOwn(expected, key) || typeof current.value !== typeof value || (typeof value === 'number' && !Number.isFinite(value))) return finish('rejected', 'invalid');
    }
    for (const [key, version] of Object.entries(expected)) {
      if (this.#fields.get(key)?.version !== version) return finish('rejected', 'conflict');
    }
    if (this.#fail) { this.#fail = false; return finish('rejected', 'persistence'); }
    for (const [key, value] of Object.entries(patch)) this.#fields.set(key, { value, version: this.#fields.get(key).version + 1 });
    this.commits++;
    return finish('applied');
  }
}
