import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { immutable } from '../../experiments/multi-actor-operations/coordinator.mjs';
import { DispatchBackend } from '../../experiments/multi-actor-operations/dispatch-fixture.mjs';
import { reviewAuthority } from '../../experiments/multi-actor-operations/authority/review-fixture.mjs';

// A bounded single-process authority fixture. Fixed test credentials are not
// production authentication, authorization, persistence or replay durability.
export async function startReferenceServer(site, { fault = 'none' } = {}) {
  let backend = new DispatchBackend();
  let generation = 1;
  let allowed = true;
  let loseNext = false;
  let loseNextRevoke = false;
  let effects = 0;
  let hostEffects = 0;
  let closed = false;
  const receipts = new Map();
  const grants = new Map();
  const reviewRequests = new Map();
  const revocations = [];
  const requests = [];
  const reviews = [];
  const reviewer = Object.freeze({ fixture: 'host-reviewer' });
  const instance = () => `delivery-1:${generation}`;
  const snapshot = () =>
    immutable({ ...backend.snapshot(), instance: instance() });
  const authority = {
    apply(command) {
      const signature = JSON.stringify(command);
      const prior = receipts.get(command.commandId);
      if (prior) {
        if (prior.signature !== signature)
          throw new Error('Idempotency key content changed');
        return prior.receipt;
      }
      let receipt;
      if (
        fault !== 'ignore-instance' &&
        command.proposal?.expectedInstance !== instance()
      ) {
        receipt = immutable({
          commandId: command.commandId,
          status: 'rejected',
          reason: 'instance',
        });
      } else {
        const before = backend.commits;
        receipt = backend.apply(command);
        effects += backend.commits - before;
      }
      receipts.set(command.commandId, { signature, receipt });
      return receipt;
    },
  };
  const review = reviewAuthority(authority, (context) => context === reviewer, {
    maxApprovals: 8,
  });
  const reply = (response, status, body) =>
    response
      .writeHead(status, { 'content-type': 'application/json' })
      .end(JSON.stringify(body));
  const withholdReceipt = (response, record) => {
    // Withhold the application receipt after server processing. Browsers can
    // transparently retry a reset connection, bypassing application uncertainty.
    // This explicit HTTP error is a deterministic fixture, not a TCP-loss proof.
    record.acknowledgmentLost = true;
    record.transportErrorStatus = 503;
    reply(response, 503, { error: 'Fixture application receipt unavailable' });
  };
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && ['/', '/app.js'].includes(req.url)) {
      const file = req.url === '/' ? 'index.html' : 'app.js';
      res
        .writeHead(200, {
          'content-type': file.endsWith('.js')
            ? 'text/javascript'
            : 'text/html',
        })
        .end(readFileSync(join(site, file)));
      return;
    }
    if (req.headers.authorization !== 'Bearer fixture-only') {
      reply(res, 401, { error: 'fixture credential required' });
      return;
    }
    if (req.method === 'GET' && req.url === '/snapshot') {
      reply(res, 200, { observation: snapshot(), fault });
      return;
    }
    if (req.method === 'GET' && req.url.startsWith('/review/')) {
      const requestId = req.url.slice('/review/'.length);
      const pending = reviewRequests.get(requestId);
      if (!pending) {
        reply(res, 404, { error: 'unknown review request' });
        return;
      }
      reply(res, 200, {
        requestId,
        commandId: pending.command.commandId,
        status: pending.token ? 'approved' : 'pending',
        ...(pending.token ? { token: pending.token } : {}),
      });
      return;
    }
    if (
      req.method !== 'POST' ||
      !['/review', '/commands', '/revoke'].includes(req.url)
    ) {
      reply(res, 404, { error: 'unknown endpoint' });
      return;
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) {
          reply(res, 413, { error: 'bounded fixture input' });
          return;
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (req.url === '/review') {
        if (
          Object.keys(body).some(
            (key) => !['command', 'requestId'].includes(key)
          )
        )
          throw new Error('Transport cannot supply approval authority');
        const command = immutable(body.command);
        if (typeof command.commandId !== 'string' || !command.commandId)
          throw new Error('Invalid command');
        if (typeof body.requestId !== 'string' || !body.requestId)
          throw new Error('Missing review request identity');
        // Transport requests review. Only the separate host control below can
        // supply reviewer authority; there is deliberately no HTTP mint route.
        const requestId = body.requestId;
        const prior = reviewRequests.get(requestId);
        if (prior && JSON.stringify(prior.command) !== JSON.stringify(command))
          throw new Error('Review request identity content changed');
        if (!prior) {
          if (reviewRequests.size >= 8)
            throw new Error('Review request capacity reached');
          reviewRequests.set(requestId, { command });
        }
        reply(res, 202, {
          requestId,
          status: 'pending',
          commandId: command.commandId,
        });
        return;
      }
      if (req.url === '/revoke') {
        if (
          typeof body.commandId !== 'string' ||
          typeof body.requestId !== 'string' ||
          (body.token !== undefined && typeof body.token !== 'string')
        )
          throw new Error('Invalid cleanup identity');
        const pending = reviewRequests.get(body.requestId);
        if (pending && pending.command.commandId !== body.commandId)
          throw new Error('Cleanup command mismatch');
        if (
          body.token !== undefined &&
          pending?.token !== undefined &&
          body.token !== pending.token
        )
          throw new Error('Cleanup token mismatch');
        const token = body.token ?? pending?.token;
        if (
          token !== undefined &&
          grants.has(token) &&
          grants.get(token) !== body.commandId
        )
          throw new Error('Cleanup grant belongs to another command');
        if (token !== undefined) {
          review.revoke(token);
          grants.delete(token);
        }
        reviewRequests.delete(body.requestId);
        const record = {
          commandId: body.commandId,
          requestId: body.requestId,
          applied: true,
        };
        revocations.push(record);
        if (loseNextRevoke) {
          loseNextRevoke = false;
          withholdReceipt(res, record);
          return;
        }
        reply(res, 200, { revoked: true });
        return;
      }
      const command = immutable(body.command);
      requests.push({
        command,
        ...(body.token === undefined ? {} : { token: body.token }),
        accepted: false,
      });
      const record = requests.at(-1);
      try {
        const receipt = review.apply(command, body.token);
        record.accepted = true;
        record.receipt = receipt;
        if (loseNext) {
          loseNext = false;
          withholdReceipt(res, record);
          return;
        }
        reply(res, 200, receipt);
      } catch (error) {
        record.error = String(error);
        reply(res, 409, { error: String(error) });
      }
    } catch (error) {
      if (!res.headersSent && !res.destroyed)
        reply(res, 400, { error: String(error) });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    inspect: () =>
      immutable({
        observation: snapshot(),
        effects,
        hostEffects,
        requests,
        reviews,
        reviewRequests: [...reviewRequests].map(([requestId, value]) => ({
          requestId,
          command: value.command,
          status: value.token ? 'approved' : 'pending',
        })),
        revocations,
        grants: grants.size,
        closed,
      }),
    controls: {
      approveReview(requestId) {
        const pending = reviewRequests.get(requestId);
        if (!pending || pending.token)
          throw new Error('Review request unavailable');
        pending.token = review.approve(pending.command, reviewer);
        grants.set(pending.token, pending.command.commandId);
        reviews.push(pending.command);
      },
      loseRevokeAcknowledgment() {
        loseNextRevoke = true;
      },
      loseAcknowledgment() {
        loseNext = true;
      },
      setAllowed(value) {
        allowed = value;
        backend.setAllowed(value);
      },
      capacityAba() {
        for (const capacity of [5, 10]) {
          const commandId = `host:${generation}:${hostEffects}`;
          const command = {
            commandId,
            operationId: commandId,
            revision: 1,
            actor: { kind: 'unknown' },
            proposal: backend.proposal({ capacity }),
          };
          const result = backend.apply(command);
          if (result.status !== 'applied')
            throw new Error('Host capacity update failed');
          hostEffects++;
        }
      },
      replaceEntity() {
        generation++;
        backend = new DispatchBackend();
        backend.setAllowed(allowed);
      },
    },
    async close() {
      if (closed) return;
      closed = true;
      review.dispose();
      grants.clear();
      reviewRequests.clear();
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}
