export const contextCheckNames = ["complete-key-order-and-missing", "duplicate-keys", "pending-owner-and-status", "unresolved-dismissal", "requests-decisions-effects", "accept-and-reject", "held-snapshot", "replacement-instance", "retired-editor", "settled-cleanup", "same-subject-order-and-unknown", "newer-revision-suppresses-old-pending", "replacement-with-live-old-command", "bulk-and-point-independent-values", "inactive-held-store"];

// Serialized into the installed application. No host closures or imports.
// Same first/20-repeat materialize/serialize boundaries as contextProbe; only
// the full-context retrieval strategy changes in the separately labelled arm.
export async function contextStrategyProbe({ rows, repetitions = 20, strategy, fault, phase = 'initial' }) {
  if (!['point', 'bulk', 'ordered'].includes(strategy)) throw Error('Unknown context strategy');
  if (!['initial', 'accepted', 'replacement'].includes(phase)) throw Error('Unknown context phase');
  const lab = window.lab, phases = {};
  const expectedRow = i => ({ id: `J-${i}`, instance: i === 0 && phase === 'replacement' ? 'context-replacement' : `initial-${i}`, title: `Inspect ${i % 3 === 0 ? 'pump' : 'valve'} ${i}`, owner: i === 0 && phase === 'accepted' ? 'Context Owner' : i === 0 && phase === 'replacement' ? 'Replacement Owner' : `Operator ${i % 10}`, status: 'queued', active: i % 2 === 0, ownerRevision: i === 0 && phase === 'accepted' ? 11 : i === 0 && phase === 'replacement' ? 40 : 10, statusRevision: i === 0 && phase === 'replacement' ? 40 : 10 });
  const canonical = row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
  for (const size of phase === 'initial' ? [50, rows] : [rows]) {
    const samples = [];
    let expected;
    for (let repeat = 0; repeat <= repetitions; repeat++) {
      const start = performance.now();
      // ID generation stays inside both timed materialization boundaries.
      const values = strategy !== 'point' && size === rows
        ? (strategy === 'bulk' ? lab.contextRows : lab.contextRowsOrdered)(Array.from({ length: size }, (_, i) => `J-${i}`))
        : Array.from({ length: size }, (_, i) => lab.row(`J-${i}`));
      const materialized = performance.now();
      if (fault === 'context-truncated') values.pop();
      if (fault === 'context-corrupt') values[0] = { ...values[0], owner: 'wrong' };
      const json = JSON.stringify(values);
      const serialized = performance.now();
      if (values.length !== size || values.some((value, i) => !value || canonical(value) !== canonical(expectedRow(i)))) throw Error('context-content-oracle');
      if (expected !== undefined && json !== expected) throw Error('context-stability-oracle');
      expected = json;
      samples.push({ materializeMs: materialized - start, serializeMs: serialized - materialized, totalMs: serialized - start });
    }
    phases[size === 50 ? 'selected' : 'full'] = { rows: size, bytes: new TextEncoder().encode(expected).byteLength, json: expected, canonicalJson: JSON.stringify(JSON.parse(expected).map(row => JSON.parse(canonical(row)))), first: samples[0], repeated: samples.slice(1) };
  }
  return phases;
}

// Mutation and its oracles are outside context timers. Each post-edit profile
// starts from a new document, warms one initial context, then invokes these.
export async function contextStrategyAdvance({ phase }) {
  const lab = window.lab;
  if (phase === 'accepted') {
    await lab.assign('J-0', 'owner', 'Context Owner', 'context-timed-A');
    const pending = lab.snapshot();
    if (pending.operations.length !== 1 || pending.operations[0].id !== 'context-timed-A' || pending.operations[0].outcome !== 'pending' || lab.row('J-0').owner !== 'Context Owner') throw Error('context-edit-pending-oracle');
    const decision = await lab.process('context-timed-A', 'accept');
    if (decision.commandId !== 'context-timed-A' || decision.instance !== 'initial-0' || decision.field !== 'owner' || decision.outcome !== 'applied' || decision.value !== 'Context Owner' || decision.revision !== 11) throw Error('context-edit-decision-oracle');
    await lab.dismissSettled();
    const settled = lab.snapshot(), effects = settled.applications;
    if (settled.operations.length !== 0 || effects.length !== 1 || effects[0].id !== 'context-timed-A' || effects[0].subject !== 'J-0' || effects[0].instance !== 'initial-0' || effects[0].field !== 'owner' || effects[0].value !== 'Context Owner' || effects[0].expectedRevision !== 10) throw Error('context-edit-effect-oracle');
  } else if (phase === 'replacement') {
    await lab.replace('J-0', { id: 'J-0', instance: 'context-replacement', title: 'Inspect pump 0', owner: 'Replacement Owner', status: 'queued', active: true, ownerRevision: 40, statusRevision: 40 });
    if (lab.row('J-0').instance !== 'context-replacement' || lab.snapshot().operations.length) throw Error('context-replacement-oracle');
  } else throw Error('Unknown context mutation');
  return { passed: true, phase };
}

// Run in a separate untimed conformance document BEFORE comparative admission.
// These checks do not warm or mutate the timing document.
export async function contextStrategyCheck({ strategy, fault }) {
  if (!['point', 'bulk', 'ordered'].includes(strategy)) throw Error('Unknown context strategy');
  const lab = window.lab;
  if (strategy === 'bulk' && typeof lab.contextRows !== 'function') throw Error('context-method-required');
  const initial = i => ({ id: `J-${i}`, instance: `initial-${i}`, title: `Inspect ${i % 3 === 0 ? 'pump' : 'valve'} ${i}`, owner: `Operator ${i % 10}`, status: 'queued', active: i % 2 === 0, ownerRevision: 10, statusRevision: 10 });
  const ids = ['J-1', 'missing-context-key', 'J-0', 'J-1'];
  const read = () => strategy === 'bulk' ? lab.contextRows(ids) : strategy === 'ordered' ? lab.contextRowsOrdered(ids) : ids.map(id => lab.row(id));
  const canonical = values => JSON.stringify(values.map(value => value && Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))));
  const assert = (actual, expected, label) => { if (canonical(actual) !== canonical(expected)) throw Error(label); };
  const before = read(), beforeJSON = canonical(before);
  assert(before, [initial(1), undefined, initial(0), initial(1)], 'context-key-order-oracle');
  lab.holdEditor('context-retired-editor', 'J-0');
  await lab.assign('J-0', 'owner', 'Context Owner', 'context-A');
  await lab.assign('J-1', 'status', 'active', 'context-B');
  const pendingExpected = [{ ...initial(1), status: 'active' }, undefined, { ...initial(0), owner: 'Context Owner' }, { ...initial(1), status: 'active' }];
  const pending = fault === 'context-stale-cache' ? before : read();
  if (fault === 'context-bypass-projection') pending[2] = initial(0);
  assert(pending, pendingExpected, 'context-pending-oracle');
  await lab.dismissSettled();
  assert(read(), pendingExpected, 'context-dismiss-pending-oracle');
  const state = lab.snapshot();
  if (state.operations.length !== 2 || state.operations.some(operation => operation.outcome !== 'pending') || !state.operations.some(operation => operation.id === 'context-A' && operation.subject === 'J-0' && operation.instance === 'initial-0' && operation.field === 'owner' && operation.value === 'Context Owner' && operation.expectedRevision === 10) || !state.operations.some(operation => operation.id === 'context-B' && operation.subject === 'J-1' && operation.instance === 'initial-1' && operation.field === 'status' && operation.value === 'active' && operation.expectedRevision === 10)) throw Error('context-pending-identity-oracle');
  if (state.requests.length !== 2 || !state.requests.some(request => request.id === 'context-A' && request.subject === 'J-0' && request.instance === 'initial-0' && request.field === 'owner' && request.value === 'Context Owner' && request.expectedRevision === 10) || !state.requests.some(request => request.id === 'context-B' && request.subject === 'J-1' && request.instance === 'initial-1' && request.field === 'status' && request.value === 'active' && request.expectedRevision === 10)) throw Error('context-request-oracle');
  const rejection = await lab.process('context-B', 'reject');
  const acceptance = await lab.process('context-A', 'accept');
  if (rejection.commandId !== 'context-B' || rejection.instance !== 'initial-1' || rejection.field !== 'status' || rejection.outcome !== 'rejected' || acceptance.commandId !== 'context-A' || acceptance.instance !== 'initial-0' || acceptance.field !== 'owner' || acceptance.outcome !== 'applied' || acceptance.value !== 'Context Owner' || acceptance.revision !== 11) throw Error('context-decision-oracle');
  const accepted = { ...initial(0), owner: 'Context Owner', ownerRevision: 11 };
  assert(read(), [initial(1), undefined, accepted, initial(1)], 'context-settled-oracle');
  if (canonical(before) !== beforeJSON) throw Error('context-held-snapshot-oracle');
  const effects = lab.snapshot().applications;
  if (effects.length !== 1 || effects[0].id !== 'context-A' || effects[0].subject !== 'J-0' || effects[0].instance !== 'initial-0' || effects[0].field !== 'owner' || effects[0].value !== 'Context Owner') throw Error('context-effect-oracle');
  const replacement = { ...initial(0), instance: 'context-replacement', owner: 'Replacement Owner', ownerRevision: 40, statusRevision: 40 };
  await lab.replace('J-0', replacement);
  await lab.editHeld('context-retired-editor', 'owner', 'Wrong Lifetime', 'context-retired-write');
  const replaced = read();
  if (fault === 'context-stale-instance') replaced[2] = accepted;
  assert(replaced, [initial(1), undefined, replacement, initial(1)], 'context-instance-oracle');
  if (lab.snapshot().requests.some(request => request.id === 'context-retired-write')) throw Error('context-retired-editor-oracle');
  await lab.dismissSettled();
  if (lab.snapshot().operations.length !== 0) throw Error('context-settled-cleanup-oracle');
  // Added untimed peer-strategy oracles. Expectations are independent of both
  // point and bulk implementations; their agreement alone is insufficient.
  const readKeys = keys => strategy === 'bulk' ? lab.contextRows(keys) : strategy === 'ordered' ? lab.contextRowsOrdered(keys) : keys.map(id => lab.row(id));
  const checkKeys = (keys, expected, label) => {
    assert(readKeys(keys), expected, label);
    assert(keys.map(id => lab.row(id)), expected, `${label}-point`);
  };
  const orderedKeys = ['J-2', 'missing-context-key', 'J-2'];
  await lab.assign('J-2', 'owner', 'Older Context Owner', 'context-order-A');
  await lab.assign('J-2', 'owner', 'Newer Context Owner', 'context-order-B');
  await lab.assign('J-2', 'status', 'active', 'context-order-S');
  await lab.lose('context-order-A');
  const orderedPending = { ...initial(2), owner: 'Newer Context Owner', status: 'active' };
  checkKeys(orderedKeys, [orderedPending, undefined, orderedPending], 'context-same-subject-order-oracle');
  const heldPending = readKeys(orderedKeys), heldPendingJSON = canonical(heldPending);
  let orderedOperations = lab.snapshot().operations;
  const operationMatches = (id, field, value, outcome) => orderedOperations.some(operation => operation.id === id && operation.subject === 'J-2' && operation.instance === 'initial-2' && operation.field === field && operation.value === value && operation.expectedRevision === 10 && operation.outcome === outcome);
  if (orderedOperations.length !== 3 || !operationMatches('context-order-A', 'owner', 'Older Context Owner', 'unknown') || !operationMatches('context-order-B', 'owner', 'Newer Context Owner', 'pending') || !operationMatches('context-order-S', 'status', 'active', 'pending')) throw Error('context-order-command-oracle');
  const latestDecision = await lab.process('context-order-B', 'accept');
  if (latestDecision.commandId !== 'context-order-B' || latestDecision.instance !== 'initial-2' || latestDecision.field !== 'owner' || latestDecision.outcome !== 'applied' || latestDecision.value !== 'Newer Context Owner' || latestDecision.revision !== 11) throw Error('context-order-decision-oracle');
  const newerAccepted = { ...orderedPending, ownerRevision: 11 };
  checkKeys(orderedKeys, [newerAccepted, undefined, newerAccepted], 'context-revision-pending-oracle');
  orderedOperations = lab.snapshot().operations;
  if (orderedOperations.length !== 3 || !operationMatches('context-order-A', 'owner', 'Older Context Owner', 'unknown') || !operationMatches('context-order-S', 'status', 'active', 'pending')) throw Error('context-revision-owner-preservation-oracle');
  const statusDecision = await lab.process('context-order-S', 'reject');
  if (statusDecision.commandId !== 'context-order-S' || statusDecision.instance !== 'initial-2' || statusDecision.field !== 'status' || statusDecision.outcome !== 'rejected' || statusDecision.value !== 'queued' || statusDecision.revision !== 10) throw Error('context-order-status-rejection-oracle');
  const ownerOnly = { ...initial(2), owner: 'Newer Context Owner', ownerRevision: 11 };
  checkKeys(orderedKeys, [ownerOnly, undefined, ownerOnly], 'context-revision-suppression-oracle');
  await lab.retry('context-order-A');
  const oldDecision = await lab.process('context-order-A', 'accept');
  if (oldDecision.commandId !== 'context-order-A' || oldDecision.instance !== 'initial-2' || oldDecision.field !== 'owner' || oldDecision.outcome !== 'conflict' || oldDecision.value !== 'Newer Context Owner' || oldDecision.revision !== 11) throw Error('context-order-old-conflict-oracle');
  checkKeys(orderedKeys, [ownerOnly, undefined, ownerOnly], 'context-order-settled-oracle');
  if (canonical(heldPending) !== heldPendingJSON) throw Error('context-held-pending-snapshot-oracle');
  const orderedRequests = lab.snapshot().requests.filter(request => request.id.startsWith('context-order-'));
  const expectedRequests = [
    ['context-order-A', 'owner', 'Older Context Owner'],
    ['context-order-B', 'owner', 'Newer Context Owner'],
    ['context-order-S', 'status', 'active'],
    ['context-order-A', 'owner', 'Older Context Owner'],
  ].map(([id, field, value]) => ({ id, subject: 'J-2', instance: 'initial-2', field, value, expectedRevision: 10 }));
  assert(orderedRequests, expectedRequests, 'context-order-request-oracle');
  const orderedEffects = lab.snapshot().applications.filter(effect => effect.id.startsWith('context-order-'));
  assert(orderedEffects, [expectedRequests[1]], 'context-order-effect-oracle');
  await lab.dismissSettled();
  if (lab.snapshot().operations.length !== 0) throw Error('context-order-cleanup-oracle');

  // A live old command may remain represented differently by each app, but it
  // cannot project onto a replacement instance or create a server application.
  const retiringKeys = ['J-3', 'J-3'];
  lab.holdEditor('context-live-retired-editor', 'J-3');
  await lab.assign('J-3', 'owner', 'Retired Context Proposal', 'context-live-old');
  const retiringValue = { ...initial(3), owner: 'Retired Context Proposal' };
  checkKeys(retiringKeys, [retiringValue, retiringValue], 'context-live-old-pending-oracle');
  const heldRetiring = readKeys(retiringKeys), heldRetiringJSON = canonical(heldRetiring);
  const liveReplacement = { ...initial(3), instance: 'context-live-replacement', owner: 'Live Replacement Owner', ownerRevision: 40, statusRevision: 40 };
  await lab.replace('J-3', liveReplacement);
  checkKeys(retiringKeys, [liveReplacement, liveReplacement], 'context-live-instance-oracle');
  await lab.editHeld('context-live-retired-editor', 'owner', 'Wrong Live Instance', 'context-live-retired-write');
  if (lab.snapshot().requests.some(request => request.id === 'context-live-retired-write')) throw Error('context-live-retired-editor-oracle');
  const retiredDecision = await lab.process('context-live-old', 'accept');
  if (retiredDecision.commandId !== 'context-live-old' || retiredDecision.instance !== liveReplacement.instance || retiredDecision.field !== 'owner' || retiredDecision.outcome !== 'conflict' || retiredDecision.value !== liveReplacement.owner || retiredDecision.revision !== 40) throw Error('context-live-old-decision-oracle');
  checkKeys(retiringKeys, [liveReplacement, liveReplacement], 'context-live-old-settled-oracle');
  if (canonical(heldRetiring) !== heldRetiringJSON || canonical(before) !== beforeJSON) throw Error('context-live-held-snapshot-oracle');
  const liveRequests = lab.snapshot().requests.filter(request => request.id === 'context-live-old');
  assert(liveRequests, [{ id: 'context-live-old', subject: 'J-3', instance: 'initial-3', field: 'owner', value: 'Retired Context Proposal', expectedRevision: 10 }], 'context-live-old-request-oracle');
  if (lab.snapshot().applications.some(effect => effect.id === 'context-live-old')) throw Error('context-live-old-effect-oracle');
  await lab.dismissSettled();
  if (lab.snapshot().operations.length !== 0) throw Error('context-live-old-cleanup-oracle');
  const inactive = await lab.contextAfterDestroy(ids);
  if (Object.keys(inactive).length !== 2 || Object.values(inactive).some(values => values.length !== ids.length || values.some(value => value !== undefined))) throw Error('context-inactive-oracle');
  return { passed: true, strategy, destroyed: true, checks: ["complete-key-order-and-missing", "duplicate-keys", "pending-owner-and-status", "unresolved-dismissal", "requests-decisions-effects", "accept-and-reject", "held-snapshot", "replacement-instance", "retired-editor", "settled-cleanup", "same-subject-order-and-unknown", "newer-revision-suppresses-old-pending", "replacement-with-live-old-command", "bulk-and-point-independent-values", "inactive-held-store"] };
}
