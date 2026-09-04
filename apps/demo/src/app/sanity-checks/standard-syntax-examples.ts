import { signalTree } from '@signal-tree/angular';

// ==============================================
// Example 1: Basic Operations
// ==============================================

const basicTree = signalTree({
  name: 'John' as string,
  age: 30 as number,
  email: 'john@example.com' as string,
  active: true as boolean,
});

// Direct value updates (standard syntax)
basicTree.$.name('Jane Doe');
basicTree.$.age(25);
basicTree.$.email('jane@example.com');
basicTree.$.active(false);

// Functional updates (standard syntax)
basicTree.$.name((current) => current.toUpperCase());
basicTree.$.age((current) => current + 5);

// ==============================================
// Example 2: Nested Object Operations
// ==============================================

const nestedTree = signalTree({
  user: {
    profile: {
      firstName: 'John' as string,
      lastName: 'Doe' as string,
      settings: {
        theme: 'dark' as string,
        notifications: true as boolean,
      },
    },
    preferences: {
      language: 'en' as string,
      timezone: 'UTC' as string,
    },
  },
});

// Deep nested updates
nestedTree.$.user.profile.firstName('Jane');
nestedTree.$.user.profile.lastName('Smith');
nestedTree.$.user.profile.settings.theme('light');
nestedTree.$.user.preferences.language('es');

// Functional updates on individual nested properties
nestedTree.$.user.profile.firstName((current) => current + ' (Updated)');
nestedTree.$.user.profile.lastName((current) => current + ' (Updated)');

// ==============================================
// Example 3: Array Operations
// ==============================================

const arrayTree = signalTree({
  todos: [
    { id: 1, text: 'Learn SignalTree', done: false },
    { id: 2, text: 'Build awesome app', done: false },
  ] as Array<{ id: number; text: string; done: boolean }>,
  tags: ['typescript', 'angular'] as string[],
  scores: [95, 87, 92] as number[],
});

// Add new todo
arrayTree.$.todos((current) => [
  ...current,
  { id: 3, text: 'Deploy to production', done: false },
]);

// Mark todo as done
arrayTree.$.todos((current) =>
  current.map((todo) => (todo.id === 1 ? { ...todo, done: true } : todo))
);

// Add new tag
arrayTree.$.tags((current) => [...current, 'signaltree']);

// Update scores
arrayTree.$.scores((current) => current.map((score) => score + 3));

// ==============================================
// Example 4: Conditional and Complex Updates
// ==============================================

const stateTree = signalTree({
  ui: {
    loading: false as boolean,
    error: null as string | null,
    data: null as { results: string[] } | null,
  },
  filters: {
    search: '' as string,
    category: 'all' as string,
    sortBy: 'name' as string,
  },
});

// Simulate loading state
stateTree.$.ui.loading(true);
stateTree.$.ui.error(null);

// Simulate data loading
setTimeout(() => {
  stateTree.$.ui.loading(false);
  stateTree.$.ui.data({ results: ['item1', 'item2', 'item3'] });
}, 100);

// Update filters based on conditions
stateTree.$.filters.search((current) => current.trim());
stateTree.$.filters.category((current) =>
  current === 'all' ? 'featured' : current
);

// ==============================================
// Example 5: Working with Optional Values
// ==============================================

const optionalTree = signalTree({
  user: {
    name: 'John' as string,
    email: 'john@example.com' as string,
    avatar: null as string | null,
    lastLogin: null as Date | null,
  },
  settings: {
    notifications: true as boolean,
    theme: 'auto' as 'light' | 'dark' | 'auto',
  },
});

// Handle optional values
optionalTree.$.user.avatar('https://example.com/avatar.jpg');
optionalTree.$.user.lastLogin(new Date());

// Conditional updates
optionalTree.$.user.avatar((current) => current || 'default-avatar.jpg');
optionalTree.$.user.lastLogin((current) => current || new Date());

// ==============================================
// Example 6: Performance and Batching
// ==============================================

const performanceTree = signalTree({
  metrics: {
    pageViews: 0 as number,
    uniqueVisitors: 0 as number,
    bounceRate: 0.0 as number,
  },
  analytics: {
    events: [] as Array<{ type: string; timestamp: Date }>,
    sessions: 0 as number,
  },
});

// Multiple rapid updates (would benefit from batching)
performanceTree.$.metrics.pageViews((current) => current + 1);
performanceTree.$.metrics.uniqueVisitors((current) => current + 1);
performanceTree.$.metrics.bounceRate((current) =>
  Math.max(0, current - 0.01)
);

// Batch analytics updates
performanceTree.$.analytics.events((current) => [
  ...current,
  { type: 'page_view', timestamp: new Date() },
  { type: 'user_action', timestamp: new Date() },
]);
performanceTree.$.analytics.sessions((current) => current + 1);

// ==============================================
// Example 7: One callable grammar at every location
// ==============================================
//
// Root, branch, and terminal locations all read with no arguments, replace with
// a complete value, and derive with an updater. This is kernel runtime behavior,
// not the retired callable-syntax transform. Use `leaf(value)` at construction
// when an object or callable should terminate the dot-path topology.

const callableTree = signalTree({
  user: {
    name: 'John' as string,
    age: 30 as number,
  },
  ui: {
    loading: false as boolean,
    error: null as string | null,
  },
});

// Branch — read the whole subtree
callableTree.$.user(); // → { name: 'John', age: 30 }

// Branch — WHOLE-VALUE write. 15.0: the value form supplies the next value of
// this location, so every key is stated. `Partial<T>` was removed from the
// callable because it overrode the state author's own strictness —
// GREENFIELD-BRANCH-WRITE-0.
callableTree.$.user({ name: 'Bob', age: 30 });

// Branch — updater form. This is how you PATCH: depending on current state is
// exactly what the updater is for, and the call site says so.
callableTree.$.ui((current) => ({ ...current, loading: !current.loading }));

// Root — the same grammar, so the root also takes a whole value.
callableTree.$({
  user: { name: 'Bob', age: 30 },
  ui: { loading: false, error: null },
});

// The leaves underneath are still written the normal way:
callableTree.$.ui.error('Request failed');
callableTree.$.user.age((current) => current + 1);
