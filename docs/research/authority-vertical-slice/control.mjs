// Exact repaired incumbent, real public semantics plus existing read-only SDK seams.
import { pathToFileURL } from 'node:url';
const repo=process.env.SIGNAL_TREE_CONTROL_REPO??'/private/tmp/st-sparse-integration-baseline-8d220643';
globalThis.ngDevMode=false;
const kernel=await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/index.js`));
const sdk=await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/adapter.js`));
const internal=await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/internals.js`));
export class Unsupported extends Error { constructor(message){super(message);this.code='UNSUPPORTED';} }
export function createStore(){
 const tree=kernel.signalTree({cells:{x:undefined,y:undefined,u:undefined,branch:{member:undefined}},rows:kernel.entityMap({selectId:r=>r.key})},{enhancers:[kernel.transactions(),kernel.restoration({maxHistorySize:1})]});
 tree.$.cells({});
 const lifecycle=internal.transactionLifecycleReader(tree);
 if(!lifecycle)throw new Unsupported('Existing transaction lifecycle reader unavailable');
 let destroyed=false, nextId=1;const refs=new WeakMap(),errors=[],stops=new Set();
 const live=()=>{if(destroyed)throw new Error('Store destroyed');};
 const payload=row=>{if(row===undefined)return undefined;const {key,...record}=row;return record;};
 const nativeRow=(key,record)=>{if(Object.hasOwn(record,'key'))throw new Unsupported('Entity payload key is reserved by control schema');return Object.defineProperties({key},Object.getOwnPropertyDescriptors(record));};
 const wrap=n=>{if(!n)return undefined;let ref=refs.get(n);if(ref)return ref;const id=nextId++;ref={id,read(){live();return payload(n());},write(record){live();const row=n();if(!row)throw new Error('Retired reference');tree.$.rows.replaceOne(row.key,nativeRow(row.key,record));}};refs.set(n,ref);return ref;};
 const readCells=()=>Object.fromEntries(Object.keys(tree.$.cells).map(key=>[key,tree.$.cells[key]()]));
 const store={
 supportsFault:false,
 write(key,value){live();if(!['x','y','branch','u'].includes(key))throw new Unsupported(`Cell schema not seeded: ${key}`);const cells=readCells();if(Object.hasOwn(cells,key)&&typeof tree.$.cells[key]==='function')tree.$.cells[key](value);else tree.$.cells({...cells,[key]:value});},
 remove(key){live();const cells=readCells();if(!Object.hasOwn(cells,key))return;delete cells[key];tree.$.cells(cells);},
 read(key){live();const cells=readCells();return Object.hasOwn(cells,key)?{present:true,value:cells[key]}:{present:false};},
 snapshot(){live();return {cells:readCells(),entities:tree.$.rows.all().map(row=>({key:row.key,id:wrap(tree.$.rows.byId(row.key)).id,value:payload(row)}))};},
 begin(fn){live();const before=new Set(lifecycle.snapshot().pending.map(p=>p.transactionId));const raw=tree.transact(fn);const id=lifecycle.snapshot().pending.find(p=>!before.has(p.transactionId))?.transactionId;let terminal,attempt;
 const pending=()=>id!==undefined&&lifecycle.snapshot().pending.some(p=>p.transactionId===id);
 const state=()=>{live();return terminal??(!pending()&&attempt?attempt:'pending');};
 const settle=(kind)=>{live();if(terminal)return;attempt=kind;try{kind==='accepted'?raw.confirm():raw.rollback();terminal=kind;}catch(e){if(!pending())terminal=kind;throw e;}finally{attempt=undefined;}};
 return {accept:()=>settle('accepted'),reject:()=>settle('rejected'),state};},
 undoable(fn){live();return kernel.undoable(fn);}, undo(){live();tree.undo();},
 add(key,record){live();if(tree.$.rows.byId(key))throw new Error('Duplicate live key');tree.$.rows.addOne(nativeRow(key,record));return wrap(tree.$.rows.byIdOrFail(key));},
 removeEntity(key){live();tree.$.rows.removeOne(key);},get(key){live();return wrap(tree.$.rows.byId(key));},
 observe(fn){live();const off=sdk.observeOwnerInvalidation(tree,()=>{try{fn();}catch(e){errors.push(e);}});stops.add(off);return ()=>{off();stops.delete(off);};},
 async flush(){await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));},takeErrors(){return errors.splice(0);},
 failNextPreparation(){throw new Unsupported('No single existing incumbent preparation-fault seam covers both ordinary writes and settlement with identical error identity');},
 stats(){throw new Unsupported('Incumbent engine operation/allocation counters unavailable');},resetStats(){throw new Unsupported('Incumbent engine operation/allocation counters unavailable');},
 destroy(){if(destroyed)return;for(const off of stops)off();stops.clear();tree.destroy();destroyed=true;errors.length=0;}
 };return store;
}
