/**
 * Drive the REAL panel against a REAL page, and assert on rendered DOM.
 *
 *     node apps/studio-devtools/smoke/verify-panel.mjs
 *
 * The previous harness (`verify-extension.mjs`) used a driver page that STOOD
 * IN for the panel — it proved the bridge, not the UI. This loads the shipped
 * `panel/main.js` itself, unmodified, and stubs exactly one thing:
 *
 *     chrome.devtools.inspectedWindow.tabId
 *
 * ⚠️ WHAT REMAINS MANUAL, AND WHY. Playwright cannot script a `devtools://`
 * window, so `chrome.devtools.panels.create` (does the SignalTree tab appear?)
 * and the real `inspectedWindow.tabId` cannot be exercised here. Those are
 * acceptance steps 1-2. Steps 3-16 run against the real panel code below.
 * Stubbing the tab id is a REAL narrowing of evidence, not a formality: it is
 * the one value a genuine DevTools context supplies.
 */
import { chromium } from 'playwright';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', '..', '..', 'dist', 'studio-devtools');
const ext = mkdtempSync(join(tmpdir(), 'st-panel-'));
cpSync(dist, ext, { recursive: true });

const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
manifest.web_accessible_resources = [
  { resources: ['harness.html'], matches: ['http://localhost:8791/*'] },
];
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Same skeleton as panel/index.html, plus the one stub.
writeFileSync(
  join(ext, 'harness.html'),
  `<!doctype html><meta charset="utf-8"><title>panel harness</title>
<link rel="stylesheet" href="panel/panel.css">
<div id="root"><p class="muted">Connecting…</p></div>
<script src="harness.js"></script>`
);
writeFileSync(
  join(ext, 'harness.js'),
  `
/** Find the inspected tab the way a DevTools context would already know it. */
async function findStudioTab() {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) continue;
    const port = chrome.tabs.connect(tab.id, { name: 'signaltree-studio' });
    const ok = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), 700);
      port.onMessage.addListener(() => { clearTimeout(t); resolve(true); });
      port.postMessage({ id: 'h', payload: { protocol: 1, id: 'h', command: 'hello' } });
    });
    port.disconnect();
    if (ok) return tab.id;
  }
  return undefined;
}

(async () => {
  const tabId = await findStudioTab();
  if (tabId === undefined) {
    document.getElementById('root').textContent = 'HARNESS: no studio tab';
    return;
  }
  // The ONLY stub. Everything else in the panel is the shipped code.
  chrome.devtools = { inspectedWindow: { tabId } };
  document.documentElement.setAttribute('data-harness', 'ready');
  const s = document.createElement('script');
  s.src = 'panel/main.js';
  document.head.append(s);
})();
`
);

const profile = mkdtempSync(join(tmpdir(), 'st-prof-'));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-first-run'],
});

const errors = [];
const demo = await ctx.newPage();
demo.on('console', (m) => m.type() === 'error' && errors.push('demo: ' + m.text()));
await demo.goto('http://localhost:8791/demo.html', { waitUntil: 'load' });

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

const panel = await ctx.newPage();
panel.on('console', (m) => m.type() === 'error' && errors.push('panel: ' + m.text()));
panel.on('pageerror', (e) => errors.push('panel threw: ' + String(e)));
await panel.setViewportSize({ width: 1000, height: 620 });
await panel.goto(`chrome-extension://${extId}/harness.html`);
const shots = join(here, 'screens');
mkdirSync(shots, { recursive: true });
await panel.waitForSelector('[data-harness="ready"]', { timeout: 10000 });

const results = [];
const check = async (name, fn) => {
  let ok = false;
  let detail = '';
  try {
    const r = await fn();
    ok = r === true || (r && r.ok === true);
    detail = (r && r.detail) || '';
  } catch (e) {
    detail = String(e).split('\n')[0];
  }
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   ${detail}` : ''}`);
};

const text = () => panel.evaluate(() => document.getElementById('root').innerText);
/** The panel repaints on a 1.5s poll; wait for the state rather than sleeping. */
const waitForText = async (needle, timeout = 12000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((await text()).includes(needle)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};
const clickPanel = (label) =>
  panel.evaluate((l) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(l));
    if (!b) throw new Error(`no button ${l}`);
    b.click();
  }, label);
const clickDemo = (re) =>
  demo.evaluate((r) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(r).test(x.textContent));
    if (!b) throw new Error('no demo button');
    b.click();
  }, re);

// ── the acceptance sequence ──────────────────────────────────────────────────
//
// ⚠️ EVERY ASSERTION WAITS. The panel repaints on a poll after an async command
// round trip, so reading the DOM straight after a click reads the PREVIOUS
// frame. A first pass did exactly that and reported six product failures that
// were entirely the harness's own impatience.
//
// ⚠️ AND EVERY NEEDLE IS DISAMBIGUATED. `'ACTIVE'` is a substring of
// `'INACTIVE'`, so waiting on it passed while capture was still stopped. The
// bullet prefixes (`● ACTIVE` / `○ INACTIVE`) are the discriminator.

await check('2. AppTree appears in the tree list', () => waitForText('AppTree'));
await check('3. realization status begins supported/inactive', () => waitForText('○ INACTIVE'));

await clickPanel('Start Capture');
await check('4/5. Start Capture -> status becomes active', () => waitForText('● ACTIVE'));
await check('5b. header reports LIVE', () => waitForText('LIVE'));

await clickDemo('10200');
await check('6. the realization is retained', () => waitForText('1 effect(s) retained'));

await panel.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'cart.total');
  if (!b) throw new Error('no cart.total chip');
  b.click();
});
// Wait for a CLAIM, not for the word "Why?" — that is also the button's label.
await check('7. cart.total selected, explanation rendered', () => waitForText('FACT'));

await check('8. WHY? reads the LIVE current value (10200)', async () => {
  const ok = await waitForText('10200');
  return { ok, detail: (await text()).match(/Current value[\s\S]{0,14}/)?.[0].replace(/\n/g, ' ') };
});
await check('8b. no divergence warning while evidence explains it', async () =>
  !(await text()).includes('not explained by retained evidence')
);
await check('9. explanation shows the real T1 / T2 ids', async () =>
  (await waitForText('T1 committed 9600')) && (await waitForText('T2 committed 9800'))
);
await check('10. external realization shows 9800 -> 10200', () =>
  waitForText('External realization changed 9800 → 10200')
);
await check('10b. DERIVED supersession, not a causal claim', async () =>
  (await waitForText('DERIVED')) &&
  (await waitForText('superseded the previously visible 9800'))
);
await check('10c. UNKNOWN authored cause is stated, not omitted', async () =>
  (await waitForText('UNKNOWN')) && (await waitForText('No retained evidence identifies'))
);

await check('11. no transactionId is invented on the realization', async () => {
  await panel.waitForFunction(
    () => [...document.querySelectorAll('button.ref')].some((x) => x.textContent.startsWith('realization:')),
    undefined,
    { timeout: 12000 }
  );
  await panel.evaluate(() => {
    [...document.querySelectorAll('button.ref')]
      .find((x) => x.textContent.startsWith('realization:'))
      .click();
  });
  await panel.waitForSelector('.detail', { timeout: 5000 });
  const drawer = await panel.evaluate(() => document.querySelector('.detail')?.innerText ?? '');
  return {
    ok: drawer.includes('participation') && !drawer.includes('transactionId'),
    detail: drawer.replace(/\n/g, ' ').slice(0, 100),
  };
});

// ⚠️ The point of the whole exercise: look at it.
await panel.screenshot({ path: join(shots, '1-live-why.png') });

await clickPanel('Stop Capture');
await check('12/14. Stop Capture -> capture reports inactive', () => waitForText('○ INACTIVE'));
await check('13. the investigation survives panel-side', async () =>
  (await waitForText('External realization changed 9800 → 10200')) &&
  (await waitForText('Holding 1 effect(s) from a stopped session'))
);

await clickDemo('9950');
await check('15. the live read follows the tree after capture stopped', () =>
  waitForText('9950')
);
await check('16. WHY? warns that retained evidence no longer explains it', () =>
  waitForText('not explained by retained evidence')
);

await panel.screenshot({ path: join(shots, '2-diverged.png') });
console.log(`\nscreens -> ${shots}`);

await ctx.close();

const real = errors.filter((e) => !/favicon|404 \(Not Found\)|Receiving end does not exist/.test(e));
if (real.length) {
  console.log('\nunexpected errors:', real);
}
const failed = results.filter((r) => !r.ok).length + real.length;
console.log(
  failed === 0
    ? '\nSTEPS 3-16 PASSED (1-2 are devtools-only and remain manual)'
    : `\n${failed} CHECK(S) FAILED`
);
process.exit(failed === 0 ? 0 : 1);
