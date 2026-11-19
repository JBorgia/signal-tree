# Deferred only — no commands executed

After Main freezes the runtime candidate, apply only TESTS.patch in its disposable composition, preserving baseline and patch hashes. From that root with Node24.15.0/pnpm10.17.0:

```sh
pnpm nx test kernel equal-owner-public-adversaries --skip-nx-cache --maxWorkers=1
```

Expected discovery: one file, six cases (it.each generates two; four additional it cases). Use Main-owned cache/TMPDIR/output/watchdog. Save exact argv/environment, source before/after and first log. No automatic retry. Existing source/spec gates remain required when Main authorizes them; this packet changes no config or type baseline.

No source execution, typecheck or runtime verification has been performed during preparation. A fixture/tooling/type failure is not automatically a runtime safety result; retain it before any correction.
