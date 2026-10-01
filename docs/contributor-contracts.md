# Contributor contracts

These ownership constraints were moved from this checkout's AGENTS.md.
They do not add APIs from the separate v15 release worktree. Compatibility is
set by [support policy](support-policy.md); historical greenfield derivation
is not permission to break stable releases.

## Target-state-first migration

> **Migration pressure may reveal a missing property, but it never determines
> the replacement architecture.** A legacy application can falsify an
> architecture. It cannot define one.

For every framework integration or application migration:

1. Derive the canonical greenfield v15 architecture without legacy constraints.
2. Implement and validate that architecture independently.
3. Freeze the target contract only from greenfield evidence.
4. Migrate applications toward that target.
5. Prefer deleting obsolete concepts over adapting them.

Do not create temporary compatibility APIs, intermediate architectures, legacy
bridges, or migration-only conveniences. Do not preserve old ownership because
moving it is expensive. Migration complexity is evidence to document, not a
reason to pollute the architecture applications should use five years from now.

`@signal-tree/kernel/adapter` is the realization SDK, not a compatibility
layer. A new export belongs there only when it is framework-neutral, expresses
a semantic fact already owned by the kernel, is required by a correct
realization, and is neither application convenience nor compatibility machinery.

Framework packages may realize SignalTree truth for their runtime. They must
not create another state authority. Do not use mutable process-global framework
installation when construction-bound ownership can express the long-term
architecture, and never let a migration determine realization ownership.

## Framework ownership ratchet

Place code by the question it answers, not by whether its names or types look
framework-neutral:

- `@signal-tree/kernel` owns behavior SignalTree requires regardless of
  framework: state and identity, EntityMap, causal turns, links, restoration,
  and owner invalidation semantics.
- `@signal-tree/kernel/adapter` owns only neutral ports that multiple runtime
  realizations can implement for a semantic requirement owned by the kernel.
- A framework package owns anything that exists because of that framework's
  API, lifecycle, diagnostics, scheduler, rendering model, identity rules, or
  quirks. A neutral interface may live in the kernel; its framework
  implementation must not.

For every field proposed for `TreeRealization` or another kernel adapter
contract:

1. State the SignalTree semantic job it serves.
2. Provide a neutral implementation.
3. Prove that a tiny fake realization importing no framework can implement it.
4. Identify the kernel authority that decides when and why it is invoked.
5. Reject it when its purpose is only framework lifecycle, diagnostics,
   rendering, hooks, dependency injection, context, scheduling, primitive
   identity detection, or compatibility with one framework primitive.

Ask two questions. If Angular, React, and Vue disappeared, would the contract still
describe a meaningful SignalTree requirement or useful port for another
reactive runtime? Could Solid, Preact, Svelte, or a tiny fake implement it
naturally without pretending to be one of those frameworks? A neutral name alone is
not evidence of neutral ownership. Vanilla need not use every adapter port;
the kernel must own the semantic question the port answers.

## Public library / private Studio boundary

The September 11 owner decision supersedes earlier free-Studio documentation.
Only kernel, angular, react, vue and solid belong in this public release
workspace.
The existing kernel observation interfaces remain public integration primitives.
Studio application, attachment/bridge, recording, sessions and query engine live
in a separate private workspace. Do not copy that source back or include its
packages in public releases, even with private manifests.

The six-package v15.1.0-rc.1 and rc.2 candidates were NOT published. Never resume
or dispatch their old release/publish workflows. A later public release must
use the corrected five-package plan (`scripts/release-plan.mjs` is the
authority; do not hand-maintain the list). Existing public history and Apache notices
are not erased or retroactively revoked by the separation.


## Lifetime, decisions and review

Destroy bounded-lifetime trees at teardown. Cleanup measurements establish their
specific observations, not a universal absence of leaks. Do not prescribe
favorable wording for retention findings.

[Product decisions](architecture/signaltree-15-product-decisions.md) retain owner
authority and their ENTAILED/INFERRED distinction. Relevant frozen dispositions
and reopening conditions remain in the [architecture record](architecture/SIGNALTREE-15-CONTEXT.md).
P3 and DR-1–DR-4 retain their qualifications; DR-4 scope and R2b remain recorded
reservations, not newly authorized implementation tasks. Load relevant sections
on demand. Use [the current review protocol](../.github/skills/adversarial-confirmation/references/protocol.md)
for procedure; historical headcounts, word bans and chat itineraries are superseded.

Check actual source/types and tests for this development branch. Do not infer
that a v15 release-worktree fix or observation API already exists here.
