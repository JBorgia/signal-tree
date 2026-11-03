# Open Record typing in v16

Ordinary whole-value writes can introduce keys. An arbitrary property access on
an undeclared `Record<string, V>` is now `unknown`: it does not guarantee that a
child handle exists. This is a source-typing migration; runtime behavior is unchanged.

```ts
import { signalTree } from '@signal-tree/kernel';

const tree = signalTree({ counts: {} as Record<string, number> });
tree.$.counts({ clicks: 1 }); // Whole-value writes retain their value types.
const candidate: unknown = tree.$.counts['clicks'];
const counts = tree.$.counts(); // Read the ordinary whole value.
const clicks = counts['clicks'];
void [candidate, clicks];
tree.destroy();
```

This example intentionally uses the framework-neutral kernel. Applications use
its Angular, React, Vue or Solid facade. Branch whole-value access has the same
meaning across those facades; leaf syntax remains framework-native.

## Keep declared children typed

Named members of hybrid objects retain their normal handles. Declare a genuinely
known key in the state type instead of asserting that every possible key exists.

```ts
import { signalTree } from '@signal-tree/kernel';

interface Counts extends Record<string, number> {
  total: number;
}
const initial: Counts = { total: 0 };
const tree = signalTree({ counts: initial });
tree.$.counts.total(1); // Kernel/React; Angular/Solid use .set(1), Vue uses .value = 1.
const dynamic: unknown = tree.$.counts['someOtherKey'];
void dynamic;
tree.destroy();
```

Closed objects, named hybrid children, readonly modifiers and whole-value write
constraints are preserved. An `unknown` value needs appropriate narrowing before
use; truthiness or `typeof value === 'function'` alone does not establish a child
handle. Callable branches have native properties such as `call`, `name` and
`length`. Explicitly supplied data keys with those names remain supported.

An existing dormant handle may remain available after its value is omitted.
Handle availability is not current membership, and arbitrary access does not
construct a never-present handle. No lookup helper or topology-declaration API
is added by this change. Do not use casts to recreate the old universal promise.

This bounded migration covers open string-indexed Records and their readonly and
hybrid forms. Numeric-only, symbol-indexed and template-pattern index signatures
retain prior behavior; this is not a claim of universal open-key soundness.

The [implementation evidence](../audits/2026-10-17-incumbent-readiness/unknown-dynamic-access/README.md)
preserves original failures, exact source hashes, independent review and validation.
