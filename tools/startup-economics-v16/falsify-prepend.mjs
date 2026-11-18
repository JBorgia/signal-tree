import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [bundle, output, priorRollback = 'yes', seedKind = 'duplicate', mode = 'transaction'] = process.argv.slice(2);
const { signalTree, entityMap, transactions, link } = await import(pathToFileURL(bundle));
const tree = signalTree({ rows: entityMap() }, { enhancers: [transactions()] });
const result = {command:process.argv,runnerSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),bundleSha256:createHash('sha256').update(readFileSync(bundle)).digest('hex'),priorRollback,seedKind,mode,stages:[]};
const sent=[];
let connection;
const flush=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
const record=name=>result.stages.push({name,physical:[...tree.$.rows.ids()],sent:structuredClone(sent)});
try {
  tree.$.rows.setAll(seedKind==='duplicate'?[{id:'a',n:1},{id:'b',n:2},{id:'a',n:3}]:[{id:'a',n:1},{id:'b',n:2}]); record('population');
  connection=link(tree.$.rows,{set:value=>{sent.push(value);}});
  if(priorRollback==='yes') {
    const append=tree.transact(()=>tree.$.rows.addMany([{id:'c',n:4},{id:'d',n:5}])); record('append-pending');
    append.rollback();await flush();await connection.settled();record('append-rollback');
  }
  if(mode==='transaction') {
    const prepend=tree.transact(()=>tree.$.rows.prependMany([{id:'x',n:6},{id:'y',n:7}]));record('prepend-pending');
    prepend.confirm();
  } else tree.$.rows.prependMany([{id:'x',n:6},{id:'y',n:7}]);
  await flush();await connection.settled();record('prepend-completed');
  assert.deepEqual(sent.at(-1)?.map(row=>row.id),['x','y','a','b']);
  result.passed=true;
} catch(error) {result.passed=false;result.error=String(error.stack);process.exitCode=1;}
finally {connection?.dispose();tree.destroy();writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify(result));
