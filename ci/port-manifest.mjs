// tests/port-manifest.json: the coverage map (BRIEF.md 12.1.5). One entry per
// spec file under packages/ at tags v15.4.9 and v16.0.0-rc.1, recording which
// 5.1/5.2 behavior IDs that old file touched ("covers"), or "notCarried" with a
// one-line reason, or "pending" until it is classified. It records coverage
// only: no test is ported from it (12.1.3).
//
//   node ci/port-manifest.mjs generate          write the map from the tags (all pending)
//   node ci/port-manifest.mjs check             validate the entries
//   node ci/port-manifest.mjs check --tags      also prove the entries are exactly the tags' spec files
//   node ci/port-manifest.mjs check --complete  also require that no entry is pending
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './entry-graph.mjs';

export const SOURCE_TAGS = ['v15.4.9', 'v16.0.0-rc.1'];
export const MANIFEST_PATH = join(repoRoot, 'tests', 'port-manifest.json');
const SPEC = /^packages\/.+\.spec\.ts$/;

/** Spec paths under packages/ at each tag, read from git. */
export function specsAtTags(tags = SOURCE_TAGS, root = repoRoot) {
  const byPath = new Map();
  for (const tag of tags) {
    const out = execFileSync('git', ['ls-tree', '-r', '--name-only', tag, '--', 'packages'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
    for (const path of out.split('\n')) {
      if (!SPEC.test(path)) continue;
      if (!byPath.has(path)) byPath.set(path, []);
      byPath.get(path).push(tag);
    }
  }
  return [...byPath.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([source, inTags]) => ({ source, in: inTags }));
}

export function generate(root = repoRoot) {
  const entries = specsAtTags(SOURCE_TAGS, root).map((e) => ({ ...e, pending: true }));
  return { sources: SOURCE_TAGS, selection: 'packages/**/*.spec.ts', entries };
}

export const BEHAVIOR_IDS = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
  'R1', 'R2', 'R3', 'R4', 'E1', 'E2', 'L1', 'L2', 'L3', 'X1', 'X2',
  'W1', 'W2', 'W3', 'W4',
];

/** Returns the problems with a coverage map; `complete` also rejects pending entries. */
export function validate(manifest, { complete = false } = {}) {
  const problems = [];
  if (!Array.isArray(manifest?.entries)) return ['manifest has no entries array'];
  let previous = '';
  for (const [i, e] of manifest.entries.entries()) {
    const at = `entry ${i} (${e?.source ?? 'no source'})`;
    if (typeof e?.source !== 'string' || !SPEC.test(e.source)) problems.push(`${at}: source must be a packages/**/*.spec.ts path`);
    else if (e.source <= previous) problems.push(`${at}: entries must be sorted and unique`);
    else previous = e.source;
    if (!Array.isArray(e?.in) || e.in.length === 0 || e.in.some((t) => !SOURCE_TAGS.includes(t))) problems.push(`${at}: "in" must list the source tags that contain it`);
    const kinds = ['covers', 'notCarried', 'pending'].filter((k) => e?.[k] !== undefined);
    if (kinds.length !== 1) {
      problems.push(`${at}: needs exactly one of "covers", "notCarried" or "pending"`);
      continue;
    }
    if (kinds[0] === 'covers') {
      const ids = e.covers;
      if (!Array.isArray(ids) || ids.length === 0) problems.push(`${at}: "covers" must list at least one behavior ID`);
      else if (ids.some((id) => !BEHAVIOR_IDS.includes(id))) problems.push(`${at}: "covers" may hold only 5.1/5.2 behavior IDs`);
      else if (new Set(ids).size !== ids.length) problems.push(`${at}: "covers" lists an ID twice`);
    } else if (kinds[0] === 'notCarried') {
      if (typeof e.notCarried !== 'string' || e.notCarried.trim().length === 0 || e.notCarried.includes('\n')) problems.push(`${at}: "notCarried" needs a one-line reason`);
    } else if (e.pending !== true) {
      problems.push(`${at}: "pending" must be true`);
    } else if (complete) {
      problems.push(`${at}: still pending`);
    }
  }
  return problems;
}

/** Problems if the manifest's sources differ from the tags' spec files. */
export function compareWithTags(manifest, root = repoRoot) {
  const expected = specsAtTags(SOURCE_TAGS, root);
  const actual = new Map(manifest.entries.map((e) => [e.source, e.in]));
  const problems = [];
  for (const { source, in: inTags } of expected) {
    if (!actual.has(source)) problems.push(`missing ${source}`);
    else if (actual.get(source).join() !== inTags.join()) problems.push(`${source}: "in" should be ${inTags.join(', ')}`);
  }
  const expectedSet = new Set(expected.map((e) => e.source));
  for (const source of actual.keys()) if (!expectedSet.has(source)) problems.push(`not a spec file at the source tags: ${source}`);
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...flags] = process.argv.slice(2);
  if (command === 'generate') {
    if (existsSync(MANIFEST_PATH)) {
      console.error('tests/port-manifest.json exists; generate only creates it. Edit dispositions in place.');
      process.exit(1);
    }
    const manifest = generate();
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`wrote ${manifest.entries.length} entries`);
  } else if (command === 'check') {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const problems = [...validate(manifest, { complete: flags.includes('--complete') }), ...(flags.includes('--tags') ? compareWithTags(manifest) : [])];
    const kind = (e) => (e.covers ? 'covered' : e.notCarried ? 'not carried' : 'pending');
    const counts = manifest.entries.reduce((acc, e) => ({ ...acc, [kind(e)]: (acc[kind(e)] ?? 0) + 1 }), {});
    for (const p of problems) console.log(`FAIL ${p}`);
    console.log(`${manifest.entries.length} entries: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    process.exit(problems.length ? 1 : 0);
  } else {
    console.error('usage: node ci/port-manifest.mjs generate | check [--tags] [--complete]');
    process.exit(2);
  }
}
