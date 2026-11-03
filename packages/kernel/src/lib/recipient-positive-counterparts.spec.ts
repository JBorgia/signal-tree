import { expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import * as life from './experimental-publication/lifecycle';

type Receipt = { read(): Readonly<{state: string; basis?: string}> };
type Experimental = ReturnType<typeof link> & {
  declare(input: {kind: 'independent'} | {kind: 'dependent'; owners: readonly object[]}, work: () => unknown): Receipt;
};
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 120; i++) await Promise.resolve(); };
const asLink = (source: object, sent: unknown[]) => link(source as never, {set: (value: unknown) => { sent.push(value); }} as never) as Experimental;

for (const kind of ['scalar', 'empty', 'collection', 'mixed'] as const)
for (const outcome of ['confirm', 'rollback'] as const)
it(`positive omission ${kind}: current absence survives then ${outcome} cannot duplicate`, async () => {
  const tree = signalTree({branch: {rows: entityMap<{id: string; x: number}, string>(), x: 0}, other: 0}, {enhancers: [transactions()]});
  const foreign = signalTree({z: 0}, {enhancers: [transactions()]});
  if (kind !== 'empty') tree.$.branch.rows.addOne({id: 'a', x: 0});
  await flush();
  const registrations = vi.spyOn(life, 'registerConnection');
  const originalStarted = life.started;
  const admissions: Array<{ channel: object; revision: object; declared: boolean }> = [];
  const starts = vi.spyOn(life, 'started').mockImplementation((...args) => {
    admissions.push({channel: args[0], revision: args[1], declared: life.hasDeclaration(args[0], args[1])});
    return originalStarted(...args);
  });
  const sent: unknown[] = [], nestedSent: unknown[] = [];
  const c = asLink(tree.$, sent);
  const child = asLink(kind === 'scalar' ? tree.$.branch.x : kind === 'mixed' ? tree.$.branch : tree.$.branch.rows, nestedSent);
  const childChannel = registrations.mock.calls.at(-1)![0];
  const q = foreign.transact(() => foreign.$.z(7));
  const inspection = q.inspect();
  const expected = [kind === 'empty' || kind === 'collection' ? [] : undefined];
  const childStarts = () => starts.mock.calls.filter(call => call[0] === childChannel);
  try {
    c.declare({kind: 'dependent', owners: [q]}, () => kind === 'scalar' ? tree.$.branch.x(7) : kind === 'empty' ? tree.$.branch.rows.addOne({id: 'a', x: 7}) : tree.$.branch.rows.updateOne('a', {x: 7}));
    await flush();
    expect(sent).toEqual([]);
    expect(nestedSent).toEqual([]);
    expect(childStarts()).toHaveLength(0);
    expect(q.inspect()).toEqual(inspection);
    expect(foreign.$.z()).toBe(7);
    c.declare({kind: 'independent'}, () => tree.$({other: 1} as never));
    await flush();
    expect(tree.$()).toEqual({other: 1});
    expect(sent).toEqual([{other: 1}]);
    expect(nestedSent).toEqual(expected);
    expect(childStarts()).toHaveLength(1);
    expect(childStarts()[0][2]).toBe('surviving');
    expect(admissions.find(entry => entry.channel === childChannel && entry.revision === childStarts()[0][1])?.declared).toBe(false);
    expect(q.inspect()).toEqual(inspection);
    expect(foreign.$.z()).toBe(7);
    await child.settled();
    expect(nestedSent).toEqual(expected); expect(sent).toEqual([{other: 1}]);
    expect(childStarts()).toHaveLength(1); expect(q.inspect()).toEqual(inspection);
    expect(tree.$()).toEqual({other: 1}); expect(foreign.$.z()).toBe(7);
    q[outcome]();
    await flush();
    expect(tree.$()).toEqual({other: 1});
    expect(sent).toEqual([{other: 1}]);
    expect(nestedSent).toEqual(expected);
    expect(childStarts()).toHaveLength(1);
    expect(foreign.$.z()).toBe(outcome === 'confirm' ? 7 : 0);
    await child.settled();
    expect(nestedSent).toEqual(expected); expect(sent).toEqual([{other: 1}]);
    expect(childStarts()).toHaveLength(1); expect(tree.$()).toEqual({other: 1});
    expect(foreign.$.z()).toBe(outcome === 'confirm' ? 7 : 0);
  } finally {
    c.dispose(); child.dispose(); tree.destroy(); foreign.destroy();
    starts.mockRestore(); registrations.mockRestore();
  }
});

for (const operation of ['equal-repeat', 'membership-omission'] as const)
for (const outcome of ['confirm', 'rollback'] as const)
it(`positive recipient ${operation}: surviving delivery then ${outcome} cannot duplicate`, async () => {
  const foreign = signalTree({z: 0}, {enhancers: [transactions()]});
  const tree = signalTree<{pair: {x: number; y?: number}}>({pair: {x: 0, y: 0}});
  const left: unknown[] = [], right: unknown[] = [];
  const registrations = vi.spyOn(life, 'registerConnection');
  const originalStarted = life.started;
  const admissions: Array<{ channel: object; revision: object; declared: boolean }> = [];
  const starts = vi.spyOn(life, 'started').mockImplementation((...args) => {
    admissions.push({channel: args[0], revision: args[1], declared: life.hasDeclaration(args[0], args[1])});
    return originalStarted(...args);
  });
  const a = asLink(tree.$.pair, left), b = asLink(tree.$.pair, right);
  const bChannel = registrations.mock.calls.at(-1)![0];
  const p = foreign.transact(() => foreign.$.z(7));
  const inspection = p.inspect();
  const expected = operation === 'equal-repeat' ? {x: 1, y: 0} : {x: 1};
  const bStarts = () => starts.mock.calls.filter(call => call[0] === bChannel);
  try {
    await flush();
    expect(left).toEqual([]); expect(right).toEqual([]);
    a.declare({kind: 'independent'}, () => tree.$.pair(expected));
    await flush();
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1);
    expect(bStarts()[0][2]).toBe('surviving');
    expect(admissions.find(entry => entry.channel === bChannel && entry.revision === bStarts()[0][1])?.declared).toBe(false);
    let second: Receipt | undefined;
    if (operation === 'equal-repeat') {
      second = a.declare({kind: 'independent'}, () => tree.$.pair({x: 1, y: 0}));
      await flush();
      expect(second.read()).toMatchObject({state: 'no-write'});
    }
    expect(tree.$.pair()).toEqual(expected);
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1);
    expect(p.inspect()).toEqual(inspection);
    expect(foreign.$.z()).toBe(7);
    await b.settled();
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1); expect(p.inspect()).toEqual(inspection);
    expect(tree.$.pair()).toEqual(expected); expect(foreign.$.z()).toBe(7);
    if (second) expect(second.read()).toMatchObject({state: 'no-write'});
    p[outcome]();
    await flush();
    expect(tree.$.pair()).toEqual(expected);
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1);
    expect(foreign.$.z()).toBe(outcome === 'confirm' ? 7 : 0);
    if (second) expect(second.read()).toMatchObject({state: 'no-write'});
    await b.settled();
    expect(left).toEqual([expected]); expect(right).toEqual([expected]);
    expect(bStarts()).toHaveLength(1); expect(tree.$.pair()).toEqual(expected);
    expect(foreign.$.z()).toBe(outcome === 'confirm' ? 7 : 0);
    if (second) expect(second.read()).toMatchObject({state: 'no-write'});
  } finally {
    a.dispose(); b.dispose(); tree.destroy(); foreign.destroy();
    starts.mockRestore(); registrations.mockRestore();
  }
});
