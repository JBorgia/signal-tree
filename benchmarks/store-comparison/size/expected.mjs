const flat = { name: 'b', count: 2, active: true, note: null, at: 0 };
const nested = { city: 'Z', zip: '2', age: 2, tags: ['t'] };
const entities = {
  ids: [1, 2, 4],
  two: { id: 2, name: 'B' },
  all: [
    { id: 1, name: 'a' },
    { id: 2, name: 'B' },
    { id: 4, name: 'd' },
  ],
};
const derived = { total: 21, expensive: true };
const async = { status: 'error', data: [1, 2], error: 'boom' };
export const EXPECTED = {
  flat,
  nested,
  arrays: {
    items: [
      { id: 1, v: 'c' },
      { id: 2, v: 'b' },
    ],
  },
  entities,
  derived,
  async,
  undo: { afterUndo: 'b', afterRedo: 'c' },
  app: { flat, nested, entities, derived, async },
  'three-stores': { flat, nested, entities },
};
export const SCENARIOS = Object.keys(EXPECTED);
export const LIBS = [
  'signals',
  'ngrx-signals',
  'ngrx-store',
  'st14',
  'st15',
  'cand',
];
