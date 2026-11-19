# Bounded qualification checkpoint

No active Nx tests, no further expansion or runtime changes. C23 input manifest bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b. Both owned-group watchdogs completed without firing; each target reports sourceUnchanged=true.

Independent raw cases (unchanged since first execution):
- candidate/packages/react/src/branch-declaration-qualification.spec.tsx: `React branch equal whole actual-owner / confirm`, `React branch equal whole actual-owner / rollback`, and `React branch disposed held receipt releases waiter without settling owner`.
- candidate/packages/kernel/src/lib/direct-row-declaration-qualification.spec.ts: `direct row equal whole actual-owner / rollback`.
- Exact commands/environments: runs/react/COMMAND.json and runs/kernel/COMMAND.json. Raw failures: respective first.log. Child results/owned PID/PGID: RESULT.json and PROCESS.json.

First outcomes: kernel5pass/1fail; React3pass/3fail, with React's existing tsc phase completed. No failure changed to force green.

Kernel failure: actual rollback sends exact restored row0 and resolves settled; old receipt is superseded rather than asserted started. Invalidating the old ticket while making a fresh surviving send is allowed by selected rejection semantics. This is an overly strong receipt oracle, preserved red; later receipt/reuse assertions in that failed case are unreached.

React three failures: after actual pending x7 authorship and equal independent whole-branch replacement, endpoint already receives exact {x:7,y:0}, receipt started/declared. Confirm/rollback cases fail before settlement; held-dispose fails before disposal. Same safety counterexample prefix, not three independently established lifecycle bugs. Owner inspection is unchanged in the two terminal variants. Actual pending support must remain a lower bound. Independent causal replay is pending; no repair authorized/performed here.

Minimal source hypothesis (not a traced cause): unchanged scalar publication preparation can create a requirement from current no-transaction authorship and overwrite prior native destination support. React re-exports kernel, so this is not established as React-specific. Frozen tests preserve the real mounted selector/act path. API/export work is separate; a confirmed leak blocks runtime composition.
