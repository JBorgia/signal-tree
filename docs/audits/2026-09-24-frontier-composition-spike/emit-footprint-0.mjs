#!/usr/bin/env node
// F5 ABLATION — can dependency-scoped eligibility replace tree-scoped blocking?
//
//   CONTROL    stock hold                          -> x held, y HELD (the gap)
//   CANDIDATE  hold bypassed for eligible sources  -> x held, y DELIVERED
//   DEPENDENT  y derived from x, edge P2->P1       -> y HELD (correctly)
//   MUTANT     same, edge suppressed               -> y delivered (edge proven)
//
// Eligibility is decided ONLY from semantic identity: the claimant IS the
// linked source location, so it is read under capture, its node's bound
// identity is looked up, and that is compared against identities owned by open
// turns. No path comparison, no business key.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const LR='packages/kernel/src/lib/internals/location-runtime.ts';
const ST='packages/kernel/src/lib/signal-tree.ts';
const CC='packages/kernel/src/lib/internals/commit-consequence.ts';
const PT=[`  if (activeConsumer) {`,`    if (activeConsumer.__capture) {`,
`      let e = activeConsumer.dependencies.get(node);`,
`      if (!e) { const r = new WeakRef(activeConsumer); e = { reference: r, version: node.version };`,
`        node.consumers.add(r); activeConsumer.dependencies.set(node, e); } else { e.version = node.version; }`,
`      const outer = activeConsumer; activeConsumer = outer.__outer;`,
`      try { trackDependency(node, token); } finally { activeConsumer = outer; }`,
`      return;`,`    }`].join('\n');
const SEAM=`
const __spikeIdentity = new WeakMap();
export function __spikeCaptureReads(run) {
  const collected = new Map();
  const consumer = { dependencies: collected, level: 0, invalidate() {}, settle() {}, __capture: true, __outer: undefined };
  const previous = activeConsumer; consumer.__outer = previous; activeConsumer = consumer;
  try { run(); } finally { activeConsumer = previous;
    for (const n of collected.keys()) for (const r of n.consumers) if (r.deref() === consumer) n.consumers.delete(r); }
  return [...collected.keys()];
}
export function __spikeIdentityOf(node) { return __spikeIdentity.get(node); }
export function __spikeBindLocation(location, identity) {
  try { const [n] = __spikeCaptureReads(() => location()); if (n) __spikeIdentity.set(n, identity); } catch {}
}`;
const b=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads, __spikeIdentityOf} from './${LR.replace(/\.ts$/,'')}';`,
   resolveDir:root,sourcefile:'emit0.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
  plugins:[{name:'f5',setup(bb){
    bb.onLoad({filter:/location-runtime\.ts$/},({path})=>{ if(relative(root,path)!==LR) return null;
      const s=readFileSync(path,'utf8'); if(!s.includes('  if (activeConsumer) {')) throw new Error('MISS track');
      return {contents:s.replace('  if (activeConsumer) {',PT)+SEAM,loader:'ts',resolveDir:dirname(path)};});
    bb.onLoad({filter:/signal-tree\.ts$/},({path})=>{ if(relative(root,path)!==ST) return null;
      let s=readFileSync(path,'utf8'); const a=`  defineNodeAddress(leaf as object, address);`;
      if(!s.includes(a)) throw new Error('MISS leaf');
      s=s.replace(a,a+`\n  __spikeBindLocation(leaf as never, { kind: 'scalar', positions: [...(positionIds ?? [])] });`);
      return {contents:`import { __spikeBindLocation } from './internals/location-runtime';\n`+s,loader:'ts',resolveDir:dirname(path)};});
    bb.onLoad({filter:/commit-consequence\.ts$/},({path})=>{ if(relative(root,path)!==CC) return null;
      const s=readFileSync(path,'utf8'); const a=`  if (scopeKey && hasOpen(scopeKey)) {`;
      if(!s.includes(a)) throw new Error('MISS hold');
      // ABLATION: tree-scoped blocking, bypassed for sources C deems eligible.
      return {contents:s.replace(a,`  const __elig = (globalThis as never as {__spikeEligible?: (c: unknown) => boolean}).__spikeEligible;\n  if (scopeKey && hasOpen(scopeKey) && !(__elig && __elig(claimant))) {`),loader:'ts',resolveDir:dirname(path)};});
  }}],
});
const K=await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);

const flushNotifier=async n=>{n.flushSync();for(let i=0;i<14;i++)await Promise.resolve();};
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

// ---- OBLIGATION MODEL -------------------------------------------------------
// A Link source is blocked by the LIVE UNRESOLVED OBLIGATIONS its payload
// carries -- not by a boolean flag, and not by which turns happen to be open.
// Obligations are keyed by semantic identity and PROPAGATE through reads, so
// transitivity and multi-blocker fall out instead of being special-cased.
const makeWorld = () => {
  const live = new Set();                    // obligation ids still unresolved
  const carried = new Map();                 // position -> Set<obligationId>
  const of = (pos) => carried.get(pos) ?? new Set();
  return {
    live,
    own(pos, oid) { live.add(oid); const s = of(pos); s.add(oid); carried.set(pos, s); },
    inherit(toPos, fromPositions) {
      const s = of(toPos);
      for (const p of fromPositions) for (const o of of(p)) s.add(o);
      carried.set(toPos, s);
    },
    resolve(oid) { live.delete(oid); },      // terminal: cleared everywhere at once
    blockers(positions) {
      const out = new Set();
      for (const p of positions) for (const o of of(p)) if (live.has(o)) out.add(o);
      return out;
    },
  };
};

const scenario = async (name, body) => {
  const world = makeWorld();
  globalThis.__spikeEligible = (claimant) => {
    try {
      const [node] = K.__spikeCaptureReads(() => claimant());
      const id = K.__spikeIdentityOf(node);
      if (!id || id.kind !== 'scalar') return false;
      return world.blockers(id.positions).size === 0;
    } catch { return false; }
  };
  const n = K.getPathNotifier();
  const tree = K.signalTree({ x:0, y:0, z:0, w:0 }, { enhancers: [K.transactions()] });
  const posOf = (key) => K.__spikeIdentityOf(K.__spikeCaptureReads(() => tree.$[key]())[0])?.positions ?? [];
  const sinks = {};
  const links = {};
  const linkUp = (key) => { sinks[key] = []; links[key] = K.link(tree.$[key], { set: v => sinks[key].push(v) }); };
  const out = await body({ tree, world, n, posOf, sinks, links, linkUp,
    flush: () => flushNotifier(n) });
  for (const l of Object.values(links)) l.dispose();
  tree.destroy(); globalThis.__spikeEligible = undefined;
  return out;
};

// H1 -- removal WITH unrelated open work still in flight.
const h1 = await scenario('H1', async ({ tree, world, posOf, sinks, linkUp, flush }) => {
  linkUp('y'); await flush(); sinks.y.length = 0;
  const xPos = posOf('x'), yPos = posOf('y');
  const p1 = tree.transact(() => { for (const p of xPos) world.own(p, 'O1'); tree.$.x(1); });
  await flush();
  const p2 = tree.transact(() => { tree.$.y(tree.$.x() + 1); world.inherit(yPos[0], xPos); });
  await flush(); p2.confirm(); await flush();
  const p3 = tree.transact(() => { for (const p of posOf('z')) world.own(p, 'O3'); tree.$.z(9); });
  await flush();
  const beforeResolve = [...sinks.y];
  world.resolve('O1'); tree.$.y(701);          // nudge so eligibility is retested
  await flush();
  const afterResolve = [...sinks.y];
  const p3StillOpen = true; try { p3.confirm(); } catch {}
  return { beforeResolve, afterResolve, p3StillOpen };
});

// H2 -- two blockers; resolving one must NOT release.
const h2 = await scenario('H2', async ({ tree, world, posOf, sinks, linkUp, flush }) => {
  linkUp('y'); await flush(); sinks.y.length = 0;
  const xPos = posOf('x'), wPos = posOf('w'), yPos = posOf('y');
  const p1 = tree.transact(() => { for (const p of xPos) world.own(p, 'O1'); tree.$.x(1); });
  const p4 = tree.transact(() => { for (const p of wPos) world.own(p, 'O4'); tree.$.w(2); });
  await flush();
  const p2 = tree.transact(() => { tree.$.y(tree.$.x() + tree.$.w()); world.inherit(yPos[0], [...xPos, ...wPos]); });
  await flush(); p2.confirm(); await flush();
  const both = [...sinks.y];
  world.resolve('O1'); tree.$.y(701); await flush();
  const afterFirst = [...sinks.y];
  world.resolve('O4'); tree.$.y(742); await flush();
  const afterSecond = [...sinks.y];
  try { p1.confirm(); p4.confirm(); } catch {}
  return { both, afterFirst, afterSecond };
});

// T -- transitive inheritance, without retaining the intermediate settled turn.
const t = await scenario('T', async ({ tree, world, posOf, sinks, linkUp, flush }) => {
  linkUp('z'); await flush(); sinks.z.length = 0;
  const xPos = posOf('x'), yPos = posOf('y'), zPos = posOf('z');
  const p1 = tree.transact(() => { for (const p of xPos) world.own(p, 'O1'); tree.$.x(1); });
  await flush();
  const p2 = tree.transact(() => { tree.$.y(tree.$.x() + 1); world.inherit(yPos[0], xPos); });
  await flush(); p2.confirm(); await flush();
  const p3 = tree.transact(() => { tree.$.z(tree.$.y() + 1); world.inherit(zPos[0], yPos); });
  await flush(); p3.confirm(); await flush();
  const beforeResolve = [...sinks.z];
  world.resolve('O1'); tree.$.z(731); await flush();
  const afterResolve = [...sinks.z];
  try { p1.confirm(); } catch {}
  return { beforeResolve, afterResolve };
});

console.log(`H1 before=${JSON.stringify(h1.beforeResolve)} after=${JSON.stringify(h1.afterResolve)} (P3 still open)`);
console.log(`H2 both=${JSON.stringify(h2.both)} afterO1=${JSON.stringify(h2.afterFirst)} afterO4=${JSON.stringify(h2.afterSecond)}`);
console.log(`T  before=${JSON.stringify(t.beforeResolve)} after=${JSON.stringify(t.afterResolve)}\n`);
check(h1.beforeResolve.length===0,'H1 y is blocked while O1 is unresolved');
check(h1.afterResolve.length>0,'H1 resolving the ACTUAL blocker releases y even with P3 still open',
  `after=${JSON.stringify(h1.afterResolve)}`);
check(h2.both.length===0,'H2 y blocked while BOTH O1 and O4 are unresolved');
check(h2.afterFirst.length===0,'H2 resolving only O1 does NOT release y (not a boolean flag)',
  `afterO1=${JSON.stringify(h2.afterFirst)}`);
check(h2.afterSecond.length>0,'H2 resolving O4 as well releases y',`afterO4=${JSON.stringify(h2.afterSecond)}`);
check(t.beforeResolve.length===0,'T z transitively carries O1 through a SETTLED P2');
check(t.afterResolve.length>0,'T resolving the root O1 releases z',`after=${JSON.stringify(t.afterResolve)}`);

writeFileSync(resolve(here,'emit-footprint-0.json'),JSON.stringify({probe:'EMIT-FOOTPRINT-0',h1,h2,t,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
