import { describe,it,expect } from 'vitest';
import { appendFileSync } from 'node:fs';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { restoration } from '../enhancers/restoration/restoration';
function countIteratedElements(run: () => void): number {
  let visited = 0;
  let recording = false;
  let attributing = false;
  const origins: Record<string, number> = Object.create(null);
  const countVisit = (n: number): void => {
    if (attributing) return;
    visited += n;
    if (!recording || n === 0) return;
    attributing = true;
    try {
      const lines = new Error().stack?.split('\n') ?? [];
      const origin = lines.find(line => line.includes('/src/') && !line.includes('entity-granular-reactivity.spec.ts')) ?? 'unattributed';
      origins[origin] = (origins[origin] ?? 0) + n;
    } finally { attributing = false; }
  };
  const restore: Array<() => void> = [];
  const patch = (
    target: object,
    key: PropertyKey,
    wrap: (original: (...args: unknown[]) => unknown) => unknown
  ): void => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) throw new Error(`nothing to count at ${String(key)}`);
    restore.push(() => Object.defineProperty(target, key, descriptor));
    Object.defineProperty(target, key, {
      ...descriptor,
      value: wrap(descriptor.value),
    });
  };
  const counting = (iterator: Iterator<unknown>): IterableIterator<unknown> => ({
    next() {
      const step = iterator.next();
      if (!step.done) countVisit(1);
      return step;
    },
    [Symbol.iterator]() {
      return this;
    },
  });
  for (const proto of [Map.prototype, Set.prototype, Array.prototype])
    for (const key of ['keys', 'values', 'entries', Symbol.iterator])
      patch(proto, key, (original) =>
        function (this: unknown, ...args: unknown[]) {
          return counting(original.apply(this, args) as Iterator<unknown>);
        }
      );
  for (const proto of [Map.prototype, Set.prototype])
    patch(proto, 'forEach', (original) =>
      function (this: { size: number }, ...args: unknown[]) {
        countVisit(this.size);
        return original.apply(this, args);
      }
    );
  // Whole-array walks, counted at their full length: a search that stops
  // early still scales with the array it searches.
  for (const key of [
    'map',
    'filter',
    'forEach',
    'slice',
    'concat',
    'reduce',
    'indexOf',
    'lastIndexOf',
    'includes',
    'find',
    'findIndex',
    'some',
    'every',
    'splice',
    'sort',
    'join',
  ])
    patch(Array.prototype, key, (original) =>
      function (this: unknown[], ...args: unknown[]) {
        countVisit(this.length);
        return original.apply(this, args);
      }
    );
  for (const key of ['keys', 'values', 'entries'])
    patch(Object, key, (original) =>
      function (this: unknown, ...args: unknown[]) {
        const result = original.apply(this, args) as unknown[];
        countVisit(result.length);
        return result;
      }
    );
  patch(Array.prototype, 'push', (original) =>
    function (this: unknown[], ...args: unknown[]) {
      countVisit(args.length);
      return original.apply(this, args);
    }
  );
  patch(Array, 'from', (original) =>
    function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args) as unknown[];
      countVisit(result.length);
      return result;
    }
  );
  let counted: number;
  try {
    visited = 0;
    recording = true;
    run();
    counted = visited;
    recording = false;
  } finally {
    for (let i = restore.length - 1; i >= 0; i--) restore[i]();
  }
  appendFileSync(process.env['ST_RESTORATION_ATTRIBUTION']!, JSON.stringify({ counted, origins }) + '\n');
  return counted;
}

describe('bounded restoration site attribution',()=>{
 for(const n of [32,64]) it(String(n), async()=>{
  const tree=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[restoration()]});
  const a=Array.from({length:n},(_,i)=>({id:i,n:i}));
  const b=Array.from({length:n},(_,i)=>({id:i+n,n:i}));
  const counts:Record<string,number>={};
  try{
   counts.initial=countIteratedElements(()=>tree.$.rows.setAll(a));
   for(let i=0;i<12;i++)await Promise.resolve();
   counts.replace=countIteratedElements(()=>undoable(()=>tree.$.rows.setAll(b)));
   for(let i=0;i<12;i++)await Promise.resolve();
   counts.undo=countIteratedElements(()=>tree.undo());
   expect(tree.$.rows.ids()).toEqual(a.map(r=>r.id));
   counts.redo=countIteratedElements(()=>tree.redo());
   expect(tree.$.rows.ids()).toEqual(b.map(r=>r.id));
   appendFileSync(process.env['ST_RESTORATION_WORK']!,JSON.stringify({n,counts})+'\n');
  }finally{tree.destroy();}
 });
});
