# Open-source SignalTree and SignalTree Studio

Everything in the left column is in the open-source packages you install from
npm. Nothing in the right column is. If a capability appears in the right
column, you cannot get it by installing `@signal-tree/kernel` or any framework
package.

## Open-source SignalTree — Apache-2.0, on npm

- State and field access at typed paths
- Entity collections (`entityMap`) — add, update, remove, look up by ID
- Framework integrations for Angular, React, Vue and Solid
- Transactions and rollback
- Undo and redo (`undoable()` with the `restoration()` enhancer)
- External-update semantics — telling your writes apart from updates that
  arrive from outside, and binding to outside sources with `link()`
- Entity lifetime — a held reference does not follow a different record that
  reuses the same ID
- Redux DevTools integration
- The observation seam for tooling (`@signal-tree/kernel/internals`)
- The adapter SDK (`@signal-tree/kernel/adapter`) for building framework
  adapters

That set is complete on its own. You can build and ship an application without
ever encountering Studio.

## SignalTree Studio — separate product, not on npm

- Retained causal exploration across turns
- "Why did this value become this value?" analysis
- Richer evidence visualization
- Cross-turn diagnostic tooling

Studio is a separate private product with an explicit development-only
attachment. Its adapter and query engine are **not** public npm packages.

## Where the line actually falls

The open-source packages provide the **semantics**: the tree knows which writes
were yours, what belongs to the same operation, and what an undo must revive.
Those rules are what make the behaviour correct, and they ship under
Apache-2.0.

Studio provides an **explanatory interface** over retained evidence. It does not
add semantics the kernel lacks; it makes existing retained information
navigable.

So: if documentation or marketing describes *causal explanation as a feature you
can see and explore*, that is Studio. If it describes *state that behaves
correctly under undo, rollback and external updates*, that is open source. The
open-source material should lead with the second.

## Related

- [Why SignalTree?](why-signaltree.md)
- [Support policy](support-policy.md)
- [`@signal-tree/kernel` tooling observation](../packages/kernel/README.md#tooling-observation)
