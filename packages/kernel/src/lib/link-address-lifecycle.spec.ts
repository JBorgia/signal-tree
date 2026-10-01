import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';

describe('Link address lifecycle', () => {
  it.each([32, 33, 64])(
    'includes leaves at depth %i without another observer',
    async (depth) => {
      let initial: unknown = 0;
      for (let index = 0; index < depth; index++) initial = { n: initial };
      const tree = signalTree(initial as Record<string, unknown>);
      const sent: unknown[] = [];
      const connection = link(tree.$, {
        set: (value) => {
          sent.push(value);
        },
      });
      try {
        let location: unknown = tree.$;
        for (let index = 0; index < depth; index++)
          location = (location as Record<string, unknown>)['n'];
        (location as (value: number) => void)(1);
        await connection.settled();
        let expected: unknown = 1;
        for (let index = 0; index < depth; index++) expected = { n: expected };
        expect(sent).toEqual([expected]);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'publishes the new value when a nested optional branch returns (transactions=%s)',
    async (withTransactions) => {
      const profile: { name: string; nested?: { age: number } } = {
        name: 'Ada',
        nested: { age: 42 },
      };
      const tree = signalTree(
        { profile },
        { enhancers: withTransactions ? [transactions()] : [] }
      );
      tree.$.profile({ name: 'Ada' });
      await Promise.resolve();
      const sent: unknown[] = [];
      const connection = link(tree.$, {
        set(value) {
          sent.push(value);
        },
      });
      try {
        tree.$.profile({ name: 'Ada', nested: { age: 43 } });
        await connection.settled();
        expect(sent.at(-1)).toEqual({
          profile: { name: 'Ada', nested: { age: 43 } },
        });
        tree.$.profile.nested!({ age: 44 });
        await connection.settled();
        expect(sent.at(-1)).toEqual({
          profile: { name: 'Ada', nested: { age: 44 } },
        });
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );

  it.each([false, true])(
    'observes an optional member restored after Link creation (transactions=%s)',
    async (withTransactions) => {
      const profile: { name: string; age?: number } = { name: 'Ada', age: 42 };
      const tree = signalTree(
        { profile },
        { enhancers: withTransactions ? [transactions()] : [] }
      );
      tree.$.profile({ name: 'Ada' });
      await Promise.resolve();
      const sent: unknown[] = [];
      const connection = link(tree.$.profile, {
        set: (value) => {
          sent.push(value);
        },
      });
      try {
        tree.$.profile({ name: 'Ada', age: 43 });
        await connection.settled();
        expect(sent.at(-1)).toEqual({ name: 'Ada', age: 43 });
        tree.$.profile.age!(44);
        await connection.settled();
        expect(sent.at(-1)).toEqual({ name: 'Ada', age: 44 });
        expect(sent).toHaveLength(2);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );
});
