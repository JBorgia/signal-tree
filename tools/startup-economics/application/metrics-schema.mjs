import assert from 'node:assert/strict';
const quantile = (values, q) => {
  if (!values.length) return null;
  assert(values.every(value => typeof value === 'number' && Number.isFinite(value)));
  return [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)];
};
export function metrics(sample) {
  const values = {};
  const add = (name, value, unit, signed = false, allowMissing = false) => {
    assert((allowMissing && value === null) || (Number.isFinite(value) && (signed || value >= 0)), `Bad ${name}`);
    values[name] = { value, unit, signed };
  };
  assert.deepEqual(Object.keys(sample.context).sort(), ['full', 'selected']);
  assert.equal(sample.context.selected.rows, 50); assert.equal(sample.context.full.rows, sample.rows);
  assert.deepEqual(sample.pressure.map(value => value.staged.count), [8, 32, 128]);
  assert.deepEqual(sample.pressure.map(value => value.settled.count), [8, 32, 128]);
  // Groups retain kind: forced-GC startup observations never enter timing groups.
  for (const name of ['seed', 'factory', 'bootstrapToLayout', 'navigationToLayout']) add(`startup.${name}`, sample.startup[name], 'ms');
  if (sample.kind === 'timing') {
    for (const [name, context] of Object.entries(sample.context)) {
      assert.equal(context.repeated.length, 20);
      add(`context.${name}.bytes`, context.bytes, 'bytes');
      for (const phase of ['materializeMs', 'serializeMs', 'totalMs']) {
        add(`context.${name}.first.${phase}`, context.first[phase], 'ms');
        add(`context.${name}.repeated.p50.${phase}`, quantile(context.repeated.map(value => value[phase]), 0.5), 'ms');
        add(`context.${name}.repeated.p95.${phase}`, quantile(context.repeated.map(value => value[phase]), 0.95), 'ms');
      }
    }
    for (const pressure of sample.pressure) for (const phase of ['staged', 'settled']) {
      const value = pressure[phase]; assert.equal(value.samples.length, value.count);
      add(`pressure.${value.count}.${phase}.elapsed`, value.elapsedMs, 'ms');
      add(`pressure.${value.count}.${phase}.p95`, quantile(value.samples, 0.95), 'ms');
    }
    const run = sample.interleaved;
    assert.equal(run.rounds, 20); assert.equal(run.checkedCommands, 180); assert.equal(run.user.length, 20);
    assert.equal(run.context.length, 20); assert.equal(run.visibility, 'visible');
    add('interleaved.complete.elapsed', run.elapsedMs, 'ms');
    add('interleaved.checkedCommandsPerSecond', run.commandsPerSecond, 'commands/second');
    assert.equal(run.commandsPerSecond, 180000 / run.elapsedMs);
    for (const name of ['enqueueToHandlerMs', 'handlerToLayoutMs', 'clickToLayoutMs', 'enqueueToLayoutMs']) {
      add(`interleaved.user.p95.${name}`, quantile(run.user.map(value => value[name]), 0.95), 'ms');
      add(`interleaved.user.maximum.${name}`, Math.max(...run.user.map(value => value[name])), 'ms');
    }
    add('interleaved.context.p95', quantile(run.context.map(value => value.elapsedMs), 0.95), 'ms');
    add('frames.baseline.medianGap', quantile(run.refreshBaselineGapsMs, 0.5), 'ms');
    add('frames.active.sampleCount', run.frameGapsMs.length, 'observations');
    add('frames.active.p95Gap', quantile(run.frameGapsMs, 0.95), 'ms', false, true);
    add('frames.active.maximumGap', run.frameGapsMs.length ? Math.max(...run.frameGapsMs) : null, 'ms', false, true);
    assert.deepEqual(Object.keys(sample.browserDurationSeconds).sort(), ['LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration']);
    for (const [name, value] of Object.entries(sample.browserDurationSeconds)) add(`browser.${name}`, value, 'seconds');
  } else {
    assert.equal(sample.kind, 'memory');
    for (const [name, context] of Object.entries(sample.context)) {
      assert.deepEqual(context.repeated, []);
      add(`context.${name}.bytes`, context.bytes, 'bytes');
      for (const phase of ['materializeMs', 'serializeMs', 'totalMs']) add(`context.${name}.first.${phase}`, context.first[phase], 'ms');
    }
    const heap = Object.fromEntries(sample.heap.map(point => [point.name, point.usedSize]));
    assert.equal(sample.heap.length, Object.keys(heap).length);
    assert.deepEqual(Object.keys(heap), ['blank', 'populated', 'after-contexts-dropped', ...[8, 32, 128].flatMap(count => [`populated-${count}`, `pending-${count}`, `settled-${count}`]), 'destroyed']);
    for (const [name, value] of Object.entries(heap)) add(`heap.${name}`, value, 'bytes');
    add('heap.populatedAboveBlank', heap.populated - heap.blank, 'bytes', true);
    add('heap.contextCacheDelta', heap['after-contexts-dropped'] - heap.populated, 'bytes', true);
    for (const count of [8, 32, 128]) {
      add(`heap.pending${count}AbovePopulated`, heap[`pending-${count}`] - heap[`populated-${count}`], 'bytes', true);
      add(`heap.settled${count}AbovePopulated`, heap[`settled-${count}`] - heap[`populated-${count}`], 'bytes', true);
    }
    add('heap.destroyedAboveBlank', heap.destroyed - heap.blank, 'bytes', true);
  }
  return values;
}
