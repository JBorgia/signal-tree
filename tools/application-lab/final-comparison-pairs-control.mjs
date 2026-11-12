#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const[aArg,bArg,cohortArg,analysisArg,outArg]=process.argv.slice(2);assert(aArg&&bArg&&cohortArg&&analysisArg&&outArg);
const a=resolve(aArg),b=resolve(bArg),cohort=resolve(cohortArg),out=resolve(outArg),self=fileURLToPath(import.meta.url),analyzer=join(dirname(self),'final-comparison-pairs.mjs');assert(!existsSync(out));
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const ap=join(a,'plan.json'),bp=join(b,'plan.json');assert.notEqual(sha(ap),sha(bp),'Two distinct valid packet plans required');const bindings={[self]:sha(self),[analyzer]:sha(analyzer),[ap]:sha(ap),[bp]:sha(bp)};
for(const root of [a,b]){const plan=read(join(root,'plan.json'));for(const[p,h]of Object.entries(plan.inputs)){assert.equal(sha(p),h);if(bindings[p])assert.equal(bindings[p],h);bindings[p]=h;}}
const aggregate=read(join(cohort,'results.json'));assert.equal(aggregate.bindings[ap],sha(ap),'Control source cohort must actually bind packetA');assert.notEqual(aggregate.bindings[bp],sha(bp));
mkdirSync(out,{recursive:true});const command=[analyzer,'inventory',b,cohort,join(out,'must-not-exist.json'),resolve(analysisArg)];
const run=spawnSync(process.execPath,command,{encoding:'utf8',env:{...process.env,NODE_ENV:'production'}});writeFileSync(join(out,'control.log'),(run.stdout??'')+(run.stderr??''),{flag:'wx'});
assert.equal(run.status,1);assert.match(run.stderr,/Cohort does not bind supplied packet plan/);assert(!existsSync(join(out,'must-not-exist.json')));for(const[p,h]of Object.entries(bindings))assert.equal(sha(p),h);
writeFileSync(join(out,'receipt.json'),JSON.stringify({passed:true,expectedFailure:'Different valid packet cannot relabel the cohort',command:[process.execPath,...command],status:run.status,bindings,logSha256:sha(join(out,'control.log'))},null,2)+'\n',{flag:'wx'});
