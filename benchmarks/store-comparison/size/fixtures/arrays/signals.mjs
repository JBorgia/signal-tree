import { signal } from '@angular/core';

const items = signal([{ id: 1, v: 'a' }]);
items.update((list) => [...list, { id: 2, v: 'b' }]);
items.update((list) => list.map((i) => (i.id === 1 ? { id: 1, v: 'c' } : i)));

globalThis.__result = { items: items().map((i) => ({ ...i })) };
