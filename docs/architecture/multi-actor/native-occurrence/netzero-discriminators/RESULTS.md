# Net-zero normalization supplement

Unchanged frozen source, 12 observational Nx cases (3 sequences × root/collection × observer off/on), all completed. Observer pairs and ordinary/physical field proofs match. No runtime changes. Output path is unique via ST_OBSERVATIONS; prior evidence untouched.

Command (candidate cwd): PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false ST_OBSERVATIONS=/private/tmp/st-native-netzero-discriminators/observations.jsonl corepack pnpm nx test kernel --skip-nx-cache native-netzero-diagnostic.spec.ts

## Native observations, before model oracle

1. q7 -> r(11,7): after write value7, q current, r.inspect changes empty. Rejectr leaves7 with no restoration; rejectq restores0. Publication proof after write/rejectr incorrectly retains destination r (pending then rolled-back), possible q. Only final0 delivered. Intermediate admissions do not establish a surviving r effect.
2. q7 -> r(11,13): after write13, q superseded/r current. Rejectr restores7 and q current; rejectq restores0. Publication proof at restored7 still names rejectedr as destination. Only final0 delivered.
3. q7 -> r(11,13) -> s19 confirmed: q/r superseded. Both rollback attempts refuse with SignalTreeRollbackError/later-confirmed-dependency; value19 and exact requirement identity remain unchanged, no delivery. This is NOT evidence that selective omission was executed. Preserved as a refusal control. The model's selective-omission case is conditional on an existing planner actually selecting that disposition; it does not assert a new allowed rollback policy.

## Algorithm correction

Original first-before/latest-after transfer is necessary but not sufficient. That rule describes capture normalization before native drain. At transactions.ts:1849–1854 and :2694 the actual settleTurnMemberEffects result determines whether the effect survives. plain-branch-membership.ts:553–563 removes equal endpoint/presence effects. Selection transfer must consume that actual normalized disposition in the same staged native installation before delivery; it cannot run solely per publication packet or assume the last admitted ambient r persists.

Executable model/model.mjs adds installDisposition: admitted uses normalized after; normalized-away uses native retained selection; selected-inverse uses exact normalized before; omitted/refused leave current selection untouched. The net-zero fixture establishes retained q is correct for THIS sequence. Do not generalize arbitrary equal endpoint values into q restoration: the production retained selection must come from native normalization/responsibility evidence, including segment and lifetime identity. The model does not fabricate that evidence.

For an omitted later-confirmed field, filter before inverse compilation and leave its current payload/support pair intact; other selected fields restore independently. The new model checks this sparse behavior separately from the empirically observed whole rollback refusal. No desired publication proof was used as a native settlement oracle.

18 standalone model tests pass, including the original14 and these4 added cases. Command: node --test model/model.test.mjs. No production integration, broader gate or review acceptance claimed. Prior model freeze remains unchanged. Source mapping continues in /private/tmp/st-transfer-join-model/SOURCE-MAPPING.md, supplemented by the drain sites above.

Review handoff: verify that native normalization can expose retained selection alongside disappearing effects, including canceled occupancy/derived fields; and that omitted/refused compensation cannot install metadata. This worker cannot dispatch Faraday; Main can supply this frozen evidence. Runtime remains unauthorized.
