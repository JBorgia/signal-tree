import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { platform, arch } from 'node:os';
import { admit, sha, fresh, save, inventory, verify } from './common.mjs';

// A derived-artifact experiment, never a replacement canonical build. Extract
// actual current query bodies; preserve every public property and its order.
const [manifestArg, manifestHash, toolchainArg, outputArg] = process.argv.slice(2);
const admitted = admit(manifestArg, manifestHash), toolchain = resolve(toolchainArg);
const output = fresh(outputArg, [admitted.manifest.root, toolchain]);
const require = createRequire(join(toolchain, 'package.json'));
const ts = require('typescript'), esbuild = require('esbuild');
assert.equal(process.version, 'v24.15.0');
assert.equal(process.env.ESBUILD_BINARY_PATH, undefined);
const esbuildBinary = createRequire(require.resolve('esbuild')).resolve(`@esbuild/${platform()}-${arch()}/bin/esbuild`);
const bindings = { ...admitted.bindings, [new URL(import.meta.url).pathname]: sha(new URL(import.meta.url)),
  [new URL('./common.mjs', import.meta.url).pathname]: sha(new URL('./common.mjs', import.meta.url)),
  [new URL('./METHOD-SEPARATION.md', import.meta.url).pathname]: sha(new URL('./METHOD-SEPARATION.md', import.meta.url)),
  [require.resolve('typescript')]: sha(require.resolve('typescript')), [require.resolve('esbuild')]: sha(require.resolve('esbuild')),
  [esbuildBinary]: sha(esbuildBinary),
  [process.execPath]: sha(process.execPath), [join(toolchain, 'pnpm-lock.yaml')]: sha(join(toolchain, 'pnpm-lock.yaml')) };
const root = join(output, 'split-kernel'); cpSync(admitted.manifest.root, root, { recursive: true, errorOnExist: true });
const target = join(root, 'dist/lib/entity-signal.js'), original = readFileSync(target, 'utf8');
const parsed = ts.createSourceFile(target, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let declaration;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'api' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    assert.equal(declaration, undefined, 'Unique entity API'); declaration = node;
  }
  ts.forEachChild(node, visit);
}
visit(parsed); assert(declaration);
const wanted = ['has', 'where', 'find'];
const methods = wanted.map(name => {
  const matches = declaration.initializer.properties.filter(property => property.name?.getText(parsed) === name);
  assert.equal(matches.length, 1); assert(ts.isMethodDeclaration(matches[0])); return matches[0];
});
const dependencies = ['absent', 'structuralStore', 'createVersionedProjection', 'whereCache', 'findCache', 'config', 'warnOnPredicateChurn', 'createQueryProjection', 'allSignal', 'presentEntities'];
const helper = join(root, 'dist/lib/entity-query-methods.js');
writeFileSync(helper, `export function createQueryMethods({${dependencies.join(',')}}) { return {${methods.map(method => method.getText(parsed)).join(',')}}; }\n`, { flag: 'wx' });
assert(ts.isVariableStatement(declaration.parent.parent));
const edits = methods.map(method => ({ start: method.getStart(parsed), end: method.end, text: `${method.name.getText(parsed)}:queryMethods.${method.name.getText(parsed)}` }));
edits.push({ start: declaration.parent.parent.getStart(parsed), end: declaration.parent.parent.getStart(parsed), text: `const queryMethods=createQueryMethods({${dependencies.join(',')}});` });
let changed = original;
for (const edit of edits.sort((left, right) => right.start - left.start)) changed = changed.slice(0, edit.start) + edit.text + changed.slice(edit.end);
changed = 'import{createQueryMethods}from"./entity-query-methods.js";\n' + changed;
writeFileSync(target, changed);
save(join(output, 'transformation.json'), { baseManifest: resolve(manifestArg), baseManifestHash: manifestHash,
  sourceSha256: sha(join(admitted.manifest.root, 'dist/lib/entity-signal.js')), changedSha256: sha(target), helperSha256: sha(helper),
  methods: wanted, dependencies, edits, limits: 'Internal module extraction on copied built JavaScript. No public export/method removed; not a canonical release artifact or heap/timing measurement.' });

const bundles = {}, records = [];
for (const [arm, packageRoot] of Object.entries({ baseline: admitted.manifest.root, split: root })) {
  bundles[arm] = {};
  for (const scenario of ['crud', 'queries']) {
    const entry = join(output, `${arm}-${scenario}.entry.mjs`), bundle = join(output, `${arm}-${scenario}.mjs`);
    const queryWork = scenario === 'queries' ? `
      const isActive = row => row.active;
      const filtered = rows.where(isActive), found = rows.find(isActive), has = rows.has('b');
      assert.equal(rows.where(isActive), filtered); assert.equal(rows.find(isActive), found);
      assert.deepEqual(filtered().map(row => row.id), sorted ? ['b','a'] : ['a','b']);
      assert.equal(found().id, sorted ? 'b' : 'a'); assert.equal(has(), true);
      const detachedWhere = rows.where; assert.deepEqual(detachedWhere(row => !row.active)().map(row => row.id), ['c']);
      rows.updateOne('b', { active: false });
      assert.deepEqual(filtered().map(row => row.id), ['a']); assert.equal(found().id, 'a');
      rows.removeOne('b'); assert.equal(has(), false);
      rows.addOne({id:'b', score:4, active:true}); assert.equal(has(), true);
      assert.deepEqual(filtered().map(row => row.id), ['a','b']);
      records.push({filtered:filtered(), found:found(), has:has()});
    ` : '';
    writeFileSync(entry, `import assert from 'node:assert/strict';
import {signalTree,entityMap} from ${JSON.stringify(join(packageRoot, 'dist/index.js'))};
export function exercise() {
  const records=[];
  for (const sorted of [false,true]) {
    const tree=signalTree({rows:entityMap({selectId:row=>row.id,...(sorted?{sortComparer:(a,b)=>a.score-b.score}:{})})});
    try {
      const rows=tree.$.rows;
      rows.setAll([{id:'a',score:2,active:true},{id:'b',score:1,active:true},{id:'c',score:3,active:false}]);
      const held=rows.byIdOrFail('a'), heldSnapshot=rows.all();
      rows.updateOne('a',{score:2}); assert.equal(rows.count(),3);
      assert.deepEqual(rows.all().map(row=>row.id),sorted?['b','a','c']:['a','b','c']);
      ${queryWork}
      rows.removeOne('a'); rows.addOne({id:'a',score:9,active:false});
      assert.equal(held(),undefined); assert.equal(rows.byIdOrFail('a')().score,9);
      assert.equal(heldSnapshot.find(row=>row.id==='a').score,2);
      records.push({sorted,rows:rows.all(),keys:Object.keys(rows),queryShape:['has','where','find'].map(name=>{const descriptor=Object.getOwnPropertyDescriptor(rows,name);return{name,length:rows[name].length,functionName:rows[name].name,enumerable:descriptor.enumerable,configurable:descriptor.configurable,writable:descriptor.writable};})});
    } finally {tree.destroy();}
  }
  return records;
}
console.log(JSON.stringify(exercise()));\n`, { flag: 'wx' });
    const built = await esbuild.build({ entryPoints: [entry], outfile: bundle, bundle: true, write: false, format: 'esm', platform: 'node', target: 'node24', minify: true, metafile: true,
      define: { ngDevMode: 'false', __DEV__: 'false', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', legalComments: 'none' });
    writeFileSync(bundle, built.outputFiles[0].contents, { flag: 'wx' });
    save(bundle + '.meta.json', built.metafile);
    for (const input of Object.keys(built.metafile.inputs)) bindings[resolve(input)] = sha(resolve(input));
    bindings[bundle] = sha(bundle); bindings[bundle + '.meta.json'] = sha(bundle + '.meta.json');
    const emitted = Object.values(built.metafile.outputs).flatMap(value => Object.entries(value.inputs).filter(([, input]) => input.bytesInOutput > 0));
    const helperBytes = emitted.filter(([path]) => path.endsWith('/entity-query-methods.js')).reduce((sum, [, input]) => sum + input.bytesInOutput, 0);
    const child = spawnSync(process.execPath, [bundle], { encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_OPTIONS: '', NODE_ENV: 'production' } });
    writeFileSync(bundle + '.stdout', child.stdout ?? '', { flag: 'wx' }); writeFileSync(bundle + '.stderr', child.stderr ?? '', { flag: 'wx' });
    const record = { arm, scenario, bundle, sha256: sha(bundle), bytes: built.outputFiles[0].contents.length,
      gzipBytes: gzipSync(built.outputFiles[0].contents, { level: 9 }).length, helperBytes, exitCode: child.status, signal: child.signal,
      stdoutSha256: sha(bundle + '.stdout'), stderrSha256: sha(bundle + '.stderr') };
    save(bundle + '.receipt.json', record); records.push(record);
    assert.equal(child.status, 0, `Behavior failure: ${bundle}`);
    bundles[arm][scenario] = JSON.parse(child.stdout);
  }
}
for (const scenario of ['crud', 'queries']) assert.deepEqual(bundles.split[scenario], bundles.baseline[scenario], `Equivalent ${scenario} behavior and public property shape`);
verify(bindings);
save(join(output, 'result.json'), { passed: true, command: process.argv, bindings, transformationSha256: sha(join(output, 'transformation.json')), splitInventory: inventory(root), records,
  sameObservableWork: true, limits: 'The specific has/where/find extraction preserves the full API. Positive helper bytes in the CRUD fixture show splitting these method files did not exclude their implementation. Other decompositions are not ruled out.' });
console.log(JSON.stringify(records));
