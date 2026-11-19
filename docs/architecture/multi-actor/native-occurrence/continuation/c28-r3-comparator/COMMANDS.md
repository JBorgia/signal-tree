# Reproduction commands

Use python3 run-focused.py <unique-run-name> test kernel <explicit files> --skip-nx-cache --maxWorkers=1. Runner pins toolchain, owns cache/tmp and process group180s deadline. Each original COMMAND.json retains exact argv/cwd/runner env; SOURCE.json and RESULT.json record source invariance.

Final main gate files:
comparator-lifecycle-r3.spec.ts approved-current-obligation.spec.ts public-sibling-current-obligation.spec.ts current-cutoff-r2.spec.ts current-validation.spec.ts cached-current-input.spec.ts opaque-current-input.spec.ts scalar-horizon-lifecycle-controls.spec.ts

Required A/B output: ST_TWO_HISTORY_OUTPUT=/private/tmp/st-c28-r3-comparator/FINAL-AB.jsonl.
Optional outputs used: ST_PUBLIC_SIBLING_OUTPUT=.../FINAL-SIBLING.jsonl, ST_CACHED_INPUT_OUTPUT=.../FINAL-CACHED.jsonl, ST_OPAQUE_INPUT_OUTPUT=.../FINAL-OPAQUE.jsonl.

Original diagnostic: python3 diagnostic/run-focused.py final-original test kernel repeated-no-write-roots.spec.ts --skip-nx-cache --maxWorkers=1
Required output: ST_NO_WRITE_ROOTS_OUTPUT=/private/tmp/st-c28-r3-comparator/diagnostic/FINAL.jsonl.
Use new output paths/run names when replaying; never overwrite preserved raw artifacts.

Initial before-public run incorrectly used ST_AB_OUTPUT. That runner failure remains; before-public-env-corrected uses ST_TWO_HISTORY_OUTPUT. No source/oracle fix was made for that failure.
