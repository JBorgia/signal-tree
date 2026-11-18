import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { request as rawRequest } from 'node:http';
import test from 'node:test';
import {
  commandFor,
  request,
  scopePath,
  startAuthorityProcess,
} from './process.mjs';

const output = process.env.ST_AUTHORITY_EVIDENCE;
assert(output, 'Use run-tests.mjs NEW_OUTPUT');
async function scenario(name, body, options = {}) {
  const directory = join(output, name);
  mkdirSync(directory);
  const database = join(directory, 'authority.sqlite');
  let authority = await startAuthorityProcess({
    database,
    outputDirectory: directory,
    ...options,
  });
  const proposer = await authority.host('create-session', {
    principal: 'agent-A',
    tenant: 'tenant-A',
    role: 'proposer',
    destinations: ['dispatch'],
  });
  const reviewer = await authority.host('create-session', {
    principal: 'reviewer-A',
    tenant: 'tenant-A',
    role: 'reviewer',
    destinations: ['dispatch'],
  });
  const base = scopePath(proposer);
  const prepared = async (id, patch = { route: 'west' }, reads = []) => {
    const snapshot = await request(authority, proposer, base + '/snapshot');
    assert.equal(snapshot.status, 200);
    const command = commandFor(proposer, snapshot.body, id, patch, reads);
    const result = await request(authority, proposer, base + '/reviews', {
      requestId: 'review-' + id,
      command,
    });
    assert.equal(result.status, 202, JSON.stringify(result.body));
    const decision = await request(
      authority,
      reviewer,
      base +
        '/reviews/' +
        encodeURIComponent(result.body.requestId) +
        '/decision',
      { decision: 'approve', expectedDigest: result.body.digest }
    );
    assert.equal(decision.status, 200, JSON.stringify(decision.body));
    return { requestId: result.body.requestId, command, review: decision.body };
  };
  try {
    await body({
      get authority() {
        return authority;
      },
      proposer,
      reviewer,
      base,
      prepared,
      database,
      async restart() {
        const previous = authority;
        await previous.waitForExit();
        authority = await startAuthorityProcess({
          database,
          outputDirectory: directory,
          ...options,
        });
        assert.notEqual(authority.pid, previous.pid);
        return authority;
      },
    });
  } finally {
    await authority.stop();
  }
}

test('real SIGKILL before commit rolls back effect and receipt; retry applies once', async (t) => {
  await scenario('crash-before-commit', async (context) => {
    const { proposer, base, prepared } = context;
    const pending = await prepared('precommit');
    const pid = context.authority.pid;
    await context.authority.host('crash-before-commit', {
      commandId: pending.command.commandId,
    });
    const event = context.authority.waitForEvent(
      (e) => e.event === 'fault-reached' && e.phase === 'before-commit'
    );
    await assert.rejects(
      request(context.authority, proposer, base + '/commands', {
        requestId: pending.requestId,
        command: pending.command,
      })
    );
    assert.equal((await event).pid, pid);
    assert.equal((await context.authority.waitForExit()).signal, 'SIGKILL');
    await context.restart();
    const before = await context.authority.host('diagnostics');
    assert.equal(before.entities[0].effects, 0);
    assert.equal(before.receipts.length, 0);
    const receipt = await request(
      context.authority,
      proposer,
      base + '/commands',
      { requestId: pending.requestId, command: pending.command }
    );
    assert.equal(receipt.body.status, 'applied');
    assert.equal(
      (await context.authority.host('diagnostics')).entities[0].effects,
      1
    );
    t.diagnostic(
      JSON.stringify({
        oldPid: pid,
        newPid: context.authority.pid,
        effectsBeforeRetry: 0,
        effectsAfterRetry: 1,
        database: before.database,
      })
    );
  });
});

test('real SIGKILL after commit preserves effect, approval and original receipt across restart', async (t) => {
  await scenario('crash-after-commit', async (context) => {
    const { proposer, base, prepared } = context;
    const pending = await prepared('postcommit');
    const oldPid = context.authority.pid;
    await context.authority.host('crash-after-commit', {
      commandId: pending.command.commandId,
    });
    const event = context.authority.waitForEvent(
      (e) => e.event === 'fault-reached' && e.phase === 'after-commit'
    );
    await assert.rejects(
      request(context.authority, proposer, base + '/commands', {
        requestId: pending.requestId,
        command: pending.command,
      })
    );
    await event;
    assert.equal((await context.authority.waitForExit()).signal, 'SIGKILL');
    await context.restart();
    const recovered = await request(
      context.authority,
      proposer,
      base + '/receipts/postcommit'
    );
    assert.equal(recovered.body.status, 'applied');
    const repeated = await request(
      context.authority,
      proposer,
      base + '/commands',
      { requestId: pending.requestId, command: pending.command }
    );
    assert.deepEqual(repeated.body, recovered.body);
    const diagnostics = await context.authority.host('diagnostics');
    assert.equal(diagnostics.entities[0].effects, 1);
    assert.equal(diagnostics.receipts.length, 1);
    assert.equal(diagnostics.database.journalMode, 'delete');
    assert.equal(diagnostics.database.synchronous, 2);
    t.diagnostic(
      JSON.stringify({
        oldPid,
        newPid: context.authority.pid,
        effectsBeforeAndAfterRetry: 1,
        identicalReceipt: true,
        database: diagnostics.database,
      })
    );
  });
});

test('concurrent duplicate HTTP commands have one effect; identity reuse with changed bytes fails', async () => {
  await scenario(
    'duplicate-commands',
    async ({ authority, proposer, base, prepared }) => {
      const p = await prepared('one-effect');
      const body = { requestId: p.requestId, command: p.command };
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(authority, proposer, base + '/commands', body)
        )
      );
      assert.ok(results.every((r) => r.status === 200));
      for (const result of results)
        assert.deepEqual(result.body, results[0].body);
      const changed = structuredClone(body);
      changed.command.proposal.patch.route = 'south';
      const denied = await request(
        authority,
        proposer,
        base + '/commands',
        changed
      );
      assert.equal(denied.status, 409);
      assert.equal(denied.body.error, 'command-identity-reused');
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        1
      );
    }
  );
});

test('independent authenticated reviewer required; forged labels and mismatched review digest cannot approve', async () => {
  await scenario(
    'independent-review',
    async ({ authority, proposer, reviewer, base }) => {
      const observation = (
        await request(authority, proposer, base + '/snapshot')
      ).body;
      const command = commandFor(proposer, observation, 'forged', {
        route: 'west',
      });
      command.actor = { kind: 'declared', label: 'administrator-approved' };
      const review = await request(authority, proposer, base + '/reviews', {
        requestId: 'r-forged',
        command,
      });
      assert.equal(review.status, 202);
      const rejectedRole = await request(
        authority,
        proposer,
        base + '/reviews/r-forged/decision',
        { decision: 'approve', expectedDigest: review.body.digest }
      );
      assert.equal(rejectedRole.status, 403);
      const wrongDigest = await request(
        authority,
        reviewer,
        base + '/reviews/r-forged/decision',
        { decision: 'approve', expectedDigest: 'wrong' }
      );
      assert.equal(wrongDigest.status, 409);
      const forbidden = await request(authority, proposer, base + '/commands', {
        requestId: 'r-forged',
        command,
      });
      assert.equal(forbidden.body.status, 'rejected');
      assert.equal(forbidden.body.reason, 'approval-pending');
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        0
      );
      // A distinct, genuinely approved operation succeeds; denial is not global.
      const next = commandFor(proposer, observation, 'legitimate', {
        route: 'west',
      });
      const r = (
        await request(authority, proposer, base + '/reviews', {
          requestId: 'r-legit',
          command: next,
        })
      ).body;
      assert.equal(
        (
          await request(
            authority,
            reviewer,
            base + '/reviews/r-legit/decision',
            { decision: 'approve', expectedDigest: r.digest }
          )
        ).status,
        200
      );
      assert.equal(
        (
          await request(authority, proposer, base + '/commands', {
            requestId: 'r-legit',
            command: next,
          })
        ).body.status,
        'applied'
      );
    }
  );
});

test('tokens authenticate principal and enforce tenant, destination and proposer ownership', async () => {
  await scenario(
    'scope-isolation',
    async ({ authority, proposer, reviewer, base, prepared }) => {
      const p = await prepared('scoped');
      const otherPrincipal = await authority.host('create-session', {
        principal: 'agent-B',
        tenant: 'tenant-A',
        role: 'proposer',
      });
      const otherTenant = await authority.host('create-session', {
        principal: 'agent-A',
        tenant: 'tenant-B',
        role: 'proposer',
      });
      const otherDestination = await authority.host('create-session', {
        principal: 'agent-C',
        tenant: 'tenant-A',
        role: 'proposer',
        destinations: ['archive'],
      });
      const body = { requestId: p.requestId, command: p.command };
      assert.equal(
        (await request(authority, { token: 'made-up' }, base + '/snapshot'))
          .status,
        401
      );
      assert.equal(
        (await request(authority, otherTenant, base + '/commands', body))
          .status,
        403
      );
      assert.equal(
        (await request(authority, otherDestination, base + '/commands', body))
          .status,
        403
      );
      assert.equal(
        (await request(authority, otherPrincipal, base + '/commands', body))
          .status,
        400
      );
      const rebased = structuredClone(body);
      rebased.command.sessionId = otherPrincipal.sessionId;
      rebased.command.sessionEpoch = otherPrincipal.epoch;
      assert.equal(
        (await request(authority, otherPrincipal, base + '/commands', rebased))
          .status,
        403
      );
      assert.equal(
        (
          await request(
            authority,
            otherPrincipal,
            base + '/reviews/' + p.requestId
          )
        ).status,
        404
      );
      assert.equal(
        (await request(authority, reviewer, base + '/commands', body)).status,
        403
      );
      assert.equal(
        (await authority.host('diagnostics')).entities.every(
          (e) => e.effects === 0
        ),
        true
      );
      assert.equal(
        (await request(authority, proposer, base + '/commands', body)).body
          .status,
        'applied'
      );
    }
  );
});

test('reviewer revocation and session stop block new effects; old applied receipt remains recoverable', async () => {
  await scenario(
    'revocation',
    async ({ authority, proposer, reviewer, base, prepared }) => {
      const revoked = await prepared('revoked');
      assert.equal(
        (
          await request(
            authority,
            reviewer,
            base + '/reviews/' + revoked.requestId + '/decision',
            { decision: 'revoke', expectedDigest: revoked.review.digest }
          )
        ).status,
        200
      );
      const refusal = await request(authority, proposer, base + '/commands', {
        requestId: revoked.requestId,
        command: revoked.command,
      });
      assert.equal(refusal.body.reason, 'approval-revoked');
      const accepted = await prepared('accepted');
      const command = {
        requestId: accepted.requestId,
        command: accepted.command,
      };
      const receipt = (
        await request(authority, proposer, base + '/commands', command)
      ).body;
      assert.equal(receipt.status, 'applied');
      const stopped = await prepared('stopped', { window: '10:00' });
      assert.equal(
        (
          await request(
            authority,
            reviewer,
            base + '/sessions/' + proposer.sessionId + '/stop',
            {}
          )
        ).body.stopped,
        true
      );
      const stopReceipt = (
        await request(authority, proposer, base + '/commands', {
          requestId: stopped.requestId,
          command: stopped.command,
        })
      ).body;
      assert.equal(stopReceipt.reason, 'session-stopped');
      assert.deepEqual(
        (await request(authority, proposer, base + '/commands', command)).body,
        receipt
      );
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        1
      );
    }
  );
});

test('new session epoch never auto-adopts old reviews and cannot apply old-session commands', async () => {
  await scenario(
    'new-session',
    async ({ authority, proposer, base, prepared }) => {
      const old = await prepared('old-session');
      const successor = await authority.host('create-session', {
        principal: proposer.principal,
        tenant: proposer.tenant,
        role: 'proposer',
      });
      assert.equal(successor.epoch, proposer.epoch + 1);
      assert.deepEqual(
        (await request(authority, successor, base + '/reviews')).body.reviews,
        []
      );
      assert.equal(
        (
          await request(
            authority,
            successor,
            base + '/reviews/' + old.requestId
          )
        ).status,
        404
      );
      assert.equal(
        (
          await request(authority, successor, base + '/commands', {
            requestId: old.requestId,
            command: old.command,
          })
        ).status,
        400
      );
      const oldResult = await request(authority, proposer, base + '/commands', {
        requestId: old.requestId,
        command: old.command,
      });
      assert.equal(oldResult.body.reason, 'session-stopped');
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        0
      );
    }
  );
});

test('entity replacement and ABA field revisions reject stale approved effects', async () => {
  await scenario(
    'replacement-aba',
    async ({ authority, proposer, base, prepared }) => {
      const replacement = await prepared('replacement');
      await authority.host('replace-entity', {
        tenant: proposer.tenant,
        destination: 'dispatch',
        patch: { route: 'replacement' },
      });
      const result = await request(authority, proposer, base + '/commands', {
        requestId: replacement.requestId,
        command: replacement.command,
      });
      assert.equal(result.body.reason, 'instance');
      const aba = await prepared('aba', { route: 'west' }, ['capacity']);
      await authority.host('patch', {
        tenant: proposer.tenant,
        destination: 'dispatch',
        patch: { capacity: 5 },
      });
      await authority.host('patch', {
        tenant: proposer.tenant,
        destination: 'dispatch',
        patch: { capacity: 10 },
      });
      const stale = await request(authority, proposer, base + '/commands', {
        requestId: aba.requestId,
        command: aba.command,
      });
      assert.equal(stale.body.reason, 'conflict');
      const d = await authority.host('diagnostics');
      assert.equal(d.entities[0].effects, 0);
      assert.equal(d.entities[0].values.route, 'replacement');
    }
  );
});

test('real HTTP responses can finish in reverse order while each receipt retains its command identity', async () => {
  await scenario(
    'response-order',
    async ({ authority, proposer, base, prepared }) => {
      const a = await prepared('response-A', { route: 'west' });
      const b = await prepared('response-B', { note: 'independent' });
      await authority.host('hold-response', { commandId: a.command.commandId });
      await authority.host('hold-response', { commandId: b.command.commandId });
      const order = [];
      const flightA = request(authority, proposer, base + '/commands', {
        requestId: a.requestId,
        command: a.command,
      }).then((r) => {
        order.push('A');
        return r;
      });
      const flightB = request(authority, proposer, base + '/commands', {
        requestId: b.requestId,
        command: b.command,
      }).then((r) => {
        order.push('B');
        return r;
      });
      await Promise.all(
        ['response-A', 'response-B'].map((commandId) =>
          authority.waitForEvent(
            (e) => e.event === 'response-held' && e.commandId === commandId
          )
        )
      );
      assert.deepEqual(order, []);
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        2
      );
      await authority.host('release-response', { commandId: 'response-B' });
      assert.equal((await flightB).body.commandId, 'response-B');
      assert.deepEqual(order, ['B']);
      await authority.host('release-response', { commandId: 'response-A' });
      assert.equal((await flightA).body.commandId, 'response-A');
      assert.deepEqual(order, ['B', 'A']);
    }
  );
});

test('event feed exposes truncation, scope-local sequence and redacts payload values and bearer secrets', async () => {
  await scenario(
    'audit-redaction',
    async ({ authority, proposer, base, prepared, database }) => {
      const secret = 'DO-NOT-RECORD-CUSTOMER-SECRET';
      const pending = await prepared('redacted', { note: secret });
      assert.equal(
        (
          await request(authority, proposer, base + '/commands', {
            requestId: pending.requestId,
            command: pending.command,
          })
        ).body.status,
        'applied'
      );
      const initialEvents = (
        await request(authority, proposer, base + '/events?after=0&limit=100')
      ).body;
      assert.ok(
        initialEvents.events.some(
          (event) =>
            event.commandId === 'redacted' && event.status === 'applied'
        )
      );
      assert.equal(JSON.stringify(initialEvents).includes(secret), false);
      assert.equal(
        JSON.stringify(initialEvents).includes(proposer.token),
        false
      );
      for (let i = 0; i < 8; i++)
        await authority.host('patch', {
          tenant: proposer.tenant,
          destination: 'dispatch',
          patch: { capacity: i },
        });
      const events = (
        await request(authority, proposer, base + '/events?after=0&limit=100')
      ).body;
      assert.equal(events.retention.truncated, true);
      assert.equal(events.events.length, 4);
      assert.equal(
        events.events[0].sequence,
        events.retention.firstAvailableSequence
      );
      assert.equal(
        events.events.at(-1).sequence,
        events.retention.latestSequence
      );
      assert.ok(
        events.events.every(
          (e, i) => i === 0 || e.sequence === events.events[i - 1].sequence + 1
        )
      );
      assert.equal(JSON.stringify(events).includes(secret), false);
      assert.equal(JSON.stringify(events).includes(proposer.token), false);
      // The authoritative review necessarily retains its payload; audit redaction
      // is distinct from database encryption/retention policy.
      assert.equal(
        readFileSync(database).includes(Buffer.from(proposer.token)),
        false
      );
      const current = await request(authority, proposer, '/api/session');
      assert.equal(Object.hasOwn(current.body, 'token'), false);
    },
    { auditLimit: 4 }
  );
});

test('review capacity denies excess pending work while admitted operation still succeeds', async () => {
  await scenario(
    'bounded-queue',
    async ({ authority, proposer, base, prepared }) => {
      const p = await prepared('admitted');
      const observation = (
        await request(authority, proposer, base + '/snapshot')
      ).body;
      const excess = commandFor(proposer, observation, 'excess', {
        note: 'overflow',
      });
      assert.equal(
        (
          await request(authority, proposer, base + '/reviews', {
            requestId: 'r-excess',
            command: excess,
          })
        ).status,
        429
      );
      assert.equal(
        (
          await request(authority, proposer, base + '/commands', {
            requestId: p.requestId,
            command: p.command,
          })
        ).body.status,
        'applied'
      );
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        1
      );
    },
    { maxPendingReviews: 1 }
  );
});

test('revoked credentials cannot complete an already-open HTTP command body', async () => {
  await scenario(
    'revoked-mid-upload',
    async ({ authority, proposer, base, prepared }) => {
      const pending = await prepared('revoked-upload');
      const encoded = JSON.stringify({
        requestId: pending.requestId,
        command: pending.command,
      });
      let opened;
      const connected = new Promise((resolve) => {
        opened = resolve;
      });
      const reply = new Promise((resolve, reject) => {
        const outgoing = rawRequest(
          authority.url + base + '/commands',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${proposer.token}`,
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(encoded),
            },
          },
          (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () =>
              resolve({
                status: response.statusCode,
                body: JSON.parse(Buffer.concat(chunks)),
              })
            );
          }
        );
        outgoing.on('error', reject);
        outgoing.write(encoded.slice(0, 20), () => opened(outgoing));
      });
      const outgoing = await connected;
      await authority.waitForEvent(
        (event) =>
          event.event === 'authenticated-upload-started' &&
          event.sessionId === proposer.sessionId
      );
      await authority.host('revoke-session', { sessionId: proposer.sessionId });
      outgoing.end(encoded.slice(20));
      assert.equal((await reply).status, 401);
      assert.equal(
        (await request(authority, proposer, base + '/snapshot')).status,
        401
      );
      const diagnostics = await authority.host('diagnostics');
      assert.equal(diagnostics.entities[0].effects, 0);
      assert.equal(diagnostics.receipts.length, 0);
    }
  );
});

test('review payload is immutable and host privilege cannot be requested over HTTP', async () => {
  await scenario(
    'immutable-review',
    async ({ authority, proposer, reviewer, base, prepared }) => {
      const pending = await prepared('immutable');
      const changed = structuredClone(pending.command);
      changed.proposal.patch.route = 'tampered';
      assert.equal(
        (
          await request(authority, proposer, base + '/reviews', {
            requestId: pending.requestId,
            command: changed,
          })
        ).status,
        409
      );
      assert.equal(
        (
          await request(authority, proposer, base + '/commands', {
            requestId: pending.requestId,
            command: changed,
          })
        ).status,
        403
      );
      assert.equal(
        (
          await request(authority, proposer, '/api/host/create-session', {
            role: 'reviewer',
          })
        ).status,
        404
      );
      assert.equal(
        (
          await request(authority, proposer, base + '/reviews', {
            requestId: 'malformed',
            command: { ...changed, role: 'reviewer' },
          })
        ).status,
        400
      );
      assert.deepEqual(
        (
          await request(
            authority,
            reviewer,
            base + '/reviews/' + pending.requestId
          )
        ).body.command,
        pending.command
      );
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        0
      );
      assert.equal(
        (
          await request(authority, proposer, base + '/commands', {
            requestId: pending.requestId,
            command: pending.command,
          })
        ).body.status,
        'applied'
      );
    }
  );
});

test('reviewer cannot stop a session whose wider destination privileges exceed its scope', async () => {
  await scenario('stop-scope', async ({ authority, reviewer, base }) => {
    const wide = await authority.host('create-session', {
      principal: 'wide-agent',
      tenant: 'tenant-A',
      role: 'proposer',
      destinations: ['dispatch', 'archive'],
    });
    const denied = await request(
      authority,
      reviewer,
      base + '/sessions/' + wide.sessionId + '/stop',
      {}
    );
    assert.equal(denied.status, 403);
    assert.equal(
      (await request(authority, wide, '/api/session')).body.stopped,
      false
    );
    assert.equal(
      (await request(authority, wide, '/api/session/stop', {})).body.stopped,
      true
    );
  });
});

test('long-lived review polling is bounded while historical direct lookup and receipts stay durable', async () => {
  await scenario(
    'bounded-review-history',
    async ({ authority, proposer, reviewer, base, prepared }) => {
      for (let i = 0; i < 72; i++) {
        const pending = await prepared('history-' + i, { route: 'route-' + i });
        assert.equal(
          (
            await request(authority, proposer, base + '/commands', {
              requestId: pending.requestId,
              command: pending.command,
            })
          ).body.status,
          'applied'
        );
      }
      const active = await prepared('still-active', { note: 'pending' });
      for (const session of [proposer, reviewer]) {
        const listed = (await request(authority, session, base + '/reviews'))
          .body;
        assert.equal(listed.reviews.length, 65);
        assert.deepEqual(listed.retention, {
          terminalLimit: 64,
          terminalTruncated: true,
        });
        assert.ok(
          listed.reviews.some((review) => review.requestId === active.requestId)
        );
        assert.ok(
          !listed.reviews.some(
            (review) => review.requestId === 'review-history-0'
          )
        );
        assert.equal(
          (
            await request(
              authority,
              session,
              base + '/reviews/review-history-0'
            )
          ).body.status,
          'applied'
        );
      }
      assert.equal(
        (await request(authority, proposer, base + '/receipts/history-0')).body
          .status,
        'applied'
      );
      const stranger = await authority.host('create-session', {
        principal: 'stranger',
        tenant: proposer.tenant,
        role: 'proposer',
      });
      assert.equal(
        (await request(authority, stranger, base + '/reviews/review-history-0'))
          .status,
        404
      );
      assert.equal(
        (await authority.host('diagnostics')).entities[0].effects,
        72
      );
    }
  );
});
