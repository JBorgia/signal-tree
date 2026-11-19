# Proposed public-route Playwright check — not executed

For Noether after Main approves and composes the seven-file overlay. This is an execution recipe, not an addition to the repository's E2E suite or configuration. The existing browser suite may not visit this new path. Use the existing Playwright installation and the actual served demo origin; do not introduce a framework or change configuration. Run against the composed demo, not the currently active candidate before composition.

The snippet assumes the existing browser runner supplies `page` and Playwright `expect`. Set `demoOrigin` to the origin of the composed demo already running in Noether's environment. No fixed port is assumed.

```ts
// Proposed assertions inside the existing Playwright execution context.
// Start a fresh component session; north is the initial previous route.
await page.goto(`${demoOrigin}/independent-publication`);
await expect(page.getByRole('heading', {
  level: 1,
  name: 'Publish a note while a route is still under review.',
})).toBeVisible();
await expect(page.getByText('v16 development preview · Unreleased', {
  exact: true,
})).toBeVisible();

const route = page.getByTestId('route');
const proposal = page.getByTestId('proposal');
const endpoint = page.getByTestId('endpoint');
const admission = page.getByTestId('admission');
const note = page.getByRole('article').filter({
  has: page.getByRole('heading', { name: 'Visible tree state', exact: true }),
}).locator('dd').nth(2);
const deliveryPanel = page.getByRole('article').filter({
  has: page.getByRole('heading', { name: 'In-memory endpoint', exact: true }),
});
const publish = page.getByRole('button', {
  name: '2. Publish independent note', exact: true,
});
const reject = page.getByRole('button', {
  name: '3. Reject route locally', exact: true,
});
const confirm = page.getByRole('button', {
  name: '3. Confirm route locally', exact: true,
});

await expect(route).toHaveText('north');
await expect(endpoint).toHaveText('No delivery yet');
await expect(publish).toBeDisabled();
await page.getByRole('button', {
  name: '1. Propose west', exact: true,
}).click();
await expect(route).toHaveText('west');
await expect(proposal).toHaveText('Pending local review');

// Crucially, do not confirm/reject to help delivery succeed.
await publish.click();
await expect(endpoint).toHaveText('dispatch-ready');
await expect(admission).toHaveText('started');
await expect(deliveryPanel.getByText('Delivered notes:', { exact: false }))
  .toHaveText('Delivered notes: 1');
await expect(publish).toBeEnabled(); // The awaited action has finished.
await expect(proposal).toHaveText('Pending local review');
await expect(route).toHaveText('west');
await expect(note).toHaveText('dispatch-ready');
await expect(page.getByRole('alert')).toHaveCount(0);

// Same literal, still pending: no extra endpoint delivery.
await publish.click();
await expect(admission).toHaveText('no-write');
await expect(publish).toBeEnabled();
await expect(deliveryPanel.getByText('Delivered notes:', { exact: false }))
  .toHaveText('Delivered notes: 1');
await expect(endpoint).toHaveText('dispatch-ready');
await expect(proposal).toHaveText('Pending local review');
await expect(route).toHaveText('west');
await expect(page.getByRole('alert')).toHaveCount(0);

await reject.click();
// This fresh session restores north. After confirming west in an earlier
// proposal, a later rejection would restore west instead.
await expect(route).toHaveText('north');
await expect(proposal).toHaveText('Rejected locally');
await expect(note).toHaveText('dispatch-ready'); // Tree note survives rollback.
await expect(endpoint).toHaveText('dispatch-ready');
await expect(deliveryPanel.getByText('Delivered notes:', { exact: false }))
  .toHaveText('Delivered notes: 1');
await expect(confirm).toBeDisabled();
await expect(reject).toBeDisabled();
await expect(publish).toBeDisabled();
await expect(page.getByRole('alert')).toHaveCount(0);
```

Use Playwright's existing bounded assertion/test timeouts and auto-waiting, not fixed sleeps. `toHaveText(string)` normalizes whitespace, so formatting around interpolations is not asserted. The note locator uses the current visible-state definition list's third value; this recipe requires no new selector or page change.

Success means the actual routed/rendered Angular page delivered the literal while its proposal remained pending, repeated it without another delivery, and retained the local note after rejecting the route. It does not prove backend durability, absence of later deliveries for all time, production bundle size, or teardown collectability. The separate component spec contains teardown controls; this browser recipe does not replace them.

Before execution, record the composed source/patch identity, build/serve command or receipt, actual origin, browser/version and command used. Preserve the first failure plus console/page errors and screenshot/trace using the existing runner's facilities. Report this recipe as NOT RUN until it executes; a successful main browser suite that omits this path is not evidence for these assertions.

The seven-file patch remains unchanged. No broad E2E file or configuration was edited.

The added component test for a mocked `settled()` rejection checks UI error handling only. This browser recipe does not inject that rejection and makes no claim about real Link endpoint-failure reporting. Neither the new component case nor this recipe has been executed by the overlay author.
