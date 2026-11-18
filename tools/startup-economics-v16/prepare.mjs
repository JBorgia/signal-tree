import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const [rootArg, outArg, angularRootArg] = process.argv.slice(2);
const root = resolve(rootArg), out = resolve(outArg);
const angularRoot = angularRootArg ? resolve(angularRootArg) : root;
mkdirSync(out, { recursive: false });
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const bindings = {};
const artifacts = {};
const harness = join(out, 'harness');
mkdirSync(harness);
for (const name of ['prepare.mjs', 'child.mjs', 'summarize-profile.mjs', 'falsify-prepend.mjs', 'README.md']) {
  const original = join(dirname(fileURLToPath(import.meta.url)), name), copied = join(harness, name);
  copyFileSync(original, copied);
  bindings[copied] = sha(copied);
}
for (const carrier of ['kernel', 'angular']) {
  const packageRoot = carrier === 'angular' ? angularRoot : root;
  const manifestPath = join(packageRoot, carrier + '.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const receipt = JSON.parse(readFileSync(manifest.buildReceipt, 'utf8'));
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256);
  assert.equal(receipt.exitCode, 0);
  assert.equal(receipt.sourceUnchanged, true);
  for (const [path, hash] of Object.entries(receipt.snapshots)) assert.equal(sha(path), hash);
  for (const [name, hash] of Object.entries(manifest.files)) assert.equal(sha(join(packageRoot, carrier, name)), hash);
  bindings[manifestPath] = sha(manifestPath);
  bindings[manifest.buildReceipt] = sha(manifest.buildReceipt);
  artifacts[carrier] = { head: manifest.head, sourceSeal: manifest.sourceSeal, manifestPath, manifestSha256: sha(manifestPath), buildReceiptSha256: manifest.buildReceiptSha256 };
  const source = join(out, carrier + '.entry.mjs');
  writeFileSync(source, `export { signalTree, entityMap, leaf, transactions, link } from ${JSON.stringify(join(packageRoot, carrier, 'dist/index.js'))};\n`);
  const bundle = join(out, carrier + '.mjs');
  const result = await build({entryPoints:[source], outfile:bundle, bundle:true, format:'esm', platform:'node', target:'node24', minify:false, sourcemap:true, metafile:true,
    nodePaths:[resolve('node_modules')], define:{ngDevMode:'false',__DEV__:'false','process.env.NODE_ENV':'"production"'},
    plugins:[{name:'bound-kernel',setup(b){b.onResolve({filter:/^@signal-tree\/kernel(?:\/.*)?$/},args=>({path:join(root,'kernel','dist', args.path==='@signal-tree/kernel'?'index.js':args.path.slice('@signal-tree/kernel/'.length)+'.js')}));}}]});
  for(const input of Object.keys(result.metafile.inputs)) bindings[resolve(input)] = sha(resolve(input));
  bindings[bundle] = sha(bundle);
  writeFileSync(join(out,carrier+'.meta.json'),JSON.stringify(result.metafile));
  assert(!Object.keys(result.metafile.inputs).some(p=>p.includes('packages/kernel/src/')));
}
writeFileSync(join(out,'packet.json'),JSON.stringify({root,angularRoot,command:process.argv,node:process.version,artifacts,bindings},null,2)+'\n');
