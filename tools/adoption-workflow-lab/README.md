# Bounded query and editing-session comparison

This executable recipe compares two independently owned responsibilities:
accepted data with a live job/driver query, and a small user-owned editing session.
It uses synthetic dispatch records, not application or customer source/data.

Five production Angular AOT consumers share the same workflow and useful oracles:
SignalTree v15 or v16 for both responsibilities, TanStack DB with a small native
Angular editor, and TanStack DB with a bounded v15 or v16 editor. The versioned
transaction-opening spelling is the only generated editor source difference.

The synthetic service is an in-memory map and receipt cache. It checks a route
revision and entity lifetime, refuses stale work, and reconciles a lost reply by
the same editor/proposal command. This is **not** durable storage, authorization,
an arbitrary exactly-once protocol, or a complete server-sync implementation.
The native editor implements this one field's inverse, not general transactions.
The ordinary shared workflow does not establish v16's additional guarantees;
those have their own runtime and demo tests.

## Run

Use the repository's Node/pnpm versions and installed build dependencies. Prepare
an isolated npm cache for the exact peers named in `build.mjs`. Supply canonical
package tarballs and full installed-payload inventories rather than aliases into
an active worktree. Each output directory must be new; failures are retained.

```sh
node tools/adoption-workflow-lab/build.mjs /absolute/config.json /absolute/new-build
node tools/adoption-workflow-lab/run.mjs /absolute/new-build/manifest.json /absolute/new-checks check
node tools/adoption-workflow-lab/run.mjs /absolute/new-build/manifest.json /absolute/new-measurements measure /absolute/new-checks/manifest.json
```

The config has `sources.v15` and `sources.v16` commit IDs, `npmCache`, and
`artifacts.{v15,v16}.{kernel,angular}` entries containing `archive`, `sha256`,
`manifest`, and `manifestSha256`. Each package inventory contains `head` and
`files` (relative path to SHA-256). `build.mjs` verifies the archive, installed
payload, one resolved kernel per facade, and the actual bundled module inputs.
Consumers compile from one frozen source snapshot. Generated locks and build
manifests preserve each exact dependency graph and emitted artifact identity.

`check` executes behavioral oracles, injects four failures to check sensitivity,
and exercises the rendered UI at desktop/mobile widths. It must pass before
`measure`. Review the screenshots as well as the assertions. `measure` records
three alternating-order cohorts and a small same-artifact control. Reserve a quiet
host window; do not run other builds, test suites or performance jobs alongside it.

## Reading results

Construction and query-ready intervals include input creation and a synthetic
authority map. Query updates include full materialization of the selected rows
and grouped counts; the independent oracle runs outside the interval. Bulk writes
use each library's multi-row API. TanStack uses explicit join/filter indexes and
a small Angular subscription bridge, not its separately published Angular adapter.

CPU samples use fresh JavaScript page realms inside one reused Chromium process;
they are not full browser cold-start measurements. Heap cohorts run separately
with forced GC. Reclaimed editor WeakRefs prove wrapper release in the observed
case, not total internal library reclamation. Full retained heap changes include
runtime/cache effects and should be read with same-artifact controls.

These results cannot decide whole-app INP, human comprehension, mobile performance,
durable sync quality, or a universal library winner. A full-output query benchmark
also does not isolate incremental notifications or virtualized query windows.
See the [frozen protocol](../../docs/audits/2026-11-18-adoption-workflow/PROTOCOL.md).
