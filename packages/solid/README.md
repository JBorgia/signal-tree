# @signal-tree/solid

SignalTree state, using Solid's own reactivity.

State behaves the same here as in every other SignalTree package: entity
identity, transactions, undo, external updates and reactive publication all
follow the same rules. This package decides only how that state becomes
something Solid can track — leaves are real Solid accessors, so they go
straight into `createMemo`, `createEffect` and JSX.

(In architecture terms the kernel holds semantic authority and this package is
its physical realization; see the
[glossary](../../docs/glossary.md) if you meet that vocabulary elsewhere.)

```bash
npm i @signal-tree/solid solid-js
```

Solid 1.9 or newer is required as a peer dependency.

The canonical v15 model and composition guidance ships with this package as
[llms.txt](llms.txt).

## Usage

Leaves are Solid accessors. Read by calling; write with `.set()`.

```ts
import { signalTree } from '@signal-tree/solid';
import { createEffect } from 'solid-js';

const tree = signalTree({ count: 0, user: { name: 'Ada' } });

createEffect(() => console.log(tree.$.count()));

tree.$.count.set(1);
tree.$.user.name.set('Grace');
```

Collections keep stable identity per subject, not per key:

```ts
import { entityMap, signalTree } from '@signal-tree/solid';

const tree = signalTree({ rows: entityMap<{ id: number; name: string }>({}) });
tree.$.rows.setAll([{ id: 1, name: 'a' }]);

const row = tree.$.rows.byId(1);
tree.$.rows.updateOne(1, { name: 'b' });
row?.(); // { id: 1, name: 'b' }

// A removed subject does not come back when its key is reused.
tree.$.rows.removeOne(1);
tree.$.rows.addOne({ id: 1, name: 'different row' });
row?.(); // undefined — the old subject is gone, not renamed
```

## How it realizes state

`createSignal` supplies exactly what the adapter seam asks for: a tracked getter
and a setter. Per-subject invalidation uses one signal and a reader, and the
adapter both creates and advances it — the kernel never writes a
framework-owned object.

Signals are created with `equals: false` on purpose. **Equality is the kernel's,
not Solid's.** The kernel has already decided whether a change is publishable by
the time this package hears about it, so letting Solid suppress a notification
on value equality would drop invalidations the kernel intended.

Derived cells are created lazily. Solid's `createMemo` evaluates eagerly, and
the kernel builds derived cells while a collection is still initializing — an
eager memo would run before that initialization finished.

## Testing a Solid app that uses SignalTree

Solid's reactivity needs its compiler. Without `vite-plugin-solid`,
`createEffect` never runs and reactivity assertions pass while observing
nothing:

```ts
// vitest.config.ts
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  resolve: { conditions: ['development', 'browser'] },
});
```

## Known limitation

**A Solid store proxy is not valid construction input.** Pass a plain snapshot:

```ts
import { unwrap } from 'solid-js/store';

const tree = signalTree({ data: structuredClone(unwrap(store)) });
```

`@signal-tree/vue` rejects the equivalent mistake with a diagnostic. This
package does not yet, and the guard is deliberately absent rather than present
and unproven: under test, `unwrap` inside this package and `createStore` in a
consumer resolve to different `solid-js` instances, so the check silently fails
to fire. Shipping a guard that cannot be demonstrated to work reads as
protection that is not there. Tracked for a follow-up release.

## License

Apache-2.0

## Transaction failures

Read [Transaction failures and current v15 limitations](https://github.com/JBorgia/signal-tree/blob/fix/15.3.1-link-rollback-and-strand/docs/guides/transaction-failures-v15.md)
before combining transactions, undo, or persistence. Explicit rollback refusal
leaves state unchanged and the handle pending but releases consequences in v15. The
15.3.1 release commits surviving writes on automatic refusal
before a handle returns and still throws. An error does not guarantee undo;
never blindly retry the entire operation.

15.3.1 containment applies to deferred write subscribers and transaction
turn listeners, not all Solid effects. An enclosing Solid `batch()` can defer
effects until after `transaction()` returns a handle; errors then surface from
the outer batch, outside automatic transaction rollback.

## Independent editors and connections

Keep shared records in an owned tree. Give each independently closable editor or
connection its own lifetime; native local form state may be enough for a draft.
A declared EntityMap supports dynamic data membership, not runtime installation
of composite slices. Separate trees do not share transactions or undo history.
Destroy directly created trees at their ownership boundary.

See the [owned sessions guide](../../docs/guides/owned-sessions.md) for the Angular
reference demo, stale-save policy, same-ID replacement and cleanup tests. Use this
package’s own reactive/lifecycle integration when applying the pattern.
