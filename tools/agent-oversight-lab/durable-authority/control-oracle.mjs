// Runs only in isolated source copies created by run-controls.mjs.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  commandFor,
  request,
  scopePath,
  startAuthorityProcess,
} from './process.mjs';

const [kind, directory] = process.argv.slice(2);
assert(['authorization', 'duplicate-effect'].includes(kind) && directory);
const authority = await startAuthorityProcess({
  database: join(directory, 'authority.sqlite'),
  outputDirectory: directory,
});
try {
  const proposer = await authority.host('create-session', {
    principal: 'owner',
    tenant: 'tenant-A',
    role: 'proposer',
  });
  const reviewer = await authority.host('create-session', {
    principal: 'independent-reviewer',
    tenant: 'tenant-A',
    role: 'reviewer',
  });
  const base = scopePath(proposer);
  const prepare = async (id, decisionActor) => {
    const observation = (await request(authority, proposer, base + '/snapshot'))
      .body;
    const command = commandFor(proposer, observation, id, { route: 'west' });
    const review = await request(authority, proposer, base + '/reviews', {
      requestId: id,
      command,
    });
    assert.equal(review.status, 202);
    await request(
      authority,
      decisionActor,
      base + '/reviews/' + id + '/decision',
      { decision: 'approve', expectedDigest: review.body.digest }
    );
    return { requestId: id, command };
  };
  if (kind === 'authorization') {
    const unprivileged = await authority.host('create-session', {
      principal: 'other-agent',
      tenant: 'tenant-A',
      role: 'proposer',
    });
    const invalid = await prepare('invalid-approval', unprivileged);
    await request(authority, proposer, base + '/commands', invalid);
    const effects = (await authority.host('diagnostics')).entities[0].effects;
    console.log(
      JSON.stringify({
        oracle: 'authorization-zero-effects',
        effects,
        expected: 0,
      })
    );
    assert.equal(effects, 0, 'authorization-zero-effects');
    const legitimate = await prepare('legitimate-approval', reviewer);
    assert.equal(
      (await request(authority, proposer, base + '/commands', legitimate)).body
        .status,
      'applied'
    );
    assert.equal(
      (await authority.host('diagnostics')).entities[0].effects,
      1,
      'positive-authorized-effect'
    );
  } else {
    const body = await prepare('same-command', reviewer);
    assert.equal(
      (await request(authority, proposer, base + '/commands', body)).body
        .status,
      'applied'
    );
    await request(authority, proposer, base + '/commands', body);
    const effects = (await authority.host('diagnostics')).entities[0].effects;
    console.log(
      JSON.stringify({ oracle: 'duplicate-one-effect', effects, expected: 1 })
    );
    assert.equal(effects, 1, 'duplicate-one-effect');
  }
} finally {
  await authority.stop();
}
