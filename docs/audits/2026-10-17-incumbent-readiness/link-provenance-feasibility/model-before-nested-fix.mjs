// Research model only: explicit instrumentation, no package imports or API exports.
export const UNKNOWN = Object.freeze({ state: 'unknown' });
export class PublicationModel {
  values = new Map();
  frames = [];
  queue = [];
  revision = 0;
  token() { return { state: 'pending' }; }
  settle(token, state) {
    if (token.state === state) return; // useful stable terminal retry
    if (token.state !== 'pending') throw new Error('Conflicting terminal settlement');
    token.state = state;
  }
  frame(dependencies, fn) {
    const frame = new Set(dependencies);
    this.frames.push(frame);
    try { return fn(); } finally { this.frames.pop(); }
  }
  // Trusted input is deliberately explicit: no automatic inference claimed.
  input(fn) { return this.frame([], fn); }
  unknown(fn) { return this.frame([UNKNOWN], fn); }
  read(key) {
    const value = this.values.get(key);
    if (!value) throw new Error('Missing model value');
    const frame = this.frames.at(-1);
    if (!frame) throw new Error('Read outside observed execution');
    for (const dependency of value.dependencies) frame.add(dependency);
    return value.value;
  }
  write(key, value, owner) {
    const dependencies = new Set(this.frames.at(-1) ?? [UNKNOWN]);
    if (owner) dependencies.add(owner);
    // Replaces label even for equal value: write identity is not value equality.
    const record = { value, dependencies, revision: ++this.revision };
    this.values.set(key, record);
    return record;
  }
  deliver(record, fn) { return this.frame(record.dependencies, () => fn(record.value)); }
  enqueue(record, fn) { this.queue.push({ record, fn }); }
  flushOne() {
    const job = this.queue.shift();
    if (job) return this.deliver(job.record, job.fn);
  }
  eligible(key) {
    const record = this.values.get(key);
    return !!record && [...record.dependencies].every(d => d.state === 'confirmed');
  }
  send(key, beforeEndpoint, endpoint) {
    if (!this.eligible(key)) return false;
    beforeEndpoint();
    // Reacquire latest revision and eligibility, not a pre-callback payload.
    if (!this.eligible(key)) return false;
    endpoint(this.values.get(key).value);
    return true;
  }
  // Diagnostic enumeration, not a claim of constant-time runtime reclamation.
  reachableObligations() {
    return new Set([...this.values.values(), ...this.queue.map(j => j.record)]
      .flatMap(r => [...r.dependencies]).concat(this.frames.flatMap(f => [...f])));
  }
  destroy() { this.values.clear(); this.queue.length = 0; }
}
