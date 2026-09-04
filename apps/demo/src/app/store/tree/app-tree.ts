import { batching, devTools, signalTree } from '@signal-tree/angular';

import { postsState, uiState, usersState } from './state';
import { LoadingState, type Post, type User } from '../types';

/**
 * Application Tree Assembly
 *
 * Mirrors the v3 trax-mobile canonical pattern:
 *   - State definitions live in `./state/*.state.ts`
 *   - Derived reads are composed in one constructor factory
 *   - Operations live in `../ops/*.ops.ts`
 *   - The thin `AppStore` facade in `../app-store.ts` composes ops by domain.
 *
 * Derived values that depend on each other close over ordinary local computeds.
 */

export const STORE_NAME = 'DemoAppTree';

// ─── Type exports ───────────────────────────────────────────────────────────

/** Final tree type after every tier has been applied. */
export type AppTree = ReturnType<typeof createAppTree>;

// ─── Base state factory ─────────────────────────────────────────────────────

function createBaseState() {
  return {
    users: usersState(),
    posts: postsState(),
    ui: uiState(),
  };
}

// ─── Tree creation ──────────────────────────────────────────────────────────

/**
 * Creates the demo application tree with its enhancers and derived state.
 *
 * @example
 * ```ts
 * const tree = createAppTree();
 *
 * // Read base state
 * tree.$.users.entities.all();
 *
 * // Read derived entity state
 * tree.$.users.selected();
 *
 * // Read derived UI state
 * tree.$.ui.totals();
 * ```
 */
export function createAppTree() {
  return signalTree(createBaseState(), {
    enhancers: [devTools({ name: STORE_NAME }), batching()],
    derived: ($) => {
      const selectedUser = () => {
        const id = $.users.selectedId();
        return id === null ? null : $.users.entities.byId(id)?.() ?? null;
      };
      const selectedPost = () => {
        const id = $.posts.selectedId();
        return id === null ? null : $.posts.entities.byId(id)?.() ?? null;
      };
      const filteredPosts = () => {
        const search = $.posts.filters.search().toLowerCase();
        const published = $.posts.filters.published();
        return $.posts.entities.all().filter((post: Post) => {
          if (published !== null && post.published !== published) return false;
          return (
            !search ||
            post.title.toLowerCase().includes(search) ||
            post.content.toLowerCase().includes(search)
          );
        });
      };

      return {
        users: {
          selected: selectedUser,
          count: () => $.users.entities.all().length,
          byRole: () => {
            const groups: Record<User['role'], User[]> = {
              admin: [],
              user: [],
              moderator: [],
            };
            for (const user of $.users.entities.all())
              groups[user.role].push(user);
            return groups;
          },
        },
        posts: {
          selected: selectedPost,
          filtered: filteredPosts,
          forSelectedUser: () => {
            const user = selectedUser();
            return user === null
              ? []
              : $.posts.entities
                  .all()
                  .filter((post: Post) => post.authorId === user.id);
                  },
                  canPublishSelected: () => {
            const post = selectedPost();
            if (post === null) return false;
            const author = $.users.entities.byId(post.authorId)?.();
            return author?.role === 'admin' && !post.published;
          },
        },
        ui: {
          isLoading: () =>
            $.users.loading.state() === LoadingState.Loading ||
            $.posts.loading.state() === LoadingState.Loading,
          firstError: () =>
            $.users.loading.error() ?? $.posts.loading.error() ?? null,
          totals: () => ({
            users: $.users.entities.all().length,
            posts: $.posts.entities.all().length,
            filteredPosts: filteredPosts().length,
          }),
        },
      };
    },
  });
}
