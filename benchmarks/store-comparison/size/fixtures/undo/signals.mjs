import { signal } from '@angular/core';

const title = signal('a');
const past = [];
const future = [];
const set = (v) => {
  past.push(title());
  future.length = 0;
  title.set(v);
};
const undo = () => {
  if (!past.length) return;
  future.push(title());
  title.set(past.pop());
};
const redo = () => {
  if (!future.length) return;
  past.push(title());
  title.set(future.pop());
};

set('b');
set('c');
undo();
const afterUndo = title();
redo();
globalThis.__result = { afterUndo, afterRedo: title() };
