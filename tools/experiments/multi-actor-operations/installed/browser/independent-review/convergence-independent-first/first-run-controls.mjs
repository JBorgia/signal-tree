import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { browserChecks } from '../checks.mjs';
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const identities = JSON.parse(readFileSync(join(source, 'convergence-review/identities.json')));
const work = identities.work;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
for (const [path, expected] of Object.entries(identities.sourceHashes)) assert.equal(hash(join(source, path)), expected, path);
for (const [path, expected] of Object.entries(identities.manifestHashes)) assert.equal(hash(join(work, path)), expected, path);
const oldChecks = readFileSync(join(source, 'history/pre-convergence/checks.mjs.txt'), 'utf8');
const currentChecks = readFileSync(join(source, 'checks.mjs'), 'utf8');
assert.ok(currentChecks.startsWith(oldChecks.slice(0, oldChecks.indexOf(' return {results,pageErrors:errors};'))), 'original twelve checks changed');
const evidence = mkdtempSync('/private/tmp/st-convergence-independent-');
const server = createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url === '/app.js' ? 'app.js' : undefined;
  if (!file) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
  res.end(readFileSync(join(work, 'site', file)));
});
let browser;
try {
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(7000);
  const url = `http://127.0.0.1:${server.address().port}`;
  const original = await browserChecks(page, url, evidence);
  writeFileSync(join(evidence, 'original.json'), JSON.stringify(original, null, 2));
  assert.equal(original.results.filter(x => x.outcome !== 'PASS').length, 0);
  assert.deepEqual(original.pageErrors, []);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const field = name => page.getByTestId(name);
  const button = name => page.getByRole('button', { name, exact: true });
  const click = name => button(name).click();
  // Synthetic events deliberately exercise handler guards even if DOM disabled
  // state has not refreshed. No private app handles or code replacements.
  const sequence = names => page.evaluate(names => {
    for (const name of names) {
      const element = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === name);
      if (!element) throw new Error('Missing button ' + name);
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }, names);
  const extras = [];
  await page.goto(url);
  await sequence(['Start embedded producer', 'Start embedded producer', 'Propose via AG-UI', 'Propose requested route']);
  await expect(field('producer-status')).toHaveText('awaiting completion');
  await expect(field('pending')).toBeEmpty(); await expect(field('phase')).toHaveText('idle');
  await sequence(['Complete embedded producer', 'Complete embedded producer', 'Start embedded producer']);
  await expect(field('phase')).toHaveText('draft'); await expect(field('pending')).toHaveText(/^\d+$/);
  await expect(field('grant-count')).toHaveText('0');
  await click('Review'); await sequence(['Apply reviewed', 'Apply reviewed']);
  await expect(field('phase')).toHaveText('succeeded'); await expect(field('commits')).toHaveText('1');
  await expect(field('deliveries')).toHaveText('1'); await expect(field('pending')).toBeEmpty();
  extras.push('same-turn duplicate starts/completions/applications do not replace ownership or duplicate delivery');

  await page.goto(url); await click('Start embedded producer');
  const packet = await field('producer-observation').textContent();
  await sequence(['External capacity to zero', 'Complete embedded producer', 'Dispose session']);
  await expect(field('server-version')).toHaveText('1'); await expect(field('producer-status')).toHaveText('awaiting completion');
  await expect(field('phase')).toHaveText('idle'); await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');
  await expect(field('producer-observation')).toHaveText(packet); await expect(field('pending')).toBeEmpty();
  await click('Dispose session');
  await sequence(['Complete embedded producer', 'Start embedded producer', 'Propose requested route', 'Propose via AG-UI', 'Dispose session']);
  await expect(field('phase')).toHaveText('disposed'); await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
  await expect(field('producer-status')).toHaveText('cancelled before proposal');
  await expect(field('deliveries')).toHaveText('0'); await expect(field('grant-count')).toHaveText('0');
  await expect(field('commits')).toHaveText('1'); await expect(field('gate-disposed')).toHaveText('true');
  extras.push('busy external service guards completion/disposal; later cancellation rejects late synthetic entries');

  for (const entry of ['human', 'embedded']) {
    await page.goto(url);
    if (entry === 'human') { await page.getByLabel('Requested route', { exact: true }).fill('south'); await click('Propose requested route'); }
    else { await click('Start embedded producer'); await click('Complete embedded producer'); }
    await expect(field('actor')).toHaveText(entry === 'human' ? 'unknown' : 'declared: deterministic-dispatch (not authenticated)');
    await click('Review'); await click('Try transport consent forgery');
    await expect(field('gate-check')).toContainText('Reviewer unauthorized');
    await click('Try apply without server grant'); await expect(field('commits')).toHaveText('0');
    await click('Create overlapping route work'); await click('Fail next persistence'); await click('Apply reviewed');
    await expect(field('phase')).toHaveText('local-pending'); await expect(field('grant-count')).toHaveText('0');
    await expect(field('server-outcome')).toHaveText('rejected'); await expect(field('pending')).toHaveText(/^\d+,\d+$/);
    await sequence(['Start embedded producer', 'Propose requested route', 'Complete embedded producer', 'Dispose session']);
    await expect(field('phase')).toHaveText('local-pending'); await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');
    await click('Resolve overlapping route work'); await click('Retry local settlement');
    await expect(field('phase')).toHaveText('failed'); await expect(field('pending')).toBeEmpty();
    await expect(field('deliveries')).toHaveText('1'); await expect(field('commits')).toHaveText('0');
    extras.push(entry + ' entry uses grant rejection and retains local-only recovery ownership');
  }
  assert.deepEqual(errors, []);
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ identities, original, extras, errors, node: process.version, chromium: await browser.version() }, null, 2));
  console.log(JSON.stringify({ evidence, originalPassed: original.results.length, extraPassed: extras.length, errors }));
} catch (error) {
  writeFileSync(join(evidence, 'failure.txt'), String(error)); console.error('Evidence: ' + evidence); throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
