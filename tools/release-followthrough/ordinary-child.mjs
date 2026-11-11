// The existing app workload, with v15 spelling adaptation also applied to the repaired v15 arm.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { quiesce } from '../lib/heap-quiescence.mjs';
import { loadApp, rowsFor, modelFor, actionFor, applyApp, applyModel, observe, check, destroy, selftest } from '../release-economics/ordinary.mjs';

const [root, packet, arm, mode, kind = 'jobs', size = '5'] = process.argv.slice(2);
globalThis.ngDevMode = false;
process.env.NODE_ENV = 'production';
const policy = JSON.parse(readFileSync(new URL('../release-economics/policy.json', import.meta.url)));
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
const drain = async () => { await turn(); await turn(); };
const cpuMs = start => { const c = process.cpuUsage(start); return (c.user + c.system) / 1000; };
const p95 = values => [...values].sort((a,b) => a-b)[Math.ceil(values.length*0.95)-1];
const mods = {};
for (const k of mode === 'heap' ? ['jobs', 'products'] : [kind]) mods[k] = await loadApp(root, resolve(packet, `${arm}-kernel`), k, arm.startsWith('v15'));

if (mode === 'selftest') {
  console.log(JSON.stringify({ arm, kind, rows: Number(size), ...selftest(mods[kind], kind, Number(size)) }));
} else if (mode === 'cpu') {
  const module = mods[kind];
  const rows = rowsFor(module.seeds, Number(size), kind);
  const initial = modelFor(rows, kind);
  const routes = [];
  async function route() {
    const cpu = process.cpuUsage(); const start = performance.now();
    const app = module.createApp(rows); const output = observe(app, kind);
    const wallMs = performance.now() - start; const syncCpuMs = cpuMs(cpu);
    await drain(); const totalCpuMs = cpuMs(cpu);
    check(output, initial);
    destroy(app, kind); await drain();
    return { wallMs, syncCpuMs, totalCpuMs };
  }
  const cold = await route();
  for (let i=0; i<policy.ordinaryCpu.warmupRoutes; i++) await route();
  for (let i=0; i<policy.ordinaryCpu.measuredRoutes; i++) routes.push(await route());
  const app = module.createApp(rows); const model = modelFor(rows, kind);
  check(observe(app, kind), model); await drain();
  const interactions = [];
  try {
    for (let i=0; i<policy.ordinaryCpu.warmupInteractions+policy.ordinaryCpu.measuredInteractions; i++) {
      const action = actionFor(model, i);
      const cpu = process.cpuUsage(); const start = performance.now();
      applyApp(app, kind, action); const output = observe(app, kind);
      const wallMs = performance.now()-start; const syncCpuMs = cpuMs(cpu);
      await drain(); const totalCpuMs = cpuMs(cpu);
      applyModel(model, action); check(output, model);
      if (i >= policy.ordinaryCpu.warmupInteractions) interactions.push({op:action[0], wallMs, syncCpuMs, totalCpuMs});
    }
  } finally { destroy(app, kind); await drain(); }
  console.log(JSON.stringify({ arm, mode, kind, rows: Number(size), cold, routes, interactions,
    endpoints: { coldInitWallMs:cold.wallMs, initP95WallMs:p95(routes.map(x=>x.wallMs)),
      interactionP95WallMs:p95(interactions.map(x=>x.wallMs)),
      initP95SyncCpuMs:p95(routes.map(x=>x.syncCpuMs)), interactionP95SyncCpuMs:p95(interactions.map(x=>x.syncCpuMs)),
      initP95TotalCpuMs:p95(routes.map(x=>x.totalCpuMs)), interactionP95TotalCpuMs:p95(interactions.map(x=>x.totalCpuMs)) },
    assertions: 1 + policy.ordinaryCpu.warmupRoutes + policy.ordinaryCpu.measuredRoutes + 1 + policy.ordinaryCpu.warmupInteractions + policy.ordinaryCpu.measuredInteractions }));
} else if (mode === 'heap') {
  const payloads = Object.fromEntries(Object.entries(mods).map(([k,m])=>[k,rowsFor(m.seeds,1000,k)]));
  for (const [k,m] of Object.entries(mods)) selftest(m,k,m.seeds.length);
  await drain();
  const idle = await quiesce({label:`${arm} idle`});
  function createStores() {
    const result=[];
    for (const spec of policy.ordinaryHeap.stores) for (let i=0; i<spec.count; i++) {
      const app = mods[spec.kind].createApp(payloads[spec.kind]);
      check(observe(app,spec.kind),modelFor(payloads[spec.kind],spec.kind));
      result.push({app,kind:spec.kind});
    }
    return result;
  }
  let held=createStores();
  const populated = await quiesce({label:`${arm} populated`});
  function editAll() {
    for (const {app,kind:k} of held) {
      const model = modelFor(payloads[k],k);
      for (let i=0; i<policy.ordinaryHeap.editsPerStore; i++) {
        const action=actionFor(model,i); applyApp(app,k,action); applyModel(model,action); check(observe(app,k),model);
      }
    }
  }
  editAll();
  const edited = await quiesce({label:`${arm} edited`});
  const refs = held.flatMap(({app,kind:k}) => k === 'jobs'
    ? [new WeakRef(app),new WeakRef(app.$.jobs.byIdOrFail('J-104'))]
    : [new WeakRef(app.store),new WeakRef(app.heldProduct)]);
  held.forEach(({app,kind:k})=>destroy(app,k)); held=null;
  const released=await quiesce({label:`${arm} released`});
  const collected=refs.map(ref=>ref.deref()===undefined);
  console.log(JSON.stringify({arm,mode,idle,populated,edited,released,collected,
    checks:{actualResourcesCollected:collected.every(Boolean)},
    endpoints:{populatedBytes:populated.heapUsed-idle.heapUsed,editedBytes:edited.heapUsed-idle.heapUsed},
    assertions:8*(policy.ordinaryHeap.editsPerStore+1)+1}));
  assert.ok(collected.every(Boolean),`Actual tree/held row sentinels must be collectable: ${JSON.stringify(collected)}`);
} else throw new Error(`Unknown mode ${mode}`);
