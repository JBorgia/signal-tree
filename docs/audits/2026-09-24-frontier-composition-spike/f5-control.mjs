#!/usr/bin/env node
// F5-A CONTROL — current kernel. Link is FULL-VALUE PER SOURCE, so x and y are
// linked as SEPARATE sources; asking one source to emit a partial payload would
// be asking Link to fabricate state.
//
//   P1 pending:  x = 1
//   ordinary:    y = 7
//
//   SAFETY      endpointX must NOT receive speculative x=1
//   CAPABILITY  endpointY SHOULD receive y=7 before P1 settles
//
// If y is withheld, the current hold is broader than necessary and there is a
// real L16 gap for C to close. If y already progresses, C's L16 value at this
// granularity is unproven.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const b = await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
    resolveDir:root,sourcefile:'f5c.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
});
const K = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const flush=async n=>{n.flushSync();for(let i=0;i<12;i++)await Promise.resolve();};
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const n=K.getPathNotifier();
const tree=K.signalTree({x:0,y:0},{enhancers:[K.transactions()]});
const sentX=[], sentY=[];
const lx=K.link(tree.$.x,{set:v=>{sentX.push(v);}});
const ly=K.link(tree.$.y,{set:v=>{sentY.push(v);}});
await flush(n);
sentX.length=0; sentY.length=0;   // ignore any initial sync

// P1 opens a pending contribution on x ONLY.
const p1=tree.transact(()=>tree.$.x(1));
await flush(n);
const xAfterPending=[...sentX], yAfterPending=[...sentY];

// Ordinary, fully settled work on y -- no relation to x.
tree.$.y(7);
await flush(n);
// NOT awaiting settled(): it does not resolve while P1 is pending, which is
// itself the measurement. Delivery is observed through the flushed sink.
const xBeforeSettle=[...sentX], yBeforeSettle=[...sentY];

console.log(`after P1 pending : endpointX=${JSON.stringify(xAfterPending)} endpointY=${JSON.stringify(yAfterPending)}`);
console.log(`after y=7        : endpointX=${JSON.stringify(xBeforeSettle)} endpointY=${JSON.stringify(yBeforeSettle)}`);

check(!xBeforeSettle.includes(1),
  'F5-A SAFETY speculative x=1 is NOT exported while pending',
  `endpointX=${JSON.stringify(xBeforeSettle)}`);
check(yBeforeSettle.includes(7),
  'F5-A CAPABILITY independent y=7 DOES progress before P1 settles',
  `endpointY=${JSON.stringify(yBeforeSettle)}`);

// After settlement, x should be exportable.
p1.confirm(); await flush(n);

check(sentX.includes(1), 'F5-A after confirm, x is exported', `endpointX=${JSON.stringify(sentX)}`);
lx.dispose(); ly.dispose(); tree.destroy();

writeFileSync(resolve(here,'f5-control.json'),JSON.stringify({probe:'F5-A-CONTROL',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
