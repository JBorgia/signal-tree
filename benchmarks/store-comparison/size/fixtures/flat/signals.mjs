import { signal } from '@angular/core';

const state = {
  name: signal('a'),
  count: signal(0),
  active: signal(false),
  note: signal(null),
  at: signal(0),
};
state.count.set(2);
state.active.set(true);
state.name.set('b');

globalThis.__result = {
  name: state.name(),
  count: state.count(),
  active: state.active(),
  note: state.note(),
  at: state.at(),
};
