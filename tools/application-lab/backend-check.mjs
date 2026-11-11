import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { DispatchBackend } = await import(
  pathToFileURL(resolve(process.argv[2])).href
);
const row = {
  id: 'J-0',
  instance: 'A',
  title: 'Job',
  owner: 'Sam',
  status: 'queued',
  active: true,
  ownerRevision: 10,
  statusRevision: 10,
};
const service = new DispatchBackend([row]);
const cmd = (id, value, expectedRevision) => ({
  id,
  subject: 'J-0',
  instance: 'A',
  field: 'owner',
  value,
  expectedRevision,
});
const a = service.send(cmd('A', 'Ada', 10));
service.process('A');
const b = service.send(cmd('B', 'Bea', 10));
assert.deepEqual(service.process('B'), {
  commandId: 'B',
  instance: 'A',
  field: 'owner',
  outcome: 'conflict',
  value: 'Ada',
  revision: 11,
});
service.deliver('B');
assert.equal((await b).outcome, 'conflict');
const c = service.send(cmd('C', 'Cy', 11));
service.process('C');
service.deliver('C');
assert.equal((await c).revision, 12);
service.deliver('A');
assert.equal((await a).revision, 11);
assert.equal(service.row('J-0').owner, 'Cy');
service.send(cmd('D', 'Dee', 12));
service.process('D');
service.lose('D');
const retry = service.send(cmd('D', 'Dee', 12));
service.process('D');
service.deliver('D');
assert.equal((await retry).revision, 13);
assert.equal(service.applications.filter((x) => x.id === 'D').length, 1);
const bad = service.send(cmd('D', 'Different', 12)).then(
  () => false,
  () => true
);
assert.throws(() => service.process('D'), /different command/);
assert.equal(await bad, true);
assert.equal(service.row('J-0').owner, 'Dee');
assert.equal(service.applications.length, 3);
service.send(cmd('E', 'Eve', 13));
service.lose('E');
assert.equal(service.applications.length, 3);
const retried = service.send(cmd('E', 'Eve', 13));
service.process('E');
service.deliver('E');
assert.equal((await retried).revision, 14);
assert.equal(service.applications.length, 4);
const old = service.send(cmd('old', 'Stale', 14));
service.replace('J-0', {
  ...row,
  instance: 'B',
  owner: 'Replacement',
  ownerRevision: 1,
});
service.process('old');
service.deliver('old');
assert.equal((await old).outcome, 'conflict');
assert.equal(service.row('J-0').owner, 'Replacement');
const payload = {
  kind: 'progress',
  subject: 'J-0',
  instance: 'B',
  status: 'queued',
  statusRevision: 10,
};
const pub = service.publish('P', payload);
assert.throws(() => service.publish('P', payload), /Duplicate/);
assert.deepEqual(service.publicationAttempts, ['P', 'P']);
assert.equal(service.starts.length, 1);
service.acknowledge('P');
await pub;
console.log(
  'CAS, delayed responses, lost and never-arrived retry, semantic idempotency, retirement and publication attempt controls passed'
);
