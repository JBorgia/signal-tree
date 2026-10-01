---
applyTo: 'packages/**/project.json,packages/**/rollup*.mjs,packages/**/package.json,scripts/*publish*,scripts/*release*'
---

# Library build contract

Use the current Nx package build targets. A package build produces the final
runtime/declaration layout referenced by its manifest; do not repair missing
files with untracked post-build copies or declaration rewrites.

- Preserve ESM and consumer tree-shaking. Configuration spelling is not proof:
  validate actual consumer bundles and runtime behavior.
- Kernel runtime uses preserved modules; declaration identity is maintained by
  this branch's configuration. See [declarations](type-declarations-fix.md).
  Framework targets depend on kernel.
- Keep development diagnostics in published libraries behind foldable dev/config
  guards. Do not globally strip console calls and erase diagnostics for development
  consumers. Genuine error reporting is not automatically development-only.
- Build-time code and declaration output must share the intended source. Validate
  tarball file/exports coverage, strict consumers and Angular AOT where affected.
- Artifact finalization, including workspace dependency resolution, belongs to
  the canonical release path. It is distinct from ad hoc source/declaration copying.

See [release validation](../VALIDATION_GUIDE.md). Budget values and package lists
belong to executable tools, not copies in this instruction file.
