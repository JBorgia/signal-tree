// Could read-capture inside transact() distinguish dependent from independent?
// Three arms whose CALLBACKS are compared for observable reads.
import { build } from 'esbuild';
const root = process.cwd();
const b = await build({stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,resolveDir:root,sourcefile:'h.ts',loader:'ts'},
 absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const K = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const flush = async n => { n.flushSync(); for (let i=0;i<8;i++) await Promise.resolve(); };

// Instrument the leaf to record every read that happens inside the callback.
const arm = async (label, build2) => {
  const n = K.getPathNotifier();
  const tree = K.signalTree({x:0,y:0},{enhancers:[K.transactions()]});
  const reads = [];
  const raw = tree.$.x;
  // Stand-in for a perfect read-capture mechanism: observe every zero-arg call.
  const spy = (...a) => { if (a.length===0) reads.push('x'); return raw(...a); };
  Object.setPrototypeOf(spy, Object.getPrototypeOf(raw));
  Object.defineProperty(tree.$, 'x', { value: spy, configurable: true, writable: true });
  const p1 = tree.transact(() => tree.$.x(1));
  await flush(n);
  // Build the callback FIRST, so a hoisted read is attributed where it really
  // happens -- outside the callback -- and only then start counting.
  const callback = build2(tree);
  const before = reads.length;
  const p2 = tree.transact(callback);
  await flush(n);
  const insideCallback = reads.length - before;
  console.log(`${label.padEnd(34)} reads observed INSIDE transact(): ${insideCallback}`);
  tree.destroy();
  return insideCallback;
};

const a = await arm('independent  y(1)',        t => () => t.$.y(1));
const c = await arm('dependent    y(x())',      t => () => t.$.y(t.$.x()));
// The read is hoisted OUT of the callback. The dependency is identical.
const d = await arm('hoisted      v=x(); y(v)', t => { const v = t.$.x(); return () => t.$.y(v); });
console.log('\nindependent vs dependent distinguishable:', a !== c);
console.log('independent vs HOISTED   distinguishable:', a !== d, ' <- both 0 reads, same dependency as arm 2');
