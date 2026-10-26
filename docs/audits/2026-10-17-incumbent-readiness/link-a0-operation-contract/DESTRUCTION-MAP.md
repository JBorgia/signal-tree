# Link destruction versus disposal map

Read-only frozen f01ed39a and production87 source/test inspection October26. No tests or new policy. Source destroy does **not** implicitly call connection.dispose: neither link.ts has registerCleanup binding to tree.destroy. Explicit connection cleanup and tree authority cleanup remain separate.

| Work / event | Established behavior and source | Qualification |
| --- | --- | --- |
| Armed ordinary work, explicit dispose before invocation | link-lifetime.spec.ts30–47 expects zero sends and settled resolves. link.ts1050–1087 sets disposed first, withdraws held consequences, unsubscribes observation, cancels waiting sends/orders, releases all local waiters before endpoint cleanup. | Existing public contract, production and candidate source preserve structure. |
| Already-started endpoint request, explicit dispose | source settled1131 exits when disposed; disposal releases local chain waiters. Endpoint promise is not canceled; its later completion must not start another send because run checks disposed. | Disposal controls in archived delivery targeted.ts dispose-started; no promise of network cancellation/server rollback. |
| Already-started request, source tree destroy with connection retained | archived lifecycle/destroy.ts tree-destroy-inflight explicitly expects unsettled before ack, settled after ack; source destroy does not dispose relationship. | Tested bounded declaration experiment, not automatic source→dispose policy. |
| Queued ordinary send, source destroy | archived lifecycle/destroy.ts tree-destroy-queued allows zero or one pre-destroy value. destroy terminates source invalidation/registered authority cleanup; scheduling race may already own pending observation. | Existing witness intentionally weak; no deterministic cancellation or delivery promise established. Do not upgrade it to zero-sends assertion without decision. |
| Held declaration dependency, source destroy | archived destroy.ts tree-destroy-held requires only explicit dispose eventually releases waiter; comment names known held-waiter gap. It does not require afterDestroy settlement or terminal rejection. | Unqualified gap, not safety/progress pass merely because dispose succeeds. |
| Foreign dependency owner tree destroy | transactions4930 unregisters experimental owner source before discarding pending native turns. lifecycle.abandonOwnerSource27–31 removes registry ownership/pending-set entries, clears source map and wakes; it deliberately does not assign terminal outcome. Existing Operation owner references can still point to cells whose outcome remains pending. | Cannot equate disappearing registry pending count with confirmed dependency. Foreign held operation may remain conservative/pending until explicit connection dispose; no useful auto-progress guarantee proved. Need explicit policy if A0 claims more. |

## Why owner cell removal is not settlement

lifecycle.ts2 terminal model includes pending/confirmed/rolled-back/abandoned. ownerTransition14–25 preserves terminal irreversibility; abandonOwnerSource comment says unregister storage only. A retained cell still carries its own outcome. Connection operations/receipts may hold references independently of sources map. finish/reconcile must not infer independence merely because tree registry disappears. Production87 has no experimental dependency cells; its destruction behavior cannot authorize a new foreign-owner policy.

## Native authority/held consequence cleanup

transactions.ts4930–4949 marks destroyed, unregisters research owner, releases confirmed authority, cancelCommitScopes, discards pending turns and clears capture metadata. commit-consequence.ts completion255–285 releases held callbacks once no open scope; cancellation309 clears scopes through existing owner cleanup. Those callback releases do not dispose Link or fabricate a dependency result. Source tree.destroy(signal-tree.ts2003–2024) runs registered cleanup functions but leaves tree.$ accessible and no connection registry ownership implicit.

## Required A0 contract separation

A0 can preserve explicit dispose: no future sends, release local waiters, no network cancel guarantee. It must not claim source destruction means disposal, nor interpret abandoned registry entry as confirmation. Retained source connection and foreign-owner destruction need accurate observable states and a separately stated lifetime rule if changing the known hold gap. No new policy selected here. Existing first receipt GC witnesses assess collectibility after both c.dispose and t.destroy; they do not prove source destruction alone releases connections.

History evidence: inspected production link.ts898 disposal/963 settled and frozen candidate1050/1131 retain explicit distinction. Recent history lookup for link-lifetime shows protective snapshotd2218eb0; no introduction commit for destruction semantics established. Original assertions remain unchanged.
