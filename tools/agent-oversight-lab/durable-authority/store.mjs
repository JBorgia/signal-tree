import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code) => {
  throw new RequestError(status, code);
};
const text = (v, max = 160) =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, allowed) =>
  plain(v) && Object.keys(v).every((k) => allowed.includes(k));
const fields = ['route', 'note', 'window', 'capacity'];
const defaults = () => ({
  route: 'north',
  note: '',
  window: '09:00',
  capacity: 10,
});
const revisions = () => ({ route: 0, note: 0, window: 0, capacity: 0 });
const parse = (v) => JSON.parse(v);
export const canonical = (value) =>
  JSON.stringify(value, function (_key, item) {
    return plain(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item;
  });
const hash = (value) => createHash('sha256').update(value).digest('hex');

export class AuthorityStore {
  constructor(path, { auditLimit = 256, maxPendingReviews = 32 } = {}) {
    assert(
      Number.isSafeInteger(auditLimit) && auditLimit >= 4 && auditLimit <= 4096
    );
    assert(
      Number.isSafeInteger(maxPendingReviews) &&
        maxPendingReviews > 0 &&
        maxPendingReviews <= 1024
    );
    this.auditLimit = auditLimit;
    this.maxPendingReviews = maxPendingReviews;
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec(`
      PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, principal TEXT NOT NULL,
        tenant TEXT NOT NULL, role TEXT NOT NULL, destinations TEXT NOT NULL,
        epoch INTEGER NOT NULL, stopped INTEGER NOT NULL DEFAULT 0,
        revoked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS entities (
        tenant TEXT NOT NULL, destination TEXT NOT NULL, entity_id TEXT NOT NULL,
        instance TEXT NOT NULL, value_json TEXT NOT NULL, versions_json TEXT NOT NULL,
        effects INTEGER NOT NULL DEFAULT 0, host_effects INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(tenant,destination,entity_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS reviews (
        tenant TEXT NOT NULL, destination TEXT NOT NULL, request_id TEXT NOT NULL,
        principal TEXT NOT NULL, session_id TEXT NOT NULL, epoch INTEGER NOT NULL,
        command_id TEXT NOT NULL, command_json TEXT NOT NULL, digest TEXT NOT NULL,
        status TEXT NOT NULL, reviewer TEXT, decision_at TEXT,
        PRIMARY KEY(tenant,destination,request_id),
        UNIQUE(tenant,destination,principal,command_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS receipts (
        tenant TEXT NOT NULL, destination TEXT NOT NULL, principal TEXT NOT NULL,
        command_id TEXT NOT NULL, digest TEXT NOT NULL, receipt_json TEXT NOT NULL,
        PRIMARY KEY(tenant,destination,principal,command_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS audit_sequences (
        tenant TEXT NOT NULL, destination TEXT NOT NULL, sequence INTEGER NOT NULL,
        PRIMARY KEY(tenant,destination)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS audit_events (
        tenant TEXT NOT NULL, destination TEXT NOT NULL, sequence INTEGER NOT NULL,
        record_json TEXT NOT NULL, PRIMARY KEY(tenant,destination,sequence)
      ) STRICT;
    `);
  }
  get(sql, ...args) {
    return this.db.prepare(sql).get(...args);
  }
  all(sql, ...args) {
    return this.db.prepare(sql).all(...args);
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  atomic(body) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = body();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }
  describeDatabase() {
    return {
      sqliteVersion: this.get('SELECT sqlite_version() AS version').version,
      journalMode: this.get('PRAGMA journal_mode').journal_mode,
      synchronous: this.get('PRAGMA synchronous').synchronous,
      foreignKeys: this.get('PRAGMA foreign_keys').foreign_keys,
    };
  }
  audit(tenant, destination, kind, context = {}) {
    this.run(
      'INSERT INTO audit_sequences VALUES (?,?,1) ON CONFLICT(tenant,destination) DO UPDATE SET sequence=sequence+1',
      tenant,
      destination
    );
    const { sequence } = this.get(
      'SELECT sequence FROM audit_sequences WHERE tenant=? AND destination=?',
      tenant,
      destination
    );
    // Explicit allowlist: authority events never contain tokens, patches, notes,
    // arbitrary actor labels, model instructions or raw exception strings.
    const record = {
      sequence,
      tenant,
      destination,
      kind,
      timestamp: new Date().toISOString(),
    };
    for (const key of [
      'principal',
      'reviewer',
      'sessionId',
      'epoch',
      'operationId',
      'commandId',
      'requestId',
      'status',
      'reason',
      'instance',
      'digest',
    ]) {
      if (context[key] !== undefined) record[key] = context[key];
    }
    this.run(
      'INSERT INTO audit_events VALUES (?,?,?,?)',
      tenant,
      destination,
      sequence,
      JSON.stringify(record)
    );
    this.run(
      'DELETE FROM audit_events WHERE tenant=? AND destination=? AND sequence<=?',
      tenant,
      destination,
      sequence - this.auditLimit
    );
    return record;
  }
  createSession({ principal, tenant, role, destinations = ['dispatch'] }) {
    assert(
      text(principal) && text(tenant) && ['proposer', 'reviewer'].includes(role)
    );
    assert(
      Array.isArray(destinations) &&
        destinations.length > 0 &&
        destinations.length <= 4 &&
        destinations.every((d) => text(d))
    );
    const token = randomBytes(32).toString('base64url'),
      id = randomUUID();
    return this.atomic(() => {
      const epoch =
        (this.get(
          'SELECT MAX(epoch) AS epoch FROM sessions WHERE principal=? AND tenant=?',
          principal,
          tenant
        ).epoch ?? 0) + 1;
      this.run(
        'UPDATE sessions SET stopped=1 WHERE principal=? AND tenant=?',
        principal,
        tenant
      );
      this.run(
        "UPDATE reviews SET status='revoked' WHERE principal=? AND tenant=? AND status IN ('pending','approved')",
        principal,
        tenant
      );
      this.run(
        'INSERT INTO sessions(id,token_hash,principal,tenant,role,destinations,epoch,created_at) VALUES (?,?,?,?,?,?,?,?)',
        id,
        hash(token),
        principal,
        tenant,
        role,
        JSON.stringify(destinations),
        epoch,
        new Date().toISOString()
      );
      for (const destination of destinations) {
        this.run(
          'INSERT OR IGNORE INTO entities VALUES (?,?,?,?,?,?,0,0)',
          tenant,
          destination,
          'delivery-1',
          randomUUID(),
          JSON.stringify(defaults()),
          JSON.stringify(revisions())
        );
        this.audit(tenant, destination, 'session-created', {
          principal,
          sessionId: id,
          epoch,
        });
      }
      return {
        token,
        ...this.publicSession(
          this.get('SELECT * FROM sessions WHERE id=?', id)
        ),
      };
    });
  }
  publicSession(session) {
    return {
      sessionId: session.id,
      epoch: session.epoch,
      principal: session.principal,
      tenant: session.tenant,
      role: session.role,
      destinations: parse(session.destinations),
      stopped: Boolean(session.stopped),
    };
  }
  authenticate(header) {
    if (
      typeof header !== 'string' ||
      !/^Bearer [A-Za-z0-9_-]{43}$/.test(header)
    )
      fail(401, 'authentication-required');
    const session = this.get(
      'SELECT * FROM sessions WHERE token_hash=?',
      hash(header.slice(7))
    );
    if (!session || session.revoked) fail(401, 'authentication-required');
    return session;
  }
  scope(session, tenant, destination) {
    if (
      session.tenant !== tenant ||
      !parse(session.destinations).includes(destination)
    )
      fail(403, 'scope-forbidden');
  }
  writable(session, role) {
    if (session.role !== role) fail(403, 'role-forbidden');
    if (session.stopped || session.revoked) fail(409, 'session-stopped');
  }
  snapshot(session, tenant, destination) {
    this.scope(session, tenant, destination);
    const row = this.get(
      'SELECT * FROM entities WHERE tenant=? AND destination=? AND entity_id=?',
      tenant,
      destination,
      'delivery-1'
    );
    if (!row) fail(404, 'entity-missing');
    return {
      entityId: row.entity_id,
      instance: row.instance,
      values: parse(row.value_json),
      versions: parse(row.versions_json),
    };
  }
  validateCommand(session, tenant, destination, command) {
    if (
      !keys(command, [
        'commandId',
        'operationId',
        'sessionId',
        'sessionEpoch',
        'actor',
        'proposal',
      ]) ||
      !text(command.commandId) ||
      !text(command.operationId) ||
      command.sessionId !== session.id ||
      command.sessionEpoch !== session.epoch
    )
      fail(400, 'invalid-command-identity');
    const actor = command.actor;
    if (
      !keys(actor, ['kind', 'label']) ||
      !['unknown', 'declared'].includes(actor.kind) ||
      (actor.kind === 'declared' && !text(actor.label)) ||
      (actor.kind === 'unknown' && Object.hasOwn(actor, 'label'))
    )
      fail(400, 'invalid-declared-actor');
    const p = command.proposal;
    if (
      !keys(p, ['entityId', 'expectedInstance', 'patch', 'expected']) ||
      p.entityId !== 'delivery-1' ||
      !text(p.expectedInstance) ||
      !keys(p.patch, fields) ||
      !keys(p.expected, fields) ||
      Object.keys(p.patch).length === 0
    )
      fail(400, 'invalid-proposal');
    for (const [key, value] of Object.entries(p.patch)) {
      if (
        !Object.hasOwn(p.expected, key) ||
        (key === 'capacity'
          ? !Number.isFinite(value) || typeof value !== 'number'
          : typeof value !== 'string' || value.length > 512)
      )
        fail(400, 'invalid-patch');
    }
    if (
      !Object.values(p.expected).every((v) => Number.isSafeInteger(v) && v >= 0)
    )
      fail(400, 'invalid-versions');
    const encoded = canonical(command);
    return {
      encoded,
      digest: hash(
        canonical({
          tenant,
          destination,
          principal: session.principal,
          command,
        })
      ),
    };
  }
  viewReview(row) {
    return {
      requestId: row.request_id,
      principal: row.principal,
      sessionId: row.session_id,
      sessionEpoch: row.epoch,
      command: parse(row.command_json),
      digest: row.digest,
      status: row.status,
      reviewer: row.reviewer,
      decisionAt: row.decision_at,
    };
  }
  createReview(session, tenant, destination, body) {
    this.scope(session, tenant, destination);
    this.writable(session, 'proposer');
    if (!keys(body, ['requestId', 'command']) || !text(body.requestId))
      fail(400, 'invalid-review-request');
    const { encoded, digest } = this.validateCommand(
      session,
      tenant,
      destination,
      body.command
    );
    return this.atomic(() => {
      const prior = this.get(
        'SELECT * FROM reviews WHERE tenant=? AND destination=? AND request_id=?',
        tenant,
        destination,
        body.requestId
      );
      if (prior) {
        if (
          prior.principal !== session.principal ||
          prior.session_id !== session.id ||
          prior.digest !== digest
        )
          fail(409, 'review-identity-reused');
        return this.viewReview(prior);
      }
      const collision = this.get(
        'SELECT 1 AS found FROM reviews WHERE tenant=? AND destination=? AND principal=? AND command_id=?',
        tenant,
        destination,
        session.principal,
        body.command.commandId
      );
      if (collision) fail(409, 'command-identity-reused');
      if (
        this.get(
          "SELECT COUNT(*) AS n FROM reviews WHERE tenant=? AND destination=? AND status IN ('pending','approved')",
          tenant,
          destination
        ).n >= this.maxPendingReviews
      )
        fail(429, 'review-capacity');
      this.run(
        "INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?,?,'pending',NULL,NULL)",
        tenant,
        destination,
        body.requestId,
        session.principal,
        session.id,
        session.epoch,
        body.command.commandId,
        encoded,
        digest
      );
      this.audit(tenant, destination, 'review-requested', {
        principal: session.principal,
        sessionId: session.id,
        epoch: session.epoch,
        operationId: body.command.operationId,
        commandId: body.command.commandId,
        requestId: body.requestId,
        digest,
      });
      return this.viewReview(
        this.get(
          'SELECT * FROM reviews WHERE tenant=? AND destination=? AND request_id=?',
          tenant,
          destination,
          body.requestId
        )
      );
    });
  }
  reviews(session, tenant, destination, requestId) {
    this.scope(session, tenant, destination);
    const restricted = session.role !== 'reviewer';
    const filter =
      'tenant=? AND destination=?' +
      (restricted ? ' AND principal=? AND session_id=? AND epoch=?' : '');
    const args = [
      tenant,
      destination,
      ...(restricted ? [session.principal, session.id, session.epoch] : []),
    ];
    if (requestId !== undefined) {
      const row = this.get(
        'SELECT * FROM reviews WHERE ' + filter + ' AND request_id=?',
        ...args,
        requestId
      );
      if (!row) fail(404, 'review-missing');
      return this.viewReview(row);
    }
    // Terminal history is durable but must not turn a routine UI poll into an
    // unbounded allocation or response. Direct by-ID lookup remains available.
    const active = this.all(
      'SELECT * FROM reviews WHERE ' +
        filter +
        " AND status IN ('pending','approved') ORDER BY rowid",
      ...args
    );
    const terminal = this.all(
      'SELECT * FROM reviews WHERE ' +
        filter +
        " AND status NOT IN ('pending','approved') ORDER BY rowid DESC LIMIT 65",
      ...args
    );
    return {
      reviews: [...active, ...terminal.slice(0, 64).reverse()].map((row) =>
        this.viewReview(row)
      ),
      retention: { terminalLimit: 64, terminalTruncated: terminal.length > 64 },
    };
  }
  decision(session, tenant, destination, requestId, body) {
    this.scope(session, tenant, destination);
    this.writable(session, 'reviewer');
    if (
      !keys(body, ['decision', 'expectedDigest']) ||
      !['approve', 'reject', 'revoke'].includes(body.decision) ||
      !text(body.expectedDigest)
    )
      fail(400, 'invalid-decision');
    return this.atomic(() => {
      const review = this.get(
        'SELECT * FROM reviews WHERE tenant=? AND destination=? AND request_id=?',
        tenant,
        destination,
        requestId
      );
      if (!review) fail(404, 'review-missing');
      if (review.principal === session.principal)
        fail(403, 'independent-reviewer-required');
      if (review.digest !== body.expectedDigest)
        fail(409, 'review-digest-mismatch');
      const proposer = this.get(
        'SELECT * FROM sessions WHERE id=?',
        review.session_id
      );
      if (!proposer || proposer.stopped || proposer.revoked)
        fail(409, 'proposer-stopped');
      const target = {
        approve: 'approved',
        reject: 'rejected',
        revoke: 'revoked',
      }[body.decision];
      if (review.status === target) return this.viewReview(review);
      if (
        body.decision === 'revoke'
          ? review.status !== 'approved'
          : review.status !== 'pending'
      )
        fail(409, 'decision-terminal');
      this.run(
        'UPDATE reviews SET status=?,reviewer=?,decision_at=? WHERE tenant=? AND destination=? AND request_id=?',
        target,
        session.principal,
        new Date().toISOString(),
        tenant,
        destination,
        requestId
      );
      this.audit(tenant, destination, 'review-' + target, {
        principal: review.principal,
        reviewer: session.principal,
        commandId: review.command_id,
        requestId,
        sessionId: review.session_id,
        epoch: review.epoch,
        digest: review.digest,
      });
      return this.viewReview(
        this.get(
          'SELECT * FROM reviews WHERE tenant=? AND destination=? AND request_id=?',
          tenant,
          destination,
          requestId
        )
      );
    });
  }
  receipt(session, tenant, destination, commandId) {
    this.scope(session, tenant, destination);
    const row = this.get(
      'SELECT receipt_json FROM receipts WHERE tenant=? AND destination=? AND principal=? AND command_id=?',
      tenant,
      destination,
      session.principal,
      commandId
    );
    if (!row) fail(404, 'receipt-missing');
    return parse(row.receipt_json);
  }
  apply(session, tenant, destination, body, beforeCommit = () => false) {
    this.scope(session, tenant, destination);
    if (session.role !== 'proposer') fail(403, 'role-forbidden');
    if (!keys(body, ['requestId', 'command']) || !text(body.requestId))
      fail(400, 'invalid-command-request');
    const { digest } = this.validateCommand(
      session,
      tenant,
      destination,
      body.command
    );
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const prior = this.get(
        'SELECT * FROM receipts WHERE tenant=? AND destination=? AND principal=? AND command_id=?',
        tenant,
        destination,
        session.principal,
        body.command.commandId
      );
      if (prior) {
        const receipt = parse(prior.receipt_json);
        if (prior.digest !== digest || receipt.requestId !== body.requestId)
          fail(409, 'command-identity-reused');
        this.db.exec('COMMIT');
        return { receipt, duplicate: true };
      }
      const command = body.command;
      const review = this.get(
        'SELECT * FROM reviews WHERE tenant=? AND destination=? AND request_id=?',
        tenant,
        destination,
        body.requestId
      );
      if (
        !review ||
        review.principal !== session.principal ||
        review.session_id !== session.id ||
        review.digest !== digest
      )
        fail(403, 'approval-mismatch');
      let reason;
      if (session.stopped) reason = 'session-stopped';
      else if (review.status !== 'approved')
        reason = 'approval-' + review.status;
      const entity = this.get(
        'SELECT * FROM entities WHERE tenant=? AND destination=? AND entity_id=?',
        tenant,
        destination,
        command.proposal.entityId
      );
      if (
        !reason &&
        (!entity || entity.instance !== command.proposal.expectedInstance)
      )
        reason = 'instance';
      const versions = entity ? parse(entity.versions_json) : {};
      if (
        !reason &&
        Object.entries(command.proposal.expected).some(
          ([key, value]) => versions[key] !== value
        )
      )
        reason = 'conflict';
      let effectSequence = entity?.effects ?? 0;
      if (!reason) {
        const values = parse(entity.value_json);
        for (const [key, value] of Object.entries(command.proposal.patch)) {
          values[key] = value;
          versions[key]++;
        }
        effectSequence++;
        this.run(
          'UPDATE entities SET value_json=?,versions_json=?,effects=? WHERE tenant=? AND destination=? AND entity_id=?',
          JSON.stringify(values),
          JSON.stringify(versions),
          effectSequence,
          tenant,
          destination,
          command.proposal.entityId
        );
      }
      const receipt = {
        commandId: command.commandId,
        operationId: command.operationId,
        sessionId: session.id,
        sessionEpoch: session.epoch,
        principal: session.principal,
        tenant,
        destination,
        requestId: body.requestId,
        commandDigest: digest,
        status: reason ? 'rejected' : 'applied',
        ...(reason ? { reason } : {}),
        effectSequence,
        instance: entity?.instance ?? null,
        timestamp: new Date().toISOString(),
      };
      this.run(
        'INSERT INTO receipts VALUES (?,?,?,?,?,?)',
        tenant,
        destination,
        session.principal,
        command.commandId,
        digest,
        JSON.stringify(receipt)
      );
      this.run(
        'UPDATE reviews SET status=? WHERE tenant=? AND destination=? AND request_id=?',
        receipt.status,
        tenant,
        destination,
        body.requestId
      );
      this.audit(tenant, destination, 'command-' + receipt.status, {
        principal: session.principal,
        sessionId: session.id,
        epoch: session.epoch,
        operationId: command.operationId,
        commandId: command.commandId,
        requestId: body.requestId,
        digest,
        status: receipt.status,
        reason,
        instance: receipt.instance,
      });
      if (beforeCommit(receipt)) return { crashing: true };
      this.db.exec('COMMIT');
      return { receipt, duplicate: false };
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }
  stopSession(id) {
    return this.atomic(() => {
      const session = this.get('SELECT * FROM sessions WHERE id=?', id);
      if (!session) fail(404, 'session-missing');
      this.run('UPDATE sessions SET stopped=1 WHERE id=?', id);
      this.run(
        "UPDATE reviews SET status='revoked' WHERE session_id=? AND status IN ('pending','approved')",
        id
      );
      for (const destination of parse(session.destinations))
        this.audit(session.tenant, destination, 'session-stopped', {
          principal: session.principal,
          sessionId: id,
          epoch: session.epoch,
        });
      return { ...this.publicSession(session), stopped: true };
    });
  }
  revokeSession(id) {
    this.stopSession(id);
    this.run('UPDATE sessions SET revoked=1 WHERE id=?', id);
    return { revoked: true };
  }
  stopOther(session, tenant, destination, targetId) {
    this.scope(session, tenant, destination);
    this.writable(session, 'reviewer');
    const target = this.get('SELECT * FROM sessions WHERE id=?', targetId);
    if (
      !target ||
      target.tenant !== tenant ||
      !parse(target.destinations).includes(destination)
    )
      fail(404, 'session-missing');
    if (
      target.role !== 'proposer' ||
      !parse(target.destinations).every((d) =>
        parse(session.destinations).includes(d)
      )
    )
      fail(403, 'scope-forbidden');
    return this.stopSession(targetId);
  }
  events(session, tenant, destination, after, limit) {
    this.scope(session, tenant, destination);
    if (
      !Number.isSafeInteger(after) ||
      after < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      fail(400, 'invalid-event-window');
    const latest =
      this.get(
        'SELECT sequence FROM audit_sequences WHERE tenant=? AND destination=?',
        tenant,
        destination
      )?.sequence ?? 0;
    const first =
      this.get(
        'SELECT MIN(sequence) AS first FROM audit_events WHERE tenant=? AND destination=?',
        tenant,
        destination
      ).first ?? latest + 1;
    const events = this.all(
      'SELECT record_json FROM audit_events WHERE tenant=? AND destination=? AND sequence>? ORDER BY sequence LIMIT ?',
      tenant,
      destination,
      after,
      limit
    ).map((r) => parse(r.record_json));
    return {
      events,
      retention: {
        firstAvailableSequence: first,
        latestSequence: latest,
        truncated: after < first - 1,
      },
      nextCursor: events.at(-1)?.sequence ?? after,
      hasMore: (events.at(-1)?.sequence ?? after) < latest,
    };
  }
  hostPatch({ tenant, destination = 'dispatch', patch, replace = false }) {
    assert(text(tenant) && text(destination) && keys(patch ?? {}, fields));
    return this.atomic(() => {
      const row = this.get(
        'SELECT * FROM entities WHERE tenant=? AND destination=? AND entity_id=?',
        tenant,
        destination,
        'delivery-1'
      );
      assert(row, 'Seed session/scope first');
      const values = replace
        ? { ...defaults(), ...patch }
        : { ...parse(row.value_json), ...patch };
      const versions = replace ? revisions() : parse(row.versions_json);
      if (!replace) for (const key of Object.keys(patch)) versions[key]++;
      const instance = replace ? randomUUID() : row.instance;
      this.run(
        'UPDATE entities SET instance=?,value_json=?,versions_json=?,host_effects=host_effects+1 WHERE tenant=? AND destination=? AND entity_id=?',
        instance,
        JSON.stringify(values),
        JSON.stringify(versions),
        tenant,
        destination,
        'delivery-1'
      );
      this.audit(
        tenant,
        destination,
        replace ? 'host-entity-replaced' : 'host-input-changed',
        { instance }
      );
      return { entityId: 'delivery-1', instance, values, versions };
    });
  }
  diagnostics() {
    return {
      database: this.describeDatabase(),
      entities: this.all('SELECT * FROM entities').map((r) => ({
        tenant: r.tenant,
        destination: r.destination,
        entityId: r.entity_id,
        instance: r.instance,
        values: parse(r.value_json),
        versions: parse(r.versions_json),
        effects: r.effects,
        hostEffects: r.host_effects,
      })),
      receipts: this.all('SELECT receipt_json FROM receipts').map((r) =>
        parse(r.receipt_json)
      ),
      sessions: this.all('SELECT * FROM sessions').map((s) => ({
        ...this.publicSession(s),
        revoked: Boolean(s.revoked),
      })),
    };
  }
  close() {
    if (this.db.isOpen) this.db.close();
  }
}
