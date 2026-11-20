# Spec test support

Shared helpers for behavior-tagged spec tests (tests whose titles carry a
BRIEF.md 5.1 or 5.2 ID, such as `[T3]`). A file with tagged tests may import
only from:

- a package's public entry point (an export of `packages/*/package.json`),
- this directory, or
- a module from outside this repository (`node:` builtins and third-party packages).

`vi.mock()`, `vi.importActual()` and similar calls count as imports.
`node ci/spec-tests.mjs check` enforces this in CI. This directory is
code-owned, so changing a helper here needs Jonathan's review, the same as
changing a tagged test.
