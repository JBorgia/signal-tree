import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const integer = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label}: ${value}`);
  return value;
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
export const CONDITIONAL_EDGE = /part of key .*-> value .*pair in WeakMap|ephemeron/i;
export function edgeSemantics(type, name) {
  if (type === 'weak') return 'weak';
  if (CONDITIONAL_EDGE.test(String(name))) return 'conditional-v8-label';
  return 'ordinary-snapshot-edge';
}

/** Raw table validation and descriptive indexing only. This is not a retainer engine. */
export function validateSnapshot(snapshot) {
  const meta = snapshot?.snapshot?.meta;
  assert(meta && Array.isArray(snapshot.nodes) && Array.isArray(snapshot.edges) && Array.isArray(snapshot.strings), 'Missing V8 snapshot tables/meta');
  const { nodes, edges, strings } = snapshot;
  const nf = meta.node_fields, ef = meta.edge_fields;
  assert(Array.isArray(nf) && Array.isArray(ef) && nf.length && ef.length, 'Invalid node/edge fields');
  assert(new Set(nf).size === nf.length && new Set(ef).size === ef.length, 'Duplicate schema fields');
  const n = Object.fromEntries(nf.map((key, index) => [key, index]));
  const e = Object.fromEntries(ef.map((key, index) => [key, index]));
  for (const key of ['type', 'name', 'id', 'self_size', 'edge_count']) assert(key in n, `Missing node ${key}`);
  for (const key of ['type', 'name_or_index', 'to_node']) assert(key in e, `Missing edge ${key}`);
  assert(nodes.length % nf.length === 0 && edges.length % ef.length === 0, 'Misaligned snapshot tables');
  const count = nodes.length / nf.length, edgeCount = edges.length / ef.length;
  assert(count > 0, 'Snapshot has no root');
  assert(snapshot.snapshot.node_count === count && snapshot.snapshot.edge_count === edgeCount, 'Snapshot header counts disagree');
  const nt = meta.node_types?.[n.type], et = meta.edge_types?.[e.type];
  assert(Array.isArray(nt) && Array.isArray(et), 'Missing type enums');
  assert(strings.every(value => typeof value === 'string'), 'Non-string string-table entry');
  const string = (index, label) => { integer(index, label); assert(index < strings.length, `${label} out of range`); return strings[index]; };
  const ids = new Map(), records = [], incoming = Array.from({ length: count }, () => []);
  let offset = 0, totalSelfSize = 0n;
  for (let i = 0; i < count; i++) {
    const at = i * nf.length, type = integer(nodes[at + n.type], 'node type');
    assert(type < nt.length, 'Node type out of range');
    const id = integer(nodes[at + n.id], 'node id'), selfSize = integer(nodes[at + n.self_size], 'self size');
    assert(!ids.has(id), `Duplicate node id ${id}`); ids.set(id, i);
    const length = integer(nodes[at + n.edge_count], 'node edge count');
    assert(offset + length <= edgeCount, 'Node edge range exceeds table');
    const row = { ordinal: i, offset: at, id, name: string(nodes[at + n.name], 'node name'), type: nt[type], selfSize, outgoing: [] };
    for (let j = 0; j < length; j++) {
      const edgeAt = (offset + j) * ef.length, typ = integer(edges[edgeAt + e.type], 'edge type');
      assert(typ < et.length, 'Edge type out of range');
      const target = integer(edges[edgeAt + e.to_node], 'edge target');
      assert(target % nf.length === 0 && target < nodes.length, 'Edge target is not an aligned node');
      const typeName = et[typ], rawName = edges[edgeAt + e.name_or_index];
      const name = typeName === 'element' || typeName === 'hidden' ? integer(rawName, 'edge index') : string(rawName, 'edge name');
      const edge = { from: i, to: target / nf.length, type: typeName, name, semantics: edgeSemantics(typeName, name) };
      row.outgoing.push(edge); incoming[edge.to].push(edge);
    }
    records.push(row); offset += length; totalSelfSize += BigInt(selfSize);
  }
  assert(offset === edgeCount, 'Unassigned trailing edges');
  return { snapshot, records, incoming, ids, totalSelfSize, nodeWidth: nf.length, edgeWidth: ef.length, nodeFields: n, edgeFields: e, edgeTypes: et };
}

export function selfSizeCensus(raw) {
  const groups = new Map();
  for (const node of raw.records) {
    const key = `${node.type}:${node.name}`;
    const group = groups.get(key) ?? { type: node.type, name: node.name, count: 0, selfSize: 0n };
    group.count++; group.selfSize += BigInt(node.selfSize); groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.selfSize > b.selfSize ? -1 : a.selfSize < b.selfSize ? 1 : a.name.localeCompare(b.name));
}

const shapes = {
  nativeRequirement: ['inputs', 'frames', 'known', 'unknown', 'possible', 'captureWindow'],
  preparedUnit: ['record', 'completion'],
  terminalRecord: ['writes', 'adds'],
  nativeCompletion: ['requirement', 'support', 'facts'],
  partsCompletion: ['parts'],
  fieldEndpoint: ['present', 'value', 'requirement'],
  physicalView: ['requirement', 'present'],
  ownerCell: ['owner', 'id', 'outcome', 'dependents'],
};
export function fieldShapeSignatures(raw) {
  const groups = Object.fromEntries(Object.keys(shapes).map(name => [name, []]));
  for (const node of raw.records) {
    if (node.type !== 'object') continue;
    const properties = new Set(node.outgoing.filter(edge => edge.type === 'property').map(edge => edge.name));
    for (const [name, keys] of Object.entries(shapes)) if (keys.every(key => properties.has(key))) groups[name].push(node.ordinal);
  }
  return groups;
}

/** Bounded incoming edge samples, not strongest paths, ownership or dominators. */
export function incomingSamples(raw, ordinal, { depth = 3, width = 5 } = {}) {
  integer(ordinal, 'sample ordinal'); assert(ordinal < raw.records.length, 'Sample node out of range');
  const walk = (index, remaining, seen) => {
    const node = raw.records[index];
    const result = { id: node.id, ordinal: index, type: node.type, name: node.name };
    if (!remaining) return { ...result, truncated: raw.incoming[index].length > 0 };
    const all = raw.incoming[index];
    result.incomingCount = all.length;
    result.incoming = all.slice(0, width).map(edge => ({ edgeType: edge.type, edgeName: edge.name, semantics: edge.semantics,
      from: seen.has(edge.from) ? { id: raw.records[edge.from].id, cycle: true } : walk(edge.from, remaining - 1, new Set([...seen, edge.from])) }));
    result.omitted = Math.max(0, all.length - width);
    return result;
  };
  return walk(ordinal, depth, new Set([ordinal]));
}

export async function loadParser(location) {
  assert(location, '--parser-dir or --parser is required; no workspace dependency fallback');
  const path = resolve(location), info = await stat(path);
  const entry = info.isDirectory() ? join(path, 'v8_heap_parser.js') : path;
  const parser = require(entry);
  assert(typeof parser.decode_bytes === 'function', 'Pinned parser decode_bytes API missing');
  const metadata = JSON.parse(await readFile(resolve(dirname(entry), '../../package.json'), 'utf8'));
  assert(metadata.name === '@vscode/v8-heap-parser' && metadata.version === '0.1.0', 'Expected external @vscode/v8-heap-parser 0.1.0');
  return { parser, identity: { entry, packageName: metadata.name, version: metadata.version,
    entrySha256: createHash('sha256').update(await readFile(entry)).digest('hex'),
    wasmSha256: createHash('sha256').update(await readFile(join(dirname(entry), 'v8_heap_parser_bg.wasm'))).digest('hex') } };
}

/** Parser API values only; class retained sizes are kept separate and never added. */
export function engineInventory(parser, bytes, raw) {
  const graph = parser.decode_bytes(bytes);
  try {
    const classes = graph.get_class_groups(0, raw.records.length, false);
    const nodes = new Map(), summaries = [];
    try {
      for (let index = 0; index < classes.length; index++) {
        const group = classes[index], name = group.name();
        const summary = { name, count: group.children_len, selfSize: group.self_size, engineRetainedSize: group.retained_size, nonadditive: true };
        summaries.push(summary);
        const children = graph.class_children(index, 0, group.children_len, parser.WasmSortBy.RetainedSize);
        try {
          assert(children.length === group.children_len, `Parser class count mismatch for ${name}`);
          for (const child of children) {
            const ordinal = raw.ids.get(child.id);
            assert(ordinal !== undefined, `Parser unknown id ${child.id}`);
            const original = raw.records[ordinal];
            assert(child.name() === original.name && child.self_size === BigInt(original.selfSize), `Parser/raw node mismatch ${child.id}`);
            assert(!nodes.has(ordinal), `Parser duplicated node ${child.id}`);
            nodes.set(ordinal, { id: child.id, parserIndex: child.index, name: child.name(), selfSize: child.self_size, engineRetainedSize: child.retained_size });
          }
        } finally { for (const child of children) child.free(); }
      }
      assert(nodes.size === raw.records.length, `Parser inventory incomplete: ${nodes.size}/${raw.records.length}`);
      const total = [...nodes.values()].reduce((sum, node) => sum + node.selfSize, 0n);
      assert(total === raw.totalSelfSize, 'Parser total self size mismatch');
      return { nodes, classes: summaries, rootIndex: graph.root_index };
    } finally { for (const group of classes) group.free(); }
  } finally { graph.free(); }
}

/** Engine incoming-retainer API is descriptive; preserve edge kind and API distance bound. */
export function engineRetainers(parser, bytes, raw, inventory, ordinal, distance = 2) {
  const node = inventory.nodes.get(ordinal); assert(node, 'Missing engine node');
  const graph = parser.decode_bytes(bytes);
  try {
    const retainers = graph.get_all_retainers(node.parserIndex, distance);
    try { return retainers.map(retainer => {
      assert(raw.ids.has(retainer.id), `Unknown engine retainer id ${retainer.id}`);
      const kinds = Object.entries(parser.EdgeType).filter(([, value]) => typeof value === 'number');
      return { id: retainer.id, parserIndex: retainer.index, retainsParserIndex: retainer.retains_index,
        edgeType: kinds.find(([, value]) => value === retainer.edge_typ)?.[0] ?? `unknown:${retainer.edge_typ}`,
        name: retainer.name(), engineRetainedSize: retainer.retained_size };
    }); } finally { for (const retainer of retainers) retainer.free(); }
  } finally { graph.free(); }
}

/** Explicitly wrong policies solely for calibration witnesses. Not an ownership algorithm. */
export function mutateEdgesForControl(snapshot, variant) {
  assert(['include-weak', 'drop-conditional'].includes(variant), 'Unknown control mutation');
  const copy = structuredClone(snapshot), raw = validateSnapshot(copy), ef = raw.edgeFields;
  const property = raw.edgeTypes.indexOf('property'), weak = raw.edgeTypes.indexOf('weak');
  assert(property >= 0 && weak >= 0, 'Control requires property/weak enums');
  let changed = 0;
  for (let at = 0; at < copy.edges.length; at += raw.edgeWidth) {
    const type = raw.edgeTypes[copy.edges[at + ef.type]], nameIndex = copy.edges[at + ef.name_or_index];
    const semantics = edgeSemantics(type, copy.strings[nameIndex]);
    if ((variant === 'include-weak' && semantics === 'weak') || (variant === 'drop-conditional' && semantics === 'conditional-v8-label')) {
      copy.edges[at + ef.type] = variant === 'include-weak' ? property : weak; changed++;
    }
  }
  assert(changed > 0, `Control mutation ${variant} changed no edges`);
  return { snapshot: copy, changed };
}

export function json(value) { return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2); }
export async function analyzeFile(snapshotFile, parserLocation, { calibration, sampleLimit = 3 } = {}) {
  const bytes = await readFile(snapshotFile), raw = validateSnapshot(JSON.parse(bytes));
  const { parser, identity } = await loadParser(parserLocation), engine = engineInventory(parser, bytes, raw);
  const signatures = fieldShapeSignatures(raw), groups = {};
  for (const [name, ordinals] of Object.entries(signatures)) {
    groups[name] = { candidateCount: ordinals.length,
      selfSize: ordinals.reduce((sum, ordinal) => sum + BigInt(raw.records[ordinal].selfSize), 0n),
      nonadditiveWithOtherGroups: true,
      representatives: ordinals.slice(0, sampleLimit).map(ordinal => ({ ...engine.nodes.get(ordinal), incomingSamples: incomingSamples(raw, ordinal) })) };
  }
  const calibrated = calibration?.passed === true && calibration?.parser?.wasmSha256 === identity.wasmSha256 && calibration?.nodeMajor === 24 && calibration?.actualWeakControlsPassed === true;
  return { schema: 'v16-pending-drain-heap-analysis-1', snapshot: { path: resolve(snapshotFile), sha256: createHash('sha256').update(bytes).digest('hex'), nodes: raw.records.length,
    edges: raw.snapshot.snapshot.edge_count, totalSelfSize: raw.totalSelfSize }, parser: identity,
    retainedSemantics: { calibrated, status: calibrated ? 'engine-reported; calibrated controls only, not exact ephemeron ownership proof' : 'UNQUALIFIED: actual Node24 weak/conditional calibration not established',
      additive: false, calibration: calibration ?? null },
    limitations: ['Shape groups are candidates, overlap and do not identify owners.', 'Opaque empty completions cannot be identified by field shape.',
      'Raw incoming samples include weak and conditional edges; they are not reachability/ownership paths.',
      'Class and individual engine retained sizes overlap and must never be summed.', 'Parser API does not expose ephemeron activation predicates; controls may reject its ownership semantics.'],
    selfSizeCensus: selfSizeCensus(raw), engineClassGroups: engine.classes, fieldShapeGroups: groups };
}

async function main() {
  const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  const snapshot = option('--snapshot'), parser = option('--parser') ?? option('--parser-dir');
  assert(snapshot, 'Usage: --snapshot FILE --parser FILE|--parser-dir NODEJS_DIR [--calibration JSON] [--output FILE]');
  const calibrationPath = option('--calibration'), calibration = calibrationPath ? JSON.parse(await readFile(calibrationPath, 'utf8')) : undefined;
  const report = await analyzeFile(snapshot, parser, { calibration });
  if (option('--output')) await writeFile(option('--output'), json(report) + '\n'); else process.stdout.write(json(report) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
