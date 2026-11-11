#!/usr/bin/env node
// Source-work diagnostic only. Instrumented code is never a release artifact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [baselineInput, variantInput, outputInput] = process.argv.slice(2);
assert.ok(
  baselineInput && variantInput && outputInput,
  'Pass BASELINE_CHECKOUT VARIANT_CHECKOUT NEW_OUTPUT'
);
const baseline = resolve(baselineInput),
  variant = resolve(variantInput),
  output = resolve(outputInput);
assert.ok(!existsSync(output), 'Preserve previous attempts');
mkdirSync(output, { recursive: true });
const require = createRequire(join(variant, 'package.json'));
const { build, version } = require('esbuild');
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const results = [];
const bindings = {};
for (const [arm, root] of [
  ['baseline', baseline],
  ['indexed', variant],
]) {
  const source = join(
    root,
    'packages/kernel/src/lib/internals/entity-egress-projection.ts'
  );
  const entry = join(output, arm + '.entry.mjs');
  writeFileSync(
    entry,
    `
import assert from 'node:assert/strict';
import {createEntityEgressProjection} from ${JSON.stringify(source)};
export function run(count) {
 const fact=Object.freeze({fact:true});
 const evidence={member:()=>fact,field:()=>fact,placement:()=>fact,keyMapping:()=>fact};
 const projection=createEntityEgressProjection([]);
 const rows=Array.from({length:count},(_,i)=>Object.fromEntries([['id',i],...Array.from({length:8},(_,f)=>['v'+f,i*10+f])]));
 globalThis.__egressCount={calls:0,visits:0,indexBuildVisits:0};
 for(let i=0;i<count;i++)projection.apply(i,rows[i],{kind:'add',subject:i,key:i,value:rows[i]},false,null,false,evidence);
 const population={...globalThis.__egressCount};
 assert.deepEqual(projection.value(),rows);
 assert.equal(projection.support().size,count*11);
 globalThis.__egressCount={calls:0,visits:0,indexBuildVisits:0};
 for(let i=0;i<count/2;i++)projection.apply(i,undefined,{kind:'remove',subject:i,key:i,value:rows[i]},false,null,false,evidence);
 const removal={...globalThis.__egressCount};
 assert.deepEqual(projection.value(),rows.slice(count/2));
 assert.equal(projection.support().size,count*6);
 for(let i=0;i<count/2;i++){assert.equal(projection.support().get(i+':m'),fact);assert.equal(projection.support().has(i+':f:v0'),false);}
 const seeded=createEntityEgressProjection(rows.map((row,subjectId)=>({row,subjectId,key:subjectId})),undefined,evidence);
 globalThis.__egressCount={calls:0,visits:0,indexBuildVisits:0};
 for(let i=0;i<2;i++)seeded.apply(i,undefined,{kind:'remove',subject:i,key:i,value:rows[i]},false,null,false,evidence);
 const seededRemoval={...globalThis.__egressCount};
 assert.deepEqual(seeded.value(),rows.slice(2));
 assert.equal(seeded.support().size,count*11-20);
 return {count,population,removal,seededRemoval,passed:true};
}
`,
    { flag: 'wx' }
  );
  let instrumented = 0;
  let lazyIndex = false;
  const bundled = join(output, arm + '.instrumented.mjs');
  const result = await build({
    entryPoints: [entry],
    outfile: bundled,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    metafile: true,
    logLevel: 'silent',
    plugins: [
      {
        name: 'count-exact-support-removal',
        setup(build) {
          build.onLoad(
            { filter: /entity-(?:egress-projection|contributor-map)\.ts$/ },
            (args) => {
              let contents = readFileSync(args.path, 'utf8');
              bindings[args.path] = sha(args.path);
              if (
                arm === 'baseline' &&
                args.path.endsWith('entity-egress-projection.ts')
              ) {
                const before =
                  'const removeSupport=(subject:number)=>{for(const key of [...contributors.keys()])if(key.startsWith(`${subject}:`))contributors.delete(key);};';
                assert.ok(
                  contents.includes(before),
                  'Baseline counter seam drifted'
                );
                contents = contents.replace(
                  before,
                  'const removeSupport=(subject:number)=>{globalThis.__egressCount.calls++;for(const key of [...contributors.keys()]){globalThis.__egressCount.visits++;if(key.startsWith(`${subject}:`))contributors.delete(key);}};'
                );
                instrumented++;
              } else if (
                arm === 'indexed' &&
                args.path.endsWith('entity-contributor-map.ts')
              ) {
                assert.ok(
                  contents.includes('deleteSubject(subject: number): void {')
                );
                assert.ok(
                  contents.includes(
                    'for (const key of keys) super.delete(key);'
                  )
                );
                contents = contents
                  .replace(
                    'deleteSubject(subject: number): void {',
                    'deleteSubject(subject: number): void { globalThis.__egressCount.calls++;'
                  )
                  .replace(
                    'for (const key of keys) super.delete(key);',
                    'for (const key of keys) {globalThis.__egressCount.visits++;super.delete(key);}'
                  );
                lazyIndex = contents.includes(
                  'for (const key of this.keys()) {'
                );
                if (lazyIndex)
                  contents = contents.replace(
                    'for (const key of this.keys()) {',
                    'for (const key of this.keys()) { globalThis.__egressCount.indexBuildVisits++;'
                  );
                instrumented++;
              }
              return { contents, loader: 'ts' };
            }
          );
        },
      },
    ],
  });
  assert.equal(instrumented, 1);
  const { run } = await import(pathToFileURL(bundled).href);
  for (const count of [200, 400]) {
    const result = run(count);
    assert.equal(result.population.calls, count);
    assert.equal(
      result.population.visits,
      arm === 'baseline' ? (11 * count * (count - 1)) / 2 : 0
    );
    assert.equal(result.removal.calls, count / 2);
    assert.equal(
      result.removal.visits,
      arm === 'baseline'
        ? 11 * count * (count / 2) - (10 * (count / 2) * (count / 2 - 1)) / 2
        : (11 * count) / 2
    );
    assert.equal(result.population.indexBuildVisits, 0);
    assert.equal(result.removal.indexBuildVisits, 0);
    assert.equal(result.seededRemoval.calls, 2);
    assert.equal(
      result.seededRemoval.visits,
      arm === 'baseline' ? 22 * count - 10 : 22
    );
    assert.equal(
      result.seededRemoval.indexBuildVisits,
      lazyIndex ? 11 * count : 0
    );
    results.push({ arm, lazyIndex, ...result, bundleSha256: sha(bundled) });
  }
  writeFileSync(
    join(output, arm + '.metafile.json'),
    JSON.stringify(result.metafile, null, 2) + '\n',
    { flag: 'wx' }
  );
}
const report = {
  passed: true,
  createdUTC: new Date().toISOString(),
  command: [process.execPath, ...process.argv.slice(1)],
  runnerSha256: sha(process.argv[1]),
  node: process.version,
  esbuild: version,
  bindings,
  results,
  limits:
    'Counts only visits in removeSupport/deleteSubject under source instrumentation; not CPU timing, heap, whole mutation work, framework behavior or release validation. Same flat support keys, values, row order and negative membership asserted.',
};
writeFileSync(
  join(output, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
  { flag: 'wx' }
);
console.log(JSON.stringify(report, null, 2));
