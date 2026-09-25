// Reproduce against the INSTALLED npm package, public/supported entry points only.
import { signalTree, transactions, link } from '@signal-tree/kernel';
import { observeWrites } from '@signal-tree/kernel/internals';
const tick=()=>new Promise(r=>setTimeout(r,5));
const tx=(t,fn)=>(t.transact??t.transaction).call(t,fn);

{ // DEFECT 1
  const t=signalTree({x:0,z:0},{enhancers:[transactions()]});
  const sent=[]; const l=link(t.$.x,{set:v=>sent.push(v)});
  await tick(); sent.length=0;
  const p1=tx(t,()=>t.$.x(1)); await tick();
  const p2=tx(t,()=>{ t.$.z(9); t.$.x(5); }); await tick();
  p1.confirm(); await tick();
  p2.rollback(); await tick(); await tick();
  const settled=await Promise.race([l.settled().then(()=>true,()=>true),new Promise(r=>setTimeout(()=>r(false),200))]);
  console.log(`INSTALLED D1: endpoint=${JSON.stringify(sent)} tree x=${t.$.x()} linkSettled=${settled} -> ${sent.at(-1)!==t.$.x()?'DEFECT':'ok'}`);
  l.dispose(); t.destroy();
}
{ // DEFECT 2
  const t=signalTree({x:0,y:0},{enhancers:[transactions()]});
  const sent=[]; const l=link(t.$.y,{set:v=>sent.push(v)});
  await tick(); sent.length=0;
  let armed=true;
  const off=observeWrites(()=>{ if(armed){ armed=false; throw new Error('boom'); } });
  let h, threw=false; try{ h=tx(t,()=>t.$.x(1)); }catch{ threw=true; }
  off?.(); await tick();
  t.$.y(7); await tick(); await tick();
  console.log(`INSTALLED D2: transactThrew=${threw} handle=${!!h} x=${t.$.x()} laterLinkSent=${JSON.stringify(sent)} -> ${threw&&!sent.includes(7)?'DEFECT':'ok'}`);
  l.dispose(); t.destroy();
}
