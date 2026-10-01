import { signalTree } from '__ST15__';

const tree = signalTree(
  { prices: [3, 4], qty: 2 },
  {
    derived: ($) => {
      const total = () => $.prices().reduce((a, b) => a + b, 0) * $.qty();
      return { total, expensive: () => total() > 10 };
    },
  }
);
tree.$.qty.set(3);

globalThis.__result = { total: tree.$.total(), expensive: tree.$.expensive() };
