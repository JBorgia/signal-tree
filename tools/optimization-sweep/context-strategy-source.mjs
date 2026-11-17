#!/usr/bin/env node
// Source overlay only. Does not mutate a packet, build, install, or qualify it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [packetArg, expectedPlanSha, outputArg] = process.argv.slice(2);
assert(packetArg && /^[a-f0-9]{64}$/.test(expectedPlanSha ?? '') && outputArg);
const packet = resolve(packetArg), out = resolve(outputArg);
assert(!existsSync(out), 'Preserve prior overlays');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const planPath = join(packet, 'plan.json');
assert.equal(sha(planPath), expectedPlanSha, 'Wrong baseline packet');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const source = fileURLToPath(import.meta.url);
const inputs = { [planPath]: sha(planPath), [source]: sha(source) };
const replacements = [];
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, 'Expected exact unique source anchor');
  return text.replace(before, after);
}
function boundRead(path) {
  assert.equal(sha(path), plan.inputs[path], `Unbound or changed input: ${path}`);
  inputs[path] = sha(path);
  return readFileSync(path, 'utf8');
}
function emit(arm, relative, before, text) {
  const destination = join(out, arm, relative);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text, { flag: 'wx' });
  replacements.push({ arm, relative, before, beforeSha256: sha(before), source: destination, afterSha256: sha(destination) });
}

for (const arm of ['v15', 'v16']) {
  assert(plan.arms.includes(arm));
  const selected = join(packet, arm, 'src/arms/selected-dispatch.ts');
  let text = boundRead(selected);
  text = replaceOnce(text, '): Dispatch {', '): Dispatch & { contextRows(ids: readonly string[]): (DispatchJob | undefined)[]; contextRowsOrdered(ids: readonly string[]): (DispatchJob | undefined)[] } {');
  text = replaceOnce(text, "    kind: 'signaltree',\n", `    kind: 'signaltree',
    // Private application strategy. A whole context needs values, not writable
    // row facades. Storage keys, caller order and optimistic projection survive.
    contextRows(ids: readonly string[]) {
      if (!active()) return ids.map(() => undefined);
      const current = accepted.$.jobs.asMap();
      return ids.map((id) => {
        const row = current.get(id);
        return row && projectJob(row);
      });
    },
    contextRowsOrdered(ids: readonly string[]) {
      if (!active()) return ids.map(() => undefined);
      // This fixture has no sortComparer or callbacks during collection reads.
      // Use stored keys, including after replacement; never infer them from id.
      const keys = accepted.$.jobs.ids();
      const values = accepted.$.jobs.all();
      if (keys.length !== values.length) throw Error('Context order mismatch');
      const lookup = new Map<string, DispatchJob>();
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index], value = values[index];
        if (key === undefined || value === undefined) throw Error('Context key/value mismatch');
        lookup.set(key, value);
      }
      return ids.map((id) => {
        const row = lookup.get(id);
        return row && projectJob(row);
      });
    },
`);
  emit(arm, 'src/arms/selected-dispatch.ts', selected, text);
  const main = join(packet, arm, 'src/dispatch-main.ts');
  let driver = boundRead(main);
  driver = replaceOnce(driver, '    row: (id: string) => current().store().row(id),\n', `    row: (id: string) => current().store().row(id),
    contextRows: (ids: readonly string[]) => {
      const store = current().store() as Dispatch & {
        contextRows(ids: readonly string[]): (DispatchJob | undefined)[];
      };
      return store.contextRows(ids);
    },
    contextRowsOrdered: (ids: readonly string[]) => {
      const store = current().store() as Dispatch & {
        contextRowsOrdered(ids: readonly string[]): (DispatchJob | undefined)[];
      };
      return store.contextRowsOrdered(ids);
    },
    async contextAfterDestroy(ids: readonly string[]) {
      const store = current().store() as Dispatch & {
        contextRows(ids: readonly string[]): (DispatchJob | undefined)[];
        contextRowsOrdered(ids: readonly string[]): (DispatchJob | undefined)[];
      };
      await destroyApplication();
      return { point: ids.map((id) => store.row(id)), bulk: store.contextRows(ids), ordered: store.contextRowsOrdered(ids) };
    },
`);
  emit(arm, 'src/dispatch-main.ts', main, driver);
}
// This receipt certifies source derivation only. Full package/build admission
// remains the packet preparer's job; a historical provenance path is not a
// substitute for a missing current compiler, package, or served dependency.
for (const [path, expected] of Object.entries(inputs)) assert.equal(sha(path), expected);
writeFileSync(join(out, 'source-overlay.json'), JSON.stringify({
  phase: 'Unbuilt private application source overlay; no performance or conformance claim',
  baselinePlanPath: planPath, baselinePlanSha256: expectedPlanSha,
  command: [process.execPath, ...process.argv.slice(1)], inputs, replacements,
  unchanged: ['Original packet', 'Original lab.row implementation', 'Runtime packages', 'UI/command/service implementation outside the added driver method'],
  requiredAdmission: ['A separate copied packet with all current runtime/toolchain inputs verified', 'Exact installed production build and existing dispatch conformance', 'Context post-edit/instance and planted controls', 'Fresh paired calibration and comparison'],
}, null, 2) + '\n', { flag: 'wx' });
