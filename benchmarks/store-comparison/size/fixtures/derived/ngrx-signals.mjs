import { Injector, computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

const Store = signalStore(
  withState({ prices: [3, 4], qty: 2 }),
  withComputed(({ prices, qty }) => {
    const total = computed(() => prices().reduce((a, b) => a + b, 0) * qty());
    return { total, expensive: computed(() => total() > 10) };
  }),
  withMethods((store) => ({ setQty: (qty) => patchState(store, { qty }) }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.setQty(3);
globalThis.__result = { total: store.total(), expensive: store.expensive() };
