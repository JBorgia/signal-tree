// Diagnostic only: final outcomes are observations, not contract assertions.
// Copy to packages/kernel/src/lib/__ordering-adjudication.spec.ts for Nx replay.
import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { signalTree, entityMap, transactions } from '../index';
import { selectNativeOwnershipTransactions } from './internals/native-ownership-public-selection';
import { getNativeOwnershipPublicExperiment } from '../enhancers/transactions/native-ownership-public-experiment';
for (const arm of ['incumbent', 'B'] as const) it(`diagnostic moved-anchor sequence: ${arm}`, () => {
  const tree = signalTree({ rows: entityMap<{id:string},string>() }, {
    enhancers: [arm === 'B' ? selectNativeOwnershipTransactions(transactions()) : transactions()],
  });
  const out: unknown[] = [];
  const record = (stage:string, error?:unknown) => out.push({stage, ids:tree.$.rows.ids(), error:error instanceof Error ? {name:error.name,message:error.message,cause:String(error.cause)} : error === undefined ? null : String(error), B:getNativeOwnershipPublicExperiment(tree)?.stats()});
  try {
    tree.$.rows.setAll(['A','B','C'].map(id=>({id})));
    const held = tree.$.rows.byIdOrFail('B');
    const p = tree.transact(()=>tree.$.rows.removeOne('B'));
    expect(tree.$.rows.ids()).toEqual(['A','C']); record('removed');
    tree.$.rows.prependMany([{id:'C'}], {mode:'overwrite'});
    expect(tree.$.rows.ids()).toEqual(['C','A']); record('front-C');
    try {p.rollback();record('first-rollback');} catch(error) {record('first-rollback',error);}
    tree.$.rows.prependMany([{id:'A'}], {mode:'overwrite'}); record('front-A');
    try {p.rollback();record('retry');} catch(error) {record('retry',error);}
    out.push({heldB:held(),sameLifetime:tree.$.rows.byId('B')===held});
  } finally { writeFileSync(`/private/tmp/st-ordering-adjudication/public-${arm}.json`,JSON.stringify({arm,out},null,2));tree.destroy(); }
});
