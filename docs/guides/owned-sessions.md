# Independent editors and device sessions

Keep shared records in one place. Give each independent editing session its own
draft, and each connection its own resource lifetime. SignalTree v15 already
supports these application patterns; they do not require mounting slices into a
running tree.

Try **Examples → Editors & devices** (`/owned-sessions`) in the demo. Open two
editors for the same record, change current data, and attempt a stale save. Start
two simulated devices and stop one. The other keeps receiving samples.

## Choose the owner first

| Need | Recommended owner and representation |
| --- | --- |
| Shared records used by several screens | A feature/application tree with a declared `entityMap()` |
| Unsaved form values | Native local form state; use a separate tree when nested reads or tree capabilities help |
| Several editors of the same record | One draft per editor instance; session ID differs from entity ID |
| Several independent connections | One owner per connection, with its tree and cleanup |
| Many data-only sessions with the same schema | A declared EntityMap under one owner; rows are data, not resource containers |
| Combined display across sessions | Framework computed reads over a registry of session owners |
| One operation requiring a shared transaction or undo boundary | Design that ownership boundary explicitly; separate trees do not supply it |

A store's declared ordinary-object shape is constructed up front. EntityMap
membership can change afterward. Adding a composite slice with its own markers,
derivations, enhancers and cleanup to an existing root is a different capability;
v15 does not offer a public mounting API for it. A `Record<string, T>` type alone
does not prove that arbitrary new properties acquire reactive descendants at
runtime. Do not work around this by assigning trees into `$` or casting away types.

Independent trees have separate observation and history. A registry can group
them for display or inspection, but does not combine their settlement authority.
Studio grouping, when available, is presentation, not a new state owner.

## Editor policy: draft, review, conditional apply

The executable Angular example uses only `@signal-tree/angular` and native Angular
signals. Its [session model](../../apps/demo/src/app/pages/owned-sessions/owned-sessions.model.ts)
is application code, not a SignalTree API.

1. Read the record and capture its application revision and lifetime tokens.
2. Create a draft tree for the editable values, with a unique editor-session ID.
3. Read current data normally beside the draft. Draft writes do not update it.
4. On apply, validate input and compare the current tokens to the captured ones.
5. If either token changed, keep the draft and display a conflict. Reload is an
   explicit discard of local edits. Never silently retarget to a replacement row.
6. Otherwise make one `updateOne()` call and close/destroy the draft session.
7. On cancel, destroy only the draft. On owner teardown, destroy all remaining
   sessions before destroying the shared tree.

The example deliberately refuses every changed revision. It does not auto-merge
fields or implement kernel MVCC. Its `revision` and `lifetime` values are
**application-owned demo tokens**, not kernel IDs. Every writer in a real
application must honor its chosen conflict protocol. A backend ETag/version check
must be enforced by the backend; a local comparison cannot prevent another client
from racing a network request. Treat an async save as a workflow: preserve the
draft through rejection, correlate its response with the correct session, and
apply returned server truth according to the application's authority policy.

Two editors may share an entity ID and still own different drafts. Removing and
recreating a record with the same ID is not permission for an old editor to edit
the replacement. If the backend supplies no lifetime/version evidence, define a
safe refusal/reload policy instead of inventing distributed identity.

The demo's **Apply locally** is a local application write, not a server ACK.
**Simulate server update** calls `external()` to represent already acquired truth;
it does not implement networking. No `transactions()` or restoration enhancer is
needed for this example. If a real workflow requires them, first read the
[v15 failure boundaries](transaction-failures-v15.md). Copying values from a draft
does not add cross-tree atomicity or make v15 rollback unconditionally safe.

## Connection policy: resources follow the session

A device session owns a tree of serializable values and registers the subscription
cleanup with `tree.registerCleanup(stop)`. Its receive callback checks
`tree.destroyed()` before applying a late sample. The example uses `external()`
for incoming samples and a timer as the source. Replace the source with a real
subscription; do not store a socket, timer or nested tree in an entity row.

Closing a connection calls `destroy()`. Closing one does not destroy the shared
records or another connection. Page teardown releases every remaining timer and
tree. A source that allocates resources and then throws before returning its stop
function must clean up its own partial acquisition.

In Angular, bind directly created trees to `DestroyRef` at the actual component,
route or service owner. `defineStore()` can manage injector-owned trees; its
provider scope must match the intended lifetime. A root singleton is appropriate
for application state, not a shortcut for independently closable dialogs.
Framework-managed cleanup is useful, but explicitly destroy a session when it
ends before its enclosing component does.

The active-device total is a `computed()` over the registry and live tree reads.
Stopping a session removes its contribution to that display. The total is not
historical telemetry and not another writable store. Do not mirror every session
into a root tree through Link merely to render a dashboard.

## Framework write grammar

Use one framework facade for application imports. Ownership policy is shared;
physical reads/writes remain native to each runtime.

| Runtime | Leaf read | Leaf write |
| --- | --- | --- |
| Angular | `leaf()` | `leaf.set(value)` |
| Vue | `leaf.value` | `leaf.value = value` |
| Solid | `leaf()` | `leaf.set(value)` |
| React / neutral | `leaf()` | `leaf(value)` |

Use that runtime's documented observation and cleanup integration. An Angular
example is not proof of React, Vue or Solid lifecycle behavior. This demo directly
tests Angular; the package guides cover their respective physical integrations.

## Guidance for adopters and implementers

Start with one real workflow. Keep canonical data, local input, request state and
resource ownership distinct. Do not recreate an action bus or reducer layer just
to invoke ordinary typed writes. Ops methods can enforce domain rules without
making SignalTree imitate the previous store.

Validate IDs at ingress. `setAll()` collapses duplicate keys; it is not a unique-ID
validator. A missing-ID filter does not detect duplicated non-null IDs. Reject or
report invalid input according to the application contract, without substituting
a shared fallback ID.

Prove these behaviors before adopting the pattern:

- Two editors of one record do not share draft values or disposal.
- Cancel leaves canonical data unchanged; apply validates against current data.
- Stale apply preserves both newer truth and the unsaved draft.
- Same-ID replacement cannot be edited through the old session.
- Closing one device leaves another live; late callbacks do not write to a closed tree.
- Owner teardown destroys every owned tree and releases every subscription.
- Aggregate reads update without creating a second writable authority.

The [executable tests](../../apps/demo/src/app/pages/owned-sessions/owned-sessions.spec.ts)
and demo browser checks pin these application policies. They do not establish a
new kernel transaction contract.

## Guidance for AI-generated code

- Read the installed package types and matching release documentation. Do not
  invent `mountSlice()`, `fork()`, `beginStage()` or enhancer installation after construction.
- Choose native local form state first when it is enough; a separate tree is an
  option for independent state, not a requirement for every input.
- Generate explicit ownership and disposal together with tree creation.
- Keep editor-session identity separate from business identity. Include a conflict
  policy and demonstrate refusal; a happy-path save is insufficient.
- Do not claim that local apply, Link completion or transaction confirmation proves
  remote durability. Do not infer server freshness from response arrival alone.
- Keep actual resources outside serializable state. Do not use link mirroring,
  root grafting or a global registry as a substitute for ownership.
- Preserve known v15 limitations. These recipes do not repair dynamic ordinary
  property insertion or promise a shared undo/transaction across independent trees.

The live demo and repository guidance may include unpublished follow-up work.
Published `15.3.1` remains the published artifact: its same-turn Link settlement
race and missing duplicate-key diagnostic are documented in the failure guide.
