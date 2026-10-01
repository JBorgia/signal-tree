#!/usr/bin/env node
/**
 * Attribute where an arm's time goes: a CPU profile around one driver operation, aggregated by
 * function (self time) and by owner (the arm's lazy chunk = library + arm code, main = Angular +
 * shared harness, GC, other).
 *
 * Build with readable names first; profiling a mangled bundle names nothing:
 *   NG_BUILD_MANGLE=0 npx ng build --configuration production --output-path <dir>
 *
 * Usage:
 *   node scripts/profile.mjs --root <dir>/browser --arm st15-released --op load --rows 50000
 *   ops: load | refetch | edit | move | remove | burst | editors
 *
 * Attribution only: sampling adds overhead, so quote timings from run.mjs, not from here.
 */
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const root = arg('root');
const arm = arg('arm', 'st15-released');
const op = arg('op', 'load');
const rows = Number(arg('rows', 50000));
const top = Number(arg('top', 25));
const repeat = Number(arg('repeat', op === 'load' ? 1 : 3));
const query = arg('footer', 'on') === 'off' ? '?footer=0' : '';
if (!root) throw new Error('--root <unmangled build>/browser is required');

const SEED = 20260930;
const server = await startServer({ root, port: 0 });
const browser = await chromium.launch({ headless: true });
try {
  const page = await (await browser.newContext()).newPage();
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${server.url}/${arm}${query}`);
  await page.waitForFunction(() => window.__bench);
  await page.evaluate(() => window.__bench.ready());
  const call = (method, ...args) =>
    page.evaluate(([m, a]) => window.__bench[m](...a), [method, args]);
  if (op !== 'load') await call('load', rows, SEED, 0);

  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
  await cdp.send('Profiler.start');
  const timings = [];
  for (let r = 0; r < repeat; r++) {
    const s = SEED + 100 + r;
    if (op === 'load') timings.push((await call('load', rows, SEED, 0)).ms);
    else if (op === 'refetch')
      timings.push((await call('load', rows, SEED, r + 1)).ms);
    else if (op === 'edit')
      timings.push(...(await call('edits', 'position-offscreen', 200, s)).ms);
    else if (op === 'burst') timings.push((await call('burst', 100, s)).ms);
    else if (op === 'move' || op === 'remove') {
      const result = await call('reorderAndRemove', 20, s);
      timings.push(...result[op].ms);
    } else if (op === 'editors')
      timings.push(...(await call('editorCycles', 10, 3, s)).open.ms);
    else throw new Error(`unknown --op ${op}`);
  }
  const { profile } = await cdp.send('Profiler.stop');

  // Self time per profile node, from the sample timeline (more exact than hitCount * interval).
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i + 1] ?? 0));
  }
  const owner = (url, name) => {
    if (name === '(garbage collector)') return 'GC';
    if (name === '(idle)' || name === '(program)' || name === '(root)')
      return name;
    if (/\/chunk-[^/]+\.js$/.test(url)) return 'arm chunk (library + arm)';
    if (/\/main-[^/]+\.js$/.test(url)) return 'main (Angular + harness)';
    return url ? 'other script' : 'native/other';
  };
  const byFn = new Map();
  const byOwner = new Map();
  let total = 0;
  for (const node of profile.nodes) {
    const us = self.get(node.id) ?? 0;
    if (!us) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    const name = functionName || '(anonymous)';
    const o = owner(url, name);
    if (o === '(idle)') continue;
    total += us;
    byOwner.set(o, (byOwner.get(o) ?? 0) + us);
    const file = url
      ? url
          .split('/')
          .pop()
          .replace(/-[A-Za-z0-9_]+\.js$/, '')
      : '';
    const key = `${name}  [${file}${url ? `:${lineNumber + 1}` : ''}]`;
    byFn.set(key, (byFn.get(key) ?? 0) + us);
  }
  // Inclusive time per function (a recursive frame is counted once, at its outermost call),
  // and who calls the hottest functions, so a helper's cost lands on the code that needs it.
  const nodesById = new Map(profile.nodes.map((n) => [n.id, n]));
  const parentOf = new Map();
  for (const n of profile.nodes)
    for (const c of n.children ?? []) parentOf.set(c, n.id);
  const nameOf = (n) => n.callFrame.functionName || '(anonymous)';
  const fileOf = (n) =>
    n.callFrame.url
      ? n.callFrame.url
          .split('/')
          .pop()
          .replace(/-[A-Za-z0-9_]+\.js$/, '')
      : '';
  const inclusive = new Map();
  for (const n of profile.nodes) {
    const us = self.get(n.id) ?? 0;
    if (!us || nameOf(n) === '(idle)') continue;
    const seen = new Set();
    for (let id = n.id; id !== undefined; id = parentOf.get(id)) {
      const a = nodesById.get(id);
      const key = `${nameOf(a)}  [${fileOf(a)}]`;
      if (seen.has(key)) continue;
      seen.add(key);
      inclusive.set(key, (inclusive.get(key) ?? 0) + us);
    }
  }
  const callersOf = (fnName) => {
    const out = new Map();
    for (const n of profile.nodes) {
      if (nameOf(n) !== fnName) continue;
      // Attribute this frame's subtree self time to its nearest non-helper caller.
      let sub = 0;
      const stack = [n.id];
      while (stack.length) {
        const id = stack.pop();
        sub += self.get(id) ?? 0;
        stack.push(...(nodesById.get(id).children ?? []));
      }
      let p = parentOf.get(n.id);
      while (
        p !== undefined &&
        /^(\(anonymous\)|__spread\w*|__defNormalProp)$/.test(
          nameOf(nodesById.get(p))
        )
      )
        p = parentOf.get(p);
      const key =
        p === undefined
          ? '(root)'
          : `${nameOf(nodesById.get(p))}  [${fileOf(nodesById.get(p))}]`;
      out.set(key, (out.get(key) ?? 0) + sub);
    }
    return out;
  };
  const ms = (us) => (us / 1000).toFixed(2).padStart(8);
  const pct = (us) => `${((us / total) * 100).toFixed(1).padStart(5)}%`;
  timings.sort((a, b) => a - b);
  console.log(
    `${arm} ${op} rows=${rows} repeat=${repeat}: ${
      timings.length
    } timed ops, median ${timings[Math.floor(timings.length / 2)].toFixed(
      3
    )} ms (with profiler)`
  );
  console.log(`busy (non-idle) samples: ${ms(total)} ms`);
  for (const [o, us] of [...byOwner].sort((a, b) => b[1] - a[1]))
    console.log(`  ${ms(us)} ms ${pct(us)}  ${o}`);
  console.log(`top ${top} functions by self time:`);
  for (const [k, us] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, top))
    console.log(`  ${ms(us)} ms ${pct(us)}  ${k}`);
  console.log(
    `top ${top} functions by inclusive time (arm chunk and harness only):`
  );
  for (const [k, us] of [...inclusive]
    .filter(([k]) => /\[chunk/.test(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, top))
    console.log(`  ${ms(us)} ms ${pct(us)}  ${k}`);
  for (const fn of (arg('callers', '') || '').split(',').filter(Boolean)) {
    console.log(`callers of ${fn} (subtree time, nearest named caller):`);
    for (const [k, us] of [...callersOf(fn)]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8))
      console.log(`  ${ms(us)} ms ${pct(us)}  ${k}`);
  }
} finally {
  await browser.close();
  await server.close();
}
