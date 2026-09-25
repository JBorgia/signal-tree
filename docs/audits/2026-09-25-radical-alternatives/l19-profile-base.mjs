import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
const K=await import(resolve(tmpdir(),'st-l19-abl0b.mjs'));
const tree=K.signalTree({a:0,b:0,c:0});
for(let i=0;i<20000;i++) tree.$.a(i);
for(let i=0;i<600000;i++) tree.$.a(i);
tree.destroy();
