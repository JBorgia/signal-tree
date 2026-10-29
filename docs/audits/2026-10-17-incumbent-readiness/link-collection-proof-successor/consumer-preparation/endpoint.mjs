import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';

// Synthetic, process-local fixture. Listen only on loopback; no persistence claim.
export function createEndpoint() {
  const events = new EventEmitter();
  const log = [];
  const held = new Map();
  let rows = [];
  let nextId = 0;
  let holdNext = 0;
  let failNext = 0;
  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const finish = (entry, res, fail) => {
    held.delete(entry.id);
    if (res.destroyed) { entry.outcome = 'client-disconnected'; return; }
    if (fail) {
      entry.outcome = 'failed-before-apply';
      send(res, 503, { error: 'scripted failure', requestId: entry.id });
    } else {
      rows = structuredClone(entry.payload);
      entry.outcome = 'applied';
      send(res, 200, { requestId: entry.id, rows });
    }
  };
  async function body(req) {
    let text = '';
    for await (const part of req) {
      text += part.toString();
      if (Buffer.byteLength(text) > 65536) throw new Error('body exceeds 64KiB');
    }
    return text ? JSON.parse(text) : {};
  }
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/orders/PO-42/items') return send(res, 200, rows);
      if (req.method === 'GET' && req.url === '/control/log') return send(res, 200, { log, held: [...held.keys()], holdNext, failNext });
      if (req.method === 'PUT' && req.url === '/orders/PO-42/items') {
        const payload = await body(req);
        if (!Array.isArray(payload) || payload.some(row => !row || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.status !== 'string') || new Set(payload.map(row => row.id)).size !== payload.length) {
          return send(res, 400, { error: 'expected unique {id,title,status} rows' });
        }
        const entry = { id: ++nextId, payload: structuredClone(payload), outcome: 'received' };
        log.push(entry);
        if (holdNext > 0) {
          holdNext--;
          entry.outcome = 'held';
          held.set(entry.id, { entry, res });
          res.on('close', () => {
            if (held.delete(entry.id)) entry.outcome = 'client-disconnected';
          });
        } else {
          const fail = failNext > 0;
          if (fail) failNext--;
          finish(entry, res, fail);
        }
        events.emit('received', entry.id);
        return;
      }
      if (req.method === 'POST' && req.url === '/control/hold') {
        holdNext++;
        return send(res, 200, { holdNext });
      }
      if (req.method === 'POST' && req.url === '/control/fail') {
        failNext++;
        return send(res, 200, { failNext });
      }
      if (req.method === 'POST' && req.url === '/control/release') {
        const request = await body(req);
        const pending = held.get(request.id);
        if (!pending) return send(res, 404, { error: 'held id missing' });
        if (request.outcome !== 'ack' && request.outcome !== 'fail') return send(res, 400, { error: 'outcome must be ack or fail' });
        finish(pending.entry, pending.res, request.outcome === 'fail');
        return send(res, 200, { released: request.id });
      }
      if (req.method === 'POST' && req.url === '/control/reset') {
        if (held.size) return send(res, 409, { error: 'release pending requests before reset' });
        rows = []; log.length = 0; holdNext = 0; failNext = 0;
        // Request IDs remain monotonic across reset, preventing stale control reuse.
        return send(res, 200, { reset: true });
      }
      send(res, 404, { error: 'route missing' });
    } catch (error) {
      if (!res.headersSent && !res.destroyed) send(res, 400, { error: error instanceof Error ? error.message : 'bad request' });
    }
  });
  return {
    server, events,
    async listen(port = 0) {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('missing TCP address');
      return `http://127.0.0.1:${address.port}`;
    },
    async close() {
      for (const { entry, res } of [...held.values()]) finish(entry, res, true);
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = createEndpoint();
  console.log(await fixture.listen(Number(process.env.PORT ?? 4317)));
  process.once('SIGINT', () => { void fixture.close(); });
  process.once('SIGTERM', () => { void fixture.close(); });
}
