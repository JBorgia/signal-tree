import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = process.env.SIGNALTREE_ROOT ?? '/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree';
const dir = dirname(fileURLToPath(import.meta.url));
const { build } = createRequire(root + '/package.json')('esbuild');
const inputs = {};
const hash = value => createHash('sha256').update(value).digest('hex');
const result = await build({ entryPoints: [resolve(dir, 'scenario.ts')], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24', alias: { '@signal-tree/kernel': resolve(root, 'packages/kernel/src/index.ts') }, plugins: [{ name: 'receipt', setup(builder) {
  builder.onLoad({ filter: /\.ts$/ }, ({ path }) => {
    const contents = readFileSync(path, 'utf8');
    inputs[path] = hash(contents);
    return { contents, loader: 'ts' };
  });
} }] });
const source = result.outputFiles[0].text;
writeFileSync(resolve(dir, 'bundle.mjs'), source);
const receipt = { node: process.version, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), planSHA256: hash(readFileSync(resolve(dir, 'PLAN.md'))), bundleSHA256: hash(source), inputs };
writeFileSync(resolve(dir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
const results = await (await import('./bundle.mjs?run=' + Date.now())).run();
writeFileSync(resolve(dir, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
