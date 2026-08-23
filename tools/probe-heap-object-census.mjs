#!/usr/bin/env node
/**
 * HEAP OBJECT CENSUS — when a reachability walk finds nothing, ask V8.
 *
 * The staged retention probe shows a `timeTravel({maxHistorySize: 2})` tree
 * growing 47 MB over 64,000 retirements while the entity layer retains only 400
 * subjects and a no-history tree is flat. An in-process census of every
 * reachable Map/Set/Array — collection, structural store, manager, notifier —
 * finds nothing that grows.
 *
 * So the retainer is not something a property walk reaches. This takes two heap
 * snapshots at different round counts and diffs the object counts by
 * constructor, which names the leaking type without needing to guess where it
 * hangs.
 *
 * Usage:
 *   node --expose-gc tools/probe-heap-object-census.mjs [--width 200] [--history 2]
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { writeHeapSnapshot } from 'node:v8';
import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/probe-heap-object-census.mjs');

const CORE = join(process.cwd(), 'dist/packages/core/dist/index.js');
if (!existsSync(CORE)) {
  console.error('❌ build first: npx nx build core');
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
};

const WIDTH = Number(arg('--width', 200));
const HISTORY = Number(arg('--history', 2));
const LOW = Number(arg('--low', 40));
const HIGH = Number(arg('--high', 320));

const { signalTree, entityMap, timeTravel } = await import(CORE);

const tree = signalTree(
  { rows: entityMap({ selectId: (r) => r.id }) },
  { enhancers: [timeTravel({ maxHistorySize: HISTORY })] }
);
const rows = tree.$.rows;
const generation = (g) => {
  const out = [];
  for (let i = 0; i < WIDTH; i++) {
    out.push({ id: `g${g}-${i}`, name: 'n' + i, v: i });
  }
  return out;
};

/**
 * Histogram of (parent type:name, edge name) for every node of a target type.
 *
 * A type census names WHAT leaked; this names WHO HOLDS IT, which is the part a
 * property walk could not find. Diffing the histogram between two round counts
 * points at one container field.
 */
function retainerHistogram(path, targetTypes) {
  const snap = JSON.parse(readFileSync(path, 'utf8'));
  const { node_fields, node_types, edge_fields, edge_types } = snap.snapshot.meta;
  const nStride = node_fields.length;
  const eStride = edge_fields.length;
  const nTypeIdx = node_fields.indexOf('type');
  const nNameIdx = node_fields.indexOf('name');
  const nEdgeCountIdx = node_fields.indexOf('edge_count');
  const eTypeIdx = edge_fields.indexOf('type');
  const eNameIdx = edge_fields.indexOf('name_or_index');
  const eToIdx = edge_fields.indexOf('to_node');
  const nodeTypeNames = node_types[nTypeIdx];
  const edgeTypeNames = edge_types[eTypeIdx];

  const label = (nodeIndex) =>
    `${nodeTypeNames[snap.nodes[nodeIndex + nTypeIdx]]}:${
      snap.strings[snap.nodes[nodeIndex + nNameIdx]]
    }`;

  const hist = new Map();
  let edgeCursor = 0;
  for (let i = 0; i < snap.nodes.length; i += nStride) {
    const edgeCount = snap.nodes[i + nEdgeCountIdx];
    const parentLabel = label(i);
    for (let e = 0; e < edgeCount; e++) {
      const base = (edgeCursor + e) * eStride;
      const to = snap.edges[base + eToIdx];
      if (!targetTypes.has(label(to))) continue;
      const edgeType = edgeTypeNames[snap.edges[base + eTypeIdx]];
      const edgeName =
        edgeType === 'element' || edgeType === 'hidden'
          ? `[${edgeType}]`
          : snap.strings[snap.edges[base + eNameIdx]];
      const key = `${parentLabel} --${edgeName}-->`;
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
    edgeCursor += edgeCount;
  }
  return hist;
}

/** Count live objects by constructor/type from a V8 heap snapshot. */
function census(path) {
  const snap = JSON.parse(readFileSync(path, 'utf8'));
  const { node_fields, node_types } = snap.snapshot.meta;
  const typeIdx = node_fields.indexOf('type');
  const nameIdx = node_fields.indexOf('name');
  const sizeIdx = node_fields.indexOf('self_size');
  const stride = node_fields.length;
  const typeNames = node_types[typeIdx];
  const counts = new Map();
  for (let i = 0; i < snap.nodes.length; i += stride) {
    const type = typeNames[snap.nodes[i + typeIdx]];
    const name = snap.strings[snap.nodes[i + nameIdx]];
    const key = `${type}:${name}`;
    const entry = counts.get(key) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += snap.nodes[i + sizeIdx];
    counts.set(key, entry);
  }
  return counts;
}

async function snapshotAt(rounds, from) {
  for (let g = from; g <= rounds; g++) {
    rows.setAll(generation(g));
    await new Promise((r) => setTimeout(r, 0));
  }
  await quiesce({ label: `${rounds}` });
  const path = join(process.cwd(), `heap-${rounds}.heapsnapshot`);
  writeHeapSnapshot(path);
  return path;
}

rows.setAll(generation(0));
await new Promise((r) => setTimeout(r, 0));

const lowPath = await snapshotAt(LOW, 1);
const highPath = await snapshotAt(HIGH, LOW + 1);
const low = census(lowPath);
const high = census(highPath);

const ratio = HIGH / LOW;
const rows_ = [];
for (const [key, hi] of high) {
  const lo = low.get(key) ?? { count: 0, bytes: 0 };
  const grewBy = hi.bytes - lo.bytes;
  if (grewBy < 512 * 1024) continue;
  rows_.push({ key, lo: lo.count, hi: hi.count, mb: grewBy / 1048576 });
}
rows_.sort((a, b) => b.mb - a.mb);

console.log(
  `HEAP OBJECT CENSUS — ${WIDTH} rows, maxHistorySize ${HISTORY}, ` +
    `${LOW} -> ${HIGH} rounds (${ratio}x)\n\n` +
    '  growth   count(low -> high)   type'
);
for (const r of rows_.slice(0, 20)) {
  console.log(
    `  ${r.mb.toFixed(2).padStart(6)} MB   ${String(r.lo).padStart(8)} -> ${String(
      r.hi
    ).padStart(8)}   ${r.key}`
  );
}

/**
 * Shortest retaining path from a GC root, for a sample of leaked nodes.
 *
 * The retainer histogram bottomed out in `object:Object --value--> Object`,
 * which names nothing: the parents are plain objects too. Walking up to a root
 * is what surfaces the named container the chain hangs from.
 */
function retainingPaths(path, targetType, sample, viaEdge) {
  const snap = JSON.parse(readFileSync(path, 'utf8'));
  const { node_fields, node_types, edge_fields, edge_types } = snap.snapshot.meta;
  const nStride = node_fields.length;
  const eStride = edge_fields.length;
  const nTypeIdx = node_fields.indexOf('type');
  const nNameIdx = node_fields.indexOf('name');
  const nEdgeCountIdx = node_fields.indexOf('edge_count');
  const eTypeIdx = edge_fields.indexOf('type');
  const eNameIdx = edge_fields.indexOf('name_or_index');
  const eToIdx = edge_fields.indexOf('to_node');
  const nodeTypeNames = node_types[nTypeIdx];
  const edgeTypeNames = edge_types[eTypeIdx];
  const nodeCount = snap.nodes.length / nStride;

  // Edge ranges per node.
  const edgeStart = new Uint32Array(nodeCount + 1);
  for (let n = 0; n < nodeCount; n++) {
    edgeStart[n + 1] = edgeStart[n] + snap.nodes[n * nStride + nEdgeCountIdx];
  }

  const label = (n) =>
    `${nodeTypeNames[snap.nodes[n * nStride + nTypeIdx]]}:${
      snap.strings[snap.nodes[n * nStride + nNameIdx]]
    }`;

  const parent = new Int32Array(nodeCount).fill(-1);
  const parentEdge = new Array(nodeCount);
  const queue = [0];
  parent[0] = 0;
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head];
    for (let e = edgeStart[n]; e < edgeStart[n + 1]; e++) {
      const to = snap.edges[e * eStride + eToIdx] / nStride;
      if (parent[to] !== -1) continue;
      parent[to] = n;
      const et = edgeTypeNames[snap.edges[e * eStride + eTypeIdx]];
      parentEdge[to] =
        et === 'element' || et === 'hidden'
          ? `[${et}]`
          : snap.strings[snap.edges[e * eStride + eNameIdx]];
      queue.push(to);
    }
  }

  const out = [];
  for (let n = 0; n < nodeCount && out.length < sample; n++) {
    if (label(n) !== targetType || parent[n] === -1) continue;
    if (viaEdge !== undefined && parentEdge[n] !== viaEdge) continue;
    const chain = [];
    let cur = n;
    for (let d = 0; d < 12 && cur !== 0; d++) {
      chain.unshift(`${parentEdge[cur] ?? '?'} @ ${label(cur)}`);
      cur = parent[cur];
    }
    out.push(chain.join('  <-  '));
  }
  return out;
}

// Who holds them.
const targets = new Set(rows_.map((r) => r.key));
if (targets.size > 0) {
  const loHist = retainerHistogram(lowPath, targets);
  const hiHist = retainerHistogram(highPath, targets);
  const grew = [];
  for (const [key, hi] of hiHist) {
    const lo = loHist.get(key) ?? 0;
    if (hi - lo < 1000) continue;
    grew.push({ key, lo, hi });
  }
  grew.sort((a, b) => b.hi - b.lo - (a.hi - a.lo));
  console.log('\nRETAINERS (edges into the leaked types)\n');
  for (const g of grew.slice(0, 15)) {
    console.log(
      `  ${String(g.lo).padStart(8)} -> ${String(g.hi).padStart(8)}   ${g.key}`
    );
  }
}

for (const via of ['path', 'value']) {
  console.log(`\nRETAINING PATHS from a GC root — via .${via}\n`);
  for (const chain of retainingPaths(highPath, 'object:Object', 3, via)) {
    console.log('  ' + chain + '\n');
  }
}

rmSync(lowPath, { force: true });
rmSync(highPath, { force: true });
