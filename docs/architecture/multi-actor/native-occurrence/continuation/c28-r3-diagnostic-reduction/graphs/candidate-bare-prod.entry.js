
      import { signalTree } from "/private/tmp/st-c28-r3-diagnostic-reduction/candidate/dist/packages/kernel/dist/index.js";
      const t = signalTree({ count: 0, user: { name: 'a' } });
      t.$.count(1); t.$.user.name('b');
      globalThis.__sink = [t.$.count(), t.$.user.name()];
    