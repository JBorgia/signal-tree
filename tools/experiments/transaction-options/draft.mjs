// Independent, non-shipping isolated-draft model of PROTOCOL.md.
// Recorded assignments only: no arbitrary callback capture or framework claims.
// Storage: one committed store, one full private store per pending draft. Reads
// are defensive copies; read() and canonical() expose the SAME committed truth.
// Merge policy: any intervening write to a draft dependency permanently refuses
// acceptance (including equal-value/ABA writes). Disjoint writes merge. This is
// deliberately conservative conflict refusal, not settlement-time re-authorship.
// Retention: terminal state stays on the caller's handle, never in an ID table.
// Costs: O(store size) copying per begin/commit, O(pending dependency pairs) conflict
// checks per commit; no heap measurements or production integration evidence.
import { isDeepStrictEqual } from 'node:util';

export class Unsupported extends Error {
  constructor(message) { super(message); this.name = 'Unsupported'; }
}
class Conflict extends Error {}
class Handle {
  #owner;
  #record;
  constructor(owner, record) { this.#owner = owner; this.#record = record; }
  static record(handle, owner) {
    if (!(handle instanceof Handle) || handle.#owner !== owner) throw new TypeError('Foreign draft handle');
    return handle.#record;
  }
}
const clone = value => structuredClone(value);
const settled = () => ({ status: 'settled' });
const refused = error => ({ status: 'refused', reason: error.message });
const typed = value => {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) {
    throw new Unsupported('Keys, reference labels and path segments must be strings or finite numbers');
  }
  return value;
};
const pathKey = path => {
  if (!Array.isArray(path) || !path.length) throw new TypeError('Expected a nonempty path');
  return JSON.stringify(path.map(typed));
};
const address = (...parts) => parts;
// '*' is a separate category, not a magic user field name.
function intersects(a, b) {
  if (a[0] === 'fields' && b[0] === 'field' || a[0] === 'field' && b[0] === 'fields') {
    return a[1] === b[1];
  }
  return a.length === b.length && a.every((part, i) => part === b[i]);
}
function copyStore(store) {
  return { values: clone(store.values), entities: clone(store.entities) };
}
function snapshot(store) {
  return clone({ values: [...store.values.values()], entities: [...store.entities.values()] });
}
function normalize(ops) {
  if (!Array.isArray(ops)) throw new Unsupported('Only arrays of recorded assignments are supported');
  const result = clone(ops);
  for (const op of result) {
    if (op.kind === 'set') { pathKey(op.path); continue; }
    if (!['add', 'remove', 'rekey', 'field'].includes(op.kind)) throw new Unsupported(`Operation ${op.kind}`);
    typed(op.ref);
    if (op.kind === 'add' || op.kind === 'rekey') typed(op.key);
    if (op.kind === 'field' && typeof op.field !== 'string') throw new Unsupported('Only named entity fields are supported');
    if (op.kind === 'add' && (!op.fields || typeof op.fields !== 'object' || Array.isArray(op.fields))) {
      throw new TypeError('Expected entity fields');
    }
  }
  return result;
}

// Work only on a staging store. Dependency addresses encode typed identity and
// separate existence, key mapping and fields. A rekey does not depend on fields.
function apply(store, ops) {
  const reads = [], writes = [];
  const occupied = (key, except) => [...store.entities.values()].some(e => e.key === key && e.ref !== except);
  for (const op of ops) {
    if (op.kind === 'set') {
      const key = pathKey(op.path), loc = address('value', key);
      reads.push(loc); writes.push(loc);
      store.values.set(key, { path: op.path, value: op.value });
      continue;
    }
    const entity = store.entities.get(op.ref), life = address('life', op.ref);
    reads.push(life);
    if (op.kind === 'add') {
      reads.push(address('key', op.key));
      if (entity || occupied(op.key)) throw new Conflict('Entity reference or key already exists');
      // Field containers belong to the lifetime, even when two input records
      // share a fields object. Never mutate the recorded add on later edits.
      store.entities.set(op.ref, { ref: op.ref, key: op.key, fields: clone(op.fields) });
      writes.push(life, address('mapping', op.ref), address('fields', op.ref), address('key', op.key));
      continue;
    }
    if (!entity) throw new Conflict('Entity lifetime no longer exists');
    if (op.kind === 'field') {
      const loc = address('field', op.ref, op.field);
      reads.push(loc); writes.push(loc);
      Object.defineProperty(entity.fields, op.field, {
        value: op.value, enumerable: true, writable: true, configurable: true,
      });
    } else if (op.kind === 'rekey') {
      reads.push(address('mapping', op.ref), address('key', op.key));
      if (occupied(op.key, op.ref)) throw new Conflict('Destination key is occupied');
      writes.push(address('mapping', op.ref), address('key', entity.key), address('key', op.key));
      entity.key = op.key;
    } else {
      reads.push(address('mapping', op.ref), address('fields', op.ref));
      writes.push(life, address('mapping', op.ref), address('fields', op.ref), address('key', entity.key));
      store.entities.delete(op.ref);
    }
  }
  return { reads, writes };
}

export function create({ profile = 'draft', diagnostics = false, seed } = {}) {
  if (profile !== 'draft') throw new Unsupported('This candidate only implements isolated drafts');
  // Diagnostics intentionally retain no additional history; both modes execute
  // identical storage and publication paths.
  void diagnostics;
  const owner = {}, active = new Set(), observers = new Set(), links = new Set();
  let store = { values: new Map(), entities: new Map() };
  let revision = -Infinity, destroyed = false, publishing = false;
  const initial = seed ?? {
    values: ['x', 'y', 'z'].map(key => ({ path: [key], value: 0 })),
    entities: [{ ref: 'original', key: 'A', fields: { name: 'Original', priority: 0 } }],
  };
  apply(store, normalize([
    ...initial.values.map(v => ({ kind: 'set', ...v })),
    ...initial.entities.map(e => ({ kind: 'add', ...e })),
  ]));
  const live = () => { if (destroyed) throw new Error('Model destroyed'); };
  const mutable = () => {
    live();
    if (publishing) throw new Unsupported('Reentrant mutation during publication');
  };
  const record = id => Handle.record(id, owner);
  function retire(id, status) {
    const r = record(id);
    r.status = status;
    r.dispositions.fill(status === 'accepted' ? 'committed' : 'rejected');
    // Release full state and operation payloads even if the caller keeps id.
    delete r.ops; delete r.view; delete r.dependencies; delete r.conflict;
    active.delete(id);
  }
  function publish(before) {
    const after = snapshot(store);
    if (isDeepStrictEqual(before, after)) return;
    publishing = true;
    const errors = [];
    const deliver = (cb, value) => { try { cb(clone(value)); } catch (error) { errors.push(error); } };
    try {
      for (const cb of [...observers]) deliver(cb, after);
      for (const entry of [...links]) {
        const previous = before.values.find(v => pathKey(v.path) === entry.key);
        const next = store.values.get(entry.key);
        if (!isDeepStrictEqual(previous, next)) deliver(entry.cb, next?.value);
      }
    } finally { publishing = false; }
    if (errors.length) throw new AggregateError(errors, 'Publication callbacks failed after commit');
  }
  function install(next, writes, committing) {
    for (const id of active) {
      if (id === committing) continue;
      const r = record(id);
      if (r.dependencies.some(dep => writes.some(write => intersects(dep, write)))) r.conflict = true;
    }
    store = next;
  }
  function commitOps(ops, nextRevision) {
    const next = copyStore(store);
    let effects;
    try { effects = apply(next, ops); }
    catch (error) { if (error instanceof Conflict) return refused(error); throw error; }
    const before = snapshot(store);
    install(next, effects.writes);
    if (nextRevision !== undefined) revision = nextRevision;
    publish(before);
    return settled();
  }
  const api = {
    begin(input) {
      mutable();
      const ops = normalize(input), view = copyStore(store);
      const { reads } = apply(view, ops);
      const id = new Handle(owner, {
        status: 'pending', dispositions: ops.map(() => 'pending'),
        ops, view, dependencies: reads, conflict: false,
      });
      active.add(id);
      return id;
    },
    accept(id) {
      mutable();
      const r = record(id);
      if (r.status !== 'pending') return { status: 'already-settled' };
      if (r.conflict) return refused(new Conflict('An intervening write touched a draft dependency; discard and author a new draft'));
      const next = copyStore(store);
      let effects;
      try { effects = apply(next, clone(r.ops)); }
      catch (error) { if (error instanceof Conflict) return refused(error); throw error; }
      const before = snapshot(store);
      install(next, effects.writes, id);
      retire(id, 'accepted');
      publish(before);
      return settled();
    },
    reject(id) {
      mutable();
      if (record(id).status !== 'pending') return { status: 'already-settled' };
      retire(id, 'rejected');
      return settled();
    },
    write(input, { context = 'local', defer = false } = {}) {
      mutable();
      if (defer) throw new Unsupported('Deferred context capture is not implemented');
      if (context !== 'local' && context !== 'external') throw new Unsupported(`Write context ${context}`);
      return commitOps(normalize(input));
    },
    authority({ ops = [], order, settlements = [] }) {
      mutable();
      if (settlements.length) throw new Unsupported('Explicit authority settlement relations are not implemented');
      if (order?.kind === 'unordered') return refused(new Conflict('Unordered authority has no admission rule'));
      if (!['snapshot', 'versioned'].includes(order?.kind)) throw new Unsupported('Unknown authority ordering');
      let nextRevision;
      if (order.kind === 'versioned') {
        if (!Number.isSafeInteger(order.revision)) throw new TypeError('Expected an integer revision');
        if (order.revision <= revision) return refused(new Conflict('Stale or equal authority revision'));
        nextRevision = order.revision;
      }
      return commitOps(normalize(ops), nextRevision);
    },
    read() { live(); return snapshot(store); },
    canonical() { live(); return snapshot(store); },
    draft(id) {
      live();
      const r = record(id);
      if (r.status !== 'pending') throw new Unsupported('Terminal draft snapshots are released');
      return snapshot(r.view);
    },
    state(id) {
      const r = record(id);
      return { status: r.status, authority: r.status === 'pending', dispositions: [...r.dispositions] };
    },
    observe(cb) {
      live();
      if (typeof cb !== 'function') throw new TypeError('Expected observer');
      observers.add(cb);
      return () => observers.delete(cb);
    },
    link(path, cb) {
      live();
      if (typeof cb !== 'function') throw new TypeError('Expected link callback');
      const entry = { key: pathKey(path), cb };
      links.add(entry);
      return () => links.delete(entry);
    },
    flush() { live(); }, // No deferred work can enter this model.
    undo() { live(); throw new Unsupported('Undo history is not implemented'); },
    stats() {
      return {
        active: active.size,
        retainedOperations: [...active].reduce((sum, id) => sum + record(id).ops.length, 0),
        history: 0,
      };
    },
    destroy() {
      if (destroyed) return;
      mutable();
      for (const id of active) retire(id, 'rejected');
      observers.clear(); links.clear(); store.values.clear(); store.entities.clear();
      destroyed = true;
    },
  };
  return api;
}
