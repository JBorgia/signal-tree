import {
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { describe, expect, it } from 'vitest';
import { confirmedTurnReader } from '../internals';

import {
  observeWrites,
  type ObservedWriteFrame,
} from './internals/write-observation';
import { withWriteContext } from './write-context';
import { getOwnedPositionIds } from './internals/owned-metadata';
import {
  plainBranchMembershipChange,
  type PlainBranchMembershipChange,
} from './internals/plain-branch-membership';
import { getPathNotifier } from './path-notifier';

interface Profile {
  name: string;
  age?: number;
}

const initialProfile = (): Profile => ({ name: 'Ada', age: 42 });
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// These are ordinary, type-legal whole-value calls: the optional member was
// seeded at construction. No arbitrary Record descendant mounting is involved.
describe('whole-value plain-object omission correctness', () => {
  it.each(['bare', 'causal'] as const)(
    'supplied undefined replaces retained storage after omission (%s)',
    (mode) => {
      const tree = signalTree(
        { profile: initialProfile() },
        { capabilities: mode === 'causal' ? ['causal-runtime'] : [] }
      );
      const age = tree.$.profile.age;
      try {
        tree.$.profile({ name: 'Ada' });
        expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
        expect(Object.keys(tree.$.profile)).toEqual(['name']);
        expect(age?.()).toBeUndefined();

        tree.$.profile({ name: 'Ada', age: undefined });
        expect(tree.$.profile()).toStrictEqual({ name: 'Ada', age: undefined });
        expect(Object.keys(tree.$.profile)).toEqual(['name', 'age']);
        expect(tree.$.profile.age).toBe(age);

        tree.$.profile(initialProfile());
        expect(tree.$.profile()).toStrictEqual(initialProfile());
        expect(tree.$.profile.age).toBe(age);
      } finally {
        tree.destroy();
      }
    }
  );

  it('observes an omission-only replacement without fabricating an undefined leaf write', async () => {
    const tree = signalTree(
      { profile: initialProfile() },
      { capabilities: ['causal-runtime'] }
    );
    const writes: ObservedWriteFrame[] = [];
    const off = observeWrites((frame) => writes.push(frame));
    try {
      tree.$.profile({ name: 'Ada' });
      await nextTask();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
      expect(writes.filter(({ path }) => path === 'profile.age')).toEqual([]);
      expect(writes.length).toBeGreaterThan(0);
    } finally {
      off();
      tree.destroy();
    }
  });

  it.each(['omission only', 'sibling also changes'] as const)(
    'a branch Link receives the actual complete replacement: %s',
    async (change) => {
      const tree = signalTree({ profile: initialProfile() });
      const received: Profile[] = [];
      const relation = link(tree.$.profile, {
        set: (value) => void received.push(value),
      });
      try {
        await nextTask();
        received.length = 0;
        const next = { name: change === 'omission only' ? 'Ada' : 'Grace' };
        tree.$.profile(next);
        await nextTask();
        await relation.settled();
        expect(tree.$.profile()).toStrictEqual(next);
        expect(received).toEqual([next]);
        expect(received.at(-1)).toStrictEqual(tree.$.profile());
      } finally {
        relation.dispose();
        tree.destroy();
      }
    }
  );

  it('a bare membership event names its retained owner and distinguishes present undefined', async () => {
    const tree = signalTree({
      profile: { name: 'Ada', age: undefined } as Profile,
    });
    const branch = tree.$.profile;
    const changes: PlainBranchMembershipChange[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _prev, _path, _owner, _origin, _subjects, _positions, meta) => {
        const change = plainBranchMembershipChange(meta);
        if (change?.branch === branch) changes.push(change);
      }
    );
    try {
      expect(getOwnedPositionIds(branch)).toBeUndefined();
      branch({ name: 'Ada' });
      await nextTask();
      expect(changes).toHaveLength(1);
      expect(changes[0].kind).toBe('plain-branch-membership');
      expect(changes[0].branch).toBe(branch);
      expect(changes[0].members).toEqual([
        {
          key: 'age',
          positionIds: undefined,
          before: { present: true, value: undefined },
          after: { present: false },
        },
      ]);
      expect(getOwnedPositionIds(branch)).toBeUndefined();
    } finally {
      off();
      tree.destroy();
    }
  });

  it.each(['bare', 'causal'] as const)(
    'literal dotted and nested branch owners remain distinct (%s)',
    async (mode) => {
      const tree = signalTree(
        { 'a.b': initialProfile(), a: { b: initialProfile() } },
        {
          capabilities: mode === 'causal' ? ['causal-runtime'] : [],
        }
      );
      const rootValues: unknown[] = [];
      const literalValues: Profile[] = [];
      const nestedValues: Profile[] = [];
      const root = link(tree.$, {
        set: (value) => void rootValues.push(value),
      });
      const literal = link(tree.$['a.b'], {
        set: (value) => void literalValues.push(value),
      });
      const nested = link(tree.$.a.b, {
        set: (value) => void nestedValues.push(value),
      });
      try {
        tree.$['a.b']({ name: 'Ada' });
        await nextTask();
        await root.settled();
        await literal.settled();
        expect(rootValues.at(-1)).toStrictEqual({
          'a.b': { name: 'Ada' },
          a: { b: initialProfile() },
        });
        expect(literalValues).toStrictEqual([{ name: 'Ada' }]);
        expect(nestedValues).toEqual([]);
        tree.$.a.b({ name: 'Ada' });
        await nextTask();
        await root.settled();
        await nested.settled();
        expect(rootValues.at(-1)).toStrictEqual({
          'a.b': { name: 'Ada' },
          a: { b: { name: 'Ada' } },
        });
        expect(literalValues).toHaveLength(1);
        expect(nestedValues).toStrictEqual([{ name: 'Ada' }]);
      } finally {
        root.dispose();
        literal.dispose();
        nested.dispose();
        tree.destroy();
      }
    }
  );

  it('an empty branch key and literal dotted member use their actual segments', async () => {
    const tree = signalTree({
      '': { name: 'Ada', 'a.b': 42 } as { name: string; 'a.b'?: number },
    });
    const received: unknown[] = [];
    const relation = link(tree.$, {
      set: (value) => void received.push(value),
    });
    try {
      tree.$['']({ name: 'Ada' });
      await nextTask();
      await relation.settled();
      expect(received.at(-1)).toStrictEqual({ '': { name: 'Ada' } });
      tree.$['']({ name: 'Ada', 'a.b': undefined });
      await nextTask();
      await relation.settled();
      expect(received.at(-1)).toStrictEqual({
        '': { name: 'Ada', 'a.b': undefined },
      });
    } finally {
      relation.dispose();
      tree.destroy();
    }
  });

  it('Link distinguishes an omitted undefined member from an explicitly present undefined', async () => {
    const tree = signalTree({
      profile: { name: 'Ada', age: undefined } as Profile,
    });
    const received: Profile[] = [];
    const relation = link(tree.$.profile, {
      set: (value) => void received.push(value),
    });
    try {
      tree.$.profile({ name: 'Ada' });
      await nextTask();
      await relation.settled();
      expect(received.at(-1)).toStrictEqual({ name: 'Ada' });
      tree.$.profile({ name: 'Ada', age: undefined });
      await nextTask();
      await relation.settled();
      expect(received.at(-1)).toStrictEqual({ name: 'Ada', age: undefined });
    } finally {
      relation.dispose();
      tree.destroy();
    }
  });

  it.each(['absent', 'present'] as const)(
    'same-turn removal and reintroduction ends %s at Link',
    async (end) => {
      const tree = signalTree({ profile: initialProfile() });
      const received: Profile[] = [];
      const relation = link(tree.$.profile, {
        set: (value) => void received.push(value),
      });
      try {
        tree.$.profile({ name: 'Ada' });
        tree.$.profile({ name: 'Ada', age: 8 });
        tree.$.profile({ name: 'Ada' });
        if (end === 'present') tree.$.profile({ name: 'Ada', age: undefined });
        await nextTask();
        await relation.settled();
        expect(received.at(-1)).toStrictEqual(
          end === 'present' ? { name: 'Ada', age: undefined } : { name: 'Ada' }
        );
      } finally {
        relation.dispose();
        tree.destroy();
      }
    }
  );

  it('nested omission reaches the root Link without touching another tree', async () => {
    const tree = signalTree({ box: { profile: initialProfile(), keep: 1 } });
    const other = signalTree({ box: { profile: initialProfile(), keep: 1 } });
    const received: unknown[] = [];
    const foreign: unknown[] = [];
    const relation = link(tree.$, {
      set: (value) => void received.push(value),
    });
    const otherRelation = link(other.$, {
      set: (value) => void foreign.push(value),
    });
    try {
      tree.$.box.profile({ name: 'Ada' });
      await nextTask();
      await relation.settled();
      expect(received.at(-1)).toStrictEqual({
        box: { profile: { name: 'Ada' }, keep: 1 },
      });
      expect(foreign).toEqual([]);
    } finally {
      relation.dispose();
      otherRelation.dispose();
      tree.destroy();
      other.destroy();
    }
  });

  it('an omission does not carry an unchanged inspection-only sibling to Link', async () => {
    const tree = signalTree({ profile: initialProfile() });
    const received: Profile[] = [];
    const relation = link(tree.$.profile, {
      set: (value) => void received.push(value),
    });
    try {
      withWriteContext(
        { origin: 'devtools', participation: 'inspection' },
        () => {
          tree.$.profile.name('Inspected');
        }
      );
      tree.$.profile({ name: 'Inspected' });
      await nextTask();
      await relation.settled();
      expect(tree.$.profile()).toStrictEqual({ name: 'Inspected' });
      expect(received.at(-1)).toStrictEqual({ name: 'Ada' });
    } finally {
      relation.dispose();
      tree.destroy();
    }
  });

  it('inspection-only omission does not hitchhike on a later eligible leaf write', async () => {
    const tree = signalTree({ profile: initialProfile() });
    const received: Profile[] = [];
    const relation = link(tree.$.profile, {
      set: (value) => void received.push(value),
    });
    try {
      withWriteContext(
        { origin: 'devtools', participation: 'inspection' },
        () => {
          tree.$.profile({ name: 'Ada' });
        }
      );
      tree.$.profile.name('Grace');
      await nextTask();
      await relation.settled();
      expect(tree.$.profile()).toStrictEqual({ name: 'Grace' });
      expect(received.at(-1)).toStrictEqual({ name: 'Grace', age: 42 });
    } finally {
      relation.dispose();
      tree.destroy();
    }
  });

  it('a transaction holds omission egress until confirmation', async () => {
    const tree = signalTree(
      { profile: initialProfile() },
      { enhancers: [transactions()] }
    );
    const received: Profile[] = [];
    const relation = link(tree.$.profile, {
      set: (value) => void received.push(value),
    });
    try {
      const pending = tree.transaction(() => tree.$.profile({ name: 'Ada' }));
      await nextTask();
      expect(received).toEqual([]);
      pending.confirm();
      await nextTask();
      await relation.settled();
      expect(received.at(-1)).toStrictEqual({ name: 'Ada' });
    } finally {
      relation.dispose();
      tree.destroy();
    }
  });

  it.each(['omission only', 'sibling also changes'] as const)(
    'explicit rollback restores the optional member: %s',
    (change) => {
      const tree = signalTree(
        { profile: initialProfile() },
        { enhancers: [transactions()] }
      );
      const age = tree.$.profile.age;
      try {
        const next = { name: change === 'omission only' ? 'Ada' : 'Grace' };
        const pending = tree.transaction(() => tree.$.profile(next));
        expect(tree.$.profile()).toStrictEqual(next);
        pending.rollback();
        expect(tree.$.profile()).toStrictEqual(initialProfile());
        expect(Object.keys(tree.$.profile)).toEqual(['name', 'age']);
        expect(tree.$.profile.age).toBe(age);
        expect(age?.()).toBe(42);
      } finally {
        tree.destroy();
      }
    }
  );

  it('automatic rollback restores the omitted member and preserves the thrown error', () => {
    const tree = signalTree(
      { profile: initialProfile() },
      { enhancers: [transactions()] }
    );
    const failure = new Error('abort branch replacement');
    try {
      expect(() =>
        tree.transaction(() => {
          tree.$.profile({ name: 'Grace' });
          throw failure;
        })
      ).toThrow(failure);
      expect(tree.$.profile()).toStrictEqual(initialProfile());
    } finally {
      tree.destroy();
    }
  });

  it.each(['value', 'updater', 'root'] as const)(
    'undo/redo restores membership as well as values through a %s call',
    async (entry) => {
      const tree = signalTree(
        { profile: initialProfile() },
        { enhancers: [restoration()] }
      );
      try {
        undoable(() => {
          if (entry === 'value') tree.$.profile({ name: 'Grace' });
          else if (entry === 'updater')
            tree.$.profile(() => ({ name: 'Grace' }));
          else tree.$({ profile: { name: 'Grace' } });
        });
        await nextTask();
        expect(tree.$.profile()).toStrictEqual({ name: 'Grace' });
        tree.undo();
        expect(tree.$.profile()).toStrictEqual(initialProfile());
        tree.redo();
        expect(tree.$.profile()).toStrictEqual({ name: 'Grace' });
        expect(Object.keys(tree.$.profile)).toEqual(['name']);
      } finally {
        tree.destroy();
      }
    }
  );
});

describe('plain-branch membership replay composition', () => {
  it.each([8, undefined])(
    'rollback restores the original value after remove and reacquire (%s)',
    (next) => {
      const tree = signalTree(
        { profile: initialProfile() },
        { enhancers: [transactions()] }
      );
      try {
        const pending = tree.transaction(() => {
          tree.$.profile({ name: 'Ada' });
          tree.$.profile({ name: 'Grace', age: next });
        });
        expect(tree.$.profile()).toStrictEqual({ name: 'Grace', age: next });
        pending.rollback();
        expect(tree.$.profile()).toStrictEqual(initialProfile());
      } finally {
        tree.destroy();
      }
    }
  );

  it.each([8, undefined])(
    'undo/redo composes remove and reacquire (%s)',
    async (next) => {
      const tree = signalTree(
        { profile: initialProfile() },
        { enhancers: [restoration()] }
      );
      try {
        undoable(() => {
          tree.$.profile({ name: 'Ada' });
          tree.$.profile({ name: 'Grace', age: next });
        });
        await nextTask();
        tree.undo();
        expect(tree.$.profile()).toStrictEqual(initialProfile());
        tree.redo();
        expect(tree.$.profile()).toStrictEqual({ name: 'Grace', age: next });
      } finally {
        tree.destroy();
      }
    }
  );

  it('undo restores a present undefined member without inventing a value', async () => {
    const tree = signalTree(
      { profile: { name: 'Ada', age: undefined } as Profile },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.profile({ name: 'Ada' }));
      await nextTask();
      tree.undo();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada', age: undefined });
      tree.redo();
      expect(tree.$.profile()).toStrictEqual({ name: 'Ada' });
    } finally {
      tree.destroy();
    }
  });

  it('undo restores an omitted branch with a literal set child', async () => {
    const tree = signalTree(
      {
        box: { keep: 1, detail: { set: 2, age: 42 } } as {
          keep: number;
          detail?: { set: number; age: number };
        },
      },
      { enhancers: [restoration()] }
    );
    const detail = tree.$.box.detail;
    try {
      undoable(() => tree.$.box({ keep: 1 }));
      await nextTask();
      tree.undo();
      expect(tree.$.box()).toStrictEqual({
        keep: 1,
        detail: { set: 2, age: 42 },
      });
      expect(tree.$.box.detail).toBe(detail);
      tree.redo();
      expect(tree.$.box()).toStrictEqual({ keep: 1 });
    } finally {
      tree.destroy();
    }
  });
});

it('rollback retains the original scalar baseline when a later replacement omits it', () => {
  const tree = signalTree(
    { profile: initialProfile() },
    { enhancers: [transactions()] }
  );
  try {
    const pending = tree.transaction(() => {
      tree.$.profile.age?.(8);
      tree.$.profile({ name: 'Grace' });
    });
    pending.rollback();
    expect(tree.$.profile()).toStrictEqual(initialProfile());
  } finally {
    tree.destroy();
  }
});

it('historical snapshots materialize member presence instead of internal endpoints', async () => {
  const tree = signalTree(
    { profile: initialProfile() },
    { enhancers: [restoration()] }
  );
  try {
    undoable(() => tree.$.profile.name('First'));
    await nextTask();
    undoable(() => tree.$.profile({ name: 'Grace' }));
    await nextTask();
    expect(
      tree.getRestorationHistory().map((entry) => entry.state)
    ).toStrictEqual([
      { profile: { name: 'First', age: 42 } },
      { profile: { name: 'Grace' } },
    ]);
  } finally {
    tree.destroy();
  }
});

describe('plain-branch membership public history values', () => {
  it.each([42, undefined])(
    'confirmed omission exposes raw values and explicit presence (%s)',
    (age) => {
      const tree = signalTree(
        { profile: { name: 'Ada', age } as Profile },
        { enhancers: [transactions({ history: { retain: 5 } })] }
      );
      try {
        tree.transaction(() => tree.$.profile({ name: 'Ada' })).confirm();
        const turns = confirmedTurnReader(tree)!.readConfirmedTurns().turns;
        expect(turns).toHaveLength(1);
        const effect = turns[0].effects.find(
          ({ path }) => path === 'profile.age'
        );
        expect(effect).toBeDefined();
        expect(effect?.before).toBe(age);
        expect(effect?.after).toBeUndefined();
        const presence:
          | { readonly before: boolean; readonly after: boolean }
          | undefined = effect?.plainBranchMembership;
        expect(presence).toStrictEqual({ before: true, after: false });
        expect(Object.getOwnPropertySymbols(effect!)).toEqual([]);
        // Scalars cannot contain an address wrapper, hidden symbols, or handles.
        expect(Object(effect?.before)).not.toHaveProperty('state');
        expect(Object.getOwnPropertySymbols(Object(effect?.before))).toEqual(
          []
        );
        expect(Object.getOwnPropertySymbols(Object(effect?.after))).toEqual([]);
      } finally {
        tree.destroy();
      }
    }
  );

  it('confirmed branch omission contains only the application branch value', () => {
    const detail = { set: 2, age: 42 };
    const tree = signalTree(
      { box: { keep: 1, detail } as { keep: number; detail?: typeof detail } },
      { enhancers: [transactions({ history: { retain: 5 } })] }
    );
    try {
      tree.transaction(() => tree.$.box({ keep: 1 })).confirm();
      const effects =
        confirmedTurnReader(tree)!.readConfirmedTurns().turns[0].effects;
      const effect = effects.find(({ path }) => path === 'box.detail');
      expect(effect?.before).toStrictEqual(detail);
      expect(effect?.after).toBeUndefined();
      expect(effect?.plainBranchMembership).toStrictEqual({
        before: true,
        after: false,
      });
      expect(Reflect.ownKeys(effect!.before as object)).toEqual(['set', 'age']);
      expect(JSON.parse(JSON.stringify(effect?.before))).toStrictEqual(detail);
    } finally {
      tree.destroy();
    }
  });

  it('confirmed reintroduction contains the current nested application value', () => {
    const profile: { name: string; nested?: { detail: { age: number } } } = {
      name: 'Ada',
      nested: { detail: { age: 42 } },
    };
    const tree = signalTree(
      { profile },
      {
        enhancers: [transactions({ history: { retain: 5 } })],
      }
    );
    try {
      tree.$();
      tree.transaction(() => tree.$.profile({ name: 'Ada' })).confirm();
      tree
        .transaction(() =>
          tree.$.profile({
            name: 'Ada',
            nested: { detail: { age: 43 } },
          })
        )
        .confirm();
      const turns = confirmedTurnReader(tree)!.readConfirmedTurns().turns;
      const effect = turns
        .at(-1)!
        .effects.find(({ path }) => path === 'profile.nested');
      expect(effect?.before).toBeUndefined();
      expect(effect?.after).toStrictEqual({ detail: { age: 43 } });
      expect(effect?.plainBranchMembership).toStrictEqual({
        before: false,
        after: true,
      });
      expect(Reflect.ownKeys(effect!.after as object)).toEqual(['detail']);
      expect(
        Reflect.ownKeys((effect!.after as { detail: object }).detail)
      ).toEqual(['age']);
    } finally {
      tree.destroy();
    }
  });

  it('historical snapshots preserve present undefined across omission and reintroduction', async () => {
    const tree = signalTree(
      { profile: { name: 'Ada', age: undefined } as Profile },
      { enhancers: [restoration()] }
    );
    try {
      undoable(() => tree.$.profile.name('First'));
      await nextTask();
      undoable(() => tree.$.profile({ name: 'Absent' }));
      await nextTask();
      undoable(() => tree.$.profile({ name: 'Present', age: undefined }));
      await nextTask();
      expect(
        tree.getRestorationHistory().map(({ state }) => state)
      ).toStrictEqual([
        { profile: { name: 'First', age: undefined } },
        { profile: { name: 'Absent' } },
        { profile: { name: 'Present', age: undefined } },
      ]);
    } finally {
      tree.destroy();
    }
  });
});
