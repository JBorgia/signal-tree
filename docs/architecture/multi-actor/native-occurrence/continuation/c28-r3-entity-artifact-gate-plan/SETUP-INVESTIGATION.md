# Setup gap investigation and revision 2

Read-only investigation; no dependency fetch, pack, install, build, gate, or runtime test was executed. Only this plan packet was changed.

## Findings

- Frozen `.github/workflows/validate.yml:29-53` provisions pnpm, reads Node from `.nvmrc`, caches `pnpm`, performs frozen root installation, and invokes both default gates and selftests. `release.yml:54-76` and `publish.yml:90-127` use the same dependency setup. No step provisions a complete npm offline cache. The current working-root workflows have the same relevant setup. There is no `ci.yml`; `validate.yml` is the relevant default gate workflow.
- `tools/verify-consumer-typecheck.mjs:528` uses npm install in a fresh packed consumer, with registry fetching permitted. It selects some ranged peers, so its exact selection policy is not sufficient for this task's pinning requirement.
- `tools/verify-angular-aot-consumer.mjs:204-300` packs/installs into a disposable directory, reads the resulting npm lock, checks name/version and the supplied tarball's SHA512 SRI against the installed lock entry, and checks the facade resolves the installed root kernel. This is the established consumer identity mechanism to reuse.
- `tools/verify-tarball-consumer.mjs:121-170` only tests resolution; its legacy-peer-deps/no-package-lock choices are not suitable for executable pinned peers.
- The existing manual candidate consumer's package-lock v3 has 38 package records: root, five SignalTree tarballs, and 32 registry records, each with integrity. Its direct specifiers use carets and its SignalTree paths point at temporary candidate tarballs. It is evidence of the dependency footprint, not a suitable permanent lock to copy blindly.
- `packages/kernel/project.json` defines `test` as `nx:run-commands`, command `node tools/run-core-vitest.mjs`, `forwardAllArgs: true`. The runner forwards ordinary positional arguments to `pnpm exec vitest run --config vitest.config.ts`, with cwd `packages/kernel`. The revised example uses `src/lib/...` positional filters. No CLI execution was performed and no test-selection success is claimed.

## Concrete correction

Remove the offline npm install/cache prerequisite. Permit registry dependency fetches during setup, matching existing consumer gates. Preserve local-only runtime workloads without inventing a network sandbox requirement.

To make exact peers AND their transitive integrities reproducible on a clean checkout, add a small npm-generated peer-only manifest/lock fixture, use npm ci, then install the fresh local tarballs and require the non-SignalTree lock graph to remain unchanged. This adds two metadata files to the planned patch; it does not vendor packages, resolve dependencies in custom code, add project dependencies, or change CI cache infrastructure. A per-run freshly resolved lock would only record drift, not prevent it.

Use the same lock for baseline, mutant and recovery. npm/cache/registry failures are setup errors, never semantic mutation evidence. A cold cache with working registry is a supported setup; an unavailable registry with cold cache is an expected infrastructure failure.

## Precise next step before gate implementation

In a disposable location, generate and review the peer-only lock with npm from the eight exact peer versions, qualify cold-cache npm ci + installation of the five existing candidate tarballs, verify unchanged peer/transitive identities and tarball integrities, and replay existing manual installed/bundled cases. Verify a second cold-cache install and an unavailable-registry setup failure. No canonical rebuild or runtime-source edit is required for that setup qualification. Do not implement or wire the default gate until those checks pass.

This revision resolves the provisioning design gap. Because the request was read-only investigation, it does not claim that the new peer lock or cold-cache qualification has already been produced/executed. PLAN.md includes that concrete acceptance step, the corrected positional command, and the retained 20-case/mutation obligations.
