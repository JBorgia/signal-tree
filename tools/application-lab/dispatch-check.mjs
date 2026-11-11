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
const built = read(join(packet, 'dispatch-build.json'));
assert.equal(sha(join(packet, 'plan.json')), built.planSha256);
const out = join(packet, 'dispatch-conformance');
assert.ok(!existsSync(out), 'Preserve first conformance attempt');
mkdirSync(out);
const bindings = { ...plan.inputs };
for (const arm of Object.values(built.arms))
  Object.assign(bindings, arm.dependencies, arm.served);
const verify = () => {
  for (const [path, expected] of Object.entries(bindings))
    assert.equal(sha(path), expected, `Input drift ${path}`);
};
const { chromium } = createRequire(
  join(plan.toolchainDirectory, 'package.json')
)('playwright');
const controls = {
  'drop-write': 'overlap-proposals',
  'stale-preview': 'late-preview',
  'premature-publication': 'publish-held',
  'clobber-other-field': 'overlap-settle-first',
  'blanket-block': 'unrelated-progress',
  'stale-editor': 'retired-editor',
  'drop-reentry': 'reentrant-action',
  'skip-destroy': 'late-after-reset',
  'false-rejection': 'lost-ack-unknown',
  'stale-success': 'cas-stale-success',
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
await new Promise((yes) => server.listen(0, '127.0.0.1', yes));
const url = `http://127.0.0.1:${server.address().port}`;
const results = [];

async function check(arm, fault = null) {
  verify();
  directory = join(packet, arm, 'dist/dispatch/browser');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  let stage = 'bootstrap';
  const events = [],
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const call = (method, ...args) =>
    page.evaluate(async ({ method, args }) => window.lab[method](...args), {
      method,
      args,
    });
  const snapshot = () => call('snapshot');
  const stable = () => call('stable');
  const reset = () => call('reset', 20);
  const command = async (field, value, id) => {
    await page.getByTestId('command-id').fill(id);
    if (field === 'status')
      await page.getByTestId('status-input').selectOption(value);
    else await page.getByTestId(field + '-input').fill(String(value));
    await page
      .getByTestId(field === 'capacity' ? 'draft-capacity' : 'assign-' + field)
      .click();
    await stable();
  };
  const publish = async (id, kind) => {
    await page.getByTestId('intent-id').fill(id);
    await page.getByTestId('publish-' + kind).click();
    await stable();
  };
  const domain = (row) => ({ owner: row.owner, status: row.status });
  const op = (s, id) => s.operations.find((item) => item.id === id);
  async function step(name, work) {
    stage = name;
    await work();
    assert.deepEqual(errors, [], `${name}: no browser errors`);
    if (name !== 'dismiss-and-destroy') {
      // Assert actual rendering after async replies as well as clicks. A plain
      // state update that fails to notify Angular must not pass this oracle.
      const s = await snapshot();
      // Transport payloads must be the agreed domain envelope. Matching a few
      // visible fields must not hide library metadata leaking onto the wire.
      for (const request of s.requests)
        assert.deepEqual(
          Object.keys(request).sort(),
          [
            'id',
            'subject',
            'instance',
            'field',
            'value',
            'expectedRevision',
          ].sort()
        );
      for (const start of s.starts) {
        if (start.payload.kind !== 'plan') continue;
        assert.deepEqual(Object.keys(start.payload).sort(), [
          'capacity',
          'kind',
          'rows',
        ]);
        assert.deepEqual(Object.keys(start.payload.capacity).sort(), [
          'instance',
          'revision',
          'value',
        ]);
      }
      const rendered = page.locator('[data-job="J-0"]');
      assert.equal(
        await rendered
          .locator('[data-field="owner"]')
          .textContent()
          .then((value) => value?.trim() ?? null),
        s.row.owner
      );
      assert.equal(
        await rendered
          .locator('[data-field="status"]')
          .textContent()
          .then((value) => value?.trim() ?? null),
        s.row.status
      );
      assert.equal(
        await rendered
          .locator('[data-field="owner-revision"]')
          .textContent()
          .then((value) => value?.trim() ?? null),
        String(s.row.ownerRevision)
      );
      for (const operation of s.operations)
        assert.equal(
          await page
            .locator(
              `[data-operation="${operation.id}"] [data-field="outcome"]`
            )
            .textContent()
            .then((value) => value?.trim() ?? null),
          operation.outcome
        );
      for (const publication of s.publications)
        assert.equal(
          await page
            .locator(
              `[data-publication="${publication.id}"] [data-field="state"]`
            )
            .textContent()
            .then((value) => value?.trim() ?? null),
          publication.state
        );
      if (s.preview) {
        assert.equal(
          await page
            .getByTestId('preview-pending')
            .textContent()
            .then((value) => value?.trim() ?? null),
          String(s.preview.pending)
        );
        assert.equal(
          await page
            .getByTestId('preview-owner')
            .textContent()
            .then((value) => value?.trim() ?? null),
          s.preview.rows[0]?.owner ?? ''
        );
        assert.equal(
          await page
            .getByTestId('preview-status')
            .textContent()
            .then((value) => value?.trim() ?? null),
          s.preview.rows[0]?.status ?? ''
        );
        assert.equal(
          await page
            .getByTestId('preview-capacity')
            .textContent()
            .then((value) => value?.trim() ?? null),
          String(s.preview.capacity.value)
        );
      }
    }
    events.push({ stage: name, passed: true });
  }
  try {
    await page.goto(`${url}/?rows=20${fault ? '&fault=' + fault : ''}`);
    await page.waitForFunction(() => window.lab?.ready, undefined, {
      timeout: 20000,
    });
    await stable();
    await step('initial', async () => {
      const s = await snapshot();
      assert.deepEqual(domain(s.row), {
        owner: 'Operator 0',
        status: 'queued',
      });
      assert.equal(s.row.ownerRevision, 10);
      assert.equal(s.requests.length, 0);
      assert.equal(s.starts.length, 0);
      assert.equal(await page.locator('tbody tr').count(), 20);
    });
    for (const a of ['accept', 'reject'])
      for (const b of ['accept', 'reject'])
        for (const order of [
          ['A', 'B'],
          ['B', 'A'],
        ]) {
          await reset();
          await step('overlap-proposals', async () => {
            await command('status', 'active', 'A');
            await command('owner', 'Lee', 'B');
            const s = await snapshot();
            assert.equal(s.requests.length, 2);
            assert.equal(op(s, 'A').outcome, 'pending');
            assert.equal(op(s, 'B').outcome, 'pending');
            assert.deepEqual(domain(s.row), { owner: 'Lee', status: 'active' });
            assert.equal(
              await page
                .locator('[data-job="J-0"] [data-field="owner"]')
                .textContent()
                .then((value) => value?.trim() ?? null),
              'Lee'
            );
          });
          await step('late-preview', async () => {
            await page.getByTestId('open-preview').click();
            await stable();
            assert.equal(
              await page
                .getByTestId('preview-pending')
                .textContent()
                .then((value) => value?.trim() ?? null),
              '2'
            );
            assert.equal(
              await page
                .getByTestId('preview-owner')
                .textContent()
                .then((value) => value?.trim() ?? null),
              'Lee'
            );
            assert.equal(
              await page
                .getByTestId('preview-status')
                .textContent()
                .then((value) => value?.trim() ?? null),
              'active'
            );
            assert.equal(
              await page
                .getByTestId('preview-count')
                .textContent()
                .then((value) => value?.trim() ?? null),
              '20'
            );
          });
          await step('publish-held', async () => {
            await publish('plan', 'plan');
            const s = await snapshot();
            assert.equal(s.starts.length, 0);
            assert.equal(s.publications[0].state, 'waiting');
            assert.deepEqual([...s.publications[0].inputs].sort(), ['A', 'B']);
          });
          const outcomes = { A: a, B: b };
          const expected = { owner: 'Lee', status: 'active' };
          for (let i = 0; i < order.length; i++) {
            const id = order[i];
            if (outcomes[id] === 'reject')
              expected[id === 'A' ? 'status' : 'owner'] =
                id === 'A' ? 'queued' : 'Operator 0';
            await step(
              i === 0 ? 'overlap-settle-first' : 'overlap-final',
              async () => {
                await call('process', id, outcomes[id]);
                const s = await snapshot();
                assert.deepEqual(domain(s.row), expected);
                assert.equal(
                  op(s, id).outcome,
                  outcomes[id] === 'accept' ? 'applied' : 'rejected'
                );
                assert.equal(s.preview.pending, 1 - i);
                assert.equal(s.starts.length, i);
                if (i === 0) assert.equal(op(s, order[1]).outcome, 'pending');
                else {
                  const payload = s.starts[0].payload;
                  assert.equal(payload.kind, 'plan');
                  assert.equal(payload.rows.length, 20);
                  assert.deepEqual(domain(payload.rows[0]), expected);
                  assert.deepEqual(payload.rows[0], s.canonical);
                  assert.deepEqual(payload.capacity, s.serverCapacity);
                  assert.equal(s.publications[0].state, 'started');
                  await call('acknowledge', 'plan');
                  assert.equal(
                    (await snapshot()).publications[0].state,
                    'acknowledged'
                  );
                }
              }
            );
          }
        }
    await reset();
    await step('foreign-capacity', async () => {
      await command('capacity', 8, 'F');
      await command('status', 'active', 'A');
      await call('process', 'A');
      await publish('dependent', 'plan');
      assert.equal((await snapshot()).starts.length, 0);
    });
    await step('unrelated-progress', async () => {
      await publish('unrelated', 'progress');
      const s = await snapshot();
      assert.equal(s.starts.length, 1);
      assert.deepEqual(s.starts[0].payload, {
        kind: 'progress',
        subject: 'J-0',
        instance: 'initial-0',
        status: 'active',
        statusRevision: 11,
      });
      assert.equal(op(s, 'F').outcome, 'pending');
      await call('acknowledge', 'unrelated');
      await call('process', 'F', 'reject');
      const done = await snapshot();
      assert.equal(done.starts.length, 2);
      assert.deepEqual(done.starts[1].payload.capacity, {
        instance: 'capacity-1',
        value: 4,
        revision: 10,
      });
      await call('acknowledge', 'dependent');
    });
    await reset();
    await step('reentrant-action', async () => {
      await call('reenter', 'first', 'second');
      await publish('first', 'progress');
      const s = await snapshot();
      assert.equal(s.starts[0].id, 'first');
      assert.equal(s.requests.length, 1);
      assert.equal(s.requests[0].id, 'second-edit');
      assert.equal(s.row.status, 'done');
      assert.equal(
        s.publications.find((item) => item.id === 'second').state,
        'waiting'
      );
      await call('process', 'second-edit');
      // Serialized writers are valid: acknowledge first without waiting for second.
      await call('acknowledge', 'first');
      const next = await snapshot();
      assert.deepEqual(
        next.starts.map((item) => item.id),
        ['first', 'second']
      );
      assert.equal(next.starts[1].payload.status, 'done');
      await call('acknowledge', 'second');
      try {
        await call('publish', 'first', 'progress', 'J-0');
      } catch {
        /* rejecting a duplicate is allowed */
      }
      assert.equal((await snapshot()).starts.length, 2);
      assert.deepEqual((await snapshot()).publicationAttempts, [
        'first',
        'second',
      ]);
    });
    await reset();
    await step('retired-editor', async () => {
      await call('holdEditor', 'old', 'J-0');
      await command('owner', 'Old proposal', 'old');
      await call('process', 'old', 'accept', false);
      const replacement = {
        ...(await snapshot()).canonical,
        instance: 'replacement',
        owner: 'New owner',
        ownerRevision: 1,
        statusRevision: 1,
      };
      await call('replace', 'J-0', replacement);
      await call('deliver', 'old');
      await call('editHeld', 'old', 'owner', 'Stale editor', 'stale');
      let s = await snapshot();
      assert.deepEqual(s.row, replacement);
      assert.equal(s.requests.length, 1);
      await call('holdEditor', 'fresh', 'J-0');
      await call('editHeld', 'fresh', 'owner', 'Fresh owner', 'fresh');
      await call('process', 'fresh');
      s = await snapshot();
      assert.equal(s.row.owner, 'Fresh owner');
      assert.equal(s.row.ownerRevision, 2);
    });
    await reset();
    await step('late-after-reset', async () => {
      await command('owner', 'Destroyed proposal', 'late');
      await publish('never-publish', 'plan');
      await reset();
      const old = await call('deliverPrevious', 'late');
      assert.equal(old.applications.length, 1);
      assert.equal(old.starts.length, 0);
      assert.equal((await snapshot()).row.owner, 'Operator 0');
      await command('owner', 'New session', 'new');
      await call('process', 'new');
      assert.equal((await snapshot()).row.owner, 'New session');
    });
    await reset();
    await step('cas-stale-success', async () => {
      await command('owner', 'Ada', 'A');
      await call('process', 'A', 'accept', false);
      await command('owner', 'Bea', 'B');
      await call('process', 'B');
      let s = await snapshot();
      assert.equal(op(s, 'B').outcome, 'conflict');
      assert.equal(op(s, 'B').value, 'Bea');
      assert.equal(op(s, 'A').outcome, 'pending');
      assert.equal(s.canonical.owner, 'Ada');
      assert.equal(s.canonical.ownerRevision, 11);
      await command('owner', 'Cy', 'C');
      assert.equal((await snapshot()).requests.at(-1).expectedRevision, 11);
      await call('process', 'C');
      await publish('cas-plan', 'plan');
      s = await snapshot();
      assert.equal(s.canonical.owner, 'Cy');
      assert.equal(s.canonical.ownerRevision, 12);
      assert.equal(s.starts.length, 0);
      await call('deliver', 'A');
      s = await snapshot();
      assert.equal(s.row.owner, 'Cy');
      assert.equal(s.row.ownerRevision, 12);
      assert.equal(s.starts.length, 1);
      assert.equal(s.starts[0].payload.rows[0].owner, 'Cy');
      assert.equal(s.starts[0].payload.rows[0].ownerRevision, 12);
      await call('acknowledge', 'cas-plan');
    });
    await step('lost-ack-unknown', async () => {
      await command('owner', 'Dee', 'D');
      await call('process', 'D', 'accept', false);
      await call('lose', 'D');
      let s = await snapshot();
      assert.equal(op(s, 'D').outcome, 'unknown');
      assert.equal(s.serverRow.ownerRevision, 13);
      assert.equal(s.canonical.ownerRevision, 12);
      await publish('unknown-plan', 'plan');
      assert.equal((await snapshot()).starts.length, 1);
      await call('retry', 'D');
      await call('process', 'D');
      s = await snapshot();
      assert.equal(s.requests.filter((item) => item.id === 'D').length, 2);
      assert.equal(s.applications.filter((item) => item.id === 'D').length, 1);
      assert.equal(s.row.owner, 'Dee');
      assert.equal(s.row.ownerRevision, 13);
      assert.equal(s.starts.length, 2);
      await call('acknowledge', 'unknown-plan');
    });
    await step('request-never-arrived', async () => {
      await command('owner', 'Eve', 'E');
      await call('lose', 'E');
      let s = await snapshot();
      assert.equal(op(s, 'E').outcome, 'unknown');
      assert.equal(s.applications.filter((item) => item.id === 'E').length, 0);
      await call('retry', 'E');
      await call('process', 'E');
      s = await snapshot();
      assert.equal(s.applications.filter((item) => item.id === 'E').length, 1);
      assert.equal(s.row.ownerRevision, 14);
      try {
        await call('assign', 'J-0', 'owner', 'Wrong reused ID', 'E');
      } catch {
        /* explicit ID rejection is allowed */
      }
      const after = await snapshot();
      assert.equal(after.requests.length, s.requests.length);
      assert.equal(after.row.owner, 'Eve');
    });
    await step('dismiss-and-destroy', async () => {
      await call('dismissSettled');
      const s = await snapshot();
      assert.equal(s.operations.length, 0);
      assert.equal(s.publications.length, 0);
      try {
        await call('assign', 'J-0', 'owner', 'Reused after dismissal', 'E');
      } catch {
        /* reserved ID */
      }
      try {
        await call('publish', 'cas-plan', 'plan');
      } catch {
        /* reserved intent */
      }
      const reserved = await snapshot();
      assert.equal(reserved.requests.length, s.requests.length);
      assert.equal(reserved.starts.length, s.starts.length);
      assert.deepEqual(reserved.row, s.row);
      assert.deepEqual(reserved.publicationAttempts, s.publicationAttempts);
      if (!fault)
        await page.screenshot({ path: join(out, arm + '.jpg'), type: 'jpeg' });
      await call('destroy');
      assert.equal(await page.locator('lab-dispatch main').count(), 0);
    });
    assert.equal(fault, null, 'Undetected planted defect');
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
        result.passed
          ? 'detected at intended stage'
          : `FAILED at ${result.detectedAt}`
      );
    }
  }
} finally {
  await new Promise((yes) => server.close(yes));
}
writeFileSync(
  join(out, 'results.json'),
  JSON.stringify(
    {
      runnerSha256: sha(fileURLToPath(import.meta.url)),
      planSha256: built.planSha256,
      buildSha256: sha(join(packet, 'dispatch-build.json')),
      controls,
      results,
      scope: 'Coordinated application conformance; no performance conclusion.',
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
