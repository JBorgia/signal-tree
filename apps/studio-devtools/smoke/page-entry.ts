import { signalTree, transactions } from '@signal-tree/kernel';
import { attachStudio } from '@signal-tree/studio-adapter';
import { installStudioBridge } from '@signal-tree/studio-adapter/bridge';

type Cart = { promoCode: string | null; discount: number; total: number };

installStudioBridge();

const tree = signalTree({ promoCode: null, discount: 0, total: 12000 } as Cart, {
  enhancers: [transactions()],
} as never) as never as {
  $: Record<string, (v?: unknown) => unknown>;
  transaction(fn: () => void): { confirm(): void };
  destroy(): void;
  registerCleanup(fn: () => void): void;
};

const attachment = attachStudio(tree as never, { label: 'AppTree' });

tree
  .transaction(() => {
    tree.$['promoCode']('SAVE20');
    tree.$['discount'](2400);
    tree.$['total'](9600);
  })
  .confirm();

// Expose ONLY test controls — never the tree or the registry.
(globalThis as Record<string, unknown>)['__smoke'] = {
  attachmentId: attachment.id,
  destroy: () => tree.destroy(),
};
