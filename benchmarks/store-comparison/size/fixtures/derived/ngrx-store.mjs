import { Injector, createEnvironmentInjector } from '@angular/core';
import {
  Store,
  createAction,
  createFeature,
  createReducer,
  createSelector,
  on,
  props,
  provideStore,
} from '@ngrx/store';

const setQty = createAction('[Derived] Set Qty', props());

const derivedFeature = createFeature({
  name: 'derived',
  reducer: createReducer(
    { prices: [3, 4], qty: 2 },
    on(setQty, (s, { qty }) => ({ ...s, qty }))
  ),
  extraSelectors: ({ selectPrices, selectQty }) => {
    const selectTotal = createSelector(
      selectPrices,
      selectQty,
      (prices, qty) => prices.reduce((a, b) => a + b, 0) * qty
    );
    return {
      selectTotal,
      selectExpensive: createSelector(selectTotal, (total) => total > 10),
    };
  },
});

const store = createEnvironmentInjector(
  [provideStore({ [derivedFeature.name]: derivedFeature.reducer })],
  Injector.NULL
).get(Store);
store.dispatch(setQty({ qty: 3 }));
globalThis.__result = {
  total: store.selectSignal(derivedFeature.selectTotal)(),
  expensive: store.selectSignal(derivedFeature.selectExpensive)(),
};
