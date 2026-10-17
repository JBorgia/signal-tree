/** Standalone ordering experiment. No kernel/framework or payload implementation.
 * Admission stores local inverse edits; settlement clones and replays the entire
 * retained journal. Work counters count visited nodes/events/dependency entries,
 * not JS engine instructions, bytes, timings, or a sparse-settlement guarantee.
 */
export class OrderingModel {
  constructor(keys = []) {
    this.state = { nodes: new Map(), keys: new Map(), head: undefined, tail: undefined };
    this.events = [];
    this.pending = new Set();
    this.nextId = 0;
    this.nextOwner = 0;
    this.sequence = 0;
    this.phase = 'admission';
    this.work = { admission: 0, settlement: 0, admissionSnapshots: 0, replayedEvents: 0 };
    for (const key of keys) this.append(key);
    this.resetWork();
  }
  resetWork() { for (const key of Object.keys(this.work)) this.work[key] = 0; }
  tick(n = 1) { this.work[this.phase] += n; }
  begin() { const owner = ++this.nextOwner; this.pending.add(owner); return owner; }
  id(key) { return this.state.keys.get(key); }
  held(id) { return { id }; }
  read(held) { const node = this.state.nodes.get(held.id); return node?.active ? node.key : undefined; }
  order(state = this.state) {
    const ids = [];
    for (let id = state.head; id !== undefined; id = state.nodes.get(id).next) {
      this.tick(); ids.push(id);
    }
    return ids;
  }
  keys() { return this.order().map((id) => this.state.nodes.get(id).key); }
  detach(state, id) {
    const node = state.nodes.get(id);
    if (!node?.active) return;
    this.tick(3);
    if (node.prev === undefined) state.head = node.next;
    else state.nodes.get(node.prev).next = node.next;
    if (node.next === undefined) state.tail = node.prev;
    else state.nodes.get(node.next).prev = node.prev;
    state.keys.delete(node.key); node.active = false;
  }
  insert(state, id, key, next) {
    this.tick(3);
    const prev = next === undefined ? state.tail : state.nodes.get(next).prev;
    state.nodes.set(id, { key, prev, next, active: true });
    state.keys.set(key, id);
    if (prev === undefined) state.head = id; else state.nodes.get(prev).next = id;
    if (next === undefined) state.tail = id; else state.nodes.get(next).prev = id;
  }
  apply(state, event) {
    this.tick();
    const node = state.nodes.get(event.id);
    if (event.kind === 'create') {
      this.insert(state, event.id, event.key, event.orderLive && event.front ? state.head : undefined);
      return { kind: 'erase', id: event.id };
    }
    if (event.kind === 'remove') {
      const inverse = { kind: 'restore', id: event.id, ...node };
      this.detach(state, event.id); return inverse;
    }
    if (event.kind === 'rekey') {
      if (!node?.active) throw new Error('Missing rekey lifetime');
      const inverse = { kind: 'key', id: event.id, key: node.key };
      state.keys.delete(node.key); node.key = event.key; state.keys.set(node.key, event.id);
      return inverse;
    }
    if (event.kind === 'front') {
      if (!node?.active) return undefined;
      const inverse = { kind: 'place', id: event.id, key: node.key, next: node.next };
      this.detach(state, event.id); this.insert(state, event.id, node.key, state.head);
      return inverse;
    }
    const before = this.order(state);
    if (this.phase === 'admission') this.work.admissionSnapshots++;
    for (const id of before) this.detach(state, id);
    for (const id of event.subjects) {
      this.tick();
      if (before.includes(id)) this.insert(state, id, state.nodes.get(id).key, undefined);
    }
    return { kind: 'exact', subjects: before };
  }
  undo(state, inverse) {
    if (!inverse) return;
    this.tick();
    if (inverse.kind === 'erase') this.detach(state, inverse.id);
    else if (inverse.kind === 'key') {
      const node = state.nodes.get(inverse.id);
      state.keys.delete(node.key); node.key = inverse.key; state.keys.set(node.key, inverse.id);
    } else if (inverse.kind === 'exact') this.apply(state, { kind: 'exact', subjects: inverse.subjects });
    else {
      this.detach(state, inverse.id);
      this.insert(state, inverse.id, inverse.key, inverse.next);
    }
  }
  admit(input, owner) {
    if (owner !== undefined && !this.pending.has(owner)) throw new Error('Unknown owner');
    const event = { ...input, owner, sequence: ++this.sequence, orderLive: input.kind !== 'remove' && input.kind !== 'rekey' };
    this.tick();
    event.inverse = this.apply(this.state, event);
    if (owner !== undefined || this.events.length) {
      // Point admission appends one record. No baseline, prefix copy, or scan.
      this.events.push(event);
      if (owner === undefined && event.kind === 'exact') this.supersede(this.events, event);
    }
    return event.id;
  }
  append(key, owner) { return this.admit({ kind: 'create', key, id: ++this.nextId, front: false }, owner); }
  prepend(key, owner) { return this.admit({ kind: 'create', key, id: ++this.nextId, front: true }, owner); }
  front(id, owner) { return this.admit({ kind: 'front', id }, owner); }
  remove(id, owner) { return this.admit({ kind: 'remove', id }, owner); }
  rekey(id, key, owner) { return this.admit({ kind: 'rekey', id, key }, owner); }
  exact(subjects, owner) { this.tick(subjects.length); return this.admit({ kind: 'exact', subjects: [...subjects] }, owner); }
  replace(subjects, owner) {
    const selected = new Set(subjects);
    for (const id of this.order()) if (!selected.has(id)) this.remove(id, owner);
    this.exact(subjects, owner);
  }
  supersede(events, exact) {
    for (const event of events) {
      this.tick();
      if (event.sequence < exact.sequence) event.orderLive = false;
    }
  }
  dependencies(events = this.events) {
    const result = [];
    for (const event of events) {
      this.tick();
      if (!event.orderLive) continue;
      for (const id of event.kind === 'exact' ? event.subjects : [event.id]) {
        this.tick(); result.push({ id, owner: event.owner, sequence: event.sequence });
      }
    }
    return result;
  }
  failPreparation() { this.failure = true; }
  settle(owner, accept) {
    if (!this.pending.has(owner)) return;
    this.phase = 'settlement';
    try {
      if (this.failure) { this.failure = false; throw new Error('Injected preparation failure'); }
      const events = this.events.map((event) => { this.tick(); return { ...event }; });
      const retiring = events.filter((event) => event.owner === owner);
      if (!accept) {
        // Conservative moved-anchor policy, not a universal rollback contract.
        const positions = new Map(this.order().map((id, rank) => [id, rank]));
        for (const event of retiring) {
          this.tick();
          if (event.kind === 'remove' && positions.has(event.inverse.prev) && positions.has(event.inverse.next) &&
              positions.get(event.inverse.prev) > positions.get(event.inverse.next))
            throw new Error('Contradictory surviving recovery anchors');
        }
      }
      const surviving = events.filter((event) => accept || event.owner !== owner);
      if (accept) {
        for (const event of retiring) event.owner = undefined;
        for (const event of retiring) if (event.kind === 'exact' && event.orderLive) this.supersede(surviving, event);
      }
      const dependencies = this.dependencies(surviving);
      if (!accept) for (const creation of retiring.filter((event) => event.kind === 'create')) {
        for (const dependency of dependencies) {
          this.tick();
          if (dependency.id !== creation.id) continue;
          const removed = surviving.some((event) => { this.tick(); return event.kind === 'remove' && event.id === creation.id && event.owner === undefined && event.sequence > dependency.sequence; });
          if (!removed) throw new Error('Surviving semantic existence dependency');
        }
      }
      const state = { nodes: new Map(), keys: new Map(this.state.keys), head: this.state.head, tail: this.state.tail };
      for (const [id, node] of this.state.nodes) { this.tick(); state.nodes.set(id, { ...node }); }
      this.tick(this.state.keys.size);
      for (let i = this.events.length - 1; i >= 0; i--) { this.tick(); this.undo(state, this.events[i].inverse); }
      const next = [];
      for (const event of surviving) {
        this.tick();
        if (!event.orderLive && (event.kind === 'exact' || event.kind === 'front')) continue;
        this.work.replayedEvents++;
        event.inverse = this.apply(state, event); next.push(event);
      }
      // No state/authority installation occurs until every preparation succeeds.
      this.state = state; this.pending.delete(owner); this.events = next;
      if (!next.some((event) => event.owner !== undefined)) {
        this.events = [];
        for (const [id, node] of state.nodes) { this.tick(); if (!node.active) state.nodes.delete(id); }
      }
    } finally { this.phase = 'admission'; }
  }
  stats() {
    return { pending: this.pending.size, semanticOrder: this.events.filter((event) => event.orderLive).length,
      recoveryOnly: this.events.filter((event) => !event.orderLive && (event.kind === 'exact' || event.kind === 'front')).length,
      recoveryRecords: this.events.filter((event) => event.inverse).length, nodes: this.state.nodes.size };
  }
}
