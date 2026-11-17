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
  const inactive = await lab.contextAfterDestroy(ids);
  if (Object.keys(inactive).length !== 3 || Object.values(inactive).some(values => values.length !== ids.length || values.some(value => value !== undefined))) throw Error('context-inactive-oracle');
  return { passed: true, strategy, destroyed: true, checks: ['complete-key-order-and-missing', 'duplicate-keys', 'pending-owner-and-status', 'unresolved-dismissal', 'requests-decisions-effects', 'accept-and-reject', 'held-snapshot', 'replacement-instance', 'retired-editor', 'settled-cleanup', 'inactive-held-store'] };
}
