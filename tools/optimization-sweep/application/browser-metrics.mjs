// Functions are serialized into a page containing an installed production app.
// They use its existing public test driver, not a library-specific shortcut.
export async function contextProbe({ rows, repetitions = 20, fault }) {
  const lab = window.lab;
  const phases = {};
  const expectedRow = i => ({ id: `J-${i}`, instance: `initial-${i}`, title: `Inspect ${i % 3 === 0 ? 'pump' : 'valve'} ${i}`, owner: `Operator ${i % 10}`, status: 'queued', active: i % 2 === 0, ownerRevision: 10, statusRevision: 10 });
  const canonical = row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
  for (const size of [50, rows]) {
    const samples = [];
    let expected;
    for (let repeat = 0; repeat <= repetitions; repeat++) {
      const start = performance.now();
      const values = size === rows
        ? lab.contextRows(Array.from({ length: size }, (_, i) => `J-${i}`))
        : Array.from({ length: size }, (_, i) => lab.row(`J-${i}`));
      const materialized = performance.now();
      if (fault === 'context-truncated') values.pop();
      if (fault === 'context-corrupt') values[0] = { ...values[0], owner: 'wrong' };
      const json = JSON.stringify(values);
      const serialized = performance.now();
      if (values.length !== size || values.some((v, i) => !v || canonical(v) !== canonical(expectedRow(i)))) throw new Error('context-content-oracle');
      if (expected !== undefined && json !== expected) throw new Error('context-stability-oracle');
      expected = json;
      samples.push({ materializeMs: materialized - start, serializeMs: serialized - materialized, totalMs: serialized - start });
    }
    phases[size === 50 ? 'selected' : 'full'] = { rows: size, bytes: new TextEncoder().encode(expected).byteLength, json: expected, canonicalJson: JSON.stringify(JSON.parse(expected).map(row => JSON.parse(canonical(row)))), first: samples[0], repeated: samples.slice(1) };
  }
  return phases;
}

export async function pressureStage({ count, prefix, fault }) {
  const lab = window.lab, samples = [], before = [];
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    before.push(lab.row(`J-${i}`).ownerRevision);
    const itemStart = performance.now();
    await lab.assign(`J-${i}`, 'owner', `${prefix}-owner-${i}`, `${prefix}-${i}`);
    samples.push(performance.now() - itemStart);
  }
  const elapsedMs = performance.now() - start;
  const state = lab.snapshot();
  const operations = fault === 'drop-pending-record' ? state.operations.slice(1) : state.operations;
  if (operations.length !== count || operations.some(op => op.outcome !== 'pending')) throw new Error('pending-cardinality-oracle');
  for (let i = 0; i < count; i++) {
    const value = fault === 'stale-optimistic' && i === 0 ? 'stale' : lab.row(`J-${i}`).owner;
    if (value !== `${prefix}-owner-${i}`) throw new Error('optimistic-value-oracle');
    if (!operations.some(op => op.id === `${prefix}-${i}`)) throw new Error('pending-identity-oracle');
    const request = state.requests.find(request => request.id === `${prefix}-${i}`);
    if (!request || request.subject !== `J-${i}` || request.instance !== `initial-${i}` || request.field !== 'owner' || request.value !== `${prefix}-owner-${i}` || request.expectedRevision !== before[i]) throw new Error('request-content-oracle');
  }
  if (state.requests.length !== count) throw new Error('request-cardinality-oracle');
  if (state.applications.length !== 0) throw new Error('premature-application-oracle');
  await lab.dismissSettled();
  const remaining = fault === 'premature-dismissal' ? [] : lab.snapshot().operations;
  if (remaining.length !== count || remaining.some(op => op.outcome !== 'pending') || operations.some(op => !remaining.find(retained => retained.id === op.id))) throw new Error('unresolved-dismissal-oracle');
  for (let i = 0; i < count; i++) {
    const row = lab.row(`J-${i}`), value = fault === 'dismissal-loses-projection' && i === 0 ? 'stale' : row.owner;
    if (value !== `${prefix}-owner-${i}` || row.ownerRevision !== before[i]) throw new Error('unresolved-projection-oracle');
  }
  return { count, elapsedMs, samples, before, pending: operations.length };
}

export async function pressureSettle({ count, prefix, before, fault }) {
  const lab = window.lab, samples = [];
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const itemStart = performance.now();
    const decision = await lab.process(`${prefix}-${i}`);
    if (decision.commandId !== `${prefix}-${i}` || decision.instance !== `initial-${i}` || decision.field !== 'owner' || decision.outcome !== 'applied' || decision.value !== `${prefix}-owner-${i}` || decision.revision !== before[i] + 1) throw new Error('server-decision-oracle');
    samples.push(performance.now() - itemStart);
  }
  const elapsedMs = performance.now() - start;
  const state = lab.snapshot();
  const effects = [...state.applications];
  if (fault === 'duplicate-effect') effects.push(effects[0]);
  if (effects.length !== count || new Set(effects.map(effect => effect.id)).size !== count) throw new Error('effect-cardinality-oracle');
  if (state.operations.length !== count || state.operations.some(op => op.outcome !== 'applied')) throw new Error('settled-outcome-oracle');
  for (let i = 0; i < count; i++) {
    const row = lab.row(`J-${i}`);
    if (row.owner !== `${prefix}-owner-${i}` || row.ownerRevision !== before[i] + 1) throw new Error('accepted-value-oracle');
    const effect = effects.find(effect => effect.id === `${prefix}-${i}`);
    if (!effect || effect.subject !== `J-${i}` || effect.instance !== `initial-${i}` || effect.field !== 'owner' || effect.value !== row.owner || effect.expectedRevision !== before[i]) throw new Error('effect-content-oracle');
  }
  await lab.dismissSettled();
  if (lab.snapshot().operations.length !== 0) throw new Error('settled-cleanup-oracle');
  return { count, elapsedMs, samples, applied: effects.length };
}

export async function interleavedProbe({ rounds = 20, fault }) {
  const lab = window.lab, frames = [], user = [], context = [], effects = [];
  const expected = new Map(Array.from({ length: 161 }, (_, i) => [`J-${i}`, { id: `J-${i}`, instance: `initial-${i}`, title: `Inspect ${i % 3 === 0 ? 'pump' : 'valve'} ${i}`, owner: `Operator ${i % 10}`, status: 'queued', active: i % 2 === 0, ownerRevision: 10, statusRevision: 10 }]));
  const canonical = row => JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))));
  let observing = true, frame;
  const observe = time => {
    frames.push(time);
    if (observing) frame = requestAnimationFrame(observe);
  };
  frame = requestAnimationFrame(observe);
  for (let i = 0; i < 12; i++) await new Promise(resolve => requestAnimationFrame(resolve));
  const refreshBaselineGapsMs = frames.slice(1).map((time, i) => time - frames[i]);
  const started = performance.now();
  try {
    for (let round = 0; round < rounds; round++) {
      const commands = [];
      const agent = new Promise((resolve, reject) => setTimeout(async () => {
        try {
          const contextStart = performance.now();
          const packet = Array.from({ length: 50 }, (_, i) => lab.row(`J-${i}`));
          const bytes = new TextEncoder().encode(JSON.stringify(packet)).byteLength;
          context.push({ elapsedMs: performance.now() - contextStart, bytes });
          if (packet.some((row, i) => canonical(row) !== canonical(expected.get(`J-${i}`)))) throw new Error('interleaved-context-oracle');
          if (fault === 'busy-main-thread' && round === 0) {
            const until = performance.now() + 80;
            while (performance.now() < until) { /* telemetry sensitivity control */ }
          }
          for (let i = 0; i < 8; i++) {
            const subject = `J-${round * 8 + i + 1}`, id = `agent-${round}-${i}`, value = `agent-owner-${round}-${i}`;
            commands.push({ id, subject, value, revision: lab.row(subject).ownerRevision });
            await lab.assign(subject, 'owner', value, id);
          }
          resolve();
        } catch (error) { reject(error); }
      }, 0));
      const enqueued = performance.now();
      const human = new Promise((resolve, reject) => setTimeout(async () => {
        const handled = performance.now();
        try {
          const id = `human-${round}`, value = `human-owner-${round}`;
          commands.push({ id, subject: 'J-0', value, revision: lab.row('J-0').ownerRevision });
          for (const [name, input] of [['command-id', id], ['owner-input', value]]) {
            const element = document.querySelector(`[data-testid="${name}"]`);
            if (!element) throw new Error('Missing human input');
            element.value = input;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const clickToLayoutMs = await lab.measure({ kind: 'click', id: 'assign-owner' });
          const layout = performance.now();
          if (lab.row('J-0').owner !== value || !document.querySelector('[data-job="J-0"] [data-field="owner"]')?.textContent.includes(value)) throw new Error('human-render-oracle');
          user.push({ enqueueToHandlerMs: handled - enqueued, clickToLayoutMs, handlerToLayoutMs: layout - handled, enqueueToLayoutMs: layout - enqueued });
          resolve();
        } catch (error) { reject(error); }
      }, 0));
      await Promise.all([agent, human]);
      if (commands.length !== 9 || lab.snapshot().operations.length !== 9) throw new Error('interleaved-pending-oracle');
      for (const command of commands) {
        if (lab.row(command.subject).owner !== command.value) throw new Error('interleaved-value-oracle');
        const decision = await lab.process(command.id);
        const instance = expected.get(command.subject).instance;
        if (decision.commandId !== command.id || decision.instance !== instance || decision.field !== 'owner' || decision.outcome !== 'applied' || decision.value !== command.value || decision.revision !== command.revision + 1) throw new Error('interleaved-server-decision-oracle');
      }
      for (const command of commands) {
        const row = lab.row(command.subject);
        if (row.owner !== command.value || row.ownerRevision !== command.revision + 1) throw new Error('interleaved-accepted-oracle');
        expected.set(command.subject, { ...expected.get(command.subject), owner: command.value, ownerRevision: command.revision + 1 });
      }
      effects.push(...commands);
      const state = lab.snapshot();
      if (state.operations.some(op => op.outcome !== 'applied') || state.applications.length !== effects.length) throw new Error('interleaved-outcome-oracle');
      for (const actual of [state.requests, state.applications]) {
        if (actual.length !== effects.length || new Set(actual.map(item => item.id)).size !== effects.length) throw new Error('interleaved-service-cardinality-oracle');
        for (const effect of effects) {
          const item = actual.find(item => item.id === effect.id);
          if (!item || item.subject !== effect.subject || item.instance !== expected.get(effect.subject).instance || item.field !== 'owner' || item.value !== effect.value || item.expectedRevision !== effect.revision) throw new Error('interleaved-service-content-oracle');
        }
      }
      await lab.dismissSettled();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const ended = performance.now(), elapsedMs = ended - started;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (new Set(effects.map(effect => effect.id)).size !== rounds * 9 || user.length !== rounds) throw new Error('interleaved-throughput-oracle');
    if (lab.snapshot().operations.length !== 0) throw new Error('interleaved-cleanup-oracle');
    const activeFrames = frames.filter(time => time >= started && time <= ended);
    return { rounds, checkedCommands: effects.length, elapsedMs, commandsPerSecond: effects.length * 1000 / elapsedMs, user, context, refreshBaselineGapsMs, frameGapsMs: activeFrames.slice(1).map((time, i) => time - activeFrames[i]), visibility: document.visibilityState, availablePerformanceEntries: PerformanceObserver.supportedEntryTypes };
  } finally { observing = false; cancelAnimationFrame(frame); }
}
