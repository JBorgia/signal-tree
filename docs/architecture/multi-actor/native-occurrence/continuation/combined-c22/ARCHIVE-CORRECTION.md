# Archive traversal correction

The first archive refresh skipped `runs` after a log-only run named `packages`
was added. The helper mistook any child named `packages` for a source checkout.
It now identifies excluded source checkouts by `packages/kernel/package.json`.
The complete C22 run directory was re-archived and its hashes recorded. No first
log or runtime source changed. The source pack remains a separate explicit
archive; its payload does not depend on this traversal heuristic.
