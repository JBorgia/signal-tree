# Your first v15 feature: edit while updates arrive

A customer asks you to make an order urgent. The shipping service then reports
it shipped. The customer changes their mind: undo the priority edit while keeping
the shipping update. That is the live story on the demo home page.

This guide uses v15's public Angular facade. Check your installed version and
declarations first; a development checkout or version label does not establish
publication. The [package guide](../../packages/angular/README.md) is the API
reference, and [llms.txt](../../llms.txt) supplies version-specific agent guidance.

## Begin with only the state you need

```typescript
import { defineStore, signalTree } from '@signal-tree/angular';

export const OrderStore = defineStore(() =>
  signalTree({
    order: { customer: 'Ada', priority: 'Standard' },
  })
);
```

Provide `OrderStore` on the feature component, then inject it in that component's
injection context. Read `orders.$.order.priority()` and write
`orders.$.order.priority.set('Rush')`. The providing injector owns cleanup.
There is no enhancer in this setup. A few local values may need only native
Angular signals; keep SignalTree when its structure removes work in your feature.

## Add records and optional undo for this workflow

```typescript
import { defineStore, entityMap, external, restoration, signalTree } from '@signal-tree/angular';

interface Order {
  id: number;
  customer: string;
  priority: string;
  status: string;
}

export const OrdersStore = defineStore(() => {
  const tree = signalTree(
    {
      orders: entityMap<Order, number>({
        selectId: (order) => order.id,
      }),
    },
    { enhancers: [restoration()] }
  );
  external(() =>
    tree.$.orders.addMany([
      { id: 101, customer: 'Ada', priority: 'Standard', status: 'Packing' },
      { id: 102, customer: 'Lin', priority: 'Standard', status: 'Ready' },
    ])
  );
  return tree;
});
```

In separate user/service events, designate the user's priority change with
`undoable(() => order.priority.set('Rush'))`, land the accepted response with
`external(() => order.status.set('Shipped'))`, and later call `tree.undo()`.
Those writes address different fields. The demonstrated result is Standard
priority with Shipped status; the other order stays unchanged.

Restoration history settles at the operation boundary. The example waits until
the event has settled before refreshing `canUndo()`. Do not imply that it is
updated halfway through the operation that creates the history entry.

## Read and run the actual implementation

The homepage imports the [order-tree recipe](../../apps/demo/src/app/components/home/order-edit-recipe.ts),
owns it with `defineStore`, and applies the user/service actions in the
[component](../../apps/demo/src/app/components/home/home.component.ts).
The [behavior tests](../../apps/demo/src/app/components/home/home.component.spec.ts)
exercise the rendered controls, both records, the retained server result, reset,
and independent component lifetimes. This is runnable application source rather
than a second library API.
The deployed guide binds source links to its build commit, including previews.

From the repository, run:

```bash
pnpm nx test demo --runInBand --no-watchman \
  --testPathPatterns=home.component.spec.ts \
  --passWithNoTests=false
pnpm nx build demo --configuration=production
```

The broader [composition recipes](composition-recipes.md) cover fetching and
optimistic reconciliation. [Owned sessions](owned-sessions.md) shows independent
editors over shared records, including stale saves and replacement.

## Keep these responsibilities explicit

- The application owns requests, stale-response policy, errors and the visible
  recovery path. `external()` classifies accepted truth; it does not authenticate
  the response or decide whether a stale response should be accepted.
- The backend owns authorization, durable storage and real-world effects. The
  home story uses a simulated shipping update.
- A conflicting undo may refuse. Explain that result and let the user review
  current state; do not label a caught exception as successful undo. See the
  [v15 failure contract](transaction-failures-v15.md).
- Each directly created tree needs `destroy()`. Independent editor trees belong
  to their editor owners; a retained entity handle belongs to its entity lifetime.
- Optional enhancers and demand allocation reduce some costs. They do not make
  shared support free or establish an application-wide speed advantage.

## Give an AI agent a concrete acceptance task

Ask the agent to use the installed v15 facade, keep one explicit store owner,
implement the three events above, and verify their final values and teardown.
Then change the task: deliver a response late, replace an entity, or make two
editors overlap. Require observable correct behavior and recovery, not just a
successful compile. V15 uses `transaction()`; v16's `transact()` and pending
inspection are a separate migration. Do not mix their examples or live handles.

This recipe is an adoption starting point. Claims about saved implementation
hours, fewer incidents or easier AI adoption need measurement in the actual
application; they are not established by this example.
