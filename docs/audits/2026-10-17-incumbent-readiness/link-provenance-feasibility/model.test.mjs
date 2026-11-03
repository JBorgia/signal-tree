import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PublicationModel as Model, UNKNOWN } from './model.mjs';
const setup = () => {
  const m = new Model(), p = m.token();
  const x = m.input(() => m.write('x', 7, p));
  return {m,p,x};
};
test('direct fresh independent input progresses while x is pending (explicit boundary)', () => {
  const {m} = setup(); m.input(() => m.write('y', 2));
  const sent=[]; assert.equal(m.send('y',()=>{},v=>sent.push(v)),true);
  assert.deepEqual(sent,[2]); assert.equal(m.eligible('x'),false);
});
test('argument-only synchronous copy held without getter', () => {
  const {m,x} = setup(); m.deliver(x,v=>m.write('y',v));
  assert.equal(m.values.get('y').value,7); assert.equal(m.eligible('y'),false);
});
test('multi-hop retains token and useful confirmation releases final value', () => {
  const {m,p,x} = setup(); m.deliver(x,v=>m.write('y',v));
  m.deliver(m.values.get('y'),v=>m.write('z',v+1));
  assert.equal(m.eligible('z'),false); m.settle(p,'confirmed');
  const sent=[]; assert.equal(m.send('z',()=>{},v=>sent.push(v)),true); assert.deepEqual(sent,[8]);
});
test('tracked getter supplies dependency without notification frame', () => {
  const {m} = setup();m.input(()=>m.write('y',m.read('x')+3));
  assert.equal(m.values.get('y').value,10);assert.equal(m.eligible('y'),false);
});
test('overwrite replaces only authored location dependencies', () => {
  const {m,x} = setup();m.deliver(x,v=>{m.write('y',v);m.write('z',v);});
  m.input(()=>m.write('y',2));assert.equal(m.eligible('y'),true);assert.equal(m.eligible('z'),false);
});
test('equal-value overwrite still replaces provenance', () => {
  const {m,x} = setup();m.deliver(x,v=>m.write('y',v));const old=m.values.get('y').revision;
  m.input(()=>m.write('y',7));assert.equal(m.eligible('y'),true);assert.ok(m.values.get('y').revision>old);
});
test('constant after dependent read in same execution conservatively held', () => {
  const {m} = setup();m.input(()=>{m.read('x');m.write('y',42);});assert.equal(m.eligible('y'),false);
});
test('rejection cannot cleanse a surviving speculative copy', () => {
  const {m,p,x} = setup();m.deliver(x,v=>m.write('y',v));m.settle(p,'rejected');
  assert.equal(m.eligible('y'),false);m.input(()=>m.write('y',0));assert.equal(m.eligible('y'),true);
});
test('nested delivery and settlement retain other pending token; stable retry', () => {
  const {m,p,x} = setup(); const q=m.token();const b=m.input(()=>m.write('b',3,q));
  m.deliver(x,()=>{m.deliver(b,()=>m.write('nested',9));m.write('outer',4);});
  m.input(()=>{m.read('x');m.read('b');m.write('both',10);});
  m.settle(p,'confirmed');m.settle(p,'confirmed');assert.equal(m.eligible('outer'),true);
  assert.equal(m.eligible('both'),false);assert.equal(m.eligible('nested'),false);
  m.settle(q,'confirmed');assert.equal(m.eligible('both'),true);
});
test('throw restores frame and retains installed write responsibility', () => {
  const {m,x} = setup();const error=new Error('observer');
  assert.throws(()=>m.deliver(x,v=>{m.write('y',v);throw error;}),e=>e===error);
  assert.equal(m.frames.length,0);assert.equal(m.eligible('y'),false);
  m.input(()=>m.write('z',4));assert.equal(m.eligible('z'),true);
});
test('queued old revision carries dependency after source overwritten', () => {
  const {m,x} = setup();m.enqueue(x,v=>m.write('y',v));m.input(()=>m.write('x',0));
  m.flushOne();assert.equal(m.eligible('x'),true);assert.equal(m.values.get('y').value,7);
  assert.equal(m.eligible('y'),false);
});
test('endpoint rechecks reentrant payload before publication', () => {
  const {m,x} = setup();m.input(()=>m.write('y',2));const sent=[];
  assert.equal(m.send('y',()=>m.deliver(x,v=>m.write('y',v)),v=>sent.push(v)),false);
  assert.deepEqual(sent,[]);
});
test('unknown callbacks remain unknown after all transaction settlement', () => {
  const {m,p} = setup();m.unknown(()=>m.write('y',7));m.settle(p,'confirmed');
  assert.equal(m.eligible('y'),false);assert.ok(m.values.get('y').dependencies.has(UNKNOWN));
});
test('diagnostic roots release after overwrite, queue drain and destruction', () => {
  const {m,p,x} = setup();m.enqueue(x,v=>m.write('y',v));m.input(()=>m.write('x',0));
  assert.ok(m.reachableObligations().has(p));m.flushOne();assert.ok(m.reachableObligations().has(p));
  m.input(()=>m.write('y',0));assert.equal(m.reachableObligations().size,0);
  m.unknown(()=>m.write('z',7));m.destroy();assert.equal(m.reachableObligations().size,0);
});
test('unscoped policies cannot satisfy both async safety and direct progress', () => {
  for(const policy of ['clean','unknown']) {
    const {m}=setup();const invoke=fn=>policy==='clean'?m.input(fn):fn();
    // Runtime sees the same unscoped write whether 7 came from a closure or input.
    invoke(()=>m.write('direct',7));invoke(()=>m.write('copy',7));
    assert.equal(m.eligible('direct'),policy==='clean');
    assert.equal(m.eligible('copy'),policy==='clean');
    assert.equal(m.eligible('direct')&&!m.eligible('copy'),false);
  }
});
test('review: nested callback cannot launder outer argument', () => {
  const {m,p,x}=setup();const q=m.token();const b=m.input(()=>m.write('b',3,q));
  m.deliver(x,v=>m.deliver(b,()=>m.write('y',v)));
  m.settle(q,'confirmed');assert.equal(p.state,'pending');assert.equal(m.eligible('y'),false);
});
test('review: returned nested callback value retains dependency in caller', () => {
  const {m,x}=setup();const clean=m.input(()=>m.write('clean',0));
  m.deliver(clean,()=>{const v=m.deliver(x,v=>v);m.write('y',v);});
  assert.equal(m.eligible('y'),false);
});
test('review: nested callback captured local retains dependency in caller', () => {
  const {m,x}=setup();const clean=m.input(()=>m.write('clean',0));
  m.deliver(clean,()=>{let value;m.deliver(x,v=>{value=v;});m.write('y',value);});
  assert.equal(m.eligible('y'),false);
});
