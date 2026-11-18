import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuthorityStore, RequestError } from './store.mjs';

if (!process.send)
  throw new Error('Durable authority starts only as an IPC child');
const options = JSON.parse(process.argv[2]);
const store = new AuthorityStore(options.database, options);
const heldCommands = new Set(),
  heldResponses = new Map();
let crash = null,
  crashing = false;
const requests = [];
const reply = (response, status, body) => {
  if (response.destroyed) return;
  response
    .writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    .end(JSON.stringify(body));
};
const killAt = (phase, commandId) => {
  if (!crash || crash.phase !== phase || crash.commandId !== commandId)
    return false;
  crashing = true;
  crash = null;
  process.send(
    {
      type: 'event',
      event: 'fault-reached',
      phase,
      commandId,
      pid: process.pid,
    },
    () => process.kill(process.pid, 'SIGKILL')
  );
  return true;
};
async function bodyOf(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new RequestError(413, 'request-too-large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'invalid-json');
  }
}
const server = createServer(async (request, response) => {
  let status = 200,
    errorCode;
  try {
    if (crashing) throw new RequestError(503, 'authority-restarting');
    if (request.headers.host !== new URL(origin).host)
      throw new RequestError(403, 'host-forbidden');
    if (request.headers.origin && request.headers.origin !== origin)
      throw new RequestError(403, 'origin-forbidden');
    const url = new URL(request.url, origin);
    if (url.origin !== origin) throw new RequestError(403, 'origin-forbidden');
    if (
      request.method === 'GET' &&
      options.siteDirectory &&
      ['/', '/app.js'].includes(url.pathname)
    ) {
      const file = url.pathname === '/' ? 'index.html' : 'app.js';
      response
        .writeHead(200, {
          'content-type': file.endsWith('.js')
            ? 'text/javascript'
            : 'text/html',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        })
        .end(readFileSync(join(options.siteDirectory, file)));
      return;
    }
    const method = request.method;
    if (!['GET', 'POST'].includes(method))
      throw new RequestError(405, 'method-forbidden');
    let session = store.authenticate(request.headers.authorization);
    if (method === 'POST' && url.pathname.endsWith('/commands'))
      process.send({
        type: 'event',
        event: 'authenticated-upload-started',
        sessionId: session.id,
        pid: process.pid,
      });
    const body = method === 'POST' ? await bodyOf(request) : undefined;
    // Authentication/revocation is rechecked after awaiting request bytes. All
    // authorization + SQLite mutation below then happen without an await.
    session = store.authenticate(request.headers.authorization);
    if (url.pathname === '/api/session' && method === 'GET') {
      reply(response, 200, store.publicSession(session));
      return;
    }
    if (url.pathname === '/api/session/stop' && method === 'POST') {
      if (!body || Object.keys(body).length)
        throw new RequestError(400, 'invalid-stop');
      reply(response, 200, store.stopSession(session.id));
      return;
    }
    const parts = url.pathname
      .split('/')
      .slice(1)
      .map((p) => decodeURIComponent(p));
    if (parts.length < 4 || parts[0] !== 'api')
      throw new RequestError(404, 'route-missing');
    const [, tenant, destination, route, id, action] = parts;
    store.scope(session, tenant, destination);
    if (route === 'snapshot' && parts.length === 4 && method === 'GET') {
      reply(response, 200, store.snapshot(session, tenant, destination));
      return;
    }
    if (route === 'reviews' && parts.length === 4 && method === 'POST') {
      status = 202;
      reply(
        response,
        status,
        store.createReview(session, tenant, destination, body)
      );
      return;
    }
    if (route === 'reviews' && parts.length <= 5 && method === 'GET') {
      reply(response, 200, store.reviews(session, tenant, destination, id));
      return;
    }
    if (
      route === 'reviews' &&
      parts.length === 6 &&
      action === 'decision' &&
      method === 'POST'
    ) {
      reply(
        response,
        200,
        store.decision(session, tenant, destination, id, body)
      );
      return;
    }
    if (route === 'commands' && parts.length === 4 && method === 'POST') {
      const result = store.apply(
        session,
        tenant,
        destination,
        body,
        (receipt) => killAt('before-commit', receipt.commandId)
      );
      if (result.crashing || killAt('after-commit', result.receipt.commandId))
        return;
      if (heldCommands.has(result.receipt.commandId)) {
        const entry = { response, receipt: result.receipt };
        const queue = heldResponses.get(result.receipt.commandId) ?? [];
        queue.push(entry);
        heldResponses.set(result.receipt.commandId, queue);
        response.once('close', () => {
          const current = heldResponses.get(result.receipt.commandId);
          if (!current) return;
          const remaining = current.filter((x) => x !== entry);
          if (remaining.length)
            heldResponses.set(result.receipt.commandId, remaining);
          else heldResponses.delete(result.receipt.commandId);
        });
        process.send({
          type: 'event',
          event: 'response-held',
          commandId: result.receipt.commandId,
          status: result.receipt.status,
          pid: process.pid,
        });
        return;
      }
      reply(response, 200, result.receipt);
      return;
    }
    if (route === 'receipts' && parts.length === 5 && method === 'GET') {
      reply(response, 200, store.receipt(session, tenant, destination, id));
      return;
    }
    if (
      route === 'sessions' &&
      parts.length === 6 &&
      action === 'stop' &&
      method === 'POST'
    ) {
      if (!body || Object.keys(body).length)
        throw new RequestError(400, 'invalid-stop');
      reply(response, 200, store.stopOther(session, tenant, destination, id));
      return;
    }
    if (route === 'events' && parts.length === 4 && method === 'GET') {
      reply(
        response,
        200,
        store.events(
          session,
          tenant,
          destination,
          Number(url.searchParams.get('after') ?? 0),
          Number(url.searchParams.get('limit') ?? 100)
        )
      );
      return;
    }
    throw new RequestError(404, 'route-missing');
  } catch (error) {
    status = error instanceof RequestError ? error.status : 500;
    errorCode = error instanceof RequestError ? error.code : 'authority-error';
    reply(response, status, { error: errorCode });
  } finally {
    requests.push({
      method: request.method,
      status,
      ...(errorCode ? { error: errorCode } : {}),
    });
    if (requests.length > 128) requests.shift();
  }
});
server.requestTimeout = 5000;
server.headersTimeout = 5000;
server.keepAliveTimeout = 1000;
process.on('message', async (message) => {
  if (message?.type !== 'host') return;
  const { id, action, payload = {} } = message;
  try {
    let result;
    if (action === 'create-session') result = store.createSession(payload);
    else if (action === 'diagnostics')
      result = {
        ...store.diagnostics(),
        requests: [...requests],
        heldResponses: Object.fromEntries(
          [...heldResponses].map(([key, value]) => [key, value.length])
        ),
        pid: process.pid,
      };
    else if (action === 'patch') result = store.hostPatch(payload);
    else if (action === 'replace-entity')
      result = store.hostPatch({ ...payload, replace: true });
    else if (action === 'stop-session')
      result = store.stopSession(payload.sessionId);
    else if (action === 'revoke-session')
      result = store.revokeSession(payload.sessionId);
    else if (['crash-before-commit', 'crash-after-commit'].includes(action)) {
      crash = { phase: action.slice(6), commandId: payload.commandId };
      result = { armed: true };
    } else if (action === 'hold-response') {
      heldCommands.add(payload.commandId);
      result = { armed: true };
    } else if (action === 'release-response') {
      heldCommands.delete(payload.commandId);
      const queue = heldResponses.get(payload.commandId) ?? [];
      heldResponses.delete(payload.commandId);
      for (const { response, receipt } of queue) reply(response, 200, receipt);
      result = { released: queue.length };
    } else if (action === 'shutdown') {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      store.close();
      process.send({ type: 'reply', id, result: { stopped: true } }, () =>
        process.exit(0)
      );
      return;
    } else throw new Error('Unknown host action');
    process.send({ type: 'reply', id, result });
  } catch (error) {
    process.send({
      type: 'reply',
      id,
      error: error instanceof RequestError ? error.code : String(error.message),
    });
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(options.port ?? 0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
process.send({
  type: 'ready',
  url: origin,
  pid: process.pid,
  database: store.describeDatabase(),
});
