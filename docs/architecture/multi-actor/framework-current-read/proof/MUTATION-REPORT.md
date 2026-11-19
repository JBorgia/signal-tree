# Executed mutation qualification

All five classes were executed as real source mutations, with unchanged test oracles.
These qualify the targeted Angular oracles, not every facade/peer combination.
Runner: `python3 proof-evidence/run-mutants.py`; exit 0 means all five test runs exited 1 and source was restored after each.
Exact argv, source/mutant hashes and restoration outcomes: [results.json](mutations/results.json).
Stable 21-file source set: [SOURCE-IDENTITY.json](SOURCE-IDENTITY.json).

| Class | Actual observed falsifier | Exit | Evidence |
| --- | --- | --- | --- |
| cached-current | Retained selection stays A after callback selects C. | 1 | [patch](mutations/cached-current.patch), [raw log](mutations/cached-current.log) |
| per-read-metadata | Repeated Angular SIGNAL metadata is not reference-identical. | 1 | [patch](mutations/per-read-metadata.patch), [raw log](mutations/per-read-metadata.log) |
| premature-publication | Warmed app selection exposes A inside held callback; expected X. | 1 | [patch](mutations/premature-publication.patch), [raw log](mutations/premature-publication.log) |
| dropped-tracking | App computed stays X after publication; expected C. | 1 | [patch](mutations/dropped-tracking.patch), [raw log](mutations/dropped-tracking.log) |
| overwritten-callback-writes | After callback completes, selection reverts to A/1 instead of C/9. | 1 | [patch](mutations/overwritten-callback-writes.patch), [raw log](mutations/overwritten-callback-writes.log) |

Every exit 1 above is an executed Vitest assertion failure, not typecheck, setup, or timeout failure.
No class is labeled qualified merely because an assertion exists. Historical failures remain preserved separately; these runs provide current-source qualification.

## Exact commands

CWD `/private/tmp/st-current-read-capability-proof`; Node v24.15.0 first on PATH; `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false`.

### cached-current

```sh
corepack pnpm nx test angular --skip-nx-cache -- selected-callback-facade -t 'realizes fresh tap reads' --maxWorkers=2
```

### per-read-metadata

```sh
corepack pnpm nx test angular --skip-nx-cache -- selected-callback-facade -t 'retains coherent native metadata' --maxWorkers=2
```

### premature-publication

```sh
corepack pnpm nx test angular --skip-nx-cache -- selected-callback-facade -t 'keeps ordinary selected observation granular' --maxWorkers=2
```

### dropped-tracking

```sh
corepack pnpm nx test angular --skip-nx-cache -- current-read-capability -t 'source-linked producer preserves held' --maxWorkers=2
```

### overwritten-callback-writes

```sh
corepack pnpm nx test angular --skip-nx-cache -- selected-callback-facade -t 'realizes fresh tap reads' --maxWorkers=2
```

## Restoration

The runner saved each baseline file, applied one mutation at a time, restored in `finally`, and verified all three touched-file hashes after each run.
All 21 source/test hashes match Hume’s reviewed manifest after the complete run.
Post-restoration focused Nx run: exit 0, 46 passed across 8 files; [log](restored-focused.log).
Frozen canonical build artifacts were never mutated or rebuilt from mutant source.
Source, tarballs and declaration bytes are frozen for the peer matrix.
