// tests/port-manifest.json (BRIEF.md 5.3 item 1): one entry per spec file
// under packages/ at tags v15.4.9 and v16.0.0-rc.1, each with a disposition.
//
//   node ci/port-manifest.mjs generate        write the manifest from the tags (all pending)
//   node ci/port-manifest.mjs check           validate entries and the files they name
//   node ci/port-manifest.mjs check --tags    also prove the entries are exactly the tags' spec files
//   node ci/port-manifest.mjs check --complete  also require no pending and every internal entry signed off
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
  const entries = specsAtTags(SOURCE_TAGS, root).map((e) => ({ ...e, disposition: 'pending' }));
  return { sources: SOURCE_TAGS, selection: 'packages/**/*.spec.ts', entries };
}

/** Returns the problems with a manifest object; `fileExists` is injectable for tests. */
export function validate(manifest, { fileExists = (p) => existsSync(join(repoRoot, p)), complete = false } = {}) {
  const problems = [];
  if (!Array.isArray(manifest?.entries)) return ['manifest has no entries array'];
  let previous = '';
  for (const [i, e] of manifest.entries.entries()) {
    const at = `entry ${i} (${e?.source ?? 'no source'})`;
    if (typeof e?.source !== 'string' || !SPEC.test(e.source)) problems.push(`${at}: source must be a packages/**/*.spec.ts path`);
    else if (e.source <= previous) problems.push(`${at}: entries must be sorted and unique`);
    else previous = e.source;
    if (!Array.isArray(e?.in) || e.in.length === 0 || e.in.some((t) => !SOURCE_TAGS.includes(t))) problems.push(`${at}: "in" must list the source tags that contain it`);
    switch (e?.disposition) {
      case 'pending':
        if (complete) problems.push(`${at}: still pending`);
        break;
      case 'ported':
        if (typeof e.target !== 'string' || !fileExists(e.target)) problems.push(`${at}: ported needs a "target" test file that exists`);
        break;
      case 'superseded':
        if (typeof e.coveredBy !== 'string' || !fileExists(e.coveredBy.split('::')[0])) problems.push(`${at}: superseded needs a "coveredBy" test file that exists`);
        break;
      case 'internal':
        if (typeof e.reason !== 'string' || e.reason.trim().length === 0 || e.reason.includes('\n')) problems.push(`${at}: internal needs a one-line "reason"`);
        if (typeof e.signedOff !== 'boolean') problems.push(`${at}: internal needs "signedOff" (true only after Jonathan's review)`);
        else if (complete && !e.signedOff) problems.push(`${at}: internal entry not signed off`);
        break;
      default:
        problems.push(`${at}: disposition must be pending, ported, superseded or internal`);
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
    const counts = manifest.entries.reduce((acc, e) => ({ ...acc, [e.disposition]: (acc[e.disposition] ?? 0) + 1 }), {});
    for (const p of problems) console.log(`FAIL ${p}`);
    console.log(`${manifest.entries.length} entries: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    process.exit(problems.length ? 1 : 0);
  } else {
    console.error('usage: node ci/port-manifest.mjs generate | check [--tags] [--complete]');
    process.exit(2);
  }
}
