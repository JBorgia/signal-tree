# Repository Authority Map

This map answers whether a file is production, validation, historical, generated,
or disposable. It describes the current repository; it does not authorize a mass
relocation.

## Authority By Location

| Location                                                                                   | Role                                        | Authority and shipping status                                                                                                                            |
| ------------------------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/kernel/src/`                                                                     | Framework-neutral production source         | Ships in `@signal-tree/kernel`. Public exports are owned by `src/index.ts` and `src/adapter.ts`; unexported files are implementation details.            |
| `packages/angular/src/`                                                                    | Angular realization source                  | Ships in `@signal-tree/angular`. Framework behavior belongs here, not in the kernel.                                                                     |
| `packages/react/src/`                                                                      | React observation source                    | Ships in `@signal-tree/react`. SignalTree remains state authority.                                                                                       |
| `packages/kernel/src/lib/internals/utilities/`                                             | Kernel implementation utilities             | Ships only as internal preserved modules inside `@signal-tree/kernel`; never a package or public entry point.                                            |
| `apps/demo/`                                                                               | Product demo and integration consumer       | Not a library package. It must consume the current public API and is part of release validation.                                                         |
| `apps/react-reference/`                                                                    | React reference consumer                    | Not published. It validates the React package against a real consumer.                                                                                   |
| `packages/**/**.spec.ts`                                                                   | Colocated product tests                     | Not shipped. Tests live beside the behavior they prove unless a distinct runtime is required.                                                            |
| `docs/guides/`, `docs/overview.md`, root `README.md`                                       | Current consumer guidance                   | Release-visible documentation. Imports, symbols, versions, and links must pass current documentation gates.                                              |
| `docs/architecture/`                                                                       | Current architecture and measured decisions | Authoritative where the document declares a frozen or current disposition. Historical sections inside a current document must be labeled.                |
| `docs/archive/`, `docs/audits/`, `docs/rfcs/`, release notes                               | Point-in-time evidence                      | Historical, not current API guidance. Preserve rejected options and provenance; do not use these paths to infer the live surface.                        |
| `tools/check-*.mjs`, `tools/verify-*.mjs`                                                  | Validation candidates                       | A filename does not make a gate authoritative. A check gates release only when registered by `tools/verify-gates.mjs` or invoked by the release scripts. |
| `tools/bench-*.mjs`, `tools/measure-*.mjs`                                                 | Measurement generators                      | Authoritative only for the specific figures and workload the generator defines. Published numbers must name their generator.                             |
| `tools/probe-*.mjs`, experimental candidates                                               | Investigation                               | Non-shipping evidence. Promotion requires a recorded disposition and an enforced consumer or release gate where appropriate.                             |
| `scripts/prepare-release.mjs`, `scripts/publish-candidate.mjs`, `scripts/release-plan.mjs` | Release operations                          | Preparation authority, sole registry publisher, and ordered package authority. Shell scripts are compatibility wrappers.                                 |
| Other `scripts/` files                                                                     | Operational wrappers or legacy reports      | Not authoritative by location alone. Check callers in `package.json`, workflows, release scripts, and `tools/verify-gates.mjs`.                          |
| `specs/`                                                                                   | Historical audit-process specifications     | Not product tests and not the current public contract. Treat as audit evidence pending any later archival move.                                          |
| `api/`                                                                                     | Hosted benchmark API functions              | Deployed support surface, not package source.                                                                                                            |
| `dist/`, `coverage/`, `artifacts/`, `tmp/`                                                 | Generated/local output                      | Never source authority. `dist/` is rebuilt for package verification; `artifacts/` is scratch and must not source published metrics.                      |

## Where New Work Goes

- Production behavior: the owning package under `packages/*/src/`.
- Product tests: beside the owning source as `*.spec.ts`; typing exclusions use
  the repository's dedicated typing specs and typecheck targets.
- Release checks: `tools/` for the check implementation, then explicit
  registration in the release gate or publish path. An unregistered checker is
  evidence, not enforcement.
- Benchmarks: `tools/bench-*.mjs` with workload, sampling, collection, and numeric
  claim provenance stated in the generator or its owning document.
- One-off experiments: keep them non-exported and label their disposition. Delete
  them after closure when they add shipping cost; preserve only evidence needed
  to explain or reproduce a decision.
- Current consumer guidance: root/package READMEs or `docs/guides/`.
- Rejected designs and point-in-time audits: the existing archive, audit, or RFC
  history surfaces. Internal decided work belongs in `TODO.md`, not a new RFC.

## How To Determine Authority

Do not infer authority from a plausible filename. Check in this order:

1. Is the file tracked and reachable from a public package entry point?
2. Is it included in the built manifest and packed tarball?
3. Is a tool invoked by `package.json`, a workflow, a publish script, or
   `tools/verify-gates.mjs`?
4. Does current documentation identify the file as a generator or frozen
   decision source?
5. Is the path explicitly historical, generated, ignored, or non-exported?

When answers conflict, package manifests and executable release gates decide what
ships; `RELEASE-1.0.md` decides current release status; `AGENTS.md` decides agent
workflow. A conflict is a repository defect to resolve, not permission to choose
the most convenient source.

## Pre-GA Boundary

Before GA, clarify ownership and remove release-visible ambiguity. Do not perform
bulk relocation merely to make the tree symmetrical. A move belongs on the
release path only when it fixes a demonstrated package, artifact, documentation,
validation, or contributor-routing failure and updates every caller in the same
change.
