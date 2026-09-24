import assert from 'node:assert/strict';
export { assert };
export const set = (key, value) => ({kind:'set',path:Array.isArray(key)?key:[key],value});
export const value = (snapshot, path) => snapshot.values.find(v => JSON.stringify(v.path)===JSON.stringify(Array.isArray(path)?path:[path]))?.value;
export const entity = (snapshot, ref) => snapshot.entities.find(e=>e.ref===ref);
export const snap = snapshot => JSON.stringify({values:[...snapshot.values].sort((a,b)=>JSON.stringify(a.path).localeCompare(JSON.stringify(b.path))),entities:[...snapshot.entities].sort((a,b)=>a.ref.localeCompare(b.ref))});
export const settled = result => assert.equal(result.status,'settled');
export const pending = (c,id) => {assert.equal(c.state(id).status,'pending');assert.equal(c.state(id).authority,true);};
export const terminal = (c,id,status) => {const s=c.state(id);assert.equal(s.status,status);assert.equal(s.authority,false);assert.ok(s.dispositions.length>0);assert.ok(s.dispositions.every(d=>['committed','superseded','rejected'].includes(d)));};
export function refusalUnchanged(c,id,action) {const before=snap(c.read()), canonical=snap(c.canonical()), events=[];const off=c.observe(s=>events.push(s));try{assert.equal(action().status,'refused');assert.equal(snap(c.read()),before);assert.equal(snap(c.canonical()),canonical);pending(c,id);assert.deepEqual(events,[]);}finally{off();}}
export function permutations(xs){return xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(p=>[x,...p])):[[]];}
