#!/usr/bin/env node
// OWNER-SEAM-2B — cardinality of node -> positionIds for the THREE identity
// classes DEPENDENCY-1F established. Candidate A is only viable if positions
// preserve the precision the NODES were proven to carry.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const b = await build({
  stdin: { contents: `export {signalTree, entityMap} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';`,
    resolveDir: root, sourcefile: 's2b.ts', loader: 'ts' },
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24',
});
const K = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);

const checks = [];
const check = (ok, label, detail) => { checks.push({label, ok, detail}); console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?`  -- ${detail}`:''}`); };
const pos = (o) => { try { const p = o?.__positionIds; return p ? [...p] : undefined; } catch { return undefined; } };

const tree = K.signalTree(
  { x: 0, y: 0, rows: K.entityMap({ selectId: (r) => r.id }) },
  { enhancers: [K.transactions()] }
);
tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 });
tree.$.rows.addOne({ id: 'B', name: 'b', score: 2 });

const xPos = pos(tree.$.x), yPos = pos(tree.$.y);
const A = tree.$.rows.byIdOrFail('A'), Bs = tree.$.rows.byIdOrFail('B');
const aScore = pos(A.score), aName = pos(A.name), bScore = pos(Bs.score);
console.log(`scalar x        -> ${JSON.stringify(xPos)}`);
console.log(`scalar y        -> ${JSON.stringify(yPos)}`);
console.log(`A.score         -> ${JSON.stringify(aScore)}`);
console.log(`A.name          -> ${JSON.stringify(aName)}`);
console.log(`B.score         -> ${JSON.stringify(bScore)}`);
console.log(`collection rows -> ${JSON.stringify(pos(tree.$.rows))}\n`);

check(JSON.stringify(xPos) !== JSON.stringify(yPos),
  'scalar leaves have DISTINCT positions', `x=${JSON.stringify(xPos)} y=${JSON.stringify(yPos)}`);
check(JSON.stringify(aScore) !== JSON.stringify(aName),
  'entity field leaves score/name have DISTINCT positions',
  `A.score=${JSON.stringify(aScore)} A.name=${JSON.stringify(aName)}`);
check(JSON.stringify(aScore) !== JSON.stringify(bScore),
  'DIFFERENT SUBJECTS have distinct positions',
  `A.score=${JSON.stringify(aScore)} B.score=${JSON.stringify(bScore)}`);
tree.destroy();

writeFileSync(resolve(here,'owner-seam-2b.json'), JSON.stringify({probe:'OWNER-SEAM-2B',checks},null,2)+'\n');
const failed = checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
