// Deliberate semantic faults. These mutate behavior at the experiment boundary,
// not production source. A kill proves the corresponding assertion is sensitive;
// it does not prove a production seam is covered or a memory leak is detected.
export const mutationIds=Array.from({length:30},(_,i)=>`M${String(i+1).padStart(2,'0')}`);
const clone=x=>structuredClone(x);
export function mutateFactory(create,mutation){return async options=>{
  const raw=await create(options),records=new Map(),released=new Set(),poisoned=new Set(),rejected=[],queued=[];
  let latest;let terminalCount=0;
  const mapOps=ops=>ops.map(o=>{
    o=clone(o);
    if(mutation==='M05'&&'key'in o)o.key=String(o.key);
    if(mutation==='M24'&&o.path)o.path=[o.path.map(String).join('.')];
    return o;
  });
  const active=()=>[...records].filter(([id])=>{try{return raw.state(id).authority;}catch{return !released.has(id);}});
  const restore=(r)=>raw.write(r.before.values.map(v=>({kind:'set',path:v.path,value:v.value})),{context:'local'});
  const base={
    begin(ops){const before=raw.read(),id=raw.begin(mapOps(ops));records.set(id,{ops:clone(ops),before});latest=id;return id;},
    accept(id){const r=records.get(id);let result=raw.accept(id);
      if(result.status==='settled'){terminalCount++;released.add(id);}
      if(['M04','M11'].includes(mutation)&&r&&result.status==='settled')raw.write(r.ops,{context:'local'});
      if(mutation==='M12'&&result.status==='settled'){const older=active().find(([other])=>other!==id);if(older)raw.write(older[1].ops,{context:'local'});}
      return result;},
    reject(id){const r=records.get(id);
      if(mutation==='M15'&&r?.ops.some(o=>o.kind==='rekey'))return {status:'refused',reason:'same subject presence'};
      if(mutation==='M07'&&r?.ops.some(o=>o.kind==='remove')){raw.write([{kind:'set',path:['x'],value:0}],{context:'local'});return {status:'refused'};}
      let result=raw.reject(id);
      if(result.status==='settled'){terminalCount++;released.add(id);rejected.push(r);}
      if(['M01','M03'].includes(mutation)&&result.status==='settled'&&r)restore(r);
      if(mutation==='M09'&&id===latest&&result.status==='settled'&&rejected.length>1){const previous=rejected.at(-2);raw.write(previous.ops.filter(o=>o.kind==='set'),{context:'local'});}
      if(['M02','M20'].includes(mutation)&&result.status==='refused'){poisoned.add(id);if(mutation==='M20')return {status:'settled'};}
      if(['M10','M14'].includes(mutation)&&result.status==='refused'&&r?.ops.some(o=>o.kind==='add')){
        raw.write(r.ops.filter(o=>o.kind==='add').map(o=>({kind:'remove',ref:o.ref})),{context:'local'});poisoned.add(id);return {status:'settled'};}
      if(mutation==='M19'&&result.status==='already-settled'&&r)raw.write(r.ops.filter(o=>o.kind==='set'),{context:'local'});
      if(mutation==='M27'&&!options.diagnostics&&result.status==='settled'&&r)raw.write(r.ops.filter(o=>o.kind==='set'),{context:'local'});
      return result;},
    state(id){const s=raw.state(id);if(['M02','M20','M10','M14'].includes(mutation)&&poisoned.has(id))return {...s,status:'rejected',authority:false};if(mutation==='M13'&&s.status!=='pending')return {...s,dispositions:s.dispositions.map((d,i)=>i===0?undefined:d)};return s;},
    write(ops,opts={}){
      if(mutation==='M26'&&opts.defer){queued.push(mapOps(ops));return {status:'unsupported',reason:'unsupported but accidentally scheduled'};}
      if(['M08','M25'].includes(mutation)&&opts.defer)opts={...opts,context:'local'};
      if(mutation==='M16'&&opts.context==='local')return raw.authority({ops:mapOps(ops),order:{kind:'snapshot'}});
      if(mutation==='M06'){
        const now=raw.read();ops=ops.map(o=>{if(o.kind!=='field')return o;const missing=!now.entities.some(e=>e.ref===o.ref);return missing&&now.entities.length?{...o,ref:now.entities.at(-1).ref}:o;});
      }
      return raw.write(mapOps(ops),opts);},
    flush(){for(const ops of queued.splice(0))raw.write(ops,{context:'local'});return raw.flush();},
    authority(e){e={...e,ops:mapOps(e.ops??[])};
      if(mutation==='M17'&&e.order.kind==='versioned')e.order={kind:'snapshot'};
      if(mutation==='M21'&&e.order.kind==='unordered')e.order={kind:'snapshot'};
      if(mutation==='M28'&&e.order.kind==='snapshot')return {status:'refused',reason:'no revision'};
      if(mutation==='M29'&&e.order.kind==='snapshot')e.settlements=active().map(([id])=>({kind:'accepts',id}));
      if(mutation==='M30')e.settlements=(e.settlements??[]).filter(r=>r.kind!=='accepts');
      return raw.authority(e);},
    observe(cb){return raw.observe(s=>{if(mutation==='M18'&&s.values.length>1){const half=clone(s);half.values[0].value=999999;cb(half);}cb(s);});},
    link(path,cb){return raw.link(path,v=>{if(mutation==='M23'&&active().length)return;cb(v);});},
    stats(){const s=raw.stats();return mutation==='M22'?{...s,active:s.active+terminalCount,retainedOperations:s.retainedOperations+terminalCount}:s;},
  };
  return new Proxy(raw,{get(target,key){return key in base?base[key]:typeof target[key]==='function'?target[key].bind(target):target[key];}});
};}
