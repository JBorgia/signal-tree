# Narrow AG-UI dispatch proposal adapter

This experiment consumes the documented AG-UI `RUN_STARTED`, `TOOL_CALL_START`,
`TOOL_CALL_ARGS`, `TOOL_CALL_END`, `RUN_FINISHED` and `RUN_ERROR` shapes. It is a
bounded subset, not a complete AG-UI implementation or a released API. Source:
[AG-UI events](https://docs.ag-ui.com/concepts/events), consulted October 29, 2026.

A host configures the sole tool `propose_dispatch`, a proposal builder and optional
declared actor context. Streamed JSON arguments contain a `patch` and optional
`reads` array. Completing the tool creates an operation in **draft** status.
It never grants approval, delivers a command, confirms a native transaction or
applies state snapshots. An application must separately review, approve and execute;
the backend checks its own permission and versions at application time.

One adapter owns one run. Tool IDs are unique within that run; operation IDs encode
thread/run/tool IDs. The host must ensure run identities are unique within its
backend idempotency domain. Limits bound call count and accumulated argument bytes.
Completion/disposal releases stream buffers; operation lifecycle is separately owned
by the coordinator. Stream termination is not command completion. Late/unsupported
state or approval events are rejected. This consumer expects parsed protocol data,
not hostile JavaScript objects/proxies; it does not authenticate the remote producer.

```sh
node --test tools/experiments/multi-actor-operations/protocol/ag-ui.test.mjs
```

The five initial controls cover fragmented arguments and explicit consent,
untrusted state events, invalid/oversize arguments, identity/terminality and
host-vs-tool attribution. No HTTP/SSE transport or full SDK conformance is claimed.

Independent review added four adversarial controls. Two first failures exposed
disposal during proposal creation and recursive tool completion; they remain in
[first-failures](first-failures/). Explicit completion phases and a post-callback
lifecycle check correct them. The unchanged review suite plus original tests now
passes 9/9 under `node --test tools/experiments/multi-actor-operations/protocol/*.test.mjs`.
This does not upgrade the adapter to full AG-UI conformance.

## Bind inputs before delayed production

The host must bind the data/version observation actually supplied to a producer.
Capture that packet before reasoning or tool execution and close over it in the
proposal builder. The fixture supports `backend.proposal(patch, reads, observed)`.
Calling its two-argument form at tool completion only captures **current**
preconditions; it does not prove that those versions informed the proposal.

The unchanged late-input discriminator originally upgraded capacity's version at
completion and accepted stale reasoning. Its failure and source remain in
`first-failures/late-input-version.log` and `dispatch-fixture.mjs.txt`. The explicit
observation now retains the original version and the backend rejects the changed
input. Ten protocol checks pass, including this new case. The host still owns
complete input declarations; this cannot discover values hidden in a model's
context or a closure. A newly captured observation is valid only after actual
fresh evaluation, not merely relabeling an old result.
