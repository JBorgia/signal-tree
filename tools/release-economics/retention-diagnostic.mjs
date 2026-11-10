import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeHeapSnapshot } from 'node:v8';
import { spawnSync } from 'node:child_process';
import { quiesce } from '../lib/heap-quiescence.mjs';
import { loadApp } from './ordinary.mjs';

const cases = ['plain', 'derived-one', 'derived-chain', 'derived-namespace', 'entity-active', 'entity-active-derived', 'app-all', 'app-omit-hidden', 'app-unread'];

function weak(value, label) {
  const ref = new WeakRef(value);
  // Mark the WeakRef, not the subject. Snapshot target discovery follows its
  // weak target edge without dereferencing and strengthening the subject.
  Object.defineProperty(ref, '__ST_DIAGNOSTIC_REF__', { value: label });
  return { ref, label };
}

function createAndDestroy(kernel, scenario, appModule) {
  const { signalTree, entityMap } = kernel;
  let tree;
  const nodes = [];
  if (scenario.startsWith('app-')) {
    tree = appModule.createApp(); // Actual five source records, no edits.
    if (scenario !== 'app-unread') {
      assert.equal(tree.$.visibleJobs().length, 3);
      assert.equal(tree.$.activeJobCount(), 2);
      assert.equal(tree.$.filtersAreDefault(), true);
      assert.equal(tree.$.jobs.activeEntity().id, 'J-104');
      if (scenario === 'app-all') assert.equal(tree.$.selectionHiddenByFilters(), false);
    }
    nodes.push(['visibleJobs', tree.$.visibleJobs], ['hidden', tree.$.selectionHiddenByFilters], ['row', tree.$.jobs.byIdOrFail('J-104')]);
  } else if (scenario.startsWith('entity-')) {
    tree = signalTree({ rows: entityMap() }, scenario === 'entity-active-derived' ? {
      derived: $ => ({ selectedStatus: () => $.rows.activeEntity()?.status }),
    } : undefined);
    tree.$.rows.setAll([{ id: 'a', status: 'queued' }]);
    tree.$.rows.setActiveId('a');
    assert.equal(tree.$.rows.activeEntity().status, 'queued');
    if (scenario === 'entity-active-derived') {
      assert.equal(tree.$.selectedStatus(), 'queued');
      nodes.push(['selectedStatus', tree.$.selectedStatus]);
    }
    nodes.push(['row', tree.$.rows.byIdOrFail('a')]);
  } else {
    const config = scenario === 'derived-one' ? { derived: $ => ({ first: () => $.x() * 2 }) }
      : scenario === 'derived-chain' ? { derived: $ => ({ first: () => $.x() * 2, second: () => $.first() + 1 }) }
      : scenario === 'derived-namespace' ? { derived: $ => ({ stats: { first: () => $.x() * 2 } }) } : undefined;
    tree = signalTree({ x: 1 }, config);
    assert.equal(tree.$.x(), 1);
    if (scenario === 'derived-one') { assert.equal(tree.$.first(), 2); nodes.push(['first', tree.$.first]); }
    if (scenario === 'derived-chain') { assert.equal(tree.$.second(), 3); nodes.push(['first', tree.$.first], ['second', tree.$.second]); }
    if (scenario === 'derived-namespace') { assert.equal(tree.$.stats.first(), 2); nodes.push(['first', tree.$.stats.first]); }
  }
  const refs = [weak(tree, 'tree'), ...nodes.map(([label, value]) => weak(value, label))];
  tree.destroy();
  return refs;
}

// V8 snapshots expose weak edges explicitly, but WeakMap key/value pair edges
// are labelled internal despite being conditional on their key's reachability.
// This graph walk excludes both weak and conditional key/value pair edges. It
// reports edge types/names so the remaining path is auditable. This is a shortest
// unconditional path in this snapshot graph, not a retained-size
// estimate or a proof about every store lifetime.
function pathsFromSnapshot(file) {
  const snap = JSON.parse(readFileSync(file, 'utf8'));
  const { nodes, edges, strings } = snap;
  const nf = snap.snapshot.meta.node_fields;
  const ef = snap.snapshot.meta.edge_fields;
  const ns = nf.length, es = ef.length;
  const nt = snap.snapshot.meta.node_types[nf.indexOf('type')];
  const et = snap.snapshot.meta.edge_types[ef.indexOf('type')];
  const ntype = nf.indexOf('type'), nname = nf.indexOf('name'), nid = nf.indexOf('id'), ncount = nf.indexOf('edge_count');
  const etype = ef.indexOf('type'), ename = ef.indexOf('name_or_index'), eto = ef.indexOf('to_node');
  const size = nodes.length / ns;
  const starts = new Int32Array(size + 1);
  let cursor = 0;
  for (let i = 0; i < size; i++) { starts[i] = cursor; cursor += nodes[i * ns + ncount] * es; }
  starts[size] = cursor;
  const describe = i => ({ index: i, id: nodes[i * ns + nid], type: nt[nodes[i * ns + ntype]], name: strings[nodes[i * ns + nname]] });
  const edgeName = e => {
    const type = et[edges[e + etype]];
    return type === 'element' || type === 'hidden' ? String(edges[e + ename]) : strings[edges[e + ename]];
  };
  const marked = [];
  for (let i = 0; i < size; i++) for (let e = starts[i]; e < starts[i + 1]; e += es) {
    if (et[edges[e + etype]] === 'property' && edgeName(e) === '__ST_DIAGNOSTIC_REF__') {
      const label = strings[nodes[edges[e + eto] + nname]];
      const targets = [];
      for (let w = starts[i]; w < starts[i + 1]; w += es) if (et[edges[w + etype]] === 'weak') targets.push(edges[w + eto] / ns);
      marked.push({ label, weakRef: describe(i), targets });
    }
  }
  const parent = new Int32Array(size).fill(-1);
  const parentEdge = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  queue[0] = 0; parent[0] = 0;
  let head = 0, tail = 1;
  while (head < tail) {
    const node = queue[head++];
    for (let e = starts[node]; e < starts[node + 1]; e += es) {
      if (et[edges[e + etype]] === 'weak' || edgeName(e).includes('part of key')) continue;
      const target = edges[e + eto] / ns;
      if (parent[target] !== -1) continue;
      parent[target] = node; parentEdge[target] = e; queue[tail++] = target;
    }
  }
  return marked.map(({ label, weakRef, targets }) => ({ label, weakRef, targets: targets.map(target => {
    const path = [];
    if (parent[target] !== -1) {
      for (let current = target; current !== 0; current = parent[current]) {
        const e = parentEdge[current];
        path.push({ from: describe(parent[current]), edge: { type: et[edges[e + etype]], name: edgeName(e) }, to: describe(current) });
      }
      path.reverse();
    }
    return { subject: describe(target), reachedByUnconditionalStrongEdges: parent[target] !== -1, path };
  }) }));
}

const [mode, root, packet, arm, scenario, snapshotFlag] = process.argv.slice(2);
if (mode === 'case') {
  globalThis.ngDevMode = false;
  process.env.NODE_ENV = 'production';
  assert.ok(cases.includes(scenario));
  const kernelDirectory = resolve(packet, `${arm}-kernel`);
  const kernel = await import(pathToFileURL(resolve(kernelDirectory, 'dist/index.js')).href);
  const module = scenario.startsWith('app-') ? await loadApp(root, kernelDirectory, 'jobs', arm === 'v15') : undefined;
  await quiesce({ label: 'before-create' });
  const refs = createAndDestroy(kernel, scenario, module);
  const after = await quiesce({ label: 'after-destroy' });
  let snapshot, paths;
  if (snapshotFlag === 'snapshot') {
    snapshot = resolve(packet, 'retention-diagnostic', `${arm}-${scenario}.heapsnapshot`);
    writeHeapSnapshot(snapshot); // Must precede ANY ref.deref().
    paths = pathsFromSnapshot(snapshot);
  }
  const collected = refs.map(({ ref, label }) => ({ label, collected: ref.deref() === undefined }));
  console.log(JSON.stringify({ arm, scenario, noEdits: true, helperScope: true, after, collected, snapshot, paths }, null, 2));
} else if (mode === 'paths') {
  console.log(JSON.stringify(pathsFromSnapshot(root), null, 2));
} else if (mode === 'suite') {
  const out = resolve(packet, 'retention-diagnostic');
  mkdirSync(out, { recursive: true });
  const results = [];
  for (const candidateArm of ['v15', 'packed']) for (const candidateCase of cases) {
    const stem = `${candidateArm}-${candidateCase}`;
    const args = ['--expose-gc', '--max-old-space-size=1536', process.argv[1], 'case', root, packet, candidateArm, candidateCase];
    if (['derived-chain', 'app-all'].includes(candidateCase)) args.push('snapshot');
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'production' } });
    writeFileSync(resolve(out, `${stem}.json`), child.stdout ?? '');
    writeFileSync(resolve(out, `${stem}.err`), child.stderr ?? '');
    assert.equal(child.status, 0, `${stem}: ${child.error ?? child.stderr}`);
    const result = JSON.parse(child.stdout);
    results.push({ arm: candidateArm, scenario: candidateCase, collected: result.collected, snapshot: result.snapshot });
  }
  writeFileSync(resolve(out, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} else throw Error('Usage: retention-diagnostic.mjs suite ROOT PACKET | case ROOT PACKET ARM CASE [snapshot]');
