const early=await import('./split/early.mjs');
const before=JSON.stringify(early.pending.inspect());
if(early.row.x()!==7)throw Error('early pending7');
const late=await import('./split/late.mjs');const sent=[];
const c=late.link(early.tree.$.rows,{set:v=>sent.push(JSON.parse(JSON.stringify(v)))});
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
try{
 await flush();if(sent.length)throw Error('premature send');
 if(JSON.stringify(early.pending.inspect())!==before)throw Error('pending changed');
 early.pending.rollback();await flush();
 if(JSON.stringify(sent)!==JSON.stringify([[{id:'r',x:0}]]))throw Error('useful rollback');
 let done=false;const p=c.settled().then(()=>{done=true;});await flush();if(!done)throw Error('unsettled');await p;
 console.log(JSON.stringify({passed:true,actualDynamicImport:true,firstRegistrationLate:false,reason:'factory retained in early shared chunk',sent}));
}finally{c.dispose();early.tree.destroy();}
