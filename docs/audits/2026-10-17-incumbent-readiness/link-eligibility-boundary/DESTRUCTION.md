# Link destruction boundary

Source HEAD `7c511c2b59e803b065b2a674e0f7b0a897f85145`. Read-only repository; disposable research build. Six controls run both against unchanged kernel source and delivery-followup in-memory transform. 42 observation checks pass. These classify existing behavior, not six fulfilled terminal-cleanup requirements. No runtime change.

## Governing evidence

- `packages/kernel/src/lib/link-reactive-settlement.spec.ts:534–580` explicitly accepts either zero outbound sends or the single value queued before tree destruction. Commit `079dd04ffa60acdf28f031f312d559ed247f27cd` deliberately stopped pinning destroy keeping Links alive. It does not demand automatic disposal either.
- `docs/audits/2026-10-01-v16-integration/PROGRESS.md:1483–1486` already records a held-send `settled()` hang on destruction due to dropped commit consequences; classified as deferred destroy-disposes-Links work.
- `docs/audits/2026-09-23-validation-instrument-corrections.md:211–214` distinguishes explicit disposal plus destruction GC from unproven automatic disposal of independently held relationships.
- `link.ts:898–925` dispose withdraws held consequences, releases held promises, waiting sends, settlement waiters, order promises and retrieval waiters before user cleanup. `link.ts:978` explicitly says disposal releases the local wait, not endpoint operation/acknowledgement.
- `signal-tree.ts:2002–2021` destruction terminates owner invalidation and runs registered cleanups. Link does not register its dispose with tree cleanup. Transactions cleanup (`transactions.ts:4327–4333`) calls `cancelCommitScopes`.
- `commit-consequence.ts:294–309` terminal teardown deletes held consequences and settlement listeners without running them. Link-local held promises remain unresolved. This explains the prior hang without treating all surviving Link work as forbidden.

## Actual results (identical baseline/experiment)

| Action | Work state | Subsequent sends | Existing settled waiter |
| --- | --- | --- | --- |
| tree.destroy | queued eligible42 | sends42 | resolves after send |
| tree.destroy | unknown42 held by pending x7 | none | still pending; explicit dispose releases |
| tree.destroy | already started42 | completion42 allowed | pending until acknowledgement |
| connection.dispose | queued42 | none | resolves |
| connection.dispose | held42 | none | resolves |
| connection.dispose | already started42 | completion42 allowed | resolves before acknowledgement |

Tree destruction leaves the separate inbound subscription attached in these samples; explicit outgoing disposal does not own that separate incoming relationship either. `unsubscribed:0` must not be read as failure of outgoing.dispose. The fixture subsequently disposes both independently owned connections.

The queued42 send after tree destruction is **permitted by established tests**, not a newly proven production violation. The held waiter is a **reproduced known lifecycle gap**, not introduced by eligibility or delivery research. Automatic tree destruction cancellation of all relationships would require deciding their ownership/lifetime contract; current evidence does not authorize making destroy equivalent to dispose.

Each false waiter observation is after100 microtasks, not a timed impossibility proof. Source explains why the held promise has no destruction release path; explicit disposal proves it is usable and distinguishes lack of waiting time from terminal release. No endpoint request is claimed retractable. No retained-heap claim.

## Replay

Node24.15.0. `loader.mjs` copied from delivery follow-up and only output directory changed. `BASELINE=1` loads all original kernel source without transforms; `receipts.json` records experimental substitution counts and source hashes. Both builds retain original emitted bundles and traces.

```sh
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
node /private/tmp/link-destruction-boundary/check.mjs
BASELINE=1 node /private/tmp/link-destruction-boundary/loader.mjs
node /private/tmp/link-destruction-boundary/loader.mjs
```

The loader uses its saved original absolute repository/output paths. For unchanged replay without rebuilding, import `baseline-bundle.mjs` or `bundle.mjs` and call `run()`. Source fixture, logs and hashes are preserved in this directory. These are disposable public-API research probes, not an Nx package-suite result. No broad suites run.
