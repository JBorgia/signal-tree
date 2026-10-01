import { signal, computed } from '@angular/core';

const all = signal([]);
const ids = computed(() => all().map((e) => e.id));
const byId = (id) => computed(() => all().find((e) => e.id === id));

all.set([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
all.update((list) => [...list, { id: 4, name: 'd' }]);
all.update((list) => list.map((e) => (e.id === 2 ? { ...e, name: 'B' } : e)));
all.update((list) => list.filter((e) => e.id !== 3));

globalThis.__result = {
  ids: [...ids()],
  two: { ...byId(2)() },
  all: all().map((e) => ({ ...e })),
};
