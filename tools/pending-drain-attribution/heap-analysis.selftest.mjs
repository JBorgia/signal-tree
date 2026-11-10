import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateSnapshot, selfSizeCensus, fieldShapeSignatures, edgeSemantics, loadParser, engineInventory, mutateEdgesForControl, json } from './heap-analysis.mjs';

/** Tiny standard-schema snapshots; no application runtime/profiling involved. */
export function syntheticSnapshot(nodes, edges) {
  const strings = [''], intern = value => { let at = strings.indexOf(value); if (at < 0) { at = strings.length; strings.push(value); } return at; };
  const nodeTypes = ['hidden', 'array', 'string', 'object', 'code', 'closure', 'regexp', 'number', 'native', 'synthetic', 'concatenated string', 'sliced string', 'symbol', 'bigint'];
  const edgeTypes = ['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'];
  const nf = ['type', 'name', 'id', 'self_size', 'edge_count', 'trace_node_id', 'detachedness'];
  const flatNodes = [], flatEdges = [];
  nodes.forEach((node, index) => {
    const outgoing = edges.filter(edge => edge.from === index);
    flatNodes.push(nodeTypes.indexOf(node.type ?? 'object'), intern(node.name), 2 * index + 1, node.size ?? 0, outgoing.length, 0, 0);
    for (const edge of outgoing) flatEdges.push(edgeTypes.indexOf(edge.type ?? 'property'), edge.type === 'element' || edge.type === 'hidden' ? edge.name ?? 0 : intern(edge.name ?? 'child'), edge.to * nf.length);
  });
  return { snapshot: { meta: { node_fields: nf, node_types: [nodeTypes, 'string', 'number', 'number', 'number', 'number', 'number'], edge_fields: ['type', 'name_or_index', 'to_node'], edge_types: [edgeTypes, 'string_or_number', 'node'], trace_function_info_fields: [], trace_node_fields: [], sample_fields: [], location_fields: [] }, node_count: nodes.length, edge_count: edges.length, trace_function_count: 0 },
    nodes: flatNodes, edges: flatEdges, trace_function_infos: [], trace_tree: [], samples: [], locations: [], strings };
}
const root = { name: '(root)', type: 'synthetic', size: 0 };
const bytes = snapshot => Buffer.from(JSON.stringify(snapshot));
function inventory(parser, snapshot) { const raw = validateSnapshot(snapshot); return { raw, engine: engineInventory(parser, bytes(snapshot), raw) }; }
function onlyObject(raw, name) {
  const matches = raw.records.filter(node => node.type === 'object' && node.name === name);
  assert.equal(matches.length, 1, `Expected exactly one object ${name}, got ${matches.length}`);
  return matches[0];
}
function retained(result, name) { return result.engine.nodes.get(onlyObject(result.raw, name).ordinal).engineRetainedSize; }
function absent(raw, names) { for (const name of names) assert.equal(raw.records.filter(node => node.type === 'object' && node.name === name).length, 0, `Unexpected live object ${name}`); }

export function runSyntheticControls(parser) {
  const chain = syntheticSnapshot([root, { name: 'ChainA', size: 10 }, { name: 'ChainB', size: 20 }, { name: 'ChainC', size: 30 }], [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]);
  const strong = inventory(parser, chain);
  assert.equal(strong.raw.totalSelfSize, 60n);
  assert.equal(selfSizeCensus(strong.raw).reduce((sum, group) => sum + group.selfSize, 0n), 60n);
  assert.equal(retained(strong, 'ChainA'), 60n); assert.equal(retained(strong, 'ChainB'), 50n); assert.equal(retained(strong, 'ChainC'), 30n);
  const shared = inventory(parser, syntheticSnapshot([root, { name: 'SharedA', size: 10 }, { name: 'SharedB', size: 20 }, { name: 'SharedC', size: 30 }], [{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }, { from: 2, to: 3 }]));
  assert.equal(retained(shared, 'SharedA'), 10n); assert.equal(retained(shared, 'SharedB'), 20n); assert.equal(retained(shared, 'SharedC'), 30n);
  const cycle = inventory(parser, syntheticSnapshot([root, { name: 'CycleA', size: 10 }, { name: 'CycleB', size: 20 }], [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 1 }]));
  assert.equal(retained(cycle, 'CycleA'), 30n); assert.equal(retained(cycle, 'CycleB'), 20n);
  const weakSnapshot = syntheticSnapshot([root, { name: 'WeakA', size: 10 }, { name: 'WeakB', size: 20 }], [{ from: 0, to: 1 }, { from: 1, to: 2, type: 'weak', name: 'weakTarget' }]);
  const weak = inventory(parser, weakSnapshot);
  assert.equal(retained(weak, 'WeakA'), 10n, 'Engine must not count a weak-only child as retained');
  const wrongWeak = inventory(parser, mutateEdgesForControl(weakSnapshot, 'include-weak').snapshot);
  assert.throws(() => assert.equal(retained(wrongWeak, 'WeakA'), 10n), 'Including weak edges must kill the weak calibration');
  assert.equal(edgeSemantics('weak', 'x'), 'weak');
  assert.equal(edgeSemantics('internal', '1 / part of key (Object @3) -> value (Object @5) pair in WeakMap (table @7)'), 'conditional-v8-label');
  // Invalid metadata/ranges must fail before the parser sees input.
  const badRange = structuredClone(chain); badRange.edges[2] = 1;
  assert.throws(() => validateSnapshot(badRange), /aligned node/);
  const badCount = structuredClone(chain); badCount.snapshot.edge_count++;
  assert.throws(() => validateSnapshot(badCount), /counts disagree/);
  const shape = syntheticSnapshot([root, { name: 'Object', size: 8 }], ['inputs', 'frames', 'known', 'unknown', 'possible', 'captureWindow'].map(name => ({ from: 1, to: 0, name })));
  assert.deepEqual(fieldShapeSignatures(validateSnapshot(shape)).nativeRequirement, [1]);
  return { strongChain: true, sharedRoots: true, cycle: true, weakIgnored: true, includeWeakMutantKilled: true, rangeValidation: true, shapePositiveControl: true };
}

/** Actual controls are snapshots generated by root on Node24, outside this module. */
export async function runActualWeakControls(parser, controls) {
  assert.equal(controls.nodeMajor, 24, 'Actual weak controls must be generated on Node24');
  for (const name of ['live', 'dead', 'liveValue', 'weakRef']) assert(controls[name]?.path, `Missing actual control ${name}`);
  const load = async entry => { const snapshot = JSON.parse(await readFile(entry.path, 'utf8')); return { snapshot, ...inventory(parser, snapshot) }; };
  const live = await load(controls.live), holder = onlyObject(live.raw, controls.live.holderName), key = onlyObject(live.raw, controls.live.keyName), value = onlyObject(live.raw, controls.live.valueName);
  const minimum = BigInt(holder.selfSize + key.selfSize + value.selfSize);
  const holderRetained = live.engine.nodes.get(holder.ordinal).engineRetainedSize;
  assert(holderRetained >= minimum, 'Engine fails live holder/key/ephemeron-value retained lower bound');
  const conditional = live.raw.records.flatMap(node => node.outgoing).filter(edge => edge.semantics === 'conditional-v8-label');
  assert(conditional.length > 0, 'Actual live snapshot has no recognized V8 ephemeron labels; unsupported');
  const dropped = inventory(parser, mutateEdgesForControl(live.snapshot, 'drop-conditional').snapshot);
  const mutantRetained = dropped.engine.nodes.get(holder.ordinal).engineRetainedSize;
  assert(mutantRetained < holderRetained, 'Dropping conditional edges was not detected by holder retained-size control; engine semantics unsupported');
  const dead = await load(controls.dead); assert(Array.isArray(controls.dead.absentNames) && controls.dead.absentNames.length >= 2, 'Dead control must name dead key and value'); absent(dead.raw, controls.dead.absentNames);
  const liveValue = await load(controls.liveValue); onlyObject(liveValue.raw, controls.liveValue.presentName);
  assert(controls.liveValue.absentNames?.length, 'Live-value control must name dead key'); absent(liveValue.raw, controls.liveValue.absentNames);
  const weakRef = await load(controls.weakRef); assert(weakRef.raw.records.some(node => node.type === 'object' && node.name === 'WeakRef'), 'WeakRef positive container missing');
  assert(controls.weakRef.absentNames?.length, 'WeakRef control must name dead target'); absent(weakRef.raw, controls.weakRef.absentNames);
  return { actualWeakControlsPassed: true, nodeMajor: 24, liveHolderRetained: holderRetained, dropConditionalHolderRetained: mutantRetained, conditionalEdges: conditional.length,
    deadKeyValueAbsent: true, liveValueDeadKey: true, weakRefOnlyTargetAbsent: true, dropConditionalMutantKilled: true };
}

export async function runSelfTests(parserLocation, actualControls) {
  const { parser, identity } = await loadParser(parserLocation);
  const synthetic = runSyntheticControls(parser);
  const actual = actualControls ? await runActualWeakControls(parser, actualControls) : { actualWeakControlsPassed: false, reason: 'Actual Node24 control snapshots not supplied' };
  return { passed: true, parser: identity, synthetic, ...actual };
}
async function main() {
  const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; };
  const controls = option('--actual-controls') ? JSON.parse(await readFile(option('--actual-controls'), 'utf8')) : undefined;
  const result = await runSelfTests(option('--parser') ?? option('--parser-dir'), controls);
  if (option('--output')) await writeFile(option('--output'), json(result) + '\n'); else process.stdout.write(json(result) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
