import { signalTree } from '@signaltree/core';
import { computed } from '@angular/core';

const tree = signalTree({ prices: [3, 4], qty: 2 })
  .derived(($) => ({
    total: computed(() => $.prices().reduce((a, b) => a + b, 0) * $.qty()),
  }))
  .derived(($) => ({
    expensive: computed(() => $.total() > 10),
  }));
tree.$.qty.set(3);

globalThis.__result = { total: tree.$.total(), expensive: tree.$.expensive() };
