#!/usr/bin/env node
// OWNER-KEY-1 (half 1) — does the EXISTING TurnEffect representation already
// carry a lossless semantic location: SubjectId + scoped leaf coordinate?
// Candidate C depends on it. Measured, not read off the types.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const b = await build({
  stdin: { contents: `export {signalTree, entityMap} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
    resolveDir: root, sourcefile: 'ok1.ts', loader: 'ts' },
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24',
});
const K = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const flush = async (n) => { n.flushSync(); for (let i=0;i<8;i++) await Promise.resolve(); };
const checks = [];
const check = (ok,label,detail) => { checks.push({label,ok,detail}); console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?`  -- ${detail}`:''}`); };

const effectsOf = async (build2) => {
  const n = K.getPathNotifier();
  const tree = K.signalTree({ x: 0, rows: K.entityMap({ selectId: (r) => r.id }) }, { enhancers: [K.transactions()] });
  tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 });
  await flush(n);
  const runtime = K.peekInternalTransactionRuntime(tree);
  const p = tree.transact(() => build2(tree));
  await flush(n);
  const [turnId] = runtime.getPendingTurnIds();
  let described;
  try { described = runtime.describePendingTurn(turnId); } catch (e) { described = { error: String(e.message).slice(0,80) }; }
  try { p.confirm(); } catch {}
  tree.destroy();
  return described;
};

const scalar = await effectsOf((t) => t.$.x(5));
const field  = await effectsOf((t) => t.$.rows.byIdOrFail('A').score(9));
const added  = await effectsOf((t) => t.$.rows.addOne({ id: 'Z', name: 'z', score: 0 }));

const show = (label, d) => {
  const fx = d?.effects ?? d?.__effects ?? [];
  console.log(`${label}: ${JSON.stringify(fx).slice(0,300)}`);
  return fx;
};
const sFx = show('scalar x(5)      ', scalar);
const fFx = show('field A.score(9) ', field);
const aFx = show('add Z            ', added);

const fieldSet = fFx.find((e)=>e.kind==='set');
check(!!fieldSet && fieldSet.subject !== undefined,
  'C entity FIELD effect carries a SubjectId', `subject=${fieldSet?.subject}`);
check(!!fieldSet && Array.isArray(fieldSet.subjectFieldSegments) && fieldSet.subjectFieldSegments.length>0,
  'C entity FIELD effect carries a scoped leaf coordinate',
  `segments=${JSON.stringify(fieldSet?.subjectFieldSegments)}`);
const scalarSet = sFx.find((e)=>e.kind==='set');
check(!!scalarSet && scalarSet.subject === undefined,
  'C scalar effect has NO subject (distinct identity class)', `subject=${scalarSet?.subject}`);
const addFx = aFx.find((e)=>e.kind==='add');
check(!!addFx && addFx.subject !== undefined,
  'C subject EXISTENCE effect carries a SubjectId (the F3 row)', `subject=${addFx?.subject}`);

writeFileSync(resolve(here,'owner-key-1.json'), JSON.stringify({probe:'OWNER-KEY-1-half1',scalar,field,added,checks},null,2)+'\n');
const failed = checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
