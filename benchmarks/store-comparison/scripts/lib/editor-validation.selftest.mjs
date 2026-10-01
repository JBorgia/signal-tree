import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the real driver and its pure helpers in memory. Only Angular DI, task scheduling,
// rendering and stores are fixtures; no application bundle or browser is built/launched.
const root = fileURLToPath(new URL('../../', import.meta.url));
const driverPath = resolve(root, 'src/app/shared/driver.ts');
const driverSource = readFileSync(driverPath, 'utf8');
console.log('driver source sha256:', createHash('sha256').update(driverSource).digest('hex'));
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture({ bufferedAt = 0, droppedAt = 0, staleDomAt = 0, checkTiming = false, omitPerEditCheck = false } = {}) {
  let timing = false;
  let ticks = 0;
  let writes = 0;
  let pending;
  const records = new Map();
  const cache = new Map();
  const reads = [];
  function untimed(what) {
    assert.equal(timing, false, `${what} must be outside the timed interval`);
    reads.push({ what, writes });
  }
  function section(record) {
    return {
      querySelector(selector) {
        untimed('DOM read');
        const shown = record.dom;
        const field = selector.match(/^\[data-field="(.*?)"\]$/)?.[1];
        if (field) return { value: String(shown.fields[field]) };
        const line = selector.match(/^\[data-line="(.*?)"\] \[data-f="(.*?)"\]$/);
        if (line) {
          const value = shown.lines.find((item) => item.id === line[1])?.[line[2]];
          return value === undefined ? null : { textContent: String(value) };
        }
        if (selector === '[data-total]')
          return { textContent: String(shown.lines.reduce((sum, l) => sum + l.qty * l.price, 0)) };
        if (selector === '[data-dirty]')
          return { textContent: String(JSON.stringify(shown) !== JSON.stringify(record.seed)) };
        throw new Error(`unsupported fixture selector: ${selector}`);
      },
      querySelectorAll(selector) {
        untimed('DOM membership read');
        assert.equal(selector, '[data-line]');
        return record.dom.lines.map((line) => ({ getAttribute: () => line.id }));
      },
    };
  }
  const document = {
    querySelector(selector) {
      untimed('DOM lookup');
      if (selector === '[data-editor]') return records.size ? {} : null;
      const id = selector.match(/^\[data-editor="(.*?)"\]$/)?.[1];
      const record = records.get(id);
      return record ? section(record) : null;
    },
  };
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    cache.set(path, module.exports);
    let source = readFileSync(path, 'utf8');
    if (path === driverPath && omitPerEditCheck) {
      const check = 'this.expectEditor(`editorCycles.edit ${op.label}`, store, op.expected, true);';
      assert.equal(source.split(check).length, 2, 'mutation must remove exactly one per-edit check');
      source = source.replace(check, '/* self-test: per-edit check removed */');
    }
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: path,
    }).outputText;
    runInNewContext(`(function(require, module, exports) {${js}\n})`, {
      document,
      performance: { now() { timing = !timing; return ++ticks; } },
    })(
      (name) => {
        if (name === './tokens') return { VISIBLE: 50, FOOTER: true };
        assert.ok(name.startsWith('.'), `unexpected runtime import ${name}`);
        return load(resolve(dirname(path), name + '.ts'));
      },
      module,
      module.exports
    );
    return module.exports;
  }
  const { BenchDriver } = load(driverPath);
  const { generateRows } = load(resolve(root, 'src/app/shared/data.ts'));
  const rows = generateRows(4, 123, 0);
  const registry = {
    stores: new Map(),
    open(seed) {
      const record = { seed: clone(seed), state: clone(seed), dom: clone(seed) };
      records.set(seed.rowId, record);
      const read = (what, get) => { untimed(what); return get(); };
      const apply = (write) => {
        writes++;
        if (writes === bufferedAt) { pending = write; return; }
        if (pending) { pending(); pending = undefined; }
        if (writes !== droppedAt) write();
      };
      registry.stores.set(registry.stores.size + 1, {
        set(key, value) { apply(() => { record.state.fields[key] = value; }); },
        updateLine(id, patch) {
          apply(() => Object.assign(record.state.lines.find((line) => line.id === id), patch));
        },
        result: () => read('store result', () => clone(record.state)),
        field: (key) => () => read('store field', () => record.state.fields[key]),
        lineIds: () => read('store line ids', () => record.state.lines.map((line) => line.id)),
        line: (id) => () => read('store line', () => record.state.lines.find((line) => line.id === id)),
        total: () => read('store total', () => record.state.lines.reduce((sum, l) => sum + l.qty * l.price, 0)),
        dirty: () => read('store dirty', () => JSON.stringify(record.state) !== JSON.stringify(record.seed)),
      });
    },
    closeAll() { registry.stores.clear(); records.clear(); },
  };
  const driver = new BenchDriver({
    arm: { id: 'signals', label: 'fixture' },
    registry,
    grid: {
      ids: () => rows.map((row) => row.id),
      row: (id) => () => rows.find((row) => row.id === id),
      update: (id, patch) => Object.assign(rows.find((row) => row.id === id), patch),
    },
    appRef: { async whenStable() {
      for (const record of records.values()) {
        if (writes !== staleDomAt) record.dom = clone(record.state);
      }
    } },
  });
  driver.freshTask = async () => {};
  // Grid validation is outside this editor-only fixture; editor checks remain the real methods.
  driver.expectRow = () => {};
  driver.expectFooter = () => {};
  if (checkTiming) {
    let counter = driver.counter;
    Object.defineProperty(driver, 'counter', {
      get() { return counter; },
      set(value) { untimed('edit counter/planning'); counter = value; },
    });
  }
  return { driver, reads, writes: () => writes };
}

test('immediate writes complete all eight edits per editor across stacked cycles', async () => {
  const f = fixture();
  const result = await f.driver.editorCycles(2, 2, 456);
  assert.equal(result.edit.ms.length, 32);
  assert.equal(f.writes(), 32);
});

test('buffered first edit must fail before a second edit can replay it', async () => {
  const f = fixture({ bufferedAt: 1 });
  await assert.rejects(() => f.driver.editorCycles(1, 1, 456), /editorCycles.*(?:field|result|state)/);
  assert.equal(f.writes(), 1);
});

test('buffered first line edit must fail before the next line edit', async () => {
  const f = fixture({ bufferedAt: 6 });
  await assert.rejects(() => f.driver.editorCycles(1, 1, 456), /editorCycles.*(?:line|result|state)/);
  assert.equal(f.writes(), 6);
});

test('matching wrong store and DOM cannot pass after a dropped write', async () => {
  const f = fixture({ droppedAt: 3 });
  await assert.rejects(() => f.driver.editorCycles(1, 1, 456), /editorCycles.*(?:field|result|state)/);
  assert.equal(f.writes(), 3);
});

test('correct state with stale DOM must fail at that edit', async () => {
  const f = fixture({ staleDomAt: 2 });
  await assert.rejects(() => f.driver.editorCycles(1, 1, 456), /editorCycles.*field/);
  assert.equal(f.writes(), 2);
});

test('each of the eight edit positions rejects a dropped write or stale DOM immediately', async () => {
  for (let at = 1; at <= 8; at++) {
    for (const options of [{ droppedAt: at }, { staleDomAt: at }]) {
      const f = fixture(options);
      await assert.rejects(() => f.driver.editorCycles(1, 1, 456), /editorCycles/);
      assert.equal(f.writes(), at, JSON.stringify(options));
    }
  }
});

test('planning, counters and validation stay outside the real timed interval', async () => {
  const f = fixture({ checkTiming: true });
  await f.driver.editorCycles(1, 1, 456);
  for (let write = 1; write <= 8; write++) {
    assert.ok(f.reads.some((read) => read.writes === write && read.what === 'store result'));
    assert.ok(f.reads.some((read) => read.writes === write && read.what === 'DOM read'));
  }
});

test('self-test kills removal of per-edit validation using buffered field and line edits', async () => {
  for (const bufferedAt of [1, 6]) {
    const mutant = fixture({ bufferedAt, omitPerEditCheck: true });
    // The very same rejection assertion must turn red with the check removed in memory.
    await assert.rejects(
      () => assert.rejects(() => mutant.driver.editorCycles(1, 1, 456), /editorCycles/),
      (error) => error.code === 'ERR_ASSERTION' && /Missing expected rejection/.test(error.message)
    );
    assert.equal(mutant.writes(), 8, 'mutant silently replays the buffered write');
  }
});
