import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [bundle, output] = process.argv.slice(2);
const { signalTree, entityMap, link, transactions } = await import(pathToFileURL(bundle));
const tree = signalTree({ rows: entityMap() }, { enhancers: [transactions()] });
const input = { id: 'a', n: 1, nested: { value: 7 } }, sent = [];
const result = { command: process.argv, runnerSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), bundleSha256:createHash('sha256').update(readFileSync(bundle)).digest('hex') };
const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
let connection;
try {
  tree.$.rows.setAll([input]);
  connection=link(tree.$.rows,{set:value=>{sent.push(value);}});
  tree.$.rows.updateOne('a',{n:2});await flush();await connection.settled();
  const retained=sent.at(-1);
  result.beforeExternalMutation=structuredClone(retained);
  input.nested.value=99;
  result.afterExternalMutation=structuredClone(retained);
  tree.$.rows.updateOne('a',{nested:{value:8}});await flush();await connection.settled();
  result.retainedAfterWrite=structuredClone(retained);result.fresh=structuredClone(sent.at(-1));
} finally {connection?.dispose();tree.destroy();writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify(result));
