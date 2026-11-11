import { isDevMode, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { EntitiesDemoComponent, INITIAL_PRODUCTS } from './entities-demo.component';

type Control = 'none' | 'skip-filter' | 'skip-destroy';
type Timing = { kind: string; wallMs: number };

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function button(parent: ParentNode, selector: string): HTMLButtonElement {
  const found = parent.querySelector<HTMLButtonElement>(selector);
  check(found, `Missing actual inventory button: ${selector}`);
  return found;
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('article.entity-row'));
}

function renderedIds(): number[] {
  return rows().map((element) => {
    const match = element.querySelector('.entity-key')?.textContent?.trim().match(/^#(\d+) \/ /);
    check(match, 'Rendered product identity missing');
    return Number(match[1]);
  });
}

function checkRenderedIds(expected: number[], label: string): void {
  const actual = renderedIds();
  check(actual.length === expected.length && actual.every((id, index) => id === expected[index]),
    `${label}: rendered identities/order differ`);
}

function row(id: number): HTMLElement {
  const found = rows().find((element) =>
    element.querySelector('.entity-key')?.textContent?.trim().startsWith(`#${id} /`)
  );
  check(found, `Missing rendered product ${id}`);
  return found;
}

async function run(control: Control = 'none') {
  check(!isDevMode(), 'Angular consumer must run in production mode');
  const start = performance.now();
  const app = await bootstrapApplication(EntitiesDemoComponent, {
    providers: [provideZonelessChangeDetection()],
  });
  const component = app.components[0].instance as EntitiesDemoComponent;
  try {
    await app.whenStable();
    const host = document.querySelector<HTMLElement>('app-entities-demo');
    check(host, 'Angular root component missing');
    const layout = host.getBoundingClientRect();
    const usableViewMs = performance.now() - start;
    const measures = performance.getEntriesByName('inventory-store-factory');
    check(measures.length === 1, 'Exactly one timed inventory factory must run');
    const storeFactoryMs = measures[0].duration;
    check(layout.height > 0 && layout.width > 0, 'Actual inventory view has no layout');
    check(rows().length === 1000, `Initial rendered count: ${rows().length}`);
    check(component.store.$.products.count() === 1000, 'Initial store count');
    check(component.availableCount() === 750, 'Initial available count');
    const installed = component.store.$.products.all();
    checkRenderedIds(Array.from({ length: 1000 }, (_, index) => index + 1), 'Initial rows');
    for (let index = 0; index < 1000; index++) {
      const actual = installed[index];
      const source = INITIAL_PRODUCTS[index % INITIAL_PRODUCTS.length];
      check(actual.id === index + 1, `Initial order/identity at ${index}`);
      check(actual.name === source.name && actual.location === source.location &&
        actual.availability === source.availability, `Initial product contents at ${index}`);
      check(actual.sku === (index < 4 ? source.sku : `${source.sku}-${index}`),
        `Initial product SKU at ${index}`);
    }

    if (control === 'skip-destroy') {
      // A planted omission must fail the same lifecycle assertion as a real run.
      check(component.store.destroyed(), 'store lifecycle destroy not observed');
    }

    const filters = Array.from(document.querySelectorAll<HTMLButtonElement>('.filter-control button'));
    check(filters.length === 3, 'Actual inventory filter controls missing');
    const timings: Timing[] = [];
    const stabilize = async () => {
      await app.whenStable();
      host.getBoundingClientRect();
    };
    const timed = async (kind: string, action: () => void, record = true) => {
      const began = performance.now();
      action();
      await stabilize();
      const wallMs = performance.now() - began;
      if (record) timings.push({ kind, wallMs });
    };
    for (let index = 0; index < 36; index++) {
      const available = index % 2 === 0;
      await timed('filter', () => {
        if (!(control === 'skip-filter' && index === 0)) filters[available ? 1 : 2].click();
      }, index >= 6);
      const expected = available ? 750 : 250;
      check(rows().length === expected,
        `filter ${available ? 'available' : 'reserved'} rendered expected ${expected} got ${rows().length}`);
      check(component.visibleProducts().every((product) => product.availability ===
        (available ? 'available' : 'reserved')), 'Filtered state contains wrong availability');
      checkRenderedIds(Array.from({ length: 1000 }, (_, rowIndex) => rowIndex + 1)
        .filter((id) => INITIAL_PRODUCTS[(id - 1) % 4].availability ===
          (available ? 'available' : 'reserved')), 'Filtered rows');
      check(rows().every((element) => element.querySelector('.availability')?.textContent?.trim() ===
        (available ? 'available' : 'reserved')), 'Filtered DOM contains wrong availability');
    }
    filters[0].click();
    await stabilize();
    check(rows().length === 1000, 'All filter did not restore every product');

    const held = component.heldProduct;
    const toggle = button(row(1), '.row-operations button');
    for (let index = 0; index < 24; index++) {
      await timed('availability', () => toggle.click(), index >= 4);
      const expected = index % 2 === 0 ? 'reserved' : 'available';
      check(held().availability === expected, 'Held product availability is stale');
      check(component.availableCount() === (expected === 'available' ? 750 : 749),
        'Available count is stale');
      check(row(1).querySelector('.availability')?.textContent?.trim() === expected,
        'Rendered availability is stale');
      check(component.heldProduct === component.store.$.products.byIdOrFail(1),
        'Ordinary update replaced the held entity handle');
      check(component.lastEvent() === 'Updated Desk lamp after commit', 'Update tap did not run');
    }

    const input = document.querySelector<HTMLInputElement>('#new-product-name');
    check(input, 'Actual inventory input missing');
    const add = button(document, '.add-command .primary-command');
    for (let index = 0; index < 10; index++) {
      const name = `Profile product ${index}`;
      input.value = ` ${name} `;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await stabilize(); // Entry/editing is outside the add-from-entered-value timer.
      check(!add.disabled, 'Entered product did not enable the Add control');
      await timed('add', () => add.click());
      const id = 1001 + index;
      check(component.store.$.products.count() === 1001 && rows().length === 1001,
        'Add did not update store and rendered counts');
      check(component.store.$.products.byIdOrFail(id)().name === name,
        'Add interceptor did not normalize the name');
      check(row(id).querySelector('strong')?.textContent === name, 'Added DOM value is wrong');
      check(component.lastEvent() === `Added ${name} after commit (1001 total)`, 'Add tap is wrong');
      const remove = button(row(id), '.remove-command');
      await timed('remove', () => remove.click());
      check(component.store.$.products.count() === 1000 && rows().length === 1000,
        'Remove did not update store and rendered counts');
      check(component.store.$.products.byId(id) === undefined, 'Removed entity remains available');
      check(!renderedIds().includes(id), 'Removed entity remains rendered');
      check(component.lastEvent() === `Removed ${name} after commit`, 'Remove tap is wrong');
    }

    button(document, '.held-inspection button').click();
    await stabilize();
    check(held().name === 'Desk lamp, revised', 'Held reader did not see rename');
    check(document.querySelector('.held-inspection output')?.textContent === held().name,
      'Held-reader DOM did not refresh');
    const beforeRejectedEvent = component.lastEvent();
    button(document, '.boundary-inspection button').click();
    await stabilize();
    check(component.store.$.products.count() === 1000, 'Rejected add changed membership');
    check(component.blockedOperation() === 'Rejected before commit: blank name', 'Rejection hook missing');
    check(component.lastEvent() === beforeRejectedEvent, 'Rejected add emitted a committed tap');
    const reset = Array.from(document.querySelectorAll<HTMLButtonElement>('.add-command button'))
      .find((candidate) => candidate.textContent?.trim() === 'Reset');
    check(reset, 'Reset button missing');
    reset.click();
    await stabilize();
    check(component.store.$.products.count() === 4 && rows().length === 4,
      'Actual app reset must restore its four source records');
    checkRenderedIds([1, 2, 3, 4], 'Reset rows');
    app.destroy();
    check(component.store.destroyed(), 'store lifecycle destroy not observed');
    check(rows().length === 0, 'Destroyed component still has rendered rows');
    return { storeFactoryMs, usableViewMs, timings, checks: {
      initialRows: 1000, initialAvailable: 750, fullInitialContents: true,
      filterTransitions: 30, availabilityUpdates: 20, addRemovePairs: 10,
      heldReader: true, interceptorAndTap: true, resetToSourceRows: true,
      treeDestroyed: true, renderedRowsRemoved: true,
    } };
  } finally {
    if (!app.destroyed) app.destroy();
  }
}

declare global {
  interface Window {
    angularProfile: { run: typeof run };
  }
}
window.angularProfile = { run };
