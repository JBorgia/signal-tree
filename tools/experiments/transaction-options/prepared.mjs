// Independent, non-shipping prepared compensation experiment. No shared resolver.
// Safety is deliberately narrower than conformance: overlapping older settlement
// refuses rather than surgically rewriting later before-images. No architecture
// selection or production authority follows from this prototype's results.
import { isDeepStrictEqual as equal } from 'node:util';

const copy = structuredClone;
const ok = () => ({ status: 'settled' });
const refusal = reason => ({ status: 'refused', reason });
const unsupported = message => {
  throw Object.assign(new Error(message), { name: 'Unsupported' });
};
class Conflict extends Error {}
const requireFact = (condition, message) => { if (!condition) throw new Conflict(message); };
const sameKey = (a, b) => Object.is(a, b);
const entity = (s, ref) => s.entities.find(e => e.ref === ref);
const scalarIndex = (s, path) => s.values.findIndex(v => equal(v.path, path));

// Mutates only private prepared snapshots; returns a recorded inverse assignment.
function apply(s, op) {
  if (op.kind === 'set' || op.kind === 'delete-value') {
    const i = scalarIndex(s, op.path);
    const inverse = i < 0 ? { kind: 'delete-value', path: copy(op.path) }
      : { kind: 'set', ...copy(s.values[i]) };
    if (op.kind === 'delete-value') { if (i >= 0) s.values.splice(i, 1); }
    else if (i >= 0) s.values[i].value = copy(op.value);
    else s.values.push({ path: copy(op.path), value: copy(op.value) });
    return inverse;
  }
  const e = entity(s, op.ref);
  if (op.kind === 'add') {
    requireFact(!e, 'lifetime already exists');
    requireFact(!s.entities.some(v => sameKey(v.key, op.key)), 'business key occupied');
    s.entities.push({ ref: op.ref, key: copy(op.key), fields: copy(op.fields) });
    return { kind: 'remove', ref: op.ref };
  }
  requireFact(e, 'lifetime absent');
  if (op.kind === 'remove') {
    const inverse = { kind: 'add', ...copy(e) };
    s.entities.splice(s.entities.indexOf(e), 1);
    return inverse;
  }
  if (op.kind === 'rekey') {
    requireFact(!s.entities.some(v => v.ref !== op.ref && sameKey(v.key, op.key)), 'business key occupied');
    const inverse = { kind: 'rekey', ref: op.ref, key: copy(e.key) };
    e.key = copy(op.key);
    return inverse;
  }
  if (op.kind === 'field' || op.kind === 'delete-field') {
    const inverse = Object.hasOwn(e.fields, op.field)
      ? { kind: 'field', ref: op.ref, field: op.field, value: copy(e.fields[op.field]) }
      : { kind: 'delete-field', ref: op.ref, field: op.field };
    if (op.kind === 'delete-field') delete e.fields[op.field];
    else Object.defineProperty(e.fields, op.field, {
      value: copy(op.value), writable: true, enumerable: true, configurable: true,
    });
    return inverse;
  }
  unsupported(`assignment kind ${op.kind}`);
}

function overlap(a, b) {
  if (a.kind === 'set' || b.kind === 'set')
    return a.kind === b.kind && equal(a.path, b.path);
  if (a.ref !== b.ref) return false; // Occupancy conflicts are separately preflighted.
  if (a.kind === 'field' && b.kind === 'field') return a.field === b.field;
  if ((a.kind === 'field' && b.kind === 'rekey') ||
      (b.kind === 'field' && a.kind === 'rekey')) return false;
  return true;
}
function supersedes(newer, older) {
  if (newer.kind === 'set' || older.kind === 'set')
    return newer.kind === older.kind && equal(newer.path, older.path);
  if (newer.ref !== older.ref) return false;
  if (newer.kind === 'remove') return true;
  return newer.kind === older.kind &&
    (newer.kind === 'rekey' || (newer.kind === 'field' && newer.field === older.field));
}

export function create({ profile = 'live', seed } = {}) {
  if (profile !== 'live') unsupported('prepared compensation supports live proposals only');
  let visible = copy(seed ?? {
    values: ['x', 'y', 'z'].map(k => ({ path: [k], value: 0 })),
    entities: [{ ref: 'original', key: 'A', fields: { name: 'Original', priority: 0 } }],
  });
  let committed = copy(visible);
  let canonicalKnown = true;
  let destroyed = false;
  let sequence = 0;
  const active = new Map();
  // Terminal summaries are reachable only through caller-held opaque handles.
  // Neither a global ID registry nor diagnostic history retains terminal work.
  const handles = new WeakMap();
  const observers = new Set();
  const links = new Set();
  const live = () => { if (destroyed) throw new Error('candidate destroyed'); };
  const get = id => {
    live();
    const record = handles.get(id);
    if (!record) throw new Error('unknown contribution');
    return record;
  };
  const state = id => {
    const r = get(id);
    return { status: r.status, authority: r.status === 'pending', dispositions: [...r.dispositions] };
  };
  const eligible = path => ![...active.values()].some(r => r.edits.some((e, i) =>
    r.dispositions[i] === 'pending' && e.op.kind === 'set' && equal(e.op.path, path)));
  function publish(before) {
    // Settlement metadata and both snapshots are committed before callbacks.
    if (!equal(before, visible)) for (const cb of [...observers]) cb(copy(visible));
    for (const link of [...links]) {
      if (!eligible(link.path)) continue;
      const i = scalarIndex(visible, link.path);
      const v = i < 0 ? undefined : visible.values[i].value;
      if (!equal(link.last, v)) { link.last = copy(v); link.cb(copy(v)); }
    }
  }
  function prepare(ops) {
    const next = copy(visible);
    const edits = ops.map(op => {
      requireFact(['set', 'add', 'field', 'rekey', 'remove'].includes(op.kind), 'unknown public operation');
      const recorded = copy(op);
      const inverse = apply(next, recorded);
      return { op: recorded, inverse, dependent: false };
    });
    return { next, edits };
  }
  function committedPlan(ops) {
    if (!canonicalKnown) return { next: committed, known: false };
    const next = copy(committed);
    try {
      for (const op of ops) {
        // Removing a speculative add needs no canonical lifetime to remove.
        if (op.kind === 'remove' && !entity(next, op.ref)) continue;
        apply(next, op);
      }
      return { next, known: true };
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      // Never manufacture a support topology just to return a canonical answer.
      return { next: committed, known: false };
    }
  }
  function markCommitted(ops, beforeSequence) {
    for (const r of active.values()) {
      if (r.sequence >= beforeSequence) continue;
      r.edits.forEach((edit, i) => {
        if (r.dispositions[i] !== 'pending') return;
        if (ops.some(op => supersedes(op, edit.op))) r.dispositions[i] = 'superseded';
        else if (edit.op.kind === 'add' && ops.some(op =>
          op.ref === edit.op.ref && ['field', 'rekey'].includes(op.kind))) edit.dependent = true;
      });
    }
  }
  function retire(id, r, status) {
    r.status = status;
    r.dispositions = r.dispositions.map(d => d === 'superseded' ? d :
      status === 'accepted' ? 'committed' : 'rejected');
    active.delete(id);
    delete r.edits; // Caller-held terminal summary retains no before-images.
    if (!active.size) { committed = copy(visible); canonicalKnown = true; }
  }
  function settle(id, accepting) {
    const r = get(id);
    if (r.status !== 'pending') return { status: 'already-settled' };
    try {
      const effective = r.edits.filter((_, i) => r.dispositions[i] === 'pending');
      for (const other of active.values()) {
        if (other.sequence <= r.sequence) continue;
        requireFact(!other.edits.some((e, i) => other.dispositions[i] === 'pending' &&
          effective.some(own => overlap(own.op, e.op))),
        'unsafe later pending overlap; before-images cannot be surgically rewritten');
      }
      const before = visible;
      if (accepting) {
        // A dependent acceptance must not smuggle in an unaccepted existence.
        for (const other of active.values()) {
          if (other.sequence >= r.sequence) continue;
          requireFact(!other.edits.some((e, i) => other.dispositions[i] === 'pending' &&
            e.op.kind === 'add' && effective.some(own => own.op.ref === e.op.ref)),
          'acceptance depends on pending-created lifetime');
        }
        const ops = effective.map(e => e.op);
        const plan = committedPlan(ops);
        // A previously unsupported canonical support topology stays unsupported
        // until all obligations retire; acceptance itself only commits ownership.
        markCommitted(ops, r.sequence);
        committed = plan.next;
        canonicalKnown = plan.known;
        retire(id, r, 'accepted');
      } else {
        const next = copy(visible);
        // ALL inverse validation happens on the private copy. In particular a
        // key collision cannot leave a scalar restored but authority retired.
        for (const edit of [...effective].reverse()) {
          const { op } = edit;
          requireFact(!edit.dependent, 'committed work depends on pending existence');
          if (op.kind === 'set') {
            const i = scalarIndex(next, op.path);
            requireFact(i >= 0 && equal(next.values[i].value, op.value), 'scalar changed');
          } else if (op.kind === 'field') {
            requireFact(entity(next, op.ref) && equal(entity(next, op.ref).fields[op.field], op.value), 'field changed');
          } else if (op.kind === 'rekey') {
            requireFact(entity(next, op.ref) && sameKey(entity(next, op.ref).key, op.key), 'mapping changed');
          } else if (op.kind === 'add') {
            requireFact(equal(entity(next, op.ref), { ref: op.ref, key: op.key, fields: op.fields }), 'added lifetime changed');
          }
          apply(next, edit.inverse);
        }
        visible = next;
        retire(id, r, 'rejected');
      }
      publish(before);
      return ok();
    } catch (e) {
      if (e instanceof Conflict) return refusal(e.message);
      throw e;
    }
  }
  return {
    begin(ops) {
      live();
      const plan = prepare(ops);
      const id = Object.freeze({});
      const r = { status: 'pending', dispositions: ops.map(() => 'pending'),
        sequence: ++sequence, edits: plan.edits };
      const before = visible;
      handles.set(id, r);
      active.set(id, r);
      visible = plan.next;
      publish(before);
      return id;
    },
    accept: id => settle(id, true),
    reject: id => settle(id, false),
    write(ops, { context = 'local', defer = false } = {}) {
      live();
      if (defer) unsupported('deferred operations unsupported; nothing queued');
      if (context !== 'local') unsupported(`${context} ingress unsupported; nothing changed`);
      try {
        const plan = prepare(ops);
        const canonical = committedPlan(ops);
        const before = visible;
        markCommitted(ops, ++sequence);
        visible = plan.next;
        committed = canonical.next;
        canonicalKnown = canonical.known;
        if (!active.size) { committed = copy(visible); canonicalKnown = true; }
        publish(before);
        return ok();
      } catch (e) {
        if (e instanceof Conflict) return refusal(e.message);
        throw e;
      }
    },
    read() { live(); return copy(visible); },
    canonical() {
      live();
      if (!canonicalKnown) unsupported('canonical support projection for dependent topology is unspecified');
      return copy(committed);
    },
    state,
    observe(cb) { live(); observers.add(cb); return () => observers.delete(cb); },
    link(path, cb) {
      live();
      const i = scalarIndex(visible, path);
      const record = { path: copy(path), cb, last: copy(i < 0 ? undefined : visible.values[i].value) };
      links.add(record);
      return () => links.delete(record);
    },
    flush() { live(); },
    draft() { unsupported('draft isolation unsupported'); },
    authority() { unsupported('authority ordering and correlation unsupported; nothing changed'); },
    undo() { unsupported('undo history unsupported'); },
    stats() {
      return { active: active.size,
        retainedOperations: [...active.values()].reduce((n, r) => n + r.edits.length, 0), history: 0 };
    },
    destroy() {
      for (const r of active.values()) delete r.edits;
      active.clear(); observers.clear(); links.clear();
      visible = committed = { values: [], entities: [] };
      destroyed = true;
    },
  };
}
