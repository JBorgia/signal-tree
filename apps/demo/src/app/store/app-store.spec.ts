import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppStore } from './app-store';
import { APP_TREE, provideAppTree } from './tree';
import { PostOps, UiOps, UserOps } from './ops';
import type { Post, User } from './types';

type NotOffered<T, K extends PropertyKey> = K extends keyof T ? false : true;
const readonlyBoundary: NotOffered<AppStore['$']['ui']['theme'], 'set'> = true;
void readonlyBoundary;

const user: User = {
  id: 1,
  name: 'Alice Admin',
  email: 'alice@example.com',
  role: 'admin',
};

const posts: Post[] = [
  {
    id: 101,
    title: 'Welcome',
    content: 'Hello',
    authorId: user.id,
    published: true,
    likes: 1,
    createdAt: new Date('2025-01-15'),
  },
  {
    id: 102,
    title: 'Draft',
    content: 'Work in progress',
    authorId: user.id,
    published: false,
    likes: 0,
    createdAt: new Date('2025-02-01'),
  },
];

describe('AppStore production consumer', () => {
  let store: AppStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [...provideAppTree(), AppStore, PostOps, UiOps, UserOps],
    });
    store = TestBed.inject(AppStore);
    store.ops.users.upsert(user);
    posts.forEach((post) => store.ops.posts.upsert(post));
    store.ops.users.setSelected(user.id);
    await Promise.resolve();
  });

  afterEach(() => {
    TestBed.inject(APP_TREE).destroy();
  });

  it('reads nested, entity and derived state through a readonly facade', () => {
    expect(store.$.ui.theme()).toBe('light');
    expect(store.$.users.entities.byIdOrFail(user.id).name()).toBe(user.name);
    expect(store.$.users.selected()?.id).toBe(user.id);
    expect(store.$.posts.filtered().map((post) => post.id)).toEqual([101, 102]);
    expect(store.$.ui.totals()).toEqual({
      users: 1,
      posts: 2,
      filteredPosts: 2,
    });
  });

  it('updates entity state through ops and refreshes derived UI state', () => {
    store.ops.posts.setSearch('draft');
    expect(store.$.posts.filtered().map((post) => post.id)).toEqual([102]);

    store.ops.users.remove(user.id);
    expect(store.$.users.entities.byId(user.id)).toBeUndefined();
    expect(store.$.users.selected()).toBeNull();
    expect(store.$.ui.totals().users).toBe(0);
  });

  it('isolates tutorial owners and destroys only the tree belonging to the closed owner', () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const providers = [...provideAppTree(), AppStore, PostOps, UiOps, UserOps];
    const first = createEnvironmentInjector(providers, parent);
    const second = createEnvironmentInjector(providers, parent);
    const firstTree = first.get(APP_TREE);
    const secondTree = second.get(APP_TREE);
    try {
      first.get(AppStore).ops.users.upsert(user);
      expect(firstTree.$.users.entities.count()).toBe(1);
      expect(secondTree.$.users.entities.count()).toBe(0);
      first.destroy();
      expect(firstTree.destroyed()).toBe(true);
      expect(secondTree.destroyed()).toBe(false);
      second.get(AppStore).ops.users.upsert(user);
      expect(secondTree.$.users.entities.count()).toBe(1);
    } finally {
      if (!first.destroyed) first.destroy();
      second.destroy();
    }
    expect(secondTree.destroyed()).toBe(true);
  });
});
