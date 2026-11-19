export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false
export ST_PREPARED_REVIEW_OUTPUT=/private/tmp/st-packet-admission-refusal-independent
cd /private/tmp/st-packet-admission-refusal-independent/candidate
corepack pnpm nx test kernel --skip-nx-cache admission-refusal.spec.ts packet-admission-r1.spec.ts packet-index-adversarial.spec.ts packet-index-review.spec.ts native-admission-handoff.spec.ts native-invocation-handoff.spec.ts structural-admission-controls.spec.ts structural-admission-sequence.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-acceptance.spec.ts --maxWorkers=1
