import assert from 'node:assert/strict';
import { ReferenceComponent } from './out/reference.component.js';
const accepted = new ReferenceComponent();
try {
  assert.equal(accepted.summary(), 'north:10');
  accepted.proposeWest();
  assert.equal(accepted.summary(), 'west:10');
  accepted.confirm();
  accepted.ingestCapacity(12);
  assert.equal(accepted.summary(), 'west:12');
} finally { accepted.ngOnDestroy(); }
const rejected = new ReferenceComponent();
try {
  rejected.proposeWest(); rejected.tree.$.note.set('independent'); rejected.reject();
  assert.equal(rejected.tree.$.route(), 'north');
  assert.equal(rejected.tree.$.note(), 'independent');
} finally { rejected.ngOnDestroy(); }
console.log(JSON.stringify({cases:2,outcome:'PASS',evidence:'AOT standalone component class and Angular computed runtime; no bootstrap/DOM claim'}));
