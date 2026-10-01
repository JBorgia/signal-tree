# Size matrix — scenarios

Each scenario is one behaviour implemented by every library the way that library's docs
recommend (the cheapest documented form an expert would use). A fixture is an ES module at
`fixtures/<scenario>/<lib>.mjs` that performs the behaviour and sets `globalThis.__result` to the
plain-JSON value given below (for `async`, it sets `globalThis.__done` to a Promise that resolves
after `__result` is set). `scripts/size-matrix.mjs` RUNS every fixture in Node and requires the
result to deep-equal `expected.mjs` before measuring it, so a misused API that tree-shakes to
nothing can never report a small size.

Libraries (`<lib>`): `signals` (Angular signals, hand-written), `ngrx-signals` (@ngrx/signals
22, SignalStore/signalState + `@ngrx/signals/entities`), `ngrx-store` (@ngrx/store 22 +
@ngrx/entity 22: actions, reducer, selectors, entity adapter, `provideStore`), `st14`
(@signaltree/core 14.1.3), `st15` (st15-released = @signal-tree/angular 15.3.1), `cand`
(st15-candidate). `st15` and `cand` share one source: write `fixtures/<scenario>/st15.mjs`
importing from `__ST15__`; the runner substitutes the specifier.

Measured: esbuild bundle, ESM, browser platform, minify, tree-shaking; `@angular/*`, `rxjs`,
`rxjs/*`, `tslib` external (shared by every Angular app, so the comparison is each library's own
code plus the fixture's own glue). gzip level 9 and brotli quality 11.

Where a library has no first-party feature (undo in NgRx), the fixture hand-rolls the minimal
correct version and the table marks it "hand-rolled": that is the code an app would have to write.

## Scenarios and expected results

1. `flat` — state `{ name: 'a', count: 0, active: false, note: null, at: 0 }`; set count to 2,
   active to true, name to 'b'. Result: `{ name: 'b', count: 2, active: true, note: null, at: 0 }`.
2. `nested` — state `{ user: { profile: { address: { city: 'X', zip: '1' }, tags: ['t'] }, age: 1 } }`;
   set city to 'Y'; replace profile.address with `{ city: 'Z', zip: '2' }`; set age to 2.
   Result: `{ city: 'Z', zip: '2', age: 2, tags: ['t'] }`.
3. `arrays` — state `{ items: [{ id: 1, v: 'a' }] }`; append `{ id: 2, v: 'b' }`; replace the item
   with id 1 by `{ id: 1, v: 'c' }`. Result: `{ items: [{ id: 1, v: 'c' }, { id: 2, v: 'b' }] }`.
4. `entities` — keyed collection of `{ id, name }` (id number): set all to ids 1,2,3 named
   'a','b','c'; add `{ id: 4, name: 'd' }`; update 2 to name 'B'; remove 3. Result:
   `{ ids: [1, 2, 4], two: { id: 2, name: 'B' }, all: [{id:1,name:'a'},{id:2,name:'B'},{id:4,name:'d'}] }`.
5. `derived` — state `{ prices: [3, 4], qty: 2 }`; derived `total = sum(prices) * qty` and
   `expensive = total > 10`; set qty to 3. Result: `{ total: 21, expensive: true }`.
6. `async` — state `{ status: 'idle', data: null, error: null }`; an async `load()` sets status
   'loading', awaits `Promise.resolve([1, 2])`, sets data and status 'loaded'; a second async
   `fail()` awaits a rejected promise ('boom') and sets status 'error', error 'boom'. Run load
   then fail. Result: `{ status: 'error', data: [1, 2], error: 'boom' }`.
7. `undo` — state `{ title: 'a' }`; set 'b', set 'c'; undo; result after undo
   `{ afterUndo: 'b', afterRedo: 'c' }` (redo after the undo).
8. `app` — scenarios 1, 2, 4, 5 and 6 in ONE store (a typical feature store). Result: the object
   `{ flat, nested, entities, derived, async }` of the individual results.
9. `three-stores` — three separate stores in one bundle: the `flat`, `nested` and `entities`
   behaviours as three independent stores. Result: `{ flat, nested, entities }`.
