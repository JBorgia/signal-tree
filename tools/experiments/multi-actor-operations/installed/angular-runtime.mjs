import assert from 'node:assert/strict';
import { ReferenceComponent } from './out/reference.component.js';
async function withinDeadline(operation) {
  let timer;
  try {
    await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Independent note did not settle while proposal stayed pending')), 5000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
const accepted = new ReferenceComponent();
try {
  assert.equal(accepted.summary(), 'north:10');
  accepted.proposeWest();
  assert.equal(accepted.summary(), 'west:10');
  await withinDeadline(accepted.publishIndependentNote());
  assert.deepEqual(accepted.publishedNotes(), ['dispatch-ready']);
  assert.equal(accepted.tree.$.route(), 'west');
  await withinDeadline(accepted.publishIndependentNote());
  assert.equal(accepted.noteAdmission(), 'no-write');
  assert.deepEqual(accepted.publishedNotes(), ['dispatch-ready']);
  accepted.confirm();
  accepted.ingestCapacity(12);
  assert.equal(accepted.summary(), 'west:12');
} finally { accepted.ngOnDestroy(); }
const rejected = new ReferenceComponent();
try {
  rejected.proposeWest();
  await withinDeadline(rejected.publishIndependentNote());
  assert.deepEqual(rejected.publishedNotes(), ['dispatch-ready']);
  rejected.tree.$.note.set('independent'); rejected.reject();
  assert.equal(rejected.tree.$.route(), 'north');
  assert.equal(rejected.tree.$.note(), 'independent');
} finally { rejected.ngOnDestroy(); }
console.log(JSON.stringify({cases:2,outcome:'PASS',evidence:'AOT standalone component class and Angular computed runtime; no bootstrap/DOM claim'}));
