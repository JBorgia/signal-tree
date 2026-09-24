// Independent scalar checkpoint/journal control. Structural operations are
// deliberately unsupported, NOT silently approximated as object snapshots.
const clone=x=>structuredClone(x),key=path=>JSON.stringify(path);
const ok=()=>({status:'settled'});
const unsupported=message=>{throw Object.assign(new Error(message),{name:'Unsupported'});};
export function create({profile='live',diagnostics=false,seed}={}){
 if(profile!=='live')unsupported('Replay control implements shared live scalar state only');
 const initial=seed??{values:['x','y','z'].map(k=>({path:[k],value:0})),entities:[{ref:'original',key:'A',fields:{name:'Original',priority:0}}]};
 let checkpoint=new Map(initial.values.map(v=>[key(v.path),clone(v)]));
 let journal=[],sequence=0,revision=-Infinity,dead=false;
 const pending=new Set(),handles=new WeakSet(),observers=new Set(),links=new Set(),queue=[],undo=[],history=[];
 const check=ops=>{if(dead)throw Error('Destroyed');for(const o of ops)if(o.kind!=='set')unsupported('Replay control supports scalar assignments only');};
 const resolve=(all)=>{const m=new Map(checkpoint);for(const e of journal)if(e.status==='accepted'||all&&e.status==='pending')for(const op of e.ops)m.set(key(op.path),{path:clone(op.path),value:clone(op.value)});return m;};
 const snapshot=m=>({values:[...m.values()].map(clone),entities:clone(initial.entities)});
 const read=()=>snapshot(resolve(true)),canonical=()=>snapshot(resolve(false));
 const asJson=s=>JSON.stringify(s);
 const value=(m,path)=>m.get(key(path))?.value;
 function publish(before,canonicalBefore){const after=read(),committed=resolve(false);if(asJson(before)!==asJson(after))for(const cb of [...observers])cb(clone(after));for(const l of [...links])if(!Object.is(value(canonicalBefore,l.path),value(committed,l.path)))l.cb(clone(value(committed,l.path)));}
 function compact(){if(!pending.size){checkpoint=resolve(false);journal=[];}}
 function capture(){return {before:read(),canonicalBefore:resolve(false)};}
 function finish(c){compact();publish(c.before,c.canonicalBefore);}
 function own(id){if(!handles.has(id))throw Error('Unknown handle');}
 function disposition(e,status){const committed=resolve(false);return e.ops.map(o=>status==='rejected'?'rejected':Object.is(value(committed,o.path),o.value)?'committed':'superseded');}
 function terminalize(e,status){e.status=status;e.dispositions=disposition(e,status);pending.delete(e);if(diagnostics){history.push({sequence:e.seq,status});if(history.length>100)history.shift();}}
 function settle(id,status){own(id);if(id.status!=='pending')return {status:'already-settled'};const c=capture();terminalize(id,status);journal=journal.filter(e=>e.status!=='rejected');finish(c);return ok();}
 const api={
  begin(ops){check(ops);const c=capture();const id={seq:++sequence,ops:clone(ops),status:'pending'};handles.add(id);pending.add(id);journal.push(id);publish(c.before,c.canonicalBefore);return id;},
  accept:id=>settle(id,'accepted'),reject:id=>settle(id,'rejected'),read,canonical,
  state(id){own(id);return {status:id.status,authority:id.status==='pending',dispositions:id.status==='pending'?id.ops.map(()=> 'pending'):[...id.dispositions]};},
  write(ops,{context='local',defer=false}={}){check(ops);if(defer){queue.push({ops:clone(ops),context});return ok();}if(context==='external')return api.authority({ops,order:{kind:'snapshot'}});
    const c=capture();if(context==='undoable')undo.push({ops:ops.map(o=>({kind:'set',path:clone(o.path),value:clone(value(c.canonicalBefore,o.path))}))});
    journal.push({seq:++sequence,ops:clone(ops),status:'accepted'});finish(c);return ok();},
  flush(){for(const q of queue.splice(0))api.write(q.ops,{context:q.context});},
  authority({ops=[],order,settlements=[]}){check(ops);if(order.kind==='unordered')return {status:'refused',reason:'unordered truth'};
    for(const s of settlements)own(s.id);
    const c=capture(),fresh=order.kind!=='versioned'||order.revision>revision;
    if(order.kind==='versioned'&&fresh)revision=order.revision;
    if(fresh){const locations=new Set(ops.map(o=>key(o.path)));for(const e of journal)if(e.status==='accepted')e.ops=e.ops.filter(o=>!locations.has(key(o.path)));for(const o of ops)checkpoint.set(key(o.path),{path:clone(o.path),value:clone(o.value)});}
    for(const s of settlements){if(s.id.status!=='pending')continue;
      if(s.kind==='rejects')terminalize(s.id,'rejected');
      else if(ops.length){terminalize(s.id,'accepted');s.id.dispositions=s.id.ops.map(()=> 'superseded');journal=journal.filter(e=>e!==s.id);}
      else terminalize(s.id,'accepted');
    }
    journal=journal.filter(e=>e.status!=='rejected');finish(c);return ok();},
  observe(cb){observers.add(cb);return()=>observers.delete(cb);},
  link(path,cb){const l={path:clone(path),cb};links.add(l);return()=>links.delete(l);},
  undo(){const entry=undo.pop();if(!entry)return {status:'refused',reason:'no undoable work'};return api.write(entry.ops,{context:'local'});},
  draft(){unsupported('No isolated draft view');},
  stats(){return {active:pending.size,retainedOperations:journal.reduce((n,e)=>n+e.ops.length,0),history:history.length};},
  destroy(){if(dead)return;dead=true;pending.clear();journal=[];queue.length=0;undo.length=0;history.length=0;observers.clear();links.clear();checkpoint.clear();},
 };
 return api;
}
