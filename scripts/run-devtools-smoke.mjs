import path from 'path';

const corePath = path.resolve('./dist/packages/core/dist/index.js');
const { signalTree, devTools, entityMap } = await import(`file://${corePath}`);

console.log('signalTree available:', typeof signalTree);
const base = signalTree({ users: entityMap() });
// 15.0: there is no `.with()`. Asserted, not just omitted — a smoke test that
// silently stopped checking the construction path is worse than one that fails.
console.log('base.with is gone:', typeof base.with === 'undefined');
const withDev = signalTree(
  { users: entityMap() },
  { enhancers: [devTools({ treeName: 'smoke' })] }
);
console.log('withDev.connectDevTools:', typeof withDev.connectDevTools);

// Extra check: call the tree to ensure callable behavior
console.log('base():', base());
console.log('withDev():', withDev());
