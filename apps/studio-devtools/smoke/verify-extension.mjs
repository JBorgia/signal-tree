/**
 * Verify the REAL built extension in a real Chromium.
 *
 *     node apps/studio-devtools/build.mjs
 *     node apps/studio-devtools/smoke/build.mjs
 *     node apps/studio-devtools/smoke/serve.mjs &
 *     node apps/studio-devtools/smoke/verify-extension.mjs
 *
 * ⚠️ WHAT THIS CANNOT COVER: `chrome.devtools.panels.create` and
 * `chrome.devtools.inspectedWindow.tabId`. Playwright cannot drive a DevTools
 * window, so those two calls stay manual-only — everything BELOW them is
 * exercised here against the shipped `dist/studio-devtools`, with only
 * `web_accessible_resources` added so a driver page can stand in for the panel.
 *
 * The driver deliberately uses the same API pair the panel uses
 * (`chrome.tabs.connect` -> `chrome.runtime.onConnect`), so a missing
 * `host_permissions` entry fails HERE rather than in a manual run.
 */
import { chromium } from 'playwright';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', '..', '..', 'dist', 'studio-devtools');
const ext = mkdtempSync(join(tmpdir(), 'st-ext-'));
cpSync(dist, ext, { recursive: true });

const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
manifest.web_accessible_resources = [
  { resources: ['verify.html'], matches: ['http://localhost:8791/*'] },
];
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(ext, 'verify.html'), '<!doctype html><meta charset=utf-8><pre id=out>running</pre><script src="verify.js"></script>');
writeFileSync(join(ext, 'verify.js'), `
const PORT = 'signaltree-studio';
const out = (v) => { document.getElementById('out').textContent = JSON.stringify(v, null, 1); };

/** Find the demo tab WITHOUT the "tabs" permission: ask each, keep who answers. */
async function connectToStudioTab() {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) continue;
    const port = chrome.tabs.connect(tab.id, { name: PORT });
    const answered = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 700);
      port.onMessage.addListener(() => { clearTimeout(timer); resolve(true); });
      port.postMessage({ id: 'h', payload: { protocol: 1, id: 'h', command: 'hello' } });
    });
    if (answered) return port;
    port.disconnect();
  }
  return undefined;
}

async function run() {
  const port = await connectToStudioTab();
  if (!port) return out({ error: 'no page answered hello' });

  const pending = new Map();
  port.onMessage.addListener((m) => { pending.get(m.id)?.(m.payload); pending.delete(m.id); });
  let n = 0;
  const req = (command, extra = {}) => new Promise((resolve) => {
    const id = 'v' + ++n;
    const timer = setTimeout(() => resolve({ TIMEOUT: true }), 1500);
    pending.set(id, (v) => { clearTimeout(timer); resolve(v); });
    port.postMessage({ id, payload: { protocol: 1, id, command, ...extra } });
  });

  const result = {};
  result.hello = await req('hello');
  result.listTrees = await req('listTrees');
  const trees = result.listTrees?.value ?? [];
  const app = trees.find((t) => t.label === 'AppTree')?.id;
  const bare = trees.find((t) => t.label === 'BareTree')?.id;

  result.turns = await req('readConfirmedTurns', { treeId: app });
  result.beforeStart = await req('readRealizations', { treeId: app });
  result.bareRefusal = await req('startRealizationCapture', { treeId: bare });
  result.start = await req('startRealizationCapture', { treeId: app });
  result.startAgain = await req('startRealizationCapture', { treeId: app });

  document.documentElement.setAttribute('data-st-armed', '1');
  // The page presses its own button next; wait for the realized write.
  await new Promise((r) => setTimeout(r, 1200));

  result.afterRealization = await req('readRealizations', { treeId: app });
  result.currentValue = await req('readCurrentValue', { treeId: app, path: 'cart.total' });
  result.missingPath = await req('readCurrentValue', { treeId: app, path: 'cart.nope' });
  result.stop = await req('stopRealizationCapture', { treeId: app });
  result.afterStop = await req('readRealizations', { treeId: app });
  out(result);
}
run().catch((e) => out({ threw: String(e) }));
`);

const profile = mkdtempSync(join(tmpdir(), 'st-prof-'));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-first-run'],
});

const errors = [];
ctx.on('weberror', (e) => errors.push(String(e.error())));

const demo = await ctx.newPage();
demo.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await demo.goto('http://localhost:8791/demo.html', { waitUntil: 'load' });

// ⚠️ This manifest has NO service worker and NO background page — nothing to
// read an id from — so it comes from chrome://extensions, which is also the
// only place the manual run would show a load error.
const mgmt = await ctx.newPage();
await mgmt.goto('chrome://extensions');
const extId = await mgmt.evaluate(() => {
  const item = document
    .querySelector('extensions-manager')
    ?.shadowRoot?.querySelector('extensions-item-list')
    ?.shadowRoot?.querySelector('extensions-item');
  return item?.getAttribute('id') ?? undefined;
});
await mgmt.close();

if (!extId) {
  console.error('FAIL: could not determine extension id');
  await ctx.close();
  process.exit(1);
}

const driver = await ctx.newPage();
driver.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await driver.goto(`chrome-extension://${extId}/verify.html`);

// Fire the external realization only once capture is confirmed running.
for (let i = 0; i < 40; i++) {
  const armed = await driver.evaluate(() => document.documentElement.getAttribute('data-st-armed'));
  if (armed) break;
  await new Promise((r) => setTimeout(r, 100));
}
await demo.bringToFront();
await demo.getByRole('button', { name: /10200/ }).click();
await driver.bringToFront();

let raw = 'running';
for (let i = 0; i < 60; i++) {
  raw = await driver.evaluate(() => document.getElementById('out').textContent);
  if (raw !== 'running' && raw.includes('afterStop')) break;
  await new Promise((r) => setTimeout(r, 250));
}
await ctx.close();

const r = JSON.parse(raw);
const value = (k) => r[k]?.value;

/**
 * ⚠️ ASSERTIONS, NOT A PRINTOUT. A script that only logs its findings is read
 * once and then trusted forever; these fail loudly instead.
 */
const checks = [
  ['hello negotiates', () => value('hello')?.protocol === 1],
  ['two trees listed', () => value('listTrees')?.length === 2],
  ['transactions retained without capture', () => value('turns')?.turns?.length === 2],
  ['capture inactive before start', () => value('beforeStart')?.capture === 'inactive'],
  [
    'unobservable tree refused AS `realizations`',
    () =>
      r.bareRefusal?.ok === false &&
      r.bareRefusal.error?.code === 'STUDIO_CAPABILITY_UNAVAILABLE' &&
      r.bareRefusal.error?.capability === 'realizations',
  ],
  ['capture starts', () => value('start')?.started === true],
  ['second start is refused, not duplicated', () => value('startAgain')?.reason === 'already-active'],
  [
    'the external realization was observed',
    () => value('afterRealization')?.snapshot?.effects?.length === 1,
  ],
  [
    'it is a realized external write with both values',
    () => {
      const e = value('afterRealization')?.snapshot?.effects?.[0];
      return (
        e?.participation === 'realized' &&
        e?.origin === 'external' &&
        e?.before?.value === 9800 &&
        e?.after?.value === 10200
      );
    },
  ],
  [
    '⚠️ no transactionId is invented for it (SUPERSESSION-0: WEAK)',
    () => value('afterRealization')?.snapshot?.effects?.[0]?.transactionId === undefined,
  ],
  ['the LIVE current value is read', () => value('currentValue')?.value === 10200],
  [
    '⚠️ a missing path is unresolved, NOT `undefined`',
    () => value('missingPath')?.valueType === 'unresolved-path',
  ],
  ['stop returns the snapshot before releasing it', () => value('stop')?.snapshot?.effects?.length === 1],
  ['capture is inactive after stop', () => value('afterStop')?.capture === 'inactive'],
];

let failed = 0;
for (const [name, check] of checks) {
  let ok = false;
  try {
    ok = check() === true;
  } catch {
    ok = false;
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

// Expected noise: a favicon 404 from serve.mjs, and the connect failures from
// probing tabs (chrome://extensions, about:blank) that have no content script.
const realErrors = errors.filter(
  (e) => !/favicon|404 \(Not Found\)|Receiving end does not exist/.test(e)
);
if (realErrors.length) {
  console.log('\nunexpected page errors:', realErrors);
  failed++;
}

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
