<div align="center">
  <img src="apps/demo/public/signaltree-mark-192.png" alt="SignalTree ST leaf mark" width="96" height="96" />
  <h1>SignalTree</h1>
  <p><strong>Edit nested state directly. Keep live records reactive.</strong></p>
  <p>Typed field access, live collections, and optional undo<br />for Angular, React, Vue, Solid, and TypeScript.</p>
  <p>
    <a href="https://signaltree.io/"><strong>Try the demo</strong></a>
    &nbsp;·&nbsp;
    <a href="#get-started">Get started</a>
    &nbsp;·&nbsp;
    <a href="docs/architecture/signaltree-architecture-guide.md">Documentation</a>
  </p>
</div>

## See the difference

Read and edit a field at the same typed path. Here is Angular; [React](packages/react/README.md), [Vue](packages/vue/README.md), and [plain TypeScript](packages/kernel/README.md) have their own entry points.

```typescript
import { computed, isSignal } from '@angular/core';
import { signalTree } from '@signal-tree/angular';

const store = signalTree({
  order: { customer: { name: 'Alex' }, priority: 'normal' },
});

store.$.order.customer.name(); // 'Alex' — a native Angular signal read
store.$.order.customer.name.set('Sam');
store.$.order.priority.set('urgent');

// Each leaf IS an Angular signal, so everything Angular takes one just works.
isSignal(store.$.order.priority); // true
const shouting = computed(() => store.$.order.priority().toUpperCase());

// Clean up when you're done with the store.
store.destroy();
```

- **No interop boundary.** A leaf is an Angular `WritableSignal`, not a wrapper around one. It goes straight into `computed`, `effect`, `linkedSignal`, a `model()` input, or a template — no adapter, nothing to unwrap. (Branches like `store.$.order` are structural accessors, not signals.)
- **Nested edits.** Change a field without copying every object above it.
- **Live records.** Find a record by ID and bind to the fields your view needs.
- **Optional undo.** Undo a user edit while keeping unrelated server updates. If undo would overwrite a newer server value, it refuses the whole operation.

Already comfortable with `signal()` and `computed()`? [See what SignalTree adds](docs/compare/native-signals.md).

## Is it a fit?

**Useful for** nested forms, live record grids, and edits across several records. Start with one feature; the [Angular store and operations example](packages/angular/README.md#readonly-state-and-operations-share-one-owner) shows how to organize it.

**Keep the tradeoffs in view:**

- A few local values may need only native framework signals.
- Reading every record after each change does different work from reading one field. Measure the way your app uses state.
- Loading, caching, saving, and merging collaborative edits remain application concerns.
- Undo applies only to operations you mark with `undoable()` and requires `restoration()`.

[Compare with NgRx SignalStore](docs/compare/ngrx-signalstore.md) · [Collection API](packages/kernel/README.md#entitymap) · [Persistence boundaries](docs/guides/persistence-guide.md)

[Run the browser benchmarks](https://signaltree.io/benchmarks) to compare the work your app does on your own device.

## Get started

Install the package for your framework:

| Runtime                      | Install                            | Guide                                                   |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------- |
| Angular 20–22                | `npm install @signal-tree/angular` | [First store and ownership](packages/angular/README.md) |
| React 18–19                  | `npm install @signal-tree/react`   | [Subscriptions and ownership](packages/react/README.md) |
| Vue 3.5+                     | `npm install @signal-tree/vue`     | [Refs and scope disposal](packages/vue/README.md)       |
| Solid 1.9+                   | `npm install @signal-tree/solid`   | [Accessors and root disposal](packages/solid/README.md) |
| Framework-neutral TypeScript | `npm install @signal-tree/kernel`  | [Kernel API](packages/kernel/README.md)                 |

Import SignalTree APIs from that one package. Each framework package includes the kernel.

Clean up each store once. Angular's `defineStore(() => signalTree(...))` does this when its injector is destroyed. For a store you create directly, call `destroy()` at teardown. [Readonly views and write methods](packages/angular/README.md#readonly-state-and-operations-share-one-owner) can share one store; readonly types are not a security boundary.

The scope is **`@signal-tree/*`**, distinct from `@ngrx/signals`. Existing **`@signaltree/*`** users are on the maintained v14 line: [support policy](docs/support-policy.md) · [v15 migration](docs/guides/migration-v14-v15.md).

## Go deeper

| Need                                       | Start here                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Structure a feature and coordinate updates | [Architecture](docs/architecture/signaltree-architecture-guide.md) · [Composition recipes](docs/guides/composition-recipes.md) |
| Work with normalized collections           | [EntityMap API and example](packages/kernel/README.md#entitymap)                                                               |
| Add undo or inspect changes                | [Restoration](packages/kernel/README.md#restoration) · [DevTools](packages/kernel/README.md#devtools)                          |
| Diagnose a failure                         | [Error codes](docs/errors/README.md) · [Report an issue](https://github.com/JBorgia/signal-tree/issues)                        |
| Guide an AI coding assistant               | [Current llms.txt](llms.txt) and your framework package's README and types                                                     |

## Project and support

Maintained by **Jonathan D Borgia**. The v15 line receives features and fixes; v14 receives bug and security fixes. See the [support policy](docs/support-policy.md), [changelog](CHANGELOG.md), and [release history](https://github.com/JBorgia/signal-tree/releases) for current details. Include the package scope and version when reporting an issue.

**Apache-2.0** for v14.1.2 onward, including v15. Earlier releases retain their original license. [LICENSE](LICENSE) · [NOTICE](NOTICE) · [Contributor instructions](AGENTS.md)
