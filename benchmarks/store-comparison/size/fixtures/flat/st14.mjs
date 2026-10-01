import { signalTree } from '@signaltree/core';

const tree = signalTree({
  name: 'a',
  count: 0,
  active: false,
  note: null,
  at: 0,
});
tree.$.count.set(2);
tree.$.active.set(true);
tree.$.name.set('b');

globalThis.__result = {
  name: tree.$.name(),
  count: tree.$.count(),
  active: tree.$.active(),
  note: tree.$.note(),
  at: tree.$.at(),
};
