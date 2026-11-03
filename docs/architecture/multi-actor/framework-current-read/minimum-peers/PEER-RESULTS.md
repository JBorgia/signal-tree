# Frozen current-reader candidate: installed minimum peers

All requested peers pass. These are disposable installed consumers of the frozen candidate, not production activation or release acceptance. No root dependencies/source, frozen candidate, package tarball, or browser reference was edited.

| Installed peer | TypeScript | Strict Bundler | Strict Node16 | Public runtime | Angular full AOT |
|---|---|---|---|---|---|
| Angular 20.0.0 | 5.8.2 | pass | pass | 8/8 | pass |
| Angular 21.0.0 | 5.9.3 | pass | pass | 8/8 | pass |
| Vue 3.5.0 | 5.9.3 | pass | pass | 8/8 | not applicable |

All strict consumers use skipLibCheck=false. They import exported package roots and the public kernel/adapter type contract, assert exact selected carrier type, native writable leaf shape, readonly query assignability, and generic current-reader capability result. No any, source aliases, ambient package declarations or ts-ignore/expect-error suppression. Runtime transpilation is separate from these strict type gates; the replayed runtime test bodies are not claimed strictly typechecked.

## Exact artifact and source identity

Handoff: CANDIDATE-HANDOFF.md, frozen 2026-10-29T19:26:57.919948+00:00.

- Artifact manifest SHA256: fee0a010942dd933b7cb421bf3f353131e957a903eb3bf2205c35f4486f3f4b8
- Source identity manifest SHA256: 10a5d0a4548e7e2da88328d072e0b6b3878633298bd356aee8849ab973614d72
- Kernel tarball: 82a290a27e3f6ad238cada0cc84a86c4160e3d405157ba67eb093baa059b8293
- Angular tarball: f45b5424ecd0ca1c50eed61ffb377f423475fe7a9c51e7467cf0be8da7abc25d
- Vue tarball: 528c6a40340b9b4bcfa1cdc0eed38dba174c5d8bd1712ba205a941fcd0d71867

replay.py verifies all source-manifest entries, tarball SHA256, every installed package file against its tarball, and consumer/control/lock hashes before running. It uses pinned Node24.15.0. CONTROL-IDENTITY.json pins the exact fixture inputs. Frozen package manifests were not rewritten; explicit local kernel+facade tarballs installed successfully together offline.

## What runtime controls establish

Six cases per peer replay selected-callback-facade.spec.ts with only import translation and TypeScript emission: fresh callback queries and retained readers across writes; ordinary granularity and warmed native-computed timing; callback selection followed by rekey; callback selection followed by clear; retained native metadata identity; counted query evaluations through held ABA plus own-query exact error recovery. The original test bodies/assertions are preserved. Minimal node:test/assert adapter implements the four used assertions; toThrow requires exact error identity, stricter than message matching. it.each expands two cases.

Two additional independent public tests per peer establish fresh native dependency error propagation (exact sentinel) and recovery inside an actual rollback tap, and final correctness of a native computed born during callback ABA. Callback counts prevent vacuous passes. All trees and tap registrations are cleaned up. No adapter implementation or kernel internals imported; Angular SIGNAL metadata access uses Angular's exported primitives/signals entry point.

Angular AOT is a real standalone component with strict template checking and public facade .set, selected read, and teardown compiled by each installed peer's compiler-cli in full compilation mode. No JIT workaround. It is compilation evidence only: no DOM/rendering, DI lifecycle runtime, or scheduled Angular effect delivery claim. Vue controls exercise computed timing; they do not constitute exhaustive watcher scheduling coverage.

## Reproduce without rebuilding packages

    python3 /private/tmp/st-current-reader-peer-matrix/replay.py

Each invocation creates a timestamped log directory and records actual commands/exits. Initial separate gate results: RESULTS.json and *-first.log. No failed type/runtime/AOT case occurred in the first run; the earlier preparation DNS failure remains registry-angular20.log and is an availability failure, followed by successful authorized fetch. Do not conflate it with candidate behavior.

This covers exact minimum versions Angular20.0.0/21.0.0 and Vue3.5.0. It does not prove all versions in a semver range, Angular22 by inference, SDK publication readiness, all four facades, or native-candidate/release acceptance.
