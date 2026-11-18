import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const [workspaceArg, outputArg] = process.argv.slice(2);
assert(workspaceArg && outputArg, 'measure-demo-load.mjs WORKSPACE NEW_OUTPUT_JSON');
const workspace = resolve(workspaceArg), output = resolve(outputArg);
const statsPath = resolve(workspace, 'dist/apps/demo/stats.json');
const browser = resolve(workspace, 'dist/apps/demo/browser');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const stats = JSON.parse(readFileSync(statsPath));
const html = readFileSync(resolve(browser, 'index.html'), 'utf8');
const roots = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
assert(roots.length, 'No emitted initial JS/CSS roots');
function pathFor(file) {
  const path = resolve(browser, file);
  assert(path.startsWith(browser + sep) && existsSync(path), 'Missing/outside emitted file: ' + file);
  return path;
}
function closure(keys) {
  const seen = new Set();
  const visit = file => {
    if (seen.has(file)) return;
    assert(stats.outputs[file], 'Missing output metadata: ' + file); pathFor(file);
    seen.add(file);
    for (const imported of stats.outputs[file].imports) {
      if (imported.kind !== 'dynamic-import' && !imported.external) visit(imported.path);
    }
  };
  keys.forEach(visit); return [...seen].sort();
}
function measure(files) {
  return { rawBytes: files.reduce((sum, file) => sum + statSync(pathFor(file)).size, 0),
    gzipBytes: files.reduce((sum, file) => sum + gzipSync(readFileSync(pathFor(file))).length, 0),
    files: Object.fromEntries(files.map(file => [file, hash(pathFor(file))])) };
}
const report = {
  command: process.argv, node: process.version,
  generatorSha256: hash(fileURLToPath(import.meta.url)),
  sourceClaim: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: workspace, encoding: 'utf8'}).trim(),
  statsSha256: hash(statsPath), indexSha256: hash(resolve(browser, 'index.html')),
  limits: 'Actual emitted JS/CSS static import closures. Gzip is per file with Node defaults, not a network transfer claim. Excludes fonts/images/docs and later dynamic features. Embedded component CSS is already in emitted JS; intermediate CSS metadata is not double counted. Source claim is not a build receipt: bind this record to a fresh production --stats-json build.',
  initial: measure(closure(roots)),
  routes: Object.entries(stats.outputs).filter(([file, value]) => value.entryPoint && file.endsWith('.js') && !roots.includes(file))
    .map(([file, value]) => ({entryPoint: value.entryPoint, ...measure(closure([...roots, file]))})),
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, sourceClaim: report.sourceClaim, initialBytes: report.initial.rawBytes}));
