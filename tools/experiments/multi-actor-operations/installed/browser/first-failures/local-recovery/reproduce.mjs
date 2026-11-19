import assert from 'node:assert/strict';
import { BrowserReference } from '/private/tmp/st-p4-browser-jEZJfT/consumer/out/browser/app.js';
const app=new BrowserReference();
app.propose();app.review();
const blocker=app.tree.transact(()=>app.tree.$.route.set('east'));
app.failNext();await app.apply();
console.log(JSON.stringify({stage:'refusal',phase:app.phase(),busy:app.busy(),pending:app.pendingIds(),message:app.message()}));
blocker.rollback();await app.retry();app.reject();app.dispose();
console.log(JSON.stringify({stage:'after blocker rollback/retry/reject/dispose',phase:app.phase(),pending:app.pendingIds(),destroyed:app.destroyed()}));
try { assert.equal(app.phase(),'failed','terminal rejection must remain locally recoverable'); }
finally { app.tree.destroy(); }
