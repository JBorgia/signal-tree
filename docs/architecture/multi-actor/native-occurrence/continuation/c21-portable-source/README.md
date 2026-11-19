# C21 portable source preservation

This is the frozen C21 source/build/test subset, **not an accepted integration or
release artifact**. Runtime remains experimental. Original full-run failures and
incomplete qualification are unchanged.

The [identity](IDENTITY.json) pins the complete candidate manifest and the
self-contained compressed source payload. All 1,738 scoped files are included;
reconstruction does not need a temporary candidate, historical patch chain or
available git baseline. The [full target hash list](TARGET.json) retains broader
candidate identity; historical documentation outside the scoped whitelist is not
in this payload. A separate verified supplement supplies the two configured demo
guide assets; `restore.py` installs both after the source subset. The [overlay inventory](PORTABLE-OVERLAY-REQUIRED.json) records
335 differences from retained production for provenance, not reconstruction.

The original [preservation audit](../c21-reproducibility-audit/REPORT.md) found
omitted temporary source bundles. This checkpoint closes source-byte preservation
for the stated subset; it does not make all historical experiments portable.

## Reconstruct and verify

With Python 3, run `python3 restore.py /absolute/path/to/empty-directory` from
this directory. The script checks archive identity, exact member names, all file
hashes and modes before writing, then verifies the reconstructed files. It
refuses a nonempty destination. It does not install dependencies or modify git.

Use Node 24.15.0 and pnpm 10.17.0, as pinned in the reconstructed manifests.
Install dependencies there using `pnpm install --frozen-lockfile`; network/store
availability is separate from source preservation. An existing dependency store
can be supplied for local checks, but that is not an offline-install guarantee.

`replay.py SOURCE NEW_OUTPUT pnpm_arguments...` verifies source identity before
and after the explicitly selected command and records its command, log and exit.
For example, use `run typecheck:source`, or `nx test kernel --skip-nx-cache
--maxWorkers=1 --testFile=src/lib/readonly.spec.ts`. This wrapper does not assert
that exit zero means a nonvacuous test pass; inspect file/case counts. It has no
watchdog and is **not** the full-run watchdog harness.

The external preload redirects the frozen test's historical diagnostic output
path into the new evidence directory. No source test is changed. The wrapper
replaces inherited `NODE_OPTIONS` deliberately and records that choice.

## Executed preservation check

Main ran `restore.py /private/tmp/st-c21-portable-reconstructed` using only the
repository payload and scripts: all 1,738 hashes and modes matched. A root
`node_modules` symlink supplied existing dependencies; there was no clean network
installation. The portable wrapper then ran `run typecheck:source`, which passed
with all source hashes unchanged. Raw results are in
[the preservation typecheck record](../c21-portable-types/RESULT.json).

Archive size is 4,626,150 bytes for 18,231,369 uncompressed file bytes. These are
preservation sizes, not application bundle measurements. Framework/build,
full-suite, docs-complete and package qualification are not established by this
reconstruction/typecheck result.

The corrected run-owned output wrapper also executed the unchanged readonly and
fixed-window-retirement tests from a second clean reconstruction: **18/18 passed**,
with source hashes unchanged. [Raw run](../c21-portable-focused/RESULT.json).
This is a focused replay check, not full-kernel or demo-build acceptance.

The final ordinary-output wrapper also ran `public-selected-unit.spec.ts` with
its required run-owned `ST_PUBLIC_DIAGNOSTIC_OUTPUT`: **4/4 passed**, all 1,740
source/asset hashes and modes unchanged. [Raw result](../c21-portable-public-unit/RESULT.json).
Specialized GC arms remain separate and are not enabled by this generic wrapper.
