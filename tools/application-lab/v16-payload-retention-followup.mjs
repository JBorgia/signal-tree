#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadavg } from 'node:os';
import { writeHeapSnapshot } from 'node:v8';

const [mode, inputArg, outArg, sampleText] = process.argv.slice(2);
assert(['compare', 'child', 'control'].includes(mode));
const input = resolve(inputArg), out = resolve(outArg);
const runner = fileURLToPath(import.meta.url);
const protocol = fileURLToPath(new URL('./v16-payload-retention-followup-protocol.md', import.meta.url));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const reportPath = join(input, 'bundles.json');
const artifact = read(reportPath).summaries.find(item => item.arm === 'lazy');
assert(artifact);
assert.equal(sha(artifact.bundle), artifact.bundleSha256);
assert.equal(sha(artifact.source), artifact.sourceSha256);
assert.equal(sha(artifact.planPath), artifact.planSha256);
assert.equal('sha512-' + createHash('sha512').update(readFileSync(artifact.archive)).digest('base64'), artifact.archiveIntegrity);
const bindings = Object.fromEntries([runner, protocol, reportPath, artifact.bundle,
  artifact.source, artifact.planPath, artifact.archive].map(path => [path, sha(path)]));
const verify = () => { for (const [path, hash] of Object.entries(bindings)) assert.equal(sha(path), hash); };

if (mode !== 'child') {
  mkdirSync(out, { recursive: false });
  const schedule = Array.from({length: 8}, (_, repeat) => ({recipient:false,cumulativeIds:true,repeat}));
  schedule.push({recipient:false,cumulativeIds:true,repeat:0,pinTree:true});
  save(join(out, 'schedule.json'), { command: [process.execPath, ...process.argv.slice(1)],
    createdUTC: new Date().toISOString(), cycles: 1, rows: 1000, bindings, schedule });
  const results = [];
  for (const [index, sample] of schedule.entries()) {
    const path = join(out, `child-${index}.json`);
    const command = ['--expose-gc', runner, 'child', input, path, JSON.stringify(sample)];
    const child = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 240000,
      env: { ...process.env, NODE_ENV: 'production' } });
    writeFileSync(path + '.log', child.stdout + child.stderr, { flag: 'wx' });
    const result = read(path);
    save(join(out, `invocation-${index}.json`), { command: [process.execPath, ...command],
      status: child.status, signal: child.signal, resultSha256: sha(path), logSha256: sha(path + '.log') });
    if (sample.pinTree) { assert.equal(child.status, 1); assert.equal(result.treePinSensitivityPassed, true); }
    else { assert.ok(child.status===0 || result.originalOraclePassed===false || result.originalTreeOraclePassed===false, result.error); }
    results.push(result);
    console.log(index + 1, schedule.length, JSON.stringify(sample), mode === 'control' ? 'fault detected' : 'passed');
  }
  verify();
  assert.equal(new Set(results.map(r => r.pid)).size, results.length);
  save(join(out, 'results.json'), { diagnosticCompleted: true, ordinaryOriginalOraclePasses:results.filter(r=>!r.sample.pin&&r.passed).length, mode, bindings, results });
} else {
  const sample = JSON.parse(sampleText);
  assert.equal(typeof global.gc, 'function');
  const api = await import(pathToFileURL(artifact.bundle));
  const result = { sample, pid: process.pid, node: process.version, bundleSha256: artifact.bundleSha256,
    hostLoad: loadavg(), cycles: [], originalOraclePassed:true, collectionObservations:[], passed: false };
  const flush = async () => { for (let n = 0; n < 160; n++) await Promise.resolve(); };
  const gcHeap = async () => {
    for (let n = 0; n < 3; n++) { await new Promise(done => setImmediate(done)); global.gc(); }
    return process.memoryUsage().heapUsed;
  };
  const inspectRegistries = tree => {
    const root = tree.$;
    const descriptors = root[Symbol.for('SignalTree:TreeRealizationDescriptors')];
    const claims = root[Symbol.for('SignalTree:SubjectRestorationClaims')];
    const positions = root[Symbol.for('SignalTree:PositionRegistry')];
    const maps = { descriptors: descriptors?.size ?? null, structuralEffects: 0,
      structuralEffectBySubject: 0, subjectDescriptors: 0 };
    for (const descriptor of descriptors?.values() ?? []) {
      for (const key of ['structuralEffects', 'structuralEffectBySubject', 'subjectDescriptors'])
        maps[key] += descriptor[key]?.size ?? 0;
    }
    return { ...maps, claims: claims?.snapshot() ?? null,
      positions: Object.fromEntries(['parents', 'addresses', 'collectionPaths'].map(key => [key, positions?.[key]?.size ?? null])) };
  };
  async function retainedStore() {
    const tree = api.create();
    let deliveries = 0, badPayloads = 0;
    const connection = sample.recipient ? api.attach(tree, values => {
      deliveries++; if (values.length) badPayloads++;
    }) : undefined;
    const payloadRefs = [], transactionRefs = [];
    let oracleIds = [];
    try {
      await flush();
      assert.equal(deliveries, 0);
      result.emptyHeapBytes = await gcHeap();
      const collection = tree.$.rows;
      async function cycle(number) {
        const rows = Array.from({ length: 1000 }, (_, i) => Object.fromEntries([
          ['id', `R-${i}`], ...Array.from({ length: 8 }, (_, f) => [`v${f}`, number * 100000 + i * 10 + f]) ]));
        const before = deliveries;
        let transaction = tree.transact(() => {
          if (sample.fault !== 'skip-populate') api.populate(tree, rows.map(row => ({ ...row })));
        });
        try {
          assert.deepEqual(api.read(tree), rows, 'Populated rows must match');
          assert.equal(api.pending(tree), 1);
          const ids = [...collection.__subjectIds];
          assert.equal(ids.length, rows.length);
          assert.deepEqual(ids.map(id => collection.__findKeyBySubjectId(id)), rows.map(row => row.id));
          const payload = new WeakRef(api.read(tree)[0]), tx = new WeakRef(transaction);
          if (sample.pin) globalThis.__stDiagnosticPayloadPin = api.read(tree)[0];
          await flush();
          if (sample.fault === 'early-send') deliveries++;
          assert.equal(deliveries, before, 'No outbound delivery before settlement');
          transaction.rollback(); transaction = undefined;
          await flush(); await connection?.settled();
          assert.deepEqual(api.read(tree), []); assert.equal(api.pending(tree), 0);
          assert.equal(badPayloads, 0);
          if (number === 1 && sample.recipient) assert(deliveries > before, 'Real Link delivery required');
          if (!sample.recipient) assert.equal(deliveries, 0);
          return { ids, payload, transaction: tx };
        } finally { transaction?.rollback(); }
      }
      for (let number = 1; number <= 1; number++) {
        const completed = await cycle(number);
        if (sample.cumulativeIds) oracleIds.push(...completed.ids);
        else oracleIds = completed.ids;
        payloadRefs.push(completed.payload); transactionRefs.push(completed.transaction);
        const heapBytes = await gcHeap();
        for (const id of oracleIds) assert.equal(collection.__inspectSubjectResources(id), undefined);
        assert.deepEqual(collection.__listSubjectReclamationCandidates(), []);
        const payloadsAlive = payloadRefs.filter(ref => ref.deref() !== undefined).length;
        const transactionsAlive = transactionRefs.filter(ref => ref.deref() !== undefined).length;
        const identities = () => payloadRefs.flatMap((ref,index)=>{const value=ref.deref();return value===undefined?[]:[{index,id:value.id,v0:value.v0}];});
        result.collectionObservations.push({cycle:number,phase:'original-three-gc',payloadsAlive,transactionsAlive,identities:identities()});
        if(payloadsAlive){
          result.originalOraclePassed=false;
          for(let extra=1;extra<=20;extra++){
            await new Promise(done=>setImmediate(done));global.gc();
            if([1,2,5,10,20].includes(extra))result.collectionObservations.push({cycle:number,phase:'extra-gc',extra,identities:identities()});
          }
          if(sample.pin){
            assert.equal(identities().length,1,'Pinned payload survives extra collection');
            delete globalThis.__stDiagnosticPayloadPin;
            for(let extra=1;extra<=6;extra++){await new Promise(done=>setImmediate(done));global.gc();}
            result.collectionObservations.push({cycle:number,phase:'pin-released-six-gc',identities:identities()});
            assert.equal(identities().length,0,'Released payload collects');result.pinSensitivityPassed=true;
          }else if(identities().length){
            result.heapSnapshot=writeHeapSnapshot(out+'.heapsnapshot');result.heapSnapshotSha256=sha(result.heapSnapshot);
          }
        }
        assert.equal(payloadsAlive, 0); assert.equal(transactionsAlive, 0);
        result.cycles.push({ cycle: number, heapBytes, oracleIds: oracleIds.length, payloadsAlive,
          transactionsAlive, retainedLifetimes: 0, retainedValueBackings: 0, deliveries,
          registries: inspectRegistries(tree) });
      }
      if(sample.pinTree)globalThis.__stDiagnosticTreePin=tree;
      return { tree: new WeakRef(tree), connection: connection ? new WeakRef(connection) : undefined };
    } finally { connection?.dispose(); tree.destroy(); }
  }
  try {
    result.beforeHeapBytes = await gcHeap();
    const refs = await retainedStore();
    result.afterHelperHeapBytes = await gcHeap();
    const alive=()=>({tree:refs.tree.deref()!==undefined,connection:refs.connection?.deref()!==undefined});
    const initial=alive();result.treeCollectionObservations=[{phase:'original-three-gc',...initial}];result.originalTreeOraclePassed=!initial.tree;
    if(initial.tree){
      for(let extra=1;extra<=20;extra++){await new Promise(done=>setImmediate(done));global.gc();if([1,2,5,10,20].includes(extra))result.treeCollectionObservations.push({phase:'extra-gc',extra,...alive()});}
      if(sample.pinTree){
        assert.equal(alive().tree,true,'Pinned tree survives extra collection');delete globalThis.__stDiagnosticTreePin;
        for(let extra=1;extra<=6;extra++){await new Promise(done=>setImmediate(done));global.gc();}
        result.treeCollectionObservations.push({phase:'pin-released-six-gc',...alive()});assert.equal(alive().tree,false,'Released tree collects');result.treePinSensitivityPassed=true;
      }else if(alive().tree){result.heapSnapshot=writeHeapSnapshot(out+'.heapsnapshot');result.heapSnapshotSha256=sha(result.heapSnapshot);}
    }
    assert.equal(initial.tree, false);
    assert.equal(refs.connection?.deref(), undefined);
    verify(); result.passed = true;
  } catch (error) { result.error = String(error?.stack ?? error); process.exitCode = 1; }
  save(out, result);
}
