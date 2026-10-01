import { signalTree, timeTravel } from '@signaltree/core';

const tree = signalTree({ title: 'a' }).with(timeTravel());
const nextTurn = () => Promise.resolve(); // history is recorded on the microtask flush: each user action is its own turn

globalThis.__done = (async () => {
  tree.$.title.set('b');
  await nextTurn();
  tree.$.title.set('c');
  await nextTurn();
  tree.undo();
  const afterUndo = tree.$.title();
  tree.redo();
  globalThis.__result = { afterUndo, afterRedo: tree.$.title() };
})();
