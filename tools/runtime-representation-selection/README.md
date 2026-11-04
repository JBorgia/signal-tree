# Architectural admission evidence

Non-shipping investigation; no new runtime, public export or registered release gate.
Baseline:9a9770a63 (frozen runtimefe18). See the architectural-alternatives audit.

`prefix-screen.spec.fixture` copies the original counter and adds an observation
callback plus a receiver-preserving wrapper around the existing native participant.
Sampling uses typed arrays; it adds no counted collection traversal. Copy it into
kernel/src/lib to run through `pnpm nx test kernel --skip-nx-cache --maxWorkers=1
--testFile=src/lib/<copied-name>.spec.ts`, Node24.15.0/pnpm10.17.0. Set
SPARSE_SCREEN_OUTPUT to a JSON output path. The native method is restored in finally.
`late-history.spec.fixture` is the public cross-tree confirmation/rollback oracle.
Remove copied specs afterward or use a disposable worktree.

`original-counter.ts` is the verbatim original helper with only an export added;
`original-counter.mjs` is its pinned-esbuild compilation. `counter-child.mjs`
executes the shared ordinary workload on a supplied built kernel entry. It sets
ngDevMode=false before import, asserts every changed endpoint and an untouched
row, exact width-copy controls and a7-charge control. Throws preserveundefined
and restore patched methods. It reports counts only, not timings or memory.

The preparation/guard scripts preserve original execution paths for replay;
edit root/path mappings in a new packet rather than overwrite the sealed records.
The24-child baseline-cost packet and generator are preserved in the audit evidence
archive. Original binding receipt metadata was wrong; read BINDING-CORRECTION.json.
Its actual arm roots and artifact manifests were correct. Never rewrite a started
registration or retry a cost cohort for a favorable outcome.

No source/package side effects should be inferred from these fixtures. Published
v15 is downloaded/unpacked in temporary storage without installation scripts;
its registry SHA512/SHA1 and file maps are verified. The stable line is unchanged.

The committed preparation script now emits correct published-artifact/frozen-build
provenance. The originally executed generator remains unchanged in the evidence
archive; its copied receipt mistake and correction sidecar are preserved. No
measured cohort was regenerated after this repair.
