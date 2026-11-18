import { fork } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = join(dirname(fileURLToPath(import.meta.url)), 'server.mjs');
export async function startAuthorityProcess(options) {
  const config = {
    ...options,
    database: resolve(options.database),
    ...(options.siteDirectory
      ? { siteDirectory: resolve(options.siteDirectory) }
      : {}),
  };
  mkdirSync(dirname(config.database), { recursive: true });
  if (config.outputDirectory)
    mkdirSync(config.outputDirectory, { recursive: true });
  const child = fork(server, [JSON.stringify(config)], {
    execPath: process.execPath,
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const pending = new Map(),
    events = [],
    listeners = new Set();
  let serial = 0,
    readyResolve,
    readyReject,
    exitResolve,
    exited = false;
  const ready = new Promise((yes, no) => {
    readyResolve = yes;
    readyReject = no;
  });
  const exit = new Promise((yes) => {
    exitResolve = yes;
  });
  const log = (name, bytes) => {
    if (config.outputDirectory)
      appendFileSync(
        join(config.outputDirectory, `${child.pid}-${name}.log`),
        bytes
      );
  };
  child.stdout.on('data', (b) => log('stdout', b));
  child.stderr.on('data', (b) => log('stderr', b));
  child.on('error', (error) => {
    readyReject(error);
    for (const p of pending.values()) p.reject(error);
  });
  child.on('exit', (code, signal) => {
    exited = true;
    readyReject(
      new Error(`Authority exited before readiness (${code}, ${signal})`)
    );
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error(`Authority exited (${code}, ${signal})`));
    }
    pending.clear();
    for (const listener of listeners) {
      clearTimeout(listener.timer);
      listener.reject(new Error('Authority exited before expected event'));
    }
    listeners.clear();
    exitResolve({ code, signal, pid: child.pid });
  });
  child.on('message', (message) => {
    if (message?.type === 'ready') readyResolve(message);
    else if (message?.type === 'reply') {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.result);
    } else if (message?.type === 'event') {
      events.push(message);
      log('events', JSON.stringify(message) + '\n');
      for (const listener of [...listeners])
        if (listener.predicate(message)) {
          listeners.delete(listener);
          clearTimeout(listener.timer);
          listener.resolve(message);
        }
    }
  });
  const startupTimer = setTimeout(() => {
    child.kill('SIGKILL');
    readyReject(new Error('Authority startup timeout'));
  }, 10000);
  let initial;
  try {
    initial = await ready;
  } finally {
    clearTimeout(startupTimer);
  }
  const host = (action, payload = {}) =>
    new Promise((yes, no) => {
      if (exited) {
        no(new Error('Authority already exited'));
        return;
      }
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        no(new Error('Host control timeout: ' + action));
      }, 10000);
      pending.set(id, { resolve: yes, reject: no, timer });
      child.send({ type: 'host', id, action, payload });
    });
  return {
    url: initial.url,
    pid: initial.pid,
    database: initial.database,
    host,
    waitForExit: () => exit,
    waitForEvent(predicate, timeout = 10000) {
      const existing = events.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((yes, no) => {
        const listener = { predicate, resolve: yes, reject: no };
        listener.timer = setTimeout(() => {
          listeners.delete(listener);
          no(new Error('Authority event timeout'));
        }, timeout);
        listeners.add(listener);
      });
    },
    async stop() {
      if (exited) return exit;
      await host('shutdown');
      return exit;
    },
    async kill() {
      if (!exited) child.kill('SIGKILL');
      return exit;
    },
  };
}

export async function request(authority, session, path, body) {
  const response = await fetch(authority.url + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${session.token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
export const scopePath = (session, destination = 'dispatch') =>
  `/api/${encodeURIComponent(session.tenant)}/${encodeURIComponent(
    destination
  )}`;
export function commandFor(session, observation, id, patch, reads = []) {
  return {
    commandId: id,
    operationId: 'operation-' + id,
    sessionId: session.sessionId,
    sessionEpoch: session.epoch,
    actor: { kind: 'unknown' },
    proposal: {
      entityId: observation.entityId,
      expectedInstance: observation.instance,
      patch,
      expected: Object.fromEntries(
        [...new Set([...Object.keys(patch), ...reads])].map((k) => [
          k,
          observation.versions[k],
        ])
      ),
    },
  };
}
