import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

export async function runBrowserChecks(
  browser,
  openServer,
  output,
  control = 'none'
) {
  const results = [];
  const cases = [];
  const check = (id, body) => cases.push({ id, body });
  const oracle = (condition, code, detail) => {
    if (!condition) throw new Error(`ORACLE:${code}: ${detail}`);
  };
  check(
    'accepted',
    async ({
      page,
      server,
      field,
      button,
      draft,
      approve,
      deliver,
      pending,
      terminals,
    }) => {
      await draft();
      const [id] = await pending();
      assert.equal(typeof id, 'number');
      await expect(button('Keep authoritative replacement')).toBeDisabled();
      await expect(field('actor')).toHaveText('unknown');
      await expect(field('route')).toHaveText('west');
      assert.equal(server.inspect().requests.length, 0);
      assert.equal(server.inspect().effects, 0);
      await expect(button('Deliver approved')).toBeDisabled();
      await approve();
      assert.equal(server.inspect().reviews.length, 1);
      assert.equal(server.inspect().requests.length, 0);
      const reviewed = JSON.parse(await field('review').innerText());
      assert.ok(Object.hasOwn(reviewed.proposal, 'expectedInstance'));
      await deliver();
      await expect(field('phase')).toHaveText('succeeded');
      oracle(
        (await pending()).length === 0,
        'native-owner-not-settled',
        'HTTP success must not masquerade as native settlement'
      );
      assert.deepEqual(await terminals(), [[id, 'confirmed']]);
      assert.equal(server.inspect().effects, 1);
      assert.equal(server.inspect().requests.length, 1);
      assert.deepEqual(server.inspect().requests[0].command, reviewed);
      assert.equal(
        server.inspect().observation.values.route,
        await field('route').innerText()
      );
      await expect(button('Deliver approved')).toBeDisabled();
      await expect(field('grants')).toHaveText('0');
    }
  );
  check('producer-cancel', async ({ server, field, button, pending }) => {
    await button('Start deterministic producer').click();
    await expect(field('producer')).toHaveText('awaiting completion');
    assert.deepEqual(await pending(), []);
    assert.equal(server.inspect().requests.length, 0);
    await button('Cancel producer').click();
    await expect(field('producer')).toHaveText('cancelled before proposal');
    await expect(button('Complete producer')).toBeDisabled();
    assert.deepEqual(await pending(), []);
    assert.equal(server.inspect().reviews.length, 0);
    assert.equal(server.inspect().effects, 0);
  });
  check(
    'delayed-aba-independent',
    async ({ page, server, field, button, approve, deliver, pending }) => {
      await button('Start deterministic producer').click();
      await expect(field('producer')).toHaveText('awaiting completion');
      const observed = JSON.parse(await field('observation').innerText());
      assert.equal(observed.versions.capacity, 0);
      server.controls.capacityAba();
      await button('Refresh authority observation').click();
      await expect(field('message')).toContainText('Fresh authority');
      assert.equal(server.inspect().observation.versions.capacity, 2);
      await expect(field('capacity')).toHaveText('10');
      await page
        .getByLabel('Independent note', { exact: true })
        .fill('human edit survives stale agent');
      await button('Complete producer').click();
      await expect(field('phase')).toHaveText('draft');
      await expect(field('actor')).toContainText(
        'declared: deterministic-dispatch'
      );
      const held = await pending();
      assert.equal(held.length, 1);
      await button('Publish independent progress').click();
      await expect(field('published')).toContainText('1');
      await expect(field('declaration')).not.toHaveText('held');
      assert.deepEqual(await pending(), held);
      await approve();
      const review = JSON.parse(await field('review').innerText());
      assert.equal(
        review.proposal.expected.capacity,
        observed.versions.capacity
      );
      await deliver();
      await expect(field('phase')).toHaveText('failed');
      await expect(field('server-outcome')).toHaveText('rejected:conflict');
      await expect(field('route')).toHaveText('north');
      await expect(field('note')).toHaveText('human edit survives stale agent');
      await expect(field('progress')).toHaveText('1');
      assert.deepEqual(await pending(), []);
      assert.equal(server.inspect().effects, 0);
      assert.equal(server.inspect().hostEffects, 2);
      assert.equal(server.inspect().requests.length, 1);
    }
  );
  check(
    'exact-approval',
    async ({ server, field, button, draft, approve, deliver }) => {
      await draft();
      await approve();
      const original = JSON.parse(await field('review').innerText());
      await button('Probe changed approved command').click();
      await expect(field('control')).toHaveText('approval-mismatch-rejected');
      assert.equal(server.inspect().requests.length, 1);
      assert.equal(server.inspect().requests[0].accepted, false);
      assert.equal(server.inspect().effects, 0);
      assert.match(
        server.inspect().requests[0].error,
        /Missing or mismatched server approval/
      );
      assert.deepEqual(JSON.parse(await field('review').innerText()), original);
      await deliver();
      await expect(field('phase')).toHaveText('succeeded');
      assert.equal(server.inspect().requests.length, 2);
      assert.equal(server.inspect().effects, 1);
      assert.deepEqual(server.inspect().requests[1].command, original);
    }
  );
  check(
    'permission-revoked',
    async ({ page, server, field, draft, approve, deliver, pending }) => {
      await draft();
      await approve();
      server.controls.setAllowed(false);
      await page
        .getByLabel('Independent note', { exact: true })
        .fill('human work after approval');
      await deliver();
      await expect(field('phase')).toHaveText('failed');
      await expect(field('server-outcome')).toHaveText('rejected:permission');
      assert.equal(server.inspect().requests.length, 1);
      assert.equal(server.inspect().effects, 0);
      await expect(field('route')).toHaveText('north');
      await expect(field('note')).toHaveText('human work after approval');
      assert.deepEqual(await pending(), []);
    }
  );
  check(
    'lost-ack-retry',
    async ({
      server,
      field,
      button,
      draft,
      approve,
      deliver,
      pending,
      terminals,
    }) => {
      await draft();
      await approve();
      const ids = await pending();
      assert.equal(ids.length, 1);
      server.controls.loseAcknowledgment();
      await deliver();
      await expect(field('phase')).toHaveText('uncertain');
      assert.deepEqual(await pending(), ids);
      assert.equal(server.inspect().effects, 1);
      assert.equal(server.inspect().requests.length, 1);
      assert.equal(server.inspect().requests[0].transportErrorStatus, 503);
      await button('Dispose session').click();
      await expect(field('message')).toContainText('Disposal blocked');
      await expect(field('destroyed')).toHaveText('0');
      await button('Retry same command').click();
      await expect(field('phase')).toHaveText('succeeded');
      assert.deepEqual(await pending(), []);
      assert.deepEqual(await terminals(), [[ids[0], 'confirmed']]);
      const state = server.inspect();
      assert.equal(state.effects, 1);
      assert.equal(state.requests.length, 2);
      assert.deepEqual(state.requests[0].command, state.requests[1].command);
      assert.equal(state.requests[0].token, state.requests[1].token);
      assert.equal(state.requests[0].acknowledgmentLost, true);
      await expect(field('deliveries')).toHaveText('2');
    }
  );
  check(
    'accepted-newer-owner',
    async ({
      server,
      field,
      button,
      draft,
      approve,
      deliver,
      pending,
      terminals,
    }) => {
      await draft();
      await approve();
      const [older] = await pending();
      await button('Create newer overlapping owner').click();
      await expect.poll(pending).toHaveLength(2);
      const both = await pending();
      assert.equal(both.length, 2);
      const newer = both.find((id) => id !== older);
      assert.equal(typeof newer, 'number');
      await deliver();
      await expect(field('phase')).toHaveText('local-pending');
      await expect(field('server-outcome')).toHaveText('applied');
      const remaining = await pending();
      assert.ok(remaining.includes(newer));
      assert.ok(
        remaining.includes(older) ||
          (await terminals()).some(
            ([id, kind]) => id === older && kind === 'confirmed'
          ),
        'Older owner needs observed terminal disposition or retained pending identity'
      );
      await expect(field('route')).toHaveText('east');
      assert.equal(server.inspect().effects, 1);
      assert.equal(server.inspect().requests.length, 1);
      await button('Dispose session').click();
      await expect(field('destroyed')).toHaveText('0');
      await expect(field('message')).toContainText('Disposal blocked');
      await button('Resolve newer owner').click();
      await expect(button('Resolve newer owner')).toBeDisabled();
      await button('Retry local settlement').click();
      await expect(field('phase')).toHaveText('succeeded');
      await expect(field('route')).toHaveText('west');
      assert.deepEqual(await pending(), []);
      assert.ok(
        (await terminals()).some(
          ([id, kind]) => id === older && kind === 'confirmed'
        )
      );
      assert.ok(
        (await terminals()).some(
          ([id, kind]) => id === newer && kind === 'rolled-back'
        )
      );
      assert.equal(server.inspect().requests.length, 1);
      assert.equal(server.inspect().effects, 1);
      await expect(field('deliveries')).toHaveText('1');
    }
  );
  check(
    'entity-replacement',
    async ({
      page,
      server,
      field,
      button,
      draft,
      approve,
      deliver,
      pending,
      terminals,
    }) => {
      await draft();
      await approve();
      const [obsoleteOwner] = await pending();
      await expect(button('Keep authoritative replacement')).toBeDisabled();
      await page
        .getByLabel('Independent note', { exact: true })
        .fill('keep the human note after replacement');
      const old = server.inspect().observation;
      assert.equal(old.instance, 'delivery-1:1');
      await expect(field('old-row')).toContainText('delivery-1:1');
      server.controls.replaceEntity();
      await button('Refresh authority observation').click();
      await expect(field('instance')).toHaveText('delivery-1:2');
      await expect(field('replacement-distinct')).toHaveText('true');
      await expect(field('old-row')).not.toContainText('delivery-1:2');
      await expect(button('Keep authoritative replacement')).toBeDisabled();
      assert.equal(
        server.inspect().observation.versions.route,
        old.versions.route,
        'Replacement reuses field revision to make instance precondition necessary'
      );
      await deliver();
      await expect(field('server-outcome')).toHaveText(/^(applied|rejected:)/);
      const receipt = server.inspect().requests[0]?.receipt;
      oracle(
        receipt?.status === 'rejected' && receipt.reason === 'instance',
        'instance-command-accepted',
        'Same key and matching field versions must not target a new entity instance'
      );
      await expect(field('phase')).toHaveText('local-pending');
      await expect(field('local-outcome')).toHaveText('pending');
      await expect(field('message')).toContainText(
        'later-confirmed-dependency'
      );
      await expect(field('server-outcome')).toHaveText('rejected:instance');
      assert.deepEqual(await pending(), [obsoleteOwner]);
      assert.deepEqual(await terminals(), []);
      await button('Retry local settlement').click();
      await expect(field('phase')).toHaveText('local-pending');
      assert.deepEqual(await pending(), [obsoleteOwner]);
      assert.equal(server.inspect().requests.length, 1);
      await expect(button('Keep authoritative replacement')).toBeEnabled();
      await button('Keep authoritative replacement').click();
      await expect(field('phase')).toHaveText('failed');
      await expect(field('local-outcome')).toHaveText('confirmed');
      await expect(field('local-resolution')).toContainText(
        'server command remains rejected'
      );
      await expect(field('server-outcome')).toHaveText('rejected:instance');
      assert.deepEqual(await terminals(), [[obsoleteOwner, 'confirmed']]);
      await expect(field('route')).toHaveText('north');
      await expect(field('instance')).toHaveText('delivery-1:2');
      await expect(field('note')).toHaveText(
        'keep the human note after replacement'
      );
      await expect(field('progress')).toHaveText('0');
      await expect(field('old-row')).not.toContainText('delivery-1:2');
      assert.equal(server.inspect().effects, 0);
      assert.equal(server.inspect().requests.length, 1);
      assert.deepEqual(await pending(), []);
      await expect(button('Keep authoritative replacement')).toBeDisabled();
    }
  );
  check(
    'reject-preserves-human',
    async ({ page, server, field, button, draft, approve, pending }) => {
      await draft();
      await approve();
      await page
        .getByLabel('Independent note', { exact: true })
        .fill('keep independent human edit');
      await button('Reject unsent proposal').click();
      await expect(field('phase')).toHaveText('rejected');
      await expect(field('route')).toHaveText('north');
      await expect(field('note')).toHaveText('keep independent human edit');
      assert.equal(server.inspect().requests.length, 0);
      assert.equal(server.inspect().effects, 0);
      await expect(field('cleanup-pending')).toHaveText('0');
      assert.equal(server.inspect().grants, 0);
      assert.deepEqual(await pending(), []);
    }
  );
  check(
    'transport-cannot-approve',
    async ({ page, server, field, button, draft, deliver, pending }) => {
      await draft();
      const nativeIds = await pending();
      await button('Review proposal').click();
      await button('Request host approval').click();
      await expect(field('phase')).toHaveText('approval-pending');
      const command = JSON.parse(await field('review').innerText());
      const [queued] = server.inspect().reviewRequests;
      assert.equal(queued.status, 'pending');
      assert.equal(server.inspect().grants, 0);
      const attack = await page.evaluate(
        async ({ command, requestId }) => {
          const post = async (path, body) => {
            const response = await fetch(path, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: 'Bearer fixture-only',
              },
              body: JSON.stringify(body),
            });
            return { status: response.status, body: await response.json() };
          };
          return {
            duplicateRequest: await post('/review', { command, requestId }),
            changedRequest: await post('/review', {
              command: {
                ...command,
                proposal: { ...command.proposal, patch: { route: 'changed' } },
              },
              requestId,
            }),
            forgedReview: await post('/review', {
              command,
              requestId,
              approved: true,
              reviewerContext: { fixture: 'host-reviewer' },
            }),
            unapprovedCommand: await post('/commands', { command }),
          };
        },
        { command, requestId: queued.requestId }
      );
      assert.equal(attack.duplicateRequest.status, 202);
      assert.equal(attack.duplicateRequest.body.requestId, queued.requestId);
      assert.equal(attack.duplicateRequest.body.status, 'pending');
      assert.equal(attack.changedRequest.status, 400);
      assert.match(
        attack.changedRequest.body.error,
        /identity content changed/
      );
      assert.equal(server.inspect().reviewRequests.length, 1);
      assert.equal(attack.forgedReview.status, 400);
      assert.match(
        attack.forgedReview.body.error,
        /Transport cannot supply approval/
      );
      assert.equal(attack.unapprovedCommand.status, 409);
      assert.match(
        attack.unapprovedCommand.body.error,
        /Missing or mismatched server approval/
      );
      await button('Check host approval').click();
      await expect(field('message')).toHaveText(
        'Host approval is still pending'
      );
      assert.equal(server.inspect().grants, 0);
      assert.equal(server.inspect().reviews.length, 0);
      assert.equal(server.inspect().effects, 0);
      assert.deepEqual(await pending(), nativeIds);
      server.controls.approveReview(queued.requestId);
      await button('Check host approval').click();
      await expect(field('phase')).toHaveText('approved');
      await deliver();
      await expect(field('phase')).toHaveText('succeeded');
      assert.equal(server.inspect().effects, 1);
      assert.equal(server.inspect().requests.length, 2);
      assert.deepEqual(await pending(), []);
    }
  );
  check(
    'accepted-cleanup-ack-lost',
    async ({
      server,
      field,
      button,
      draft,
      approve,
      deliver,
      pending,
      terminals,
    }) => {
      await draft();
      await approve();
      const [id] = await pending();
      server.controls.loseRevokeAcknowledgment();
      await deliver();
      await expect(field('phase')).toHaveText('succeeded');
      await expect(field('cleanup-message')).toContainText(
        'Cleanup acknowledgment uncertain'
      );
      await expect(field('busy')).toHaveText('false');
      await expect(field('cleanup-pending')).toHaveText('1');
      await expect(field('grants')).toHaveText('1');
      assert.deepEqual(await pending(), []);
      assert.deepEqual(await terminals(), [[id, 'confirmed']]);
      assert.equal(server.inspect().grants, 0);
      assert.equal(server.inspect().effects, 1);
      assert.equal(server.inspect().requests.length, 1);
      assert.equal(server.inspect().revocations.length, 1);
      assert.equal(server.inspect().revocations[0].transportErrorStatus, 503);
      await button('Dispose session').click();
      await expect(field('message')).toContainText(
        'grant cleanup acknowledgment is unresolved'
      );
      await expect(field('destroyed')).toHaveText('0');
      await button('Retry grant cleanup').click();
      await expect(field('cleanup-pending')).toHaveText('0');
      await expect(field('grants')).toHaveText('0');
      assert.equal(server.inspect().requests.length, 1);
      assert.equal(server.inspect().effects, 1);
      assert.equal(server.inspect().revocations.length, 2);
      assert.equal(server.inspect().revocations[0].acknowledgmentLost, true);
      assert.equal(
        server.inspect().revocations[0].commandId,
        server.inspect().revocations[1].commandId
      );
      assert.deepEqual(await pending(), []);
      await expect(field('server-outcome')).toHaveText('applied');
    }
  );
  check(
    'rejected-cleanup-ack-lost',
    async ({ server, field, button, draft, approve, pending, terminals }) => {
      await draft();
      await approve();
      const [id] = await pending();
      server.controls.loseRevokeAcknowledgment();
      await button('Reject unsent proposal').click();
      await expect(field('phase')).toHaveText('rejected');
      await expect(field('cleanup-message')).toContainText(
        'Cleanup acknowledgment uncertain'
      );
      await expect(field('busy')).toHaveText('false');
      assert.deepEqual(await pending(), []);
      assert.deepEqual(await terminals(), [[id, 'rolled-back']]);
      await expect(field('route')).toHaveText('north');
      await expect(field('cleanup-pending')).toHaveText('1');
      assert.equal(server.inspect().grants, 0);
      assert.equal(server.inspect().requests.length, 0);
      assert.equal(server.inspect().effects, 0);
      assert.equal(server.inspect().revocations.length, 1);
      assert.equal(server.inspect().revocations[0].transportErrorStatus, 503);
      await button('Retry grant cleanup').click();
      await expect(field('cleanup-pending')).toHaveText('0');
      await expect(field('grants')).toHaveText('0');
      assert.equal(server.inspect().revocations.length, 2);
      assert.equal(server.inspect().requests.length, 0);
      assert.equal(server.inspect().effects, 0);
      assert.deepEqual(await pending(), []);
    }
  );
  const selected =
    control === 'skip-native-settlement'
      ? cases.filter((c) => c.id === 'accepted')
      : control === 'ignore-instance'
      ? cases.filter((c) => c.id === 'entity-replacement')
      : cases;
  for (const item of selected) {
    const server = await openServer(control);
    const page = await browser.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    const field = (name) => page.getByTestId(name),
      button = (name) => page.getByRole('button', { name, exact: true });
    const pending = async () => {
      const text = await field('pending').innerText();
      return text ? text.split(',').map(Number) : [];
    };
    const terminals = async () =>
      JSON.parse(await field('terminals').innerText());
    let result;
    try {
      await page.goto(server.url);
      await expect(field('phase')).toHaveText('idle');
      const draft = async () => {
        await button('Propose unknown actor').click();
        await expect(field('phase')).toHaveText('draft');
      };
      const approve = async () => {
        await button('Review proposal').click();
        await expect(field('phase')).toHaveText('reviewed');
        await button('Request host approval').click();
        await expect(field('phase')).toHaveText('approval-pending');
        assert.equal(server.inspect().grants, 0);
        const requests = server.inspect().reviewRequests;
        assert.equal(requests.length, 1);
        assert.equal(requests[0].status, 'pending');
        assert.deepEqual(
          requests[0].command,
          JSON.parse(await field('review').innerText())
        );
        server.controls.approveReview(requests[0].requestId);
        await button('Check host approval').click();
        await expect(field('phase')).toHaveText('approved');
      };
      const deliver = async () => button('Deliver approved').click();
      await item.body({
        page,
        server,
        field,
        button,
        draft,
        approve,
        deliver,
        pending,
        terminals,
      });
      assert.deepEqual(errors, []);
      await expect(field('busy')).toHaveText('false');
      await expect(field('cleanup-pending')).toHaveText('0');
      await button('Dispose session').click();
      await expect(field('phase')).toHaveText('disposed');
      await expect(field('destroyed')).toHaveText('1');
      await expect(button('Dispose session')).toBeDisabled();
      assert.deepEqual(await pending(), []);
      result = {
        id: item.id,
        outcome: 'PASS',
        nativeTerminals: await terminals(),
        server: server.inspect(),
        consoleErrors,
      };
    } catch (error) {
      await page
        .screenshot({
          path: join(output, `${item.id}-failure.png`),
          fullPage: true,
        })
        .catch(() => {});
      result = {
        id: item.id,
        outcome: 'FAIL',
        error: String(error),
        pageErrors: errors,
        consoleErrors,
        server: server.inspect(),
        body: await page
          .locator('body')
          .innerText()
          .catch(() => 'unavailable'),
      };
    } finally {
      await page.close();
      await server.close();
    }
    result.serverClosed = server.inspect().closed;
    results.push(result);
    writeFileSync(
      join(output, 'browser-results.partial.json'),
      JSON.stringify(results, null, 2) + '\n'
    );
  }
  const expectedCode =
    control === 'skip-native-settlement'
      ? 'native-owner-not-settled'
      : control === 'ignore-instance'
      ? 'instance-command-accepted'
      : undefined;
  const controlDetected =
    expectedCode !== undefined &&
    results.length === 1 &&
    results[0].outcome === 'FAIL' &&
    results[0].error.includes(`ORACLE:${expectedCode}:`);
  return {
    control,
    results,
    controlDetected,
    passed:
      control === 'none'
        ? results.length === 12 &&
          results.every((result) => result.outcome === 'PASS')
        : controlDetected,
  };
}
