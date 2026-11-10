# TODO

The current v16 candidate decision is **NO-GO** in
[RELEASE-CURRENT.md](RELEASE-CURRENT.md#current-disposition--reject-the-packed-candidate).
The [application economics audit](docs/audits/2026-11-10-release-economics/README.md)
closes the requested ordinary-budget and equivalent-workflow comparison.

Required corrections for any successor candidate, under the unchanged registered
workloads: reduce coordinated pending-state representation below 32 MiB for eight
sessions; reduce coordinated start work below 4 ms p95; break the finalizer-held
derived dependency retention; bring first state initialization below 25 ms.
Preserve late readers, independent publication, reentry, entity lifetime and the
original point-work bound. Repeat exact-artifact qualification only after the
acceptance failures are corrected. These are reopening conditions, not an
unbounded queue of speculative micro-optimizations.

Cleanup is part of that work: consolidate repeated setup and active instructions,
preserve meaningful tests and first failures, and serialize heavy jobs. Do not
start another architecture competition or reopen B.

Historical entries and prior decisions are preserved byte-for-byte in the
[November 3 queue archive](docs/archive/2026-11-03-active-queues/TODO.md.before.txt),
with [checksums](docs/audits/2026-11-03-progress-and-workflow/QUEUE-ARCHIVE.json).
That archive is not a pending task list. Stable v15 and unrelated work remain
unchanged. No publication authority follows from qualification alone.
