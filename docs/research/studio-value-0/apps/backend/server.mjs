/**
 * STUDIO-VALUE-0 — shared backend. NON-SHIPPING RESEARCH FIXTURE.
 *
 * One backend, two clients (NgRx arm and SignalTree arm). Both hit this exact
 * implementation so the server side of the comparison is identical by
 * construction rather than by care.
 *
 * Zero dependencies, plain node:http, so it cannot drift and needs no install.
 *
 *   node server.mjs            # port 8787
 *
 * OBSERVABILITY RULE — load-bearing, and the reason the previous fixture was
 * ruled inadmissible: emit FACTS, never CONCLUSIONS. No log line may name the
 * defect, reference a ticket, or explain what a job failed to do. The
 * investigator must derive the mechanism; the logs must not hand it over.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8787);

/** Authoritative cart state. Money in integer minor units. */
const cart = {
  id: '88213',
  currency: 'USD',
  subtotal: 12000,
  promoCode: null,
  discount: 0,
  total: 12000,
  status: 'idle',
  revision: 3301,
};

const PROMOS = { SAVE20: { percent: 20 } };
const TIER = { silver: { maxPromoDiscount: 1800 } };
const customerTier = 'silver';

/** Append-only mutation record. Facts only. */
const mutations = [];
/** OTel-shaped spans. */
const spans = [];
/** Structured service log. Facts only. */
const serviceLog = [];
/** Connected SSE clients for push. */
const subscribers = new Set();

const now = () => new Date().toISOString();
const hex = (n) => randomUUID().replace(/-/g, '').slice(0, n);

function log(level, fields) {
  serviceLog.push({ at: now(), level, ...fields });
}

function span(name, attributes, traceId, parentSpanId = null) {
  const s = {
    spanId: hex(16),
    parent: parentSpanId,
    traceId,
    name,
    start: now(),
    end: null,
    attributes,
  };
  spans.push(s);
  return s;
}

function applyChanges(changes, ctx) {
  cart.revision += 1;
  const before = {};
  for (const [field, value] of Object.entries(changes)) {
    before[field] = cart[field];
    cart[field] = value;
  }
  mutations.push({
    at: now(),
    cartRevision: cart.revision,
    requestId: ctx.requestId,
    traceId: ctx.traceId,
    spanId: ctx.spanId ?? null,
    actor: ctx.actor,
    sourceService: ctx.service,
    reasonCode: ctx.reasonCode,
    schemaVersion: 1,
    changes: Object.fromEntries(
      Object.entries(changes).map(([f, v]) => [f, { before: before[f], after: v }])
    ),
  });
  return cart.revision;
}

function push(messageId, patch, ctx) {
  const frame = {
    messageId,
    channel: `cart.${cart.id}`,
    cartRevision: cart.revision,
    traceId: ctx.traceId,
    producerSpanId: ctx.spanId ?? null,
    sentAt: now(),
    patch,
  };
  const payload = `data: ${JSON.stringify(frame)}\n\n`;
  for (const res of subscribers) res.write(payload);
  return frame;
}

function snapshot() {
  return { ...cart };
}

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(text),
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
  });
  res.end(text);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const traceId = req.headers['x-trace-id'] ?? hex(32);
  const requestId = req.headers['x-request-id'] ?? `rq-${hex(6)}`;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  // --- push channel -------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    res.write(`: connected ${now()}\n\n`);
    subscribers.add(res);
    log('info', { service: 'cart-api', event: 'subscriber.connected', channel: `cart.${cart.id}`, subscribers: subscribers.size });
    req.on('close', () => {
      subscribers.delete(res);
      log('info', { service: 'cart-api', event: 'subscriber.disconnected', subscribers: subscribers.size });
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === `/carts/${cart.id}`) {
    const s = span('GET /carts/:id', { 'http.route': '/carts/:id', 'request.id': requestId }, traceId);
    s.end = now();
    s.attributes['http.response.status_code'] = 200;
    s.attributes['cart.revision'] = cart.revision;
    return json(res, 200, snapshot());
  }

  // --- promo validation ---------------------------------------------------
  if (req.method === 'POST' && url.pathname === `/carts/${cart.id}/promo`) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { code } = JSON.parse(body || '{}');
      const httpSpan = span('POST /carts/:id/promo', { 'http.route': '/carts/:id/promo', 'request.id': requestId }, traceId);
      const validate = span('promo-service.validate', { 'promo.code': code }, traceId, httpSpan.spanId);

      const promo = PROMOS[code];
      if (!promo) {
        validate.end = now();
        httpSpan.end = now();
        httpSpan.attributes['http.response.status_code'] = 404;
        log('info', { service: 'promo-service', requestId, traceId, event: 'promo.lookup', code, found: false });
        return json(res, 404, { error: 'unknown_promo', requestId });
      }

      const nominal = Math.round((cart.subtotal * promo.percent) / 100);
      const cap = TIER[customerTier].maxPromoDiscount;
      const applied = Math.min(nominal, cap);

      validate.attributes['promo.nominal'] = nominal;
      validate.attributes['promo.applied'] = applied;
      validate.attributes['promo.cap_rule'] = `tier.${customerTier}.maxPromoDiscount`;
      validate.end = now();

      log('info', {
        service: 'promo-service', requestId, traceId, event: 'promo.evaluated',
        code, tier: customerTier, nominalDiscount: nominal, capLimit: cap, appliedDiscount: applied,
      });

      const revision = applyChanges(
        { promoCode: code, discount: applied, total: cart.subtotal - applied, status: 'idle' },
        { requestId, traceId, spanId: httpSpan.spanId, actor: 'svc-promo', service: 'promo-service', reasonCode: 'promo.applied' }
      );

      httpSpan.end = now();
      httpSpan.attributes['http.response.status_code'] = 200;
      httpSpan.attributes['cart.revision'] = revision;
      return json(res, 200, { ...snapshot(), requestId, traceId });
    });
    return;
  }

  // --- maintenance job: THE INJECTED DEFECT -------------------------------
  // Clears promo attribution fields. Does not touch `total`. No log line says
  // so — the investigator must notice the omission from the patch itself.
  if (req.method === 'POST' && url.pathname === '/jobs/expire-stale-promos') {
    const jobTrace = hex(32);
    const jobSpan = span('cart-maintenance.expire_stale_promos', { 'service.name': 'cart-maintenance', 'request.id': requestId, 'job.name': 'expire-stale-promos' }, jobTrace);

    log('info', { service: 'cart-maintenance', requestId, traceId: jobTrace, event: 'job.started', job: 'expire-stale-promos' });

    let updated = 0;
    let frame = null;
    if (cart.promoCode !== null) {
      const revision = applyChanges(
        { promoCode: null, discount: 0 },
        { requestId, traceId: jobTrace, spanId: jobSpan.spanId, actor: 'svc-cart-maintenance', service: 'cart-maintenance', reasonCode: 'promo.window_elapsed' }
      );
      updated = 1;
      frame = push(`msg-${hex(8)}`, { promoCode: null, discount: 0 }, { traceId: jobTrace, spanId: jobSpan.spanId });
      log('info', { service: 'cart-maintenance', requestId, traceId: jobTrace, event: 'cart.updated', cart: cart.id, cartRevision: revision, fields: ['promoCode', 'discount'] });
    }

    jobSpan.attributes['carts.scanned'] = 1;
    jobSpan.attributes['carts.updated'] = updated;
    jobSpan.end = now();
    log('info', { service: 'cart-maintenance', requestId, traceId: jobTrace, event: 'job.finished', scanned: 1, updated });

    return json(res, 200, { updated, cartRevision: cart.revision, messageId: frame?.messageId ?? null });
  }

  // --- evidence export ----------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/__evidence') {
    return json(res, 200, { exportedAt: now(), finalState: snapshot(), mutations, spans, serviceLog });
  }

  if (req.method === 'POST' && url.pathname === '/__reset') {
    Object.assign(cart, { promoCode: null, discount: 0, total: 12000, status: 'idle', revision: 3301 });
    mutations.length = 0; spans.length = 0; serviceLog.length = 0;
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  log('info', { service: 'cart-api', event: 'listening', port: PORT });
  process.stdout.write(`STUDIO-VALUE-0 backend on http://localhost:${PORT}\n`);
});
