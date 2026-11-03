import assert from 'node:assert/strict';
import { OperationCoordinator } from '../coordinator.mjs';
if (typeof global.gc !== 'function') throw new Error('Run with --expose-gc');
const turn = () => new Promise(resolve => setImmediate(resolve));
async function collected(ref) {
  for (let i = 0; i < 30; i++) {
    await turn(); global.gc(); await turn();
    if (ref.deref() === undefined) return true;
  }
  return false;
}
function setup() {
  const dependency = { payload: new Uint8Array(1024 * 1024), receipt: { commandId: '', status: 'applied' } };
  const ref = new WeakRef(dependency);
  const coordinator = new OperationCoordinator({ apply() { return dependency.receipt; } });
  coordinator.create('cleanup/rejected', { route: 'west' });
  const review = coordinator.review('cleanup/rejected');
  coordinator.reject('cleanup/rejected');
  coordinator.forget('cleanup/rejected');
  coordinator.dispose();
  return { coordinator, review, ref };
}
const retained = setup();
assert.equal(await collected(retained.ref), true, 'disposed coordinator retains the adapter dependency');
assert.equal(retained.review.proposal.route, 'west');
assert.throws(() => retained.coordinator.create('late', {}), /disposed/);
console.log(JSON.stringify({ result: 'PASS', claim: 'retained disposed coordinator and review do not retain adapter dependency', cycles: 30, limit: 'sampled collectibility, not universal GC or retained byte attribution' }, null, 2));
