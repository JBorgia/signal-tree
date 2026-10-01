import { signalTree, restoration, undoable } from '__ST15__';

const tree = signalTree({ title: 'a' }, { enhancers: [restoration()] });
const nextTurn = () => Promise.resolve(); // undo is called from a later user action than the undoable write

globalThis.__done = (async () => {
  undoable(() => tree.$.title.set('b'));
  await nextTurn();
  undoable(() => tree.$.title.set('c'));
  await nextTurn();
  tree.undo();
  const afterUndo = tree.$.title();
  tree.redo();
  globalThis.__result = { afterUndo, afterRedo: tree.$.title() };
})();
