// Experimental native-authority arm. No production imports or retained canonical mirror.
export function createStore() {
  const cells = new Map(), entities = new Map(), obligations = new Map(), owners = new Map();
  const observers = new Set(), errors = [], deliveries = [];
  let revision = 0, sequence = 0, nextOwner = 0, nextLife = 0, currentOwner = null;
  let destroyed = false, faultArmed = false, fault, faultAfterPrepared, scheduled = false, draining = false;
  let undoRecord = null, recording = null;
  let counts = freshCounts();
  function freshCounts() { return { visitedLocations: 0, preparedCells: 0, preparedRecords: 0, nativeWrites: 0, publications: 0, snapshotLocations: 0, ledgerCopies: 0, contributionCopies: 0, factAllocations: 0, ownerAllocations: 0, referenceAllocations: 0, deliveryAllocations: 0, payloadCopies: 0, payloadObjectCopies: 0, installedUnits: 0, observerDeliveries: 0 }; }
  function clonePayload(value) {
    if (value === null || typeof value !== 'object') return value;
    const copy = structuredClone(value); counts.payloadCopies++;
    const seen = new Set(), queue = [copy];
    while (queue.length) { const item = queue.pop(); if (item === null || typeof item !== 'object' || seen.has(item)) continue; seen.add(item); counts.payloadObjectCopies++; for (const child of Object.values(item)) queue.push(child); }
    return copy;
  }
  function alive() { if (destroyed) throw new Error('Store destroyed'); }
  function location(kind, key) { return `${kind}:${key}`; }
  function fact(present, value, seq) { counts.factAllocations++; return present ? { present, value, seq } : { present, seq }; }
  function native(kind, key) { const map = kind === 'c' ? cells : entities; return map.has(key) ? { present: true, value: map.get(key) } : { present: false }; }
  function ledgerCopy(old) { counts.ledgerCopies++; counts.contributionCopies += old.contributions.size; return { kind: old.kind, key: old.key, base: old.base, contributions: new Map(old.contributions) }; }
  function winner(ledger) { let result = ledger.base; for (const entry of ledger.contributions.values()) { counts.visitedLocations++; if (entry.seq > result.seq) result = entry; } return result; }
  function prepareGate() {
    let prepared = 0;
    function throwFault() { const error = fault; faultArmed = false; fault = undefined; faultAfterPrepared = undefined; throw error; }
    if (faultArmed && faultAfterPrepared === undefined) throwFault();
    return () => { prepared++; if (faultArmed && faultAfterPrepared !== undefined && prepared >= faultAfterPrepared) throwFault(); };
  }
  function install(kind, key, selected) {
    const map = kind === 'c' ? cells : entities;
    if (selected.present) map.set(key, selected.value); else map.delete(key);
    counts.nativeWrites++;
  }
  function publish() {
    counts.publications++; counts.installedUnits++;
    if (!observers.size) return;
    counts.deliveryAllocations++;
    deliveries.push([...observers]);
    if (!scheduled) { scheduled = true; queueMicrotask(drain); }
  }
  function drain() {
    scheduled = false;
    if (draining || destroyed) return;
    draining = true;
    try { while (deliveries.length) { const batch = deliveries.shift(); for (const observer of batch) { if (!observers.has(observer)) continue; try { counts.observerDeliveries++; observer(); } catch (error) { errors.push(error); } } } }
    finally { draining = false; }
  }
  function writeFact(kind, key, present, value, entityPayload = false) {
    alive();
    const start = revision;
    const preparedLocation = prepareGate();
    let prepared = present ? clonePayload(value) : undefined;
    if (entityPayload) counts.preparedRecords++;
    counts.preparedCells++; counts.visitedLocations++;
    const id = location(kind, key), old = obligations.get(id), before = native(kind, key);
    const seq = sequence + 1;
    const authored = fact(present, prepared, seq);
    let next;
    if (currentOwner) {
      next = old ? ledgerCopy(old) : { kind, key, base: fact(before.present, before.value, 0), contributions: new Map() };
      if (!old) counts.ledgerCopies++;
      next.contributions.set(currentOwner.id, authored);
      counts.contributionCopies++;
    } else if (old) { next = ledgerCopy(old); next.base = authored; }
    const visible = next ? winner(next) : authored;
    preparedLocation();
    if (revision !== start) throw new Error('Preparation invalidated by reentry');
    // No callback/fallible user code between native install and responsibility commit.
    if (recording && !recording.has(id)) recording.set(id, { kind, key, before });
    sequence = seq;
    install(kind, key, visible);
    if (next) obligations.set(id, next);
    if (currentOwner) currentOwner.locations.add(id);
    revision++;
    publish();
  }
  function settle(owner, accept) {
    alive();
    if (owner.status !== 'pending') return;
    const start = revision;
    const preparedLocation = prepareGate();
    const plans = [];
    for (const id of owner.locations) {
      counts.visitedLocations++;
      const old = obligations.get(id);
      if (!old || !old.contributions.has(owner.id)) throw new Error('Missing pending responsibility');
      const next = ledgerCopy(old), own = next.contributions.get(owner.id);
      next.contributions.delete(owner.id);
      if (accept && own.seq > next.base.seq) next.base = own;
      plans.push({ id, next, visible: winner(next) }); counts.preparedCells++; preparedLocation();
    }
    if (revision !== start) throw new Error('Settlement invalidated by reentry');
    for (const plan of plans) {
      install(plan.next.kind, plan.next.key, plan.visible);
      if (plan.next.contributions.size) obligations.set(plan.id, plan.next); else obligations.delete(plan.id);
    }
    owner.status = accept ? 'accepted' : 'rejected';
    owner.locations.clear(); owners.delete(owner.id);
    revision++;
    publish();
  }
  function ref(key, id) {
    counts.referenceAllocations++;
    return Object.freeze({ id,
      read() { if (destroyed) return undefined; const row = entities.get(key); return row?.id === id ? clonePayload(row.record) : undefined; },
      write(record) { alive(); const row = entities.get(key); if (row?.id !== id) throw new Error('Retired entity reference'); writeFact('e', key, true, { id, record }, true); }
    });
  }
  return {
    write(key, value) { writeFact('c', key, true, value); },
    remove(key) { alive(); if (!cells.has(key)) return; writeFact('c', key, false); },
    read(key) { alive(); const result = native('c', key); return result.present ? { present: true, value: clonePayload(result.value) } : result; },
    add(key, record) { alive(); if (entities.has(key)) throw new Error('Duplicate entity key'); const id = ++nextLife; writeFact('e', key, true, { id, record }, true); return ref(key, id); },
    removeEntity(key) { alive(); if (!entities.has(key)) throw new Error(`Entity with id ${key} not found`); writeFact('e', key, false); },
    get(key) { alive(); const row = entities.get(key); return row ? ref(key, row.id) : undefined; },
    begin(fn) {
      alive(); const owner = { id: ++nextOwner, status: 'pending', locations: new Set() }; counts.ownerAllocations++;
      owners.set(owner.id, owner);
      const handle = { accept: () => settle(owner, true), reject: () => settle(owner, false), state: () => destroyed ? 'destroyed' : owner.status };
      const previous = currentOwner; currentOwner = owner;
      try { fn(); } catch (error) {
        currentOwner = previous;
        try { settle(owner, false); } catch (recoveryError) {
          if (error instanceof Error && Object.isExtensible(error)) Object.defineProperty(error, 'recovery', { value: handle, configurable: true });
          errors.push(recoveryError);
        }
        throw error;
      } finally { currentOwner = previous; }
      return handle;
    },
    undoable(fn) {
      alive(); if (currentOwner || recording) throw new Error('Nested undoable unsupported');
      const history = new Map(); recording = history;
      try { fn(); } finally { recording = null; undoRecord = history; }
    },
    undo() {
      alive(); if (!undoRecord) return;
      if (owners.size) throw new Error('Undo refused while pending');
      const start = revision; const preparedLocation = prepareGate();
      const plans = [];
      for (const entry of undoRecord.values()) { counts.visitedLocations++; counts.preparedCells++; plans.push(entry); preparedLocation(); }
      if (start !== revision) throw new Error('Undo preparation invalidated');
      // No live ownership records exist. This is the same native-authority install contract.
      for (const entry of plans) { sequence++; install(entry.kind, entry.key, entry.before); }
      undoRecord = null; revision++; publish();
    },
    snapshot() {
      alive(); const out = Object.create(null); const rows = [];
      for (const [key, value] of cells) { counts.snapshotLocations++; Object.defineProperty(out, key, { value: clonePayload(value), enumerable: true, configurable: true, writable: true }); }
      for (const [key, row] of entities) { counts.snapshotLocations++; rows.push({ key, id: row.id, value: clonePayload(row.record) }); }
      return { cells: out, entities: rows };
    },
    observe(fn) { alive(); observers.add(fn); return () => observers.delete(fn); },
    flush() { drain(); },
    takeErrors() { return errors.splice(0); },
    failNextPreparation(error, options) { alive(); if (options?.afterPrepared !== undefined && (!Number.isInteger(options.afterPrepared) || options.afterPrepared < 1)) throw new Error('Invalid prepared-location fault index'); faultArmed = true; fault = error; faultAfterPrepared = options?.afterPrepared; },
    stats() {
      let contributions = 0; for (const ledger of obligations.values()) contributions += ledger.contributions.size;
      return { ...counts, retainedOwnershipLocations: obligations.size, retainedBaseFacts: obligations.size, retainedContributions: contributions, retainedOwners: owners.size, nativeLocations: cells.size + entities.size, retainedReferences: 0, retainedHistoryFacts: undoRecord?.size ?? 0, retainedDeliveries: deliveries.length, canonicalMirrorLocations: 0 };
    },
    resetStats() { counts = freshCounts(); },
    destroy() { destroyed = true; cells.clear(); entities.clear(); obligations.clear(); owners.clear(); observers.clear(); deliveries.length = 0; errors.length = 0; undoRecord = null; recording = null; fault = undefined; faultArmed = false; currentOwner = null; }
  };
}
