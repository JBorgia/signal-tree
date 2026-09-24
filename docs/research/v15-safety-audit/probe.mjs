import { entityMap, signalTree, transactions } from '@signal-tree/kernel';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const settle = (op) => { try { op(); return 'ok'; } catch (e) { return e?.cause?.kind ?? 'throw'; } };
const mkTx = (t) => t.transact ? ((f)=>t.transact(f)) : ((f)=>t.transaction(f));
const ver = (await import('@signal-tree/kernel/package.json', {with:{type:'json'}})).default.version;

// R6
const t1 = signalTree({ rows: entityMap({ selectId: r=>r.id }), x: 0 }, { enhancers:[transactions()] });
t1.$.rows.addOne({id:'A',name:'Original'}); await flush();
const p = mkTx(t1)(() => { t1.$.x(1); t1.$.rows.removeOne('A'); }); await flush();
t1.$.rows.addOne({id:'A',name:'FromServer'}); await flush();
const r6first = settle(()=>p.rollback());
const r6pending = t1.__transactions?.getPendingTurnCount?.() ?? 'n/a';
const r6x = t1.$.x();
const r6second = settle(()=>p.rollback());

// R8 A and E
const mk = async () => {
  const t = signalTree({x:0,y:0,z:0},{enhancers:[transactions()]});
  const a = mkTx(t)(()=>{t.$.x(1);t.$.y(1);}); await flush();
  const b = mkTx(t)(()=>{t.$.y(2);t.$.z(2);}); await flush();
  return {t,a,b};
};
const A = await mk(); settle(()=>A.a.rollback()); const aAfter={x:A.t.$.x(),y:A.t.$.y(),z:A.t.$.z()};
settle(()=>A.b.confirm()); const aFinal={x:A.t.$.x(),y:A.t.$.y(),z:A.t.$.z()};
const E = await mk(); settle(()=>E.a.rollback()); settle(()=>E.b.rollback());
const eFinal={x:E.t.$.x(),y:E.t.$.y(),z:E.t.$.z()};

console.log(JSON.stringify({
  ver,
  R6: { first:r6first, pendingAfter:r6pending, x:r6x, second:r6second,
        REPRO: r6first==='effect-validation-failed' && r6pending===0 && r6x===1 },
  R8_A: { afterRejectP1:aAfter, final:aFinal, REPRO: aAfter.y===0 },
  R8_E: { final:eFinal, REPRO: eFinal.y!==0 },
}));
