import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  startAuthorityProcess,
  request,
  scopePath,
  commandFor,
} from '../durable-authority/process.mjs';

export async function runApplicationChecks(
  browser,
  siteDirectory,
  output,
  { startAuthority = startAuthorityProcess, selected = [] } = {}
) {
  const investigation = join(output, 'investigator-views');
  mkdirSync(investigation);
  const results = [];
  const cases = [];
  const check = (id, run) => cases.push({ id, run });
  const namedOracle = async (name, assertion) => {
    try {
      await assertion();
    } catch (error) {
      throw new Error(`${name}: ${String(error)}`, { cause: error });
    }
  };
  const field = (page, name) => page.getByTestId(name);
  const button = (page, name) =>
    page.getByRole('button', { name, exact: true });
  const owners = async (page) =>
    (await field(page, 'pending-ids').innerText())
      .split(',')
      .filter(Boolean)
      .map(Number);
  const operation = (page, id) => page.locator(`[data-request="${id}"]`);
  const refresh = async (page) => {
    const complete = page.waitForResponse(
      (r) => r.url().endsWith('/reviews') && r.request().method() === 'GET'
    );
    await button(page, 'Refresh reviews and outcomes').click();
    await complete;
  };
  const native = (page, id) => operation(page, id).locator('.native');
  const receipt = (page, id) => operation(page, id).locator('.receipt');
  async function prepare(f, which = 'route') {
    await button(f.page, `Prepare ${which} proposal`).click();
    await expect(f.page.locator('article.operation')).toHaveCount(
      f.reviewIds.length + 1
    );
    const reviews = (
      await request(f.authority, f.proposer, scopePath(f.proposer) + '/reviews')
    ).body.reviews;
    const review = reviews.find((r) => !f.reviewIds.includes(r.requestId));
    assert(review);
    f.reviewIds.push(review.requestId);
    await expect(native(f.page, review.requestId)).toHaveText('pending');
    return review;
  }
  async function approve(f, review) {
    await refresh(f.reviewerPage);
    await button(
      operation(f.reviewerPage, review.requestId),
      'Approve exact request'
    ).click();
    await expect(
      operation(f.reviewerPage, review.requestId).locator('.review-status')
    ).toHaveText('approved');
    await refresh(f.page);
    await expect(
      operation(f.page, review.requestId).locator('.review-status')
    ).toHaveText('approved');
  }
  const deliver = (f, review) =>
    button(
      operation(f.page, review.requestId),
      'Deliver approved request'
    ).click();

  check('independent-approved-effect', async (f) => {
    const review = await prepare(f);
    await f.capture('A');
    await expect(
      button(operation(f.page, review.requestId), 'Deliver approved request')
    ).toBeDisabled();
    const denied = await request(
      f.authority,
      f.proposer,
      scopePath(f.proposer) + `/reviews/${review.requestId}/decision`,
      { decision: 'approve', expectedDigest: review.digest }
    );
    assert.equal(denied.status, 403);
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      0
    );
    await approve(f, review);
    await deliver(f, review);
    await expect(receipt(f.page, review.requestId)).toHaveText('applied');
    await expect(native(f.page, review.requestId)).toHaveText('confirmed');
    assert.deepEqual(
      await owners(f.page),
      [],
      'ORACLE:native-owner-not-settled'
    );
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1,
      'ORACLE:approved-effect'
    );
    await expect(field(f.page, 'route')).toHaveText('west');
    return {
      proposer: f.proposer.principal,
      reviewer: f.reviewer.principal,
      effects: 1,
      owners: [],
    };
  });

  check('concurrent-reverse-completion', async (f) => {
    const a = await prepare(f, 'route'),
      b = await prepare(f, 'window');
    const original = await owners(f.page);
    assert.equal(original.length, 2);
    assert.notEqual(original[0], original[1]);
    await f.page
      .getByLabel('Independent working note')
      .fill('human note survives both requests');
    await approve(f, a);
    await approve(f, b);
    await f.authority.host('patch', {
      tenant: f.proposer.tenant,
      patch: { capacity: 8 },
    });
    for (const review of [a, b])
      await f.authority.host('hold-response', {
        commandId: review.command.commandId,
      });
    await deliver(f, a);
    await deliver(f, b);
    for (const review of [a, b])
      await f.authority.waitForEvent(
        (e) =>
          e.event === 'response-held' &&
          e.commandId === review.command.commandId
      );
    assert.deepEqual(await owners(f.page), original);
    await button(f.page, 'Publish independent progress').click();
    await expect(field(f.page, 'progress')).toHaveText('1');
    assert.deepEqual(await owners(f.page), original);
    await f.authority.host('release-response', {
      commandId: b.command.commandId,
    });
    await expect(native(f.page, b.requestId)).toHaveText('confirmed');
    assert.deepEqual(
      await owners(f.page),
      [original[0]],
      'ORACLE:wrong-owner-settled'
    );
    await expect(receipt(f.page, a.requestId)).toHaveText('not observed');
    await f.capture('B');
    await f.authority.host('release-response', {
      commandId: a.command.commandId,
    });
    await expect(receipt(f.page, a.requestId)).toHaveText('rejected:conflict');
    await expect(native(f.page, a.requestId)).toHaveText('rolled back');
    assert.deepEqual(await owners(f.page), []);
    await expect(field(f.page, 'route')).toHaveText('north');
    await expect(field(f.page, 'window')).toHaveText('10:00');
    await expect(field(f.page, 'human-note')).toHaveText(
      'human note survives both requests'
    );
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1
    );
    return {
      originalOwners: original,
      completionOrder: ['window', 'route'],
      effects: 1,
      independentProgress: 1,
    };
  });

  check('approval-revoked-before-delivery', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    await button(
      operation(f.reviewerPage, review.requestId),
      'Revoke approval'
    ).click();
    await expect(
      operation(f.reviewerPage, review.requestId).locator('.review-status')
    ).toHaveText('revoked');
    // Stale proposer UI still offers delivery; the server must recheck approval.
    await deliver(f, review);
    await expect(receipt(f.page, review.requestId)).toHaveText(
      'rejected:approval-revoked'
    );
    await expect(native(f.page, review.requestId)).toHaveText('rolled back');
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      0
    );
    return { staleUiAuthorizedEffect: false };
  });

  check('preparation-refresh-registration-isolation', async (f) => {
    let releaseReply, observedReply;
    const held = new Promise((resolve) => {
      releaseReply = resolve;
    });
    const observed = new Promise((resolve) => {
      observedReply = resolve;
    });
    await f.page.route('**/reviews', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const actual = await route.fetch();
      observedReply();
      await held;
      await route.fulfill({ response: actual });
    });
    await button(f.page, 'Prepare route proposal').click();
    await observed;
    await expect(button(f.page, 'Refresh reviews and outcomes')).toBeDisabled();
    await expect(button(f.page, 'Prepare window proposal')).toBeDisabled();
    assert.deepEqual(await owners(f.page), []);
    releaseReply();
    await expect(f.page.locator('article.operation')).toHaveCount(1);
    await expect(f.page.locator('article.operation .native')).toHaveText(
      'pending'
    );
    const original = await owners(f.page);
    assert.equal(original.length, 1);
    await f.page.unroute('**/reviews');
    let releaseList, observedList;
    const listHeld = new Promise((resolve) => {
      releaseList = resolve;
    });
    const listObserved = new Promise((resolve) => {
      observedList = resolve;
    });
    await f.page.route('**/reviews', async (route) => {
      const actual = await route.fetch();
      observedList();
      await listHeld;
      await route.fulfill({ response: actual });
    });
    await button(f.page, 'Refresh reviews and outcomes').click();
    await listObserved;
    await expect(button(f.page, 'Prepare route proposal')).toBeDisabled();
    await expect(button(f.page, 'Prepare window proposal')).toBeDisabled();
    releaseList();
    await expect(button(f.page, 'Refresh reviews and outcomes')).toBeEnabled();
    await expect(f.page.locator('article.operation')).toHaveCount(1);
    assert.deepEqual(
      await owners(f.page),
      original,
      'ORACLE:duplicate-owner-during-refresh'
    );
    await f.page.unroute('**/reviews');
    return {
      actualServerRepliesDelayed: true,
      proposals: 1,
      owners: 1,
      deliveriesRemainIndependent: 'covered by concurrent-reverse-completion',
    };
  });

  check('old-snapshot-and-late-duplicate-reply', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    let release,
      observed,
      first = true;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const captured = new Promise((resolve) => {
      observed = resolve;
    });
    await f.page.route('**/snapshot', async (route) => {
      if (!first) return route.continue();
      first = false;
      const actual = await route.fetch();
      assert.equal((await actual.json()).values.route, 'north');
      observed();
      await held;
      await route.fulfill({ response: actual });
    });
    await button(f.page, 'Refresh reviews and outcomes').click();
    await captured;
    await f.authority.host('hold-response', {
      commandId: review.command.commandId,
    });
    await deliver(f, review);
    await f.authority.waitForEvent((e) => e.event === 'response-held');
    await button(
      operation(f.page, review.requestId),
      'Check authoritative receipt'
    ).click();
    await expect(native(f.page, review.requestId)).toHaveText('confirmed');
    await expect(field(f.page, 'server-snapshot')).toContainText('route west');
    release();
    await expect(button(f.page, 'Refresh reviews and outcomes')).toBeEnabled();
    await expect(field(f.page, 'route')).toHaveText('west');
    await expect(field(f.page, 'server-snapshot')).toContainText('route west');
    assert.deepEqual(
      await owners(f.page),
      [],
      'ORACLE:stale-review-restaged-owner'
    );
    await f.authority.host('release-response', {
      commandId: review.command.commandId,
    });
    await expect(native(f.page, review.requestId)).toHaveText('confirmed');
    await expect(
      button(operation(f.page, review.requestId), 'Deliver approved request')
    ).toBeDisabled();
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1
    );
    return {
      staleSnapshotIgnored: true,
      receiptCheckedDuringDelivery: true,
      repeatedReceiptDidNotReclassifySettlement: true,
      effects: 1,
    };
  });

  check('same-session-reload-reconstructs-explicit-owner', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    await f.page.reload();
    await expect(native(f.page, review.requestId)).toHaveText(
      'pending — reconstructed in this page'
    );
    const restored = (
      await request(
        f.authority,
        f.proposer,
        scopePath(f.proposer) + `/reviews/${review.requestId}`
      )
    ).body;
    assert.equal(restored.digest, review.digest);
    assert.deepEqual(restored.command, review.command);
    assert.equal((await owners(f.page)).length, 1);
    await deliver(f, review);
    await expect(native(f.page, review.requestId)).toHaveText('confirmed');
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1
    );
    return {
      immutableReviewPreserved: true,
      reconstructionDisclosed: true,
      effects: 1,
    };
  });

  check('aged-terminal-review-retains-pending-owner', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    const original = await owners(f.page);
    await f.authority.host('hold-response', {
      commandId: review.command.commandId,
    });
    await deliver(f, review);
    await f.authority.waitForEvent((e) => e.event === 'response-held');
    for (let n = 0; n < 72; n++) {
      const observation = (
        await request(
          f.authority,
          f.proposer,
          scopePath(f.proposer) + '/snapshot'
        )
      ).body;
      const command = commandFor(f.proposer, observation, 'history-' + n, {
        note: 'historical note ' + n,
      });
      const requested = await request(
        f.authority,
        f.proposer,
        scopePath(f.proposer) + '/reviews',
        { requestId: 'history-review-' + n, command }
      );
      assert.equal(requested.status, 202);
      const approved = await request(
        f.authority,
        f.reviewer,
        scopePath(f.reviewer) + `/reviews/${requested.body.requestId}/decision`,
        { decision: 'approve', expectedDigest: requested.body.digest }
      );
      assert.equal(approved.status, 200);
      const applied = await request(
        f.authority,
        f.proposer,
        scopePath(f.proposer) + '/commands',
        { requestId: requested.body.requestId, command }
      );
      assert.equal(applied.body.status, 'applied');
    }
    await refresh(f.page);
    await expect(field(f.page, 'review-coverage')).toContainText(
      'Recent history only'
    );
    await expect(operation(f.page, review.requestId)).toHaveCount(1);
    assert.deepEqual(
      await owners(f.page),
      original,
      'ORACLE:aged-pending-owner-disappeared'
    );
    await expect(receipt(f.page, review.requestId)).toHaveText('not observed');
    await f.authority.host('release-response', {
      commandId: review.command.commandId,
    });
    await expect(native(f.page, review.requestId)).toHaveText('confirmed');
    assert.deepEqual(await owners(f.page), []);
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      73
    );
    return {
      terminalHistoryBound: 64,
      usefulEffects: 73,
      originalOwnerRetained: true,
    };
  });

  check('replacement-refusal-and-explicit-recovery', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    const replacement = await f.authority.host('replace-entity', {
      tenant: f.proposer.tenant,
      patch: { route: 'replacement', note: 'authoritative replacement' },
    });
    await refresh(f.page);
    await expect(field(f.page, 'instance')).toHaveText(replacement.instance);
    await deliver(f, review);
    await namedOracle('ORACLE:entity-lifetime-rejection', () =>
      expect(receipt(f.page, review.requestId)).toHaveText('rejected:instance')
    );
    await expect(native(f.page, review.requestId)).toHaveText(
      'recovery required'
    );
    assert.equal(
      (await owners(f.page)).length,
      1,
      'ORACLE:unsafe-rollback-owner-lost'
    );
    await expect(field(f.page, 'route')).toHaveText('replacement');
    await f.capture('C');
    await button(
      operation(f.page, review.requestId),
      'Keep authoritative replacement'
    ).click();
    await expect(native(f.page, review.requestId)).toHaveText(
      'obsolete local ownership resolved; server rejection preserved'
    );
    assert.deepEqual(await owners(f.page), []);
    await expect(receipt(f.page, review.requestId)).toHaveText(
      'rejected:instance'
    );
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      0
    );
    return {
      refused: true,
      explicitRecovery: true,
      rejectedReceiptPreserved: true,
    };
  });

  check('postcommit-crash-reload-reconciliation', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    const oldPid = f.authority.pid,
      port = Number(new URL(f.authority.url).port);
    await f.authority.host('crash-after-commit', {
      commandId: review.command.commandId,
    });
    await deliver(f, review);
    await f.authority.waitForExit();
    await expect(
      operation(f.page, review.requestId).locator('.delivery')
    ).toHaveText('uncertain');
    await f.capture('D');
    f.authority = await startAuthorityProcess({
      database: f.database,
      siteDirectory,
      port,
      outputDirectory: f.logs,
    });
    assert.notEqual(f.authority.pid, oldPid);
    await f.page.reload();
    await expect(receipt(f.page, review.requestId)).toHaveText('applied');
    await expect(native(f.page, review.requestId)).toHaveText(
      'no owner in this page — authoritative receipt observed'
    );
    await expect(field(f.page, 'route')).toHaveText('west');
    assert.deepEqual(await owners(f.page), []);
    const replay = await request(
      f.authority,
      f.proposer,
      scopePath(f.proposer) + '/commands',
      { requestId: review.requestId, command: review.command }
    );
    assert.equal(replay.status, 200);
    assert.equal(replay.body.status, 'applied');
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1,
      'ORACLE:duplicate-effect'
    );
    return {
      oldPid,
      restartedPid: f.authority.pid,
      effects: 1,
      nativeOwnerReused: false,
    };
  });

  check('page-close-late-response-and-new-session', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    await f.authority.host('hold-response', {
      commandId: review.command.commandId,
    });
    await deliver(f, review);
    await f.authority.waitForEvent((e) => e.event === 'response-held');
    await button(f.page, 'Close workspace').click();
    await expect(field(f.page, 'workspace-state')).toHaveText(
      'Closed — remote outcomes require reconciliation'
    );
    await f.authority.host('release-response', {
      commandId: review.command.commandId,
    });
    await expect(field(f.page, 'status')).toHaveText(
      'Workspace closed. This does not cancel or settle external effects.'
    );
    // Actual navigation destroys the old Angular instance; a new authenticated epoch has no old operation/native handle.
    const next = await f.authority.host('create-session', {
      principal: f.proposer.principal,
      tenant: f.proposer.tenant,
      role: 'proposer',
    });
    await f.page.evaluate(
      (token) => sessionStorage.setItem('dispatch-session-token', token),
      next.token
    );
    await f.page.reload();
    await expect(field(f.page, 'session-id')).toHaveText(next.sessionId);
    await expect(field(f.page, 'empty-operations')).toHaveText(
      'No operations in this session.'
    );
    assert.deepEqual(await owners(f.page), []);
    const oldReceipt = await request(
      f.authority,
      next,
      scopePath(next) + '/receipts/' + review.command.commandId
    );
    assert.equal(oldReceipt.body.status, 'applied');
    assert.equal(oldReceipt.body.sessionId, f.proposer.sessionId);
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1
    );
    return {
      newEpoch: next.epoch,
      oldOutcomeLookup: true,
      inheritedOwner: false,
    };
  });

  check('stop-new-work-preserves-applied-outcome', async (f) => {
    const review = await prepare(f);
    await approve(f, review);
    await f.authority.host('hold-response', {
      commandId: review.command.commandId,
    });
    await deliver(f, review);
    await f.authority.waitForEvent((e) => e.event === 'response-held');
    await button(f.page, 'Stop new work in this session').click();
    await expect(field(f.page, 'workspace-state')).toHaveText(
      'Stopped — existing outcomes remain available'
    );
    await expect(button(f.page, 'Prepare route proposal')).toBeDisabled();
    await f.authority.host('release-response', {
      commandId: review.command.commandId,
    });
    await expect(receipt(f.page, review.requestId)).toHaveText('applied');
    await expect(native(f.page, review.requestId)).toHaveText('confirmed');
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1
    );
    return { stoppedFutureWork: true, appliedEffectRemains: true };
  });

  check('redacted-gap-aware-bounded-investigation', async (f) => {
    const secret = 'FAKE-SENSITIVE-CANARY-never-retain-in-evidence';
    await f.authority.host('patch', {
      tenant: f.proposer.tenant,
      patch: { note: secret },
    });
    const review = await prepare(f);
    await approve(f, review);
    await deliver(f, review);
    await expect(receipt(f.page, review.requestId)).toHaveText('applied');
    // More writes than server retention while this consumer is stalled.
    for (let n = 0; n < 270; n++)
      await f.authority.host('patch', {
        tenant: f.proposer.tenant,
        patch: { note: secret + n },
      });
    await button(f.page, 'Load recent evidence').click();
    await namedOracle('ORACLE:missing-gap-warning', () =>
      expect(field(f.page, 'evidence-coverage')).toContainText(
        'Incomplete evidence'
      )
    );
    for (let n = 0; n < 3; n++) {
      const response = f.page.waitForResponse((r) =>
        r.url().includes('/events?')
      );
      await button(f.page, 'Load recent evidence').click();
      await response;
      await expect(field(f.page, 'evidence').locator('li')).toHaveCount(64);
    }
    await button(f.page, 'Export redacted evidence').click();
    await expect(field(f.page, 'evidence-export')).not.toBeEmpty();
    const exported = await field(f.page, 'evidence-export').innerText();
    assert(!exported.includes(secret));
    assert(!exported.includes(f.proposer.token));
    assert(!exported.includes(f.reviewer.token));
    const data = JSON.parse(exported);
    assert.equal(data.events.length, 64);
    assert(data.coverage.includes('Incomplete'));
    await f.capture('E');
    assert.equal(
      (await f.authority.host('diagnostics')).entities[0].effects,
      1
    );
    return {
      serverRetention: 256,
      renderedRetention: 64,
      gapVisible: true,
      canariesAbsent: true,
      nativeOutcome: 'confirmed',
    };
  });

  const admittedCases = selected.length
    ? cases.filter((test) => selected.includes(test.id))
    : cases;
  if (selected.length)
    assert.equal(
      admittedCases.length,
      selected.length,
      'Every requested control case exists'
    );
  for (const { id, run } of admittedCases) {
    const contexts = [],
      errors = [],
      directory = join(output, id);
    const f = {
      database: join(directory, 'authority.sqlite'),
      logs: join(directory, 'logs'),
      reviewIds: [],
    };
    f.capture = async (label) => {
      await f.page.screenshot({
        path: join(investigation, label + '.png'),
        fullPage: true,
      });
      writeFileSync(
        join(investigation, label + '.txt'),
        await f.page.locator('body').innerText()
      );
    };
    const started = performance.now();
    try {
      f.authority = await startAuthority({
        database: f.database,
        siteDirectory,
        outputDirectory: f.logs,
      });
      f.proposer = await f.authority.host('create-session', {
        principal: 'agent-owner',
        tenant: 'tenant-a',
        role: 'proposer',
      });
      f.reviewer = await f.authority.host('create-session', {
        principal: 'human-reviewer',
        tenant: 'tenant-a',
        role: 'reviewer',
      });
      for (const [key, session] of [
        ['page', f.proposer],
        ['reviewerPage', f.reviewer],
      ]) {
        const context = await browser.newContext();
        contexts.push(context);
        // Each independent browser context receives only its own trusted host credential.
        await context.addInitScript((token) => {
          if (!sessionStorage.getItem('dispatch-session-token'))
            sessionStorage.setItem('dispatch-session-token', token);
        }, session.token);
        const page = await context.newPage();
        f[key] = page;
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(f.authority.url);
        await expect(field(page, 'principal')).toHaveText(session.principal);
        await expect(field(page, 'route')).toHaveText('north');
      }
      const details = await run(f);
      assert.deepEqual(errors, [], 'No uncaught application errors');
      await f.page.screenshot({
        path: join(directory, 'final.png'),
        fullPage: true,
      });
      writeFileSync(
        join(directory, 'visible.txt'),
        await f.page.locator('body').innerText()
      );
      const result = {
        id,
        passed: true,
        wallMs: performance.now() - started,
        details,
        browserErrors: errors,
      };
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (error) {
      if (f.page) {
        await f.page
          .screenshot({ path: join(directory, 'failure.png'), fullPage: true })
          .catch(() => {});
        writeFileSync(
          join(directory, 'visible-failure.txt'),
          await f.page
            .locator('body')
            .innerText()
            .catch(() => 'Page unavailable')
        );
      }
      results.push({
        id,
        passed: false,
        error: String(error.stack ?? error),
        browserErrors: errors,
      });
    } finally {
      for (const context of contexts) await context.close();
      await f.authority?.stop().catch(() => f.authority.kill());
      writeFileSync(
        join(output, 'cases.json'),
        JSON.stringify(results, null, 2)
      );
    }
    if (!results.at(-1).passed) break;
  }
  return {
    passed:
      results.length === admittedCases.length && results.every((r) => r.passed),
    cases: results,
    expectedCases: admittedCases.length,
  };
}
