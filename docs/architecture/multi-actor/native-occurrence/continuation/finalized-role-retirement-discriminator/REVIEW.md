# Executed retirement-predicate discriminator

Reproduced the representation mismatch in an isolated source-faithful model. First execution passed all model assertions (Node v24.15.0, exit 0). No C25 runtime imports, writes, successor, Nx suites or public-path defect claim.

The generator copies the exact C25 retirement predicate from `packages/kernel/src/lib/experimental-publication/entity.ts:247–268`, and exact `combineProofs`, `nativeProof`, composite/readiness and owner-source lookup functions from `.../lifecycle.ts:31,98–127,156–175`. EXTRACTION.json records full-file and extracted-span hashes; the raw source bytes are preserved alongside the model. All requirements in this model are already ready and all leaf proofs cached. Unresolved-frame helpers throw if reached; no validation/activation lifecycle is simulated.

Flattening constructs a separate ready leaf holding the exact union proof, removes component/getter ancestry, and preserves the root's own retirement flag, including absence. Every comparison asserts proof equality and preservation of root provenance. It models proposed representational equivalence, not a runtime correction.

| Case | Original | Flattened, preserving root provenance |
|---|---|---|
| Clean + clean | Retires | Retires |
| Own-window with confirmed possible cell + clean | Retires | Refuses |
| Own-window with rolled-back possible cell + clean | Retires | Refuses |
| Arbitrary unknown + clean | Refuses | Refuses |
| Own-window + arbitrary unknown | Refuses | Refuses |
| Own-window pending, source present + clean | Can release after settlement; waits | Refuses, no settlement subscription eligibility |
| Same pending cell, source disappeared + clean | Refuses | Refuses |

A deliberately unsafe additional variant invents `retirementOwnWindowOnly:true` for the flattened own-window + arbitrary-unknown composite. Its proof is still identical, but it incorrectly retires. Thus neither preserving only the absent root flag nor guessing true from one component establishes equivalent behavior.

A separate same-leaf control removes only owner registry storage while keeping the proof object and pending outcome unchanged. `canRelease` changes true→false and settlement-subscription eligibility true→false. This reproduces the source-availability dependency of `ownerCellCanTransition`; it does not execute notification scheduling or prove actual callback registration/release behavior.

Command:

`/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-finalized-role-retirement-discriminator/model.ts > /private/tmp/st-finalized-role-retirement-discriminator/first.log 2>&1`

Seven original/flattened comparisons plus unsafe-provenance and source-disappearance controls passed. `first.log` preserves all results. This establishes a mismatch for allowed ready requirement graphs under the extracted predicate. Reachability of this exact composite in public entity retirement remains unestablished. No listener, allocation, retention-bound, integration or release qualification follows.

## Final replay record and limits

Main independently reports Node24.15.0 `model.ts` exit 0. The preserved `main-replay.log` was inspected and is byte-identical to the first execution output; MAIN-REPLAY.json records its hash and attribution. No further execution or case expansion was performed by this reviewer.

Both executions establish only the extracted retirement-predicate distinction on constructed ready requirement graphs. They do not establish public-operation reachability, actual runtime normalization behavior, readiness/listener scheduling, memory reclamation, bounded retention, or integration acceptance. The mismatch is evidence against assuming proof-role equality alone preserves retirement; it is not a demonstrated public C25 defect.
