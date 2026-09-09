import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = '/tmp/st-ext';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'st-chain-')), {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
});

// The inspected tab.
const page = await ctx.newPage();
await page.goto('http://localhost:8791/index.html', { waitUntil: 'load' });
await page.waitForTimeout(500);

// Discover the extension id from its service worker or any extension page.
let extId;
for (let i = 0; i < 20 && !extId; i++) {
  const targets = ctx.serviceWorkers().map((w) => w.url());
  const bg = targets.find((u) => u.startsWith('chrome-extension://'));
  if (bg) extId = new URL(bg).host;
  else await page.waitForTimeout(200);
}
if (!extId) {
  // No service worker in this manifest; derive from the content script's origin.
  extId = await page.evaluate(() => {
    const el = document.querySelector('script[src^="chrome-extension://"]');
    return el ? new URL(el.src).host : null;
  });
}
console.log('=== EXTENSION ID ===', extId ?? 'UNKNOWN');

if (extId) {
  const driver = await ctx.newPage();
  await driver.goto(`chrome-extension://${extId}/driver.html`);
  await driver.waitForTimeout(2500);
  const text = await driver.textContent('#out');
  console.log('=== FULL CHAIN (panel API -> content -> page) ===');
  console.log(text);
}
await ctx.close();
