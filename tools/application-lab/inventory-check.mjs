#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packet = resolve(process.argv[2] ?? '');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const plan = read(join(packet, 'plan.json'));
const built = read(join(packet, 'build.json'));
const out = join(packet, 'inventory-conformance');
assert.ok(
  !existsSync(out),
  'Preserve first conformance run; corrections need a new packet'
);
mkdirSync(out);
assert.equal(sha(join(packet, 'plan.json')), built.planSha256);
const bindings = { ...plan.inputs };
for (const arm of Object.values(built.arms))
  Object.assign(bindings, arm.dependencies, arm.served);
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
};
verify();
const require = createRequire(join(plan.toolchainDirectory, 'package.json'));
const { chromium } = require('playwright');
const controls = {
  'drop-filter': 'filter-pump',
  'stale-count': 'valid-add',
  'invalid-add': 'invalid-add',
  'stale-editor': 'retired-editor',
  'skip-destroy': 'destroy',
};
let directory;
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(
    directory,
    '.' + (pathname === '/' ? '/index.html' : pathname)
  );
  if (!path.startsWith(directory + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.css')
        ? 'text/css'
        : 'text/html'
    );
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const url = `http://127.0.0.1:${server.address().port}`;
const results = [];

async function check(arm, fault = null) {
  verify();
  directory = join(packet, arm, 'dist/inventory/browser');
  const browser = await chromium.launch({ headless: true });
  let stage = 'bootstrap';
  const events = [];
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const text = (id) =>
    page
      .getByTestId(id)
      .textContent()
      .then((value) => value?.trim() ?? null);
  const stable = () => page.evaluate(() => window.lab.stable());
  const ids = () =>
    page
      .locator('tbody tr')
      .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-job')));
  const row = (id) => page.evaluate((id) => window.lab.row(id), id);
  const filter = async (value) => {
    await page.getByTestId('filter').fill(value);
    await stable();
  };
  async function step(name, action) {
    stage = name;
    await action();
    assert.deepEqual(errors, [], `${name}: no browser errors`);
    events.push({ stage: name, passed: true });
  }
  try {
    await page.goto(`${url}/?rows=20${fault ? '&fault=' + fault : ''}`);
    await page.waitForFunction(() => window.lab?.ready, undefined, {
      timeout: 15000,
    });
    await stable();
    await step('initial', async () => {
      assert.equal(await text('total'), '20');
      assert.equal(await text('matched'), '20');
      assert.equal(await text('selected'), 'none');
      assert.deepEqual(
        await ids(),
        Array.from({ length: 20 }, (_, i) => `J-${i}`)
      );
      assert.equal((await row('J-0')).title, 'Inspect pump 0');
    });
    await step('filter-pump', async () => {
      await filter(' PUMP ');
      assert.equal(await text('matched'), '7');
      assert.deepEqual(
        await ids(),
        [0, 3, 6, 9, 12, 15, 18].map((i) => `J-${i}`)
      );
    });
    await step('literal-filter', async () => {
      await filter('%_');
      assert.equal(await text('matched'), '0');
      assert.deepEqual(await ids(), []);
      await filter('');
    });
    await step('select-and-rename', async () => {
      await page.getByTestId('select-J-0').click();
      await stable();
      assert.equal(await text('selected'), 'J-0');
      await page.getByTestId('rename-title').fill('  Renamed pump  ');
      await page.getByTestId('rename').click();
      await stable();
      assert.equal((await row('J-0')).title, 'Renamed pump');
      assert.equal(
        await page
          .locator('[data-job="J-0"] [data-field="title"]')
          .textContent()
          .then((value) => value?.trim() ?? null),
        'Renamed pump'
      );
    });
    await step('invalid-rename', async () => {
      await page.getByTestId('rename-title').fill('   ');
      await page.getByTestId('rename').click();
      await stable();
      assert.equal((await row('J-0')).title, 'Renamed pump');
      assert.equal(await text('error'), 'Enter a title.');
    });
    await step('toggle', async () => {
      assert.equal((await row('J-0')).active, true);
      await page.getByTestId('toggle-J-0').click();
      await stable();
      assert.equal((await row('J-0')).active, false);
      assert.equal(await text('toggle-J-0'), 'Inactive');
      assert.equal((await row('J-2')).active, true);
    });
    await step('invalid-add', async () => {
      await page.getByTestId('new-title').fill('   ');
      await page.getByTestId('add').click();
      await stable();
      assert.equal(await text('total'), '20');
      assert.equal(await text('error'), 'Enter a title.');
      assert.equal(await row('J-new-1'), undefined);
    });
    await step('valid-add', async () => {
      await page.getByTestId('new-title').fill('  Added valve  ');
      await page.getByTestId('add').click();
      await stable();
      assert.equal(await text('total'), '21');
      assert.equal(await text('matched'), '21');
      assert.equal((await row('J-new-1')).title, 'Added valve');
      assert.equal(await text('error'), '');
      assert.equal((await ids()).at(-1), 'J-new-1');
    });
    await step('remove-selection', async () => {
      await page.getByTestId('remove-J-0').click();
      await stable();
      assert.equal(await text('selected'), 'none');
      assert.equal(await text('total'), '20');
      assert.equal(await row('J-0'), undefined);
      assert.equal((await ids()).includes('J-0'), false);
    });
    await step('retired-editor', async () => {
      await page.evaluate(() => window.lab.holdEditor('old', 'J-1'));
      const replacement = {
        ...(await row('J-1')),
        instance: 'replacement-1',
        title: 'Replacement job',
      };
      await page.evaluate(
        (value) => window.lab.replace('J-1', value),
        replacement
      );
      assert.equal((await ids()).at(-1), 'J-1');
      await page.evaluate(() => window.lab.editHeld('old', 'Wrong old editor'));
      assert.deepEqual(await row('J-1'), replacement);
      await page.evaluate(() => window.lab.holdEditor('fresh', 'J-1'));
      await page.evaluate(() =>
        window.lab.editHeld('fresh', 'Fresh editor works')
      );
      assert.equal((await row('J-1')).title, 'Fresh editor works');
    });
    await step('new-session', async () => {
      await page.evaluate(() => window.lab.reset(1000));
      assert.equal(await text('total'), '1000');
      assert.equal((await ids()).length, 40);
      await page.evaluate(() =>
        window.lab.editHeld('fresh', 'Wrong previous session')
      );
      assert.equal((await row('J-1')).title, 'Inspect valve 1');
      await filter('pump');
      assert.equal(await text('matched'), '334');
      assert.deepEqual(
        await ids(),
        Array.from({ length: 40 }, (_, i) => `J-${i * 3}`)
      );
    });
    if (!fault)
      await page.screenshot({ path: join(out, arm + '.jpg'), type: 'jpeg' });
    await step('destroy', async () => {
      await page.evaluate(() => window.lab.destroy());
      assert.equal(await page.locator('lab-inventory main').count(), 0);
    });
    assert.equal(fault, null, `Undetected planted defect: ${fault}`);
    return { arm, fault, passed: true, events };
  } catch (error) {
    return {
      arm,
      fault,
      passed: Boolean(
        fault &&
          stage === controls[fault] &&
          error.code === 'ERR_ASSERTION' &&
          errors.length === 0
      ),
      detectedAt: stage,
      error: String(error.stack),
      browserErrors: errors,
      events,
    };
  } finally {
    await browser.close();
    verify();
  }
}

try {
  for (const arm of plan.arms) {
    const baseline = await check(arm);
    results.push(baseline);
    writeFileSync(
      join(out, arm + '-baseline.json'),
      JSON.stringify(baseline, null, 2) + '\n',
      { flag: 'wx' }
    );
    console.log(
      arm,
      'baseline',
      baseline.passed ? 'passed' : `FAILED at ${baseline.detectedAt}`
    );
    if (!baseline.passed) continue;
    for (const fault of Object.keys(controls)) {
      const result = await check(arm, fault);
      results.push(result);
      writeFileSync(
        join(out, `${arm}-${fault}.json`),
        JSON.stringify(result, null, 2) + '\n',
        { flag: 'wx' }
      );
      console.log(
        arm,
        fault,
        result.passed ? 'detected at intended stage' : 'FAILED'
      );
    }
  }
} finally {
  await new Promise((accept) => server.close(accept));
}
writeFileSync(
  join(out, 'results.json'),
  JSON.stringify(
    {
      runnerSha256: sha(fileURLToPath(import.meta.url)),
      planSha256: built.planSha256,
      buildSha256: sha(join(packet, 'build.json')),
      controls,
      results,
      scope:
        'Ordinary inventory conformance only. No coordinated, timing or retention conclusion.',
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
if (
  results.length !== plan.arms.length * (Object.keys(controls).length + 1) ||
  results.some((result) => !result.passed)
)
  process.exitCode = 1;
