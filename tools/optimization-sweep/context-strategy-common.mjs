import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyExecution } from './context-strategy-execution.mjs';

export const here = dirname(fileURLToPath(import.meta.url));
export const lines = ['v15', 'v16'];
export const strategies = ['point', 'bulk', 'ordered'];
export const faults = {
  'context-truncated': 'context-content-oracle',
  'context-corrupt': 'context-content-oracle',
  'context-stale-cache': 'context-pending-oracle',
  'context-bypass-projection': 'context-pending-oracle',
  'context-stale-instance': 'context-instance-oracle',
};
export const dispatchFaults = ['drop-write', 'stale-preview', 'premature-publication', 'clobber-other-field', 'blanket-block', 'stale-editor', 'drop-reentry', 'skip-destroy', 'false-rejection', 'stale-success'];
export const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export const hashText = text => createHash('sha256').update(text).digest('hex');
export const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export function verify(bindings) {
  for (const [path, expected] of Object.entries(bindings)) assert.equal(sha(path), expected, `Input drift: ${path}`);
}
export function inventory(root) {
  const output = {};
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), `Unexpected package/source alias: ${entry.name}`);
      const relative = prefix + entry.name, path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path, relative + '/');
      else { assert(entry.isFile()); output[relative] = sha(path); }
    }
  };
  walk(root); return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}
export function sourceBindings() {
  return Object.fromEntries(readdirSync(here).filter(name => name.startsWith('context-strategy') && /\.(mjs|md|json)$/.test(name)).sort().map(name => [join(here, name), sha(join(here, name))]));
}
export function scheduleFor(mode) {
  assert(['controls', 'calibrate', 'compare'].includes(mode));
  const schedule = [];
  if (mode === 'controls') {
    for (const arm of lines) for (const strategy of strategies)
      for (const fault of [null, ...Object.keys(faults)]) schedule.push({ arm, strategy, rows: 1000, round: 0, kind: 'control', fault });
  } else for (const rows of mode === 'calibrate' ? [1000] : [1000, 10000]) {
    for (let round = 0; round < (mode === 'calibrate' ? 1 : 5); round++) {
      const orderedLines = round % 2 ? [...lines].reverse() : lines;
      for (const arm of orderedLines) {
        const order = strategies.map((_, index) => strategies[(index + round + lines.indexOf(arm)) % strategies.length]);
        for (const strategy of order) for (const kind of ['timing', 'memory']) schedule.push({ arm, strategy, rows, round, kind });
      }
      if (mode === 'compare' && round < 2) for (const arm of orderedLines)
        for (const member of [0, 1]) for (const kind of ['timing', 'memory'])
          schedule.push({ arm, strategy: 'point', rows, round, kind, aa: true, member });
    }
  }
  return schedule;
}
export function admitPacket(packet) {
  const planPath = join(packet, 'plan.json'), buildPath = join(packet, 'dispatch-build.json');
  const conformancePath = join(packet, 'dispatch-conformance/results.json');
  const plan = read(planPath), build = read(buildPath), conformance = read(conformancePath);
  assert.deepEqual(plan.arms, lines); assert.equal(plan.contextStrategy.schema, 1);
  assert.deepEqual(Object.keys(build.arms).sort(), lines);
  assert.equal(build.planSha256, sha(planPath));
  assert.equal(conformance.planSha256, sha(planPath)); assert.equal(conformance.buildSha256, sha(buildPath));
  assert.equal(conformance.runnerSha256, sha(plan.contextStrategy.checker));
  assert.deepEqual(Object.keys(conformance.controls).sort(), [...dispatchFaults].sort());
  assert.equal(conformance.results.length, lines.length * (dispatchFaults.length + 1));
  for (const arm of lines) {
    const results = conformance.results.filter(value => value.arm === arm);
    assert.deepEqual(results.map(value => value.fault ?? 'baseline').sort(), ['baseline', ...dispatchFaults].sort());
    assert(results.every(value => value.passed), 'Application conformance failed');
  }
  const bindings = { ...plan.inputs, ...sourceBindings(), [planPath]: sha(planPath), [buildPath]: sha(buildPath), [conformancePath]: sha(conformancePath) };
  assert.deepEqual(sourceBindings(), plan.contextStrategy.toolSources, 'Method changed after packet freeze');
  for (const arm of lines) {
    Object.assign(bindings, build.arms[arm].served);
    for (const [path, expected] of Object.entries(build.arms[arm].dependencies)) {
      assert.equal(plan.inputs[path], expected, `Unregistered compiled dependency: ${path}`); bindings[path] = expected;
    }
    for (const [name, expected] of Object.entries(plan.contextStrategy.packages[arm])) assert.deepEqual(inventory(join(packet, arm, 'node_modules/@signal-tree', name)), expected);
  }
  verify(bindings);
  assert.equal(plan.toolchainDirectory, plan.contextStrategy.execution.toolchainDirectory);
  verifyExecution(plan.contextStrategy.execution);
  return { plan, build, bindings, identity: { planSha256: sha(planPath), buildSha256: sha(buildPath), conformanceSha256: sha(conformancePath), toolSources: sourceBindings(), execution: plan.contextStrategy.execution } };
}
export function admitRun(path, mode, identity, validateMetrics) {
  const result = read(path), schedulePath = join(dirname(path), 'schedule.json'), schedule = read(schedulePath);
  const expected = scheduleFor(mode);
  if (mode !== 'controls') assert.equal(typeof validateMetrics, 'function', 'Metric admission requires the complete metric validator');
  assert.equal(schedule.mode, mode);
  assert.equal(result.mode, mode); assert.equal(result.passed, true);
  assert.equal(result.planned, expected.length); assert.equal(result.completed, expected.length); assert.equal(result.children.length, expected.length);
  assert.equal(result.scheduleSha256, sha(schedulePath)); assert.deepEqual(schedule.schedule, expected);
  assert.deepEqual(result.identity, identity); assert.deepEqual(schedule.identity, identity);
  verify(schedule.bindings);
  const bindings = { [path]: sha(path), [schedulePath]: sha(schedulePath) }, children = [];
  for (let index = 0; index < expected.length; index++) {
    const entry = result.children[index]; assert.equal(entry.index, index); assert.equal(entry.passed, true);
    assert.equal(entry.path, `child-${index}.json`);
    const childPath = join(dirname(path), entry.path); assert.equal(sha(childPath), entry.sha256); bindings[childPath] = entry.sha256;
    const child = read(childPath); assert.equal(child.index, index); assert.equal(child.passed, true);
    assert.deepEqual(child.sample, expected[index]); assert.deepEqual(child.errors, []);
    assert.equal(child.browser, identity.execution.browser.version, 'Child browser version drift');
    if (mode === 'controls' && child.sample.fault) {
      assert.equal(child.expectedControlObserved, true);
      assert.equal(child.detectedOracle, faults[child.sample.fault]);
    } else if (mode === 'controls') {
      assert.equal(child.conformance.passed, true); assert.equal(child.conformance.destroyed, true);
    } else validateMetrics(child);
    children.push(child);
  }
  return { result, schedule, children, bindings };
}
export function assertNewOutput(path) { assert(!existsSync(path), `Preserve previous attempt: ${path}`); }
