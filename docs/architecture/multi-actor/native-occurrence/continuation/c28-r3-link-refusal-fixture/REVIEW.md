# Link refusal fixture: bounded test-only correction

Frozen for independent review. Whole file passes 7/7; spec-types exits 0. Exact R3 runtime/configuration unchanged. No dynamic-admission or per-unit realization repair is composed.

Base manifest e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3. Final manifest 0000bfbe3c8c14a75e77eb39796796fe839bb17172c550005a998d7fa4716c9f. TESTS.patch SHA256 175ef27ba7747d0a0292c425a73457ee5fa5b433c89b1fea7187dd65d847e7cb. All manifested files except packages/kernel/src/lib/link-commit-ordering.spec.ts remain exact base hashes, verified after gates.

The original whole-file replay is preserved in runs/original-first: 6 pass, 1 fail, expected rollback function to throw at original line193. Byte-exact original is originals/link-commit-ordering.spec.ts. The original validateEffects replacement did not inject refusal on selected scalar rollback. Prior reviewed packet /private/tmp/st-c28-r3-refusal-fixtures supplies the same reached selected-preparation technique; its verdict was not used as a substitute for this replay.

The correction installs a typed prepareSelectedUnit wrapper immediately before rollback. First invocation throws an injected Error before calling the real preparer. Any subsequent invocation forwards the exact argument tuple and receiver. Assertions require exactly one invocation and zero returned plans, unchanged physical a1/b0 state and identical nonempty pending snapshot. The original method is restored in finally before the original unrelated write and real rollback retry. This is generic pre-install refusal, not a fabricated authentic structural-drift witness.

Every original assertion line is preserved, including refusal, held persistence after unrelated b write, useful eventual transport and exact a0/after-refusal payload. Other six cases are unchanged. Added state/pending reads are inspection only, with no pending-owner or transport bypass. No runtime, API, config, baseline or discovery change.

Commands (pinned Node24.15.0/pnpm10.17.0 via run.py, own Nx caches/TMPDIR, 180s owned-group bound):

- Original and corrected: corepack pnpm nx test kernel src/lib/link-commit-ordering.spec.ts --skip-nx-cache --maxWorkers=1.
- Types: node tools/check-spec-types.mjs.

runs/corrected-first: 7/7, exit0. runs/spec-types-first: exit0. All three runs report sourceUnchanged:true, timeout:false. Exact command/process records and raw logs preserved. Existing archived-tsconfig warnings and three preexisting spec-baseline improvements remain visible; no --update used.

No blocker demonstrated in these falsifiers. No full suite/build/performance/release verification. Independent review requested separately after dynamic source review; this fixture packet is not general runtime acceptance.
