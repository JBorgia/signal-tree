import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { browserChecks } from '../checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const browserSource = resolve(here, '..');
const artifact = '/private/tmp/st-p4-browser-lAvjkb';
const identities = JSON.parse(readFileSync(join(browserSource, 'authority-review/identities.json')));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
for (const [path, expected] of Object.entries(identities)) {
  const actualPath = path.startsWith('browser/') ? join(browserSource, path.slice(8)) : join(artifact, path);
  assert.equal(hash(actualPath), expected, `Identity mismatch: ${path}`);
}
assert.equal(hash(join(browserSource, 'app.ts')), hash(join(artifact, 'consumer/browser/app.ts')));
const evidence = mkdtempSync('/private/tmp/st-authority-security-');
const server = createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url === '/app.js' ? 'app.js' : undefined;
  if (!file) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
  res.end(readFileSync(join(artifact, 'site', file)));
});
let browser;
const extra = [];
try {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(7000);
  const url = `http://127.0.0.1:${server.address().port}`;
  const original = await browserChecks(page, url, evidence);
  assert.equal(original.results.filter(result => result.outcome !== 'PASS').length, 0);
  assert.deepEqual(original.pageErrors, []);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const field = name => page.getByTestId(name);
  const click = name => page.getByRole('button', { name, exact: true }).click();
  const prepare = async () => {
    await page.goto(url);
    await expect(field('phase')).toHaveText('idle');
    await click('Propose via AG-UI'); await click('Review');
    await expect(field('phase')).toHaveText('reviewed');
  };
  await prepare();
  await click('Create overlapping route work');
  await click('Fail next persistence'); await click('Lose next acknowledgment'); await click('Apply reviewed');
  await expect(field('phase')).toHaveText('uncertain');
  await expect(field('commits')).toHaveText('0');
  await expect(field('grant-count')).toHaveText('1');
  await click('Try second grant at capacity'); await expect(field('gate-check')).toContainText('Approval capacity reached');
  await click('Lose next acknowledgment'); await click('Retry receipt');
  await expect(field('phase')).toHaveText('uncertain'); await expect(field('grant-count')).toHaveText('1');
  await expect(field('deliveries')).toHaveText('2'); await expect(field('commits')).toHaveText('0');
  await click('Dispose session'); await expect(field('gate-disposed')).toHaveText('false');
  await click('Retry receipt');
  await expect(field('phase')).toHaveText('local-pending');
  await expect(field('server-outcome')).toHaveText('rejected');
  await expect(field('grant-count')).toHaveText('0'); await expect(field('deliveries')).toHaveText('3');
  await click('Retry local settlement'); await expect(field('phase')).toHaveText('local-pending');
  await expect(field('deliveries')).toHaveText('3');
  await click('Resolve overlapping route work'); await click('Retry local settlement');
  await expect(field('phase')).toHaveText('failed'); await expect(field('deliveries')).toHaveText('3');
  await expect(field('pending')).toBeEmpty(); await expect(field('commits')).toHaveText('0');
  await click('Propose via AG-UI'); await click('Review'); await click('Apply reviewed');
  await expect(field('phase')).toHaveText('succeeded'); await expect(field('commits')).toHaveText('1');
  await click('Dispose session'); await expect(field('gate-disposed')).toHaveText('true');
  extra.push('Repeated lost rejection acknowledgments retain grant; terminal receipt revokes before local-only recovery; capacity reusable');

  await prepare();
  for (let i = 0; i < 3; i++) {
    await click('Try transport consent forgery');
    await expect(field('gate-check')).toContainText('Invalid dispatch arguments');
    await expect(field('gate-check')).toContainText('Reviewer unauthorized');
    await click('Try apply without server grant'); await expect(field('gate-check')).toContainText('Missing or mismatched server approval');
  }
  await expect(field('commits')).toHaveText('0'); await expect(field('deliveries')).toHaveText('0');
  await expect(field('grant-count')).toHaveText('0');
  await click('Reject proposal'); await expect(field('phase')).toHaveText('rejected');
  await click('Dispose session'); await expect(field('gate-disposed')).toHaveText('true');
  await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
  extra.push('Repeated forgery/missing-grant controls create neither authority nor delivery; reviewed rejection/disposal retains no grant');
  assert.deepEqual(errors, []);
  const result = { artifact, identities, node: process.version, chromium: await browser.version(), original, extra, pageErrors: errors };
  writeFileSync(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ evidence, originalPassed: original.results.length, extraPassed: extra.length, pageErrors: errors }));
} catch (error) {
  writeFileSync(join(evidence, 'failure.txt'), String(error));
  console.error(`Evidence: ${evidence}`); throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
