import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Diagnostic only: --trace-gc-nvp changes execution. No CPU/elapsed result from
// this run is a comparison sample. The markers delimit observed V8 GC fields.
const [planPath, arm, mode = 'normal'] = process.argv.slice(2);
assert.ok(mode === 'normal' || mode === 'planted-array');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const planBytes = readFileSync(planPath), plan = JSON.parse(planBytes);
const binding = plan.arms[arm];
assert.ok(binding);
assert.equal(process.version, plan.node);
assert.equal(sha(readFileSync(process.execPath)), plan.executableSha256);
assert.equal(typeof global.gc, 'function');
function verify() {
  assert.equal(sha(readFileSync(binding.admission.receiptPath)), binding.admission.receiptSha256);
  for (const file of binding.files) assert.equal(sha(readFileSync(join(binding.root, file.path))), file.sha256);
}
verify();
globalThis.ngDevMode = false;
const load = file => import(pathToFileURL(join(binding.root, file)).href);
const { signalTree, entityMap, transactions } = await load('dist/index.js');
const { getEntityPublicationBinding } = await load('dist/lib/internals/entity-publication.js');
const { getPathNotifier } = await load('dist/lib/path-notifier.js');
const { captureNativeInput } = await load('dist/lib/experimental-publication/lifecycle.js');
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 160; i++) await Promise.resolve(); };
const tree = signalTree({ rows: entityMap() }, { enhancers: [transactions()] });
try {
  const rows = tree.$.rows, source = getEntityPublicationBinding(rows).source;
  rows.setAll(Array.from({ length: 1000 }, (_, i) => ({ id: `live${i}`, f0: i, f1: 1, f2: 2, f3: 3, f4: 4, f5: 5, f6: 6, f7: 7 })));
  for (let i = 0; i < 20; i++) rows.updateOne(`live${i}`, { f0: i + 10000 });
  await flush();
  assert.equal(rows.all().length, 1000);
  for (let i = 0; i < 20; i++) assert.equal(rows.byIdOrFail(`live${i}`).f0(), i + 10000);
  assert.equal(rows.byIdOrFail('live20').f0(), 20);
  assert.equal(source.inspect().packedSubjects, 0);
  const expected = [...new Set(source.captureViews().map(view => view.requirement))].map(captureNativeInput);
  assert.equal(expected.length, 21);
  const captures = new Array(20);
  for (let i = 0; i < 4; i++) { await new Promise(setImmediate); global.gc(); }
  process.stdout.write('ST_CAPTURE_BEGIN\n');
  for (let i = 0; i < captures.length; i++) captures[i] = source.captureInput();
  const planted = mode === 'planted-array' ? new Array(500000).fill(17) : undefined;
  process.stdout.write('ST_CAPTURE_END\n');
  global.gc();
  process.stdout.write('ST_CAPTURE_AFTER_GC\n');
  const arrays = new Set(), inputs = new Set();
  for (const result of captures) {
    assert.equal(result.native.length, expected.length);
    assert.ok(Object.isFrozen(result.native)); assert.ok(!arrays.has(result.native)); arrays.add(result.native);
    result.native.forEach((input, index) => {
      assert.equal(input.requirement, expected[index].requirement);
      assert.ok(Object.isFrozen(input)); assert.ok(!inputs.has(input)); inputs.add(input);
      assert.ok(Object.isFrozen(input.owners)); assert.equal(input.owners.length, expected[index].owners.length);
      input.owners.forEach((owner, i) => assert.equal(owner, expected[index].owners[i]));
    });
  }
  if (planted) { assert.equal(planted.length, 500000); assert.equal(planted[0], 17); assert.equal(planted[499999], 17); }
  verify();
  process.stdout.write('ST_DIAGNOSTIC_RESULT ' + JSON.stringify({ arm, mode, pid: process.pid, planSha256: sha(planBytes), packageIdentity: binding.identity,
    captures: 20, requirementsPerCapture: expected.length, meaningfulEndpoints: 21, freshFrozenInputs: true,
    plantedArrayElements: planted?.length ?? 0, limits: 'Trace-instrumented diagnostic; do not quote its CPU/elapsed as a comparison. Allocated NVP fields include fixed marker/harness overhead and do not cover all external memory.' }) + '\n');
} finally { tree.destroy(); await flush(); }
