# Independent bounded browser convergence review

No blocker demonstrated in the declared in-memory, in-session fixture boundary. This is approval of neither production authentication nor a runtime/public API change. No implementation or documentation files were edited. One independent browser control file was added.

## Identity and scope

Reviewed repository HEAD `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`; experimental files are untracked, so HEAD alone does not identify them. Compared browser app/checks against `installed/browser/history/pre-convergence/*.txt`. The runner verified all entries in `convergence-review/identities.json`, including packed dependencies, consumer inputs and served output. It also verified that the original twelve test bodies remain unchanged.

- app.ts SHA-256: `675eed2658fb972f78f7d126570b58911122c47a688a569338f3b31b69700849`
- checks.mjs SHA-256: `23df3eb321bf3dcc736a31dae6d1ac81f03145b9f20e29dc55a94e8cdad8ed96`
- served site/app.js SHA-256: `d95ca596a0cf429f075bc9599cb87de7e8917c34e145c8e1a0307fd28d039f0b`
- Exact artifact directory: `/private/tmp/st-p4-browser-fLlJQx`

Read review-contract, authority README, integration/convergence handoffs and relevant source. Did not use previous reviewers' conclusions as evidence. Unrelated dirty files were preserved.

## Determinations and falsifiers

1. **Entry convergence and attribution:** `app.ts:105–169` routes human requests and embedded AG-UI completion through `acceptProposal`, creating the same native transaction/current owner before common Review/Apply. Human is unknown; embedded is explicitly host-declared and not authenticated. Neither source label is reviewer authorization. The original AG-UI path also shares the helper. Ran the new common-path DOM case and independent human/embedded grant-forgery/local-recovery cases; both passed.

2. **Binding and grants:** `app.ts:172–179` builds the command from the immutable review binding and the same operation/revision command ID. The trusted host context supplies approval; entry arguments do not. The unchanged gate/backend chain still enforces exact command binding, cap, backend validation and receipt idempotency. Replayed missing-grant/forged-context, uncertain retry/cap and terminal revoke/local recovery controls. Embedded lost acknowledgment also traverses that path. No extra commit or grant was observed.

3. **Captured observation:** `app.ts:130–169` retains the immutable start snapshot for both the deterministic capacity decision and proposal version preconditions. Completion does not substitute the current backend snapshot. Ran delayed capacity 10-to-0 control: old packet chooses west and is rejected; new packet chooses south and succeeds; independent note survives. This detects stale-input acceptance and silent response-time version upgrading.

4. **Lifetime and reentry:** `app.ts:97,157–169,271–289` guards competing entries while pending, completion while busy/disposed, and disposal while authority/local work remains unresolved. Completion consumes the producer before synchronous stream delivery and disposes the stream in finally. Explicit session disposal cancels waiting production before disposing owners/tree. Ran duplicate starts/completions/applications in the same DOM turn, busy service update followed by attempted completion/disposal, and synthetic late events after cancellation. Observed one delivery/commit in the duplicate-Apply case; cancellation produced no proposal, delivery or grant, with one tree cleanup. The busy service case's single commit belongs to the deliberate external capacity update.

5. **Local authority after remote termination:** `app.ts:217–249,281–289` retains the native transaction when rollback is refused, revokes terminal grants, blocks new entry/disposal, and retries only local settlement. Independently tested both human and embedded entries with overlapping work plus persistence rejection. Each retained two pending IDs until overlap resolution, then cleared pending ownership with one total delivery and zero commits.

## Executed evidence

Command from repository root, with authorized loopback access:

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node tools/experiments/multi-actor-operations/installed/browser/independent-review/authority-security-convergence.mjs
```

Exit 0: 15 existing/current browser cases plus 4 independent scenarios passed; no page errors. Node v24.15.0, Chromium 141.0.7390.37. Raw results and complete verified manifest: `/private/tmp/st-convergence-independent-37faql/result.json`.

First attempt is preserved at `/private/tmp/st-convergence-independent-lwoqsS/` with `failure.txt`, `original.json` and `first-run-controls.mjs`. The control read the observation DOM immediately after clicking Start and captured pre-render `none`. Added an explicit wait for awaiting-completion and non-none observation before capturing the packet. No semantic assertion was removed or weakened; the second run passed.

Not run: fresh AOT rebuild, full package/release gates, real HTTP grant delivery, actual asynchronous producer callbacks, page navigation/reload or durable handoff. This review replayed the hash-verified existing compiled artifact. The producer delay is an explicit inter-event pause with synchronous completion; these checks do not prove cancellation of a future network/LLM callback implementation. Same-realm code compromise is outside this fixture's authentication boundary. UI and authority README explicitly retain these limitations. No broader authentication requirement is inferred.

## Retained SDK evidence

Separate SDK review remains separate from this browser determination. Original Vue fresh-dependency-error counterexample and raw identity are retained at `/private/tmp/st-current-reader-marker-error-review.md` and `/private/tmp/st-marker-error-identity-MPO0cU/manifest.json`. The public-primitives Angular same-sentinel polling controls and bounded no-suppression result remain at `/private/tmp/st-marker-error-identity-MPO0cU/ANGULAR-RESULT.md`. Those findings describe their exact captured candidate, not a later SDK repair. Helmholtz handoff remains `/private/tmp/st-current-read-capability-proof/proof-evidence/INDEPENDENT-CONTROLS-FOR-HELMHOLTZ.md`.
