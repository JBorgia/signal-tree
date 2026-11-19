# Fresh C22 installed-consumer qualification

Fresh five-package artifacts from the independently completed streamed build pass the installed consumer runtime identities and strict TypeScript checks under bundler and node16 resolution. consumers-network/RESULT.json records exit0 and unchanged source/artifacts. Node16 here names TypeScript module resolution; the test ran Node24.15.0.

First attempt failed writing the sandbox-excluded default npm cache; the generic root-owned-cache message was not independently established. Second attempt used a task-local cache but npm repeatedly failed registry DNS (ENOTFOUND). Only its verified npm child24533 was stopped, permitting parent failure/hash recording. The third run used the same task-local cache with authorized network access and passed. No global cache permission change occurred.

Command: NPM_CONFIG_CACHE=/private/tmp/st-c22-artifact-checks/npm-cache python3 /private/tmp/st-c22-artifact-checks/run.py consumers-network tools/verify-consumer-typecheck.mjs. Dependencies resolved by the existing consumer generator; npm lock/logs preserve those versions. This validates C22 artifacts, not later public API edits or release acceptance.
