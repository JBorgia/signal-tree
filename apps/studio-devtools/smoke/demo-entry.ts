import { external, signalTree, transactions } from '@signal-tree/kernel';
import { attachStudio } from '@signal-tree/studio-adapter';
import { installStudioBridge } from '@signal-tree/studio-adapter/bridge';

/**
 * The demo application for the first real panel run.
 *
 * ⚠️ SEPARATE FROM `page-entry.ts` ON PURPOSE. That page is frozen S1 transport
 * evidence — `smoke/README.md` row 5 pins its exact committed effects — so the
 * demo gets its own page rather than invalidating a recorded result.
 *
 * The whole point of the flow is the ORDER:
 *
 *   1. two transactions commit at load     -> kernel-retained, capture-free
 *   2. the user starts capture in the panel
 *   3. an external realization is triggered -> observable only because of (2)
 *
 * Step 3 has no authored parent Studio can name, which is what makes the
 * UNKNOWN line real rather than decorative.
 */

type Cart = { promoCode: string | null; discount: number; total: number };

installStudioBridge();

const tree = signalTree({ cart: { promoCode: null, discount: 0, total: 12000 } as Cart }, {
  enhancers: [transactions()],
} as never) as never as {
  $: { cart: Record<string, (v?: unknown) => unknown> };
  transaction(fn: () => void): { confirm(): void };
  destroy(): void;
};

attachStudio(tree as never, { label: 'AppTree' });

// A second, bare tree, so the panel's tree list and the "unsupported
// composition" refusal are both visible in the same run.
const bare = signalTree({ ui: { theme: 'dark' } }) as never;
attachStudio(bare, { label: 'BareTree' });

// T1 — the promotion.
tree.transaction(() => {
  tree.$.cart['promoCode']('SAVE20');
  tree.$.cart['discount'](2400);
  tree.$.cart['total'](9600);
}).confirm();

// T2 — shipping added on top.
tree.transaction(() => {
  tree.$.cart['total'](9800);
}).confirm();

const button = (label: string, onClick: () => void) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = onClick;
  document.body.append(b, document.createTextNode(' '));
};

button('Server corrects total → 10200', () => {
  // ⚠️ NO transactionId. An external realization carries no authored parent
  // (SUPERSESSION-0 returned WEAK), so Studio must say the value was superseded
  // WITHOUT claiming which operation caused it.
  external(() => tree.$.cart['total'](10200));
});

button('Server corrects total → 9950', () => {
  external(() => tree.$.cart['total'](9950));
});

button('Authored: apply extra discount', () => {
  tree.transaction(() => {
    tree.$.cart['discount'](3000);
    tree.$.cart['total'](9000);
  }).confirm();
});

button('destroy AppTree', () => tree.destroy());
