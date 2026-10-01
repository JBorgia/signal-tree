/**
 * One scenario group = one fresh Chromium. Each function launches, drives window.__bench over
 * CDP/Playwright, closes, and returns raw data. Any failure throws (the runner marks the arm).
 *
 * Grid group: a fresh browser CONTEXT (new renderer process) per row count inside the group's
 * browser, so heap from a smaller N cannot sit in the process measured for a larger N.
 */
import { latency } from './stats.mjs';

export const EDIT_KINDS = [
  'position-visible',
  'position-offscreen',
  'status-visible',
];
const SEED = 20260930;

async function openPage(browser, { cpu, timeoutMs }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('crash', () => errors.push('page crashed'));
  const cdp = await context.newCDPSession(page);
  if (cpu && cpu > 1)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

  const withTimeout = (promise, label) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timeout after ${timeoutMs} ms in ${label}`)),
        timeoutMs
      );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  };
  const check = () => {
    if (errors.length) throw new Error(errors.join('; '));
  };
  const bench = async (method, ...args) => {
    const value = await withTimeout(
      page.evaluate(([m, a]) => window.__bench[m](...a), [method, args]),
      `__bench.${method}`
    );
    check();
    return value;
  };
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize;
  };
  /**
   * Bytes the APPLICATION retains: a heap snapshot summed by node type, excluding V8's compiled
   * code and internal system objects. `Runtime.getHeapUsage` also counts code, and repeated editor
   * cycles keep optimising functions for many cycles, which read as a per-cycle "leak" in every
   * arm (first integration run: growth after 45 warm cycles was all code/TrustedByteArray plus the
   * browser's LayoutShift entries, with no application objects).
   */
  const appHeap = async () => {
    for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
    const chunks = [];
    const on = (e) => chunks.push(e.chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', on);
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
    cdp.off('HeapProfiler.addHeapSnapshotChunk', on);
    const snap = JSON.parse(chunks.join(''));
    const {
      node_fields: fields,
      node_types: [types],
    } = snap.snapshot.meta;
    const nf = fields.length,
      typeAt = fields.indexOf('type'),
      nameAt = fields.indexOf('name'),
      sizeAt = fields.indexOf('self_size');
    let app = 0,
      code = 0,
      system = 0;
    for (let i = 0; i < snap.nodes.length; i += nf) {
      const type = types[snap.nodes[i + typeAt]];
      const name = snap.strings[snap.nodes[i + nameAt]];
      const size = snap.nodes[i + sizeAt];
      if (type === 'code') code += size;
      else if (
        type === 'hidden' ||
        type === 'synthetic' ||
        String(name).startsWith('system /') ||
        name === 'LayoutShift' ||
        name === 'LayoutShiftAttribution' ||
        name === 'DOMRectReadOnly'
      )
        system += size;
      else app += size;
    }
    return { app, code, system };
  };
  const dom = async () => {
    const c = await cdp.send('Memory.getDOMCounters');
    return {
      nodes: c.nodes,
      listeners: c.jsEventListeners,
      documents: c.documents,
    };
  };
  /** Navigate to /<route>, wait for the bench API, verify it is the expected arm, await ready(). */
  const open = async (url, route) => {
    await withTimeout(
      page.goto(`${url}/${route}`, { waitUntil: 'load' }),
      `goto /${route}`
    );
    await withTimeout(
      page.waitForFunction(
        () => window.__bench || window.__benchBootError,
        null,
        { timeout: timeoutMs }
      ),
      'wait for __bench'
    );
    const boot = await page.evaluate(() =>
      window.__benchBootError
        ? String(window.__benchBootError.stack ?? window.__benchBootError)
        : null
    );
    if (boot) throw new Error(`__benchBootError: ${boot}`);
    check();
    const id = await page.evaluate(() => window.__bench.arm?.id);
    if (id !== route) throw new Error(`route /${route} booted arm "${id}"`);
    // Without isolation performance.now() is coarsened to 100 us, too coarse for single edits.
    if (!(await page.evaluate(() => globalThis.crossOriginIsolated)))
      throw new Error(
        'page is not cross-origin isolated: timer resolution would be 100 us'
      );
    await bench('ready');
  };
  return {
    context,
    page,
    cdp,
    bench,
    heap,
    appHeap,
    dom,
    open,
    check,
    withTimeout,
  };
}

async function launched(chromium, fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

const timedSummary = (timed) => ({ ms: timed.ms, counters: timed.counters });
const samples = (s) => ({ ms: s.ms, counters: s.counters, ...latency(s.ms) });

export function runStartup(chromium, { url, route, cpu, timeoutMs }) {
  return launched(chromium, async (browser) => {
    const s = await openPage(browser, { cpu, timeoutMs });
    try {
      await s.cdp.send('Network.enable');
      await s.cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      const types = new Map();
      const scripts = [];
      let bytes = 0;
      s.cdp.on('Network.responseReceived', (e) => {
        if (e.type === 'Script') types.set(e.requestId, e.response.url);
      });
      s.cdp.on('Network.loadingFinished', (e) => {
        if (types.has(e.requestId)) {
          bytes += e.encodedDataLength;
          scripts.push({
            url: types.get(e.requestId),
            bytes: e.encodedDataLength,
          });
        }
      });
      await s.cdp.send('Performance.enable');
      const metrics = async () =>
        Object.fromEntries(
          (await s.cdp.send('Performance.getMetrics')).metrics.map((m) => [
            m.name,
            m.value,
          ])
        );
      const before = await metrics();
      await s.open(url, route);
      await new Promise((r) => setTimeout(r, 250)); // let trailing loadingFinished events land
      const after = await metrics();
      return {
        jsBytesGzip: bytes,
        scripts,
        scriptDurationMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
        taskDurationMs: (after.TaskDuration - before.TaskDuration) * 1000,
        jsHeapUsedBytes: after.JSHeapUsedSize,
      };
    } finally {
      await s.context.close().catch(() => {});
    }
  });
}

export function runGrid(
  chromium,
  { url, route, cpu, timeoutMs, rows, counts }
) {
  return launched(chromium, async (browser) => {
    const out = {};
    for (const n of rows) {
      const s = await openPage(browser, { cpu, timeoutMs });
      try {
        await s.open(url, route);
        const baseline = await s.heap();
        await s.bench('resetCounters');
        const load = timedSummary(await s.bench('load', n, SEED, 0));
        const afterLoad = await s.heap();
        await s.bench('resetCounters');
        const refetch = timedSummary(await s.bench('load', n, SEED, 1));
        const edits = {};
        for (const [i, kind] of EDIT_KINDS.entries()) {
          await s.bench('resetCounters');
          edits[kind] = samples(
            await s.bench('edits', kind, counts.edits, SEED + 1 + i)
          );
        }
        await s.bench('resetCounters');
        const burst = timedSummary(
          await s.bench('burst', counts.burst, SEED + 10)
        );
        await s.bench('resetCounters');
        const rr = await s.bench('reorderAndRemove', counts.move, SEED + 20);
        const digest = await s.bench('digest');
        await s.bench('teardown');
        const end = await s.heap();
        const dom = await s.dom();
        out[n] = {
          n,
          heap: { baseline, afterLoad, end },
          load,
          refetch,
          edits,
          burst,
          move: samples(rr.move),
          remove: samples(rr.remove),
          digest,
          dom,
        };
      } finally {
        await s.context.close().catch(() => {});
      }
    }
    return out;
  });
}

export function runEditors(chromium, { url, route, cpu, timeoutMs, counts }) {
  return launched(chromium, async (browser) => {
    const s = await openPage(browser, { cpu, timeoutMs });
    try {
      await s.open(url, route);
      await s.bench('load', 1000, SEED, 0);
      // One cycle first, so the first-use cost of the editor code path is not counted as growth.
      await s.bench('editorCycles', 1, 3, SEED + 99);
      const a1 = await s.appHeap();
      // A library can fill a bounded cache over its first tens of trees (v15: ~200 KB once, inside
      // cycles 5-25, then ~0 per cycle like every other arm). That is reported as one-time growth,
      // and per-cycle retention is measured only after the warm-up.
      await s.bench('editorCycles', counts.warm - 1, 3, SEED + 100);
      const m5 = await s.heap();
      const a5 = await s.appHeap();
      await s.bench('resetCounters');
      const r = await s.bench('editorCycles', counts.measured, 3, SEED + 101);
      const m25 = await s.heap();
      const a25 = await s.appHeap();
      const digest = await s.bench('digest');
      await s.bench('teardown');
      await s.heap(); // GC first, as in the grid group, so DOM counters do not count collectable nodes
      const dom = await s.dom();
      return {
        warmCycles: counts.warm,
        measuredCycles: counts.measured,
        open: samples(r.open),
        edit: samples(r.edit),
        close: samples(r.close),
        heap: { m5, m25, app1: a1, app5: a5, app25: a25 },
        bytesPerCycle: (m25 - m5) / counts.measured,
        appOneTimeBytes: a5.app - a1.app,
        appBytesPerCycle: (a25.app - a5.app) / counts.measured,
        codeBytesPerCycle: (a25.code - a5.code) / counts.measured,
        digest,
        dom,
      };
    } finally {
      await s.context.close().catch(() => {});
    }
  });
}

export function warmUp(chromium, url) {
  return launched(chromium, async (browser) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${url}/`, { waitUntil: 'load' });
  });
}

export async function chromiumVersion(chromium) {
  return launched(chromium, async (b) => b.version());
}
