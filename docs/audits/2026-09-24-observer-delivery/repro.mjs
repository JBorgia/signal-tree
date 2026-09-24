import { signalTree, transactions, entityMap, link } from '@signal-tree/kernel';
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const S = (t) => ({ x: t.$.x?.(), pending: t.__transactions.getPendingTurnCount(), confirmed: t.__transactions.getConfirmedTurnCount() });
const settle = (op) => { try { op(); return 'ok'; } catch (e) { return String(e?.cause?.kind ?? e?.message ?? 'threw'); } };
const row = () => signalTree({ rows: entityMap({ selectId: (r) => r.id }), x: 0 }, { enhancers: [transactions()] });

console.log('=== CONTROL 1 — successful rollback ===');
{
  const t = signalTree({ x: 0 }, { enhancers: [transactions()] });
  const p = t.transaction(() => t.$.x(1)); await flush();
  console.log('  outcome', settle(() => p.rollback()), '|', JSON.stringify(S(t)));
  console.log('  retry  ', settle(() => p.rollback()), '| confirm', settle(() => p.confirm()));
  t.destroy();
}

console.log('=== CONTROL 2 — genuine PRE-INSTALL refusal (R6) ===');
{
  const t = row();
  t.$.rows.addOne({ id: 'A', name: 'o' }); await flush();
  const p = t.transaction(() => { t.$.x(1); t.$.rows.removeOne('A'); }); await flush();
  t.$.rows.addOne({ id: 'A', name: 'server' }); await flush();
  const o = settle(() => p.rollback()); await flush();
  console.log('  outcome', o, '|', JSON.stringify(S(t)), '| A =', t.$.rows.byId('A')?.()?.name);
  console.log('  retry  ', settle(() => p.rollback()), '| then confirm', settle(() => p.confirm()), '|', JSON.stringify(S(t)));
  t.destroy();
}

console.log('=== TARGET — observer throws AFTER compensation installs ===');
{
  const t = signalTree({ x: 0 }, { enhancers: [transactions()] });
  let armed = false;
  const l = link(t.$.x, { set: () => { if (armed) throw new Error('OBSERVER BOOM'); } });
  await flush();
  const p = t.transaction(() => t.$.x(1)); await flush();
  armed = true;
  const o = settle(() => p.rollback());
  console.log('  rollback outcome   ', o, '|', JSON.stringify(S(t)));
  await flush();
  console.log('  after flush        ', JSON.stringify(S(t)), '| x reversed =', t.$.x() === 0);
  let st = 'resolved'; try { await l.settled(); } catch (e) { st = 'REJECTED ' + e?.message; }
  console.log('  link.settled()     ', st);
  console.log('  subsequent write   ', (t.$.x(9), t.$.x()) === 9 ? 'ok' : 'BROKEN');
  const p2 = t.transaction(() => t.$.x(10)); await flush();
  console.log('  subsequent txn     ', settle(() => p2.rollback()), '| x =', t.$.x());
  l.dispose(); t.destroy();
}
