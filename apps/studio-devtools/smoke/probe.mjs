import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = '/tmp/st-ext';
const profile = mkdtempSync(join(tmpdir(), 'st-prof-'));

const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
  ],
});

const page = await ctx.newPage();
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

const probe = async (url) => {
  await page.goto(url, { waitUntil: 'load' });
  for (let i = 0; i < 40; i++) {
    const raw = await page.evaluate(() =>
      document.documentElement.getAttribute('data-st-smoke')
    );
    if (raw) return JSON.parse(raw);
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
};

console.log('=== CHROME ===', ctx.browser()?.version?.() ?? 'persistent-context');

const withBridge = await probe('http://localhost:8791/index.html');
console.log('A. bridge installed, tree attached:');
console.log('   hello      ', JSON.stringify(withBridge?.hello?.value));
console.log('   listTrees  ', JSON.stringify(withBridge?.listTrees?.value));
console.log('   effects    ', JSON.stringify(
  withBridge?.read?.value?.turns?.[0]?.effects?.map((e) => `${e.path}: ${JSON.stringify(e.before)} -> ${JSON.stringify(e.after)}`)
));

// B. destroy the tree, then re-probe listTrees from the isolated world.
await page.evaluate(() => globalThis.__smoke.destroy());
const afterDestroy = await page.evaluate(async () => {
  const ch = new MessageChannel();
  const answer = new Promise((r) => { ch.port1.onmessage = (e) => r(e.data); });
  ch.port1.start();
  window.postMessage({ type: 'SIGNALTREE_STUDIO_CONNECT', protocol: 1, nonce: 'b' }, '*', [ch.port2]);
  await new Promise((r) => setTimeout(r, 50));
  ch.port1.postMessage({ protocol: 1, id: 'd1', command: 'listTrees' });
  return await Promise.race([answer, new Promise((r) => setTimeout(() => r({ TIMEOUT: true }), 800))]);
});
console.log('B. after tree.destroy(): listTrees ->', JSON.stringify(afterDestroy?.value));

const noBridge = await probe('http://localhost:8791/nobridge.html');
console.log('C. no installStudioBridge():');
console.log('   probe result', JSON.stringify(noBridge?.hello ?? noBridge));

if (pageErrors.length) console.log('=== PAGE ERRORS ===', pageErrors.filter((e) => !e.includes('favicon')));

await ctx.close();
