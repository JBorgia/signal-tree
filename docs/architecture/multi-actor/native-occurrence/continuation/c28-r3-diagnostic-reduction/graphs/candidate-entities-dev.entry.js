
      import { signalTree, entityMap } from "/private/tmp/st-c28-r3-diagnostic-reduction/candidate/dist/packages/kernel/dist/index.js";
      const t = signalTree({ count: 0, users: entityMap() });
      t.$.users.addOne({ id: 1, name: 'a' }); t.$.users.updateOne(1, { name: 'b' });
      globalThis.__sink = t.$.users.all();
    