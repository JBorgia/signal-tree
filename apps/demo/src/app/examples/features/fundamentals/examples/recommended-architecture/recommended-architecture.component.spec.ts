import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import {
  ApiService,
  APP_TREE,
  type Post,
  type User,
} from '../../../../../store';
import { RecommendedArchitectureComponent } from './recommended-architecture.component';

const user: User = {
  id: 1,
  name: 'Editor',
  email: 'editor@example.com',
  role: 'admin',
};
const post: Post = {
  id: 1,
  authorId: 1,
  title: 'Draft',
  content: 'Review this',
  published: false,
  likes: 0,
  createdAt: new Date('2026-01-01'),
};

describe('RecommendedArchitectureComponent ownership', () => {
  let users: Subject<User[]>;
  let posts: Subject<Post[]>;
  let published: Subject<Post>;

  beforeEach(async () => {
    users = new Subject<User[]>();
    posts = new Subject<Post[]>();
    published = new Subject<Post>();
    await TestBed.configureTestingModule({
      imports: [RecommendedArchitectureComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            getUsers$: () => users,
            getPosts$: () => posts,
            publishPost$: () => published,
          },
        },
      ],
    }).compileComponents();
  });

  it('cancels active loading when its owner closes and starts a fresh owner on revisit', () => {
    const first = TestBed.createComponent(RecommendedArchitectureComponent);
    const firstTree = first.debugElement.injector.get(APP_TREE);
    expect(users.observed).toBe(true);
    expect(posts.observed).toBe(true);
    users.next([user]);
    expect(firstTree.$.users.entities.count()).toBe(1);
    first.destroy();
    expect(firstTree.destroyed()).toBe(true);
    expect(users.observed).toBe(false);
    expect(posts.observed).toBe(false);

    // A late source result has no consumer left to write into the destroyed tree.
    posts.next([post]);
    const second = TestBed.createComponent(RecommendedArchitectureComponent);
    const secondTree = second.debugElement.injector.get(APP_TREE);
    expect(secondTree).not.toBe(firstTree);
    expect(secondTree.$.users.entities.count()).toBe(0);
    expect(secondTree.$.posts.entities.count()).toBe(0);
    expect(users.observed).toBe(true);
    users.next([user]);
    expect(secondTree.$.users.entities.count()).toBe(1);
    second.destroy();
    expect(secondTree.destroyed()).toBe(true);
    expect(users.observed).toBe(false);
    expect(posts.observed).toBe(false);
  });

  it('cancels an active publish subscription before a late response can mutate a closed owner', () => {
    const fixture = TestBed.createComponent(RecommendedArchitectureComponent);
    users.next([user]);
    posts.next([post]);
    const component = fixture.componentInstance;
    component.store.ops.posts.setSelected(post.id);
    expect(component.canPublishSelected()).toBe(true);
    component.publishSelected();
    expect(published.observed).toBe(true);
    expect(component.selectedPost()?.published).toBe(false);
    const tree = fixture.debugElement.injector.get(APP_TREE);
    fixture.destroy();
    expect(tree.destroyed()).toBe(true);
    expect(published.observed).toBe(false);
    published.next({ ...post, published: true });
  });
});
