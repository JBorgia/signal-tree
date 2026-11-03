**Yes, as a bounded correction—with one essential distinction: consumed is not installed, and a thrown error does not prove noninstallation.** That follows from the existing rollback terminality contract; it needs no new owner policy.

Use an invocation-local lifecycle:

| Event | Required result |
|---|---|
| Enter selected write | Create a fresh open, unused invocation. No ambient endpoint. |
| Selected kernel body begins | Consume once **before the projection’s before-read**, including any getter it invokes. Interceptor wrappers forward the same invocation; they do not each consume it. |
| Second execution attempt | Refuse before reads, writes or publication. Never reinstall the endpoint. |
| Interceptor returns without executing | Close and refuse; do not report successful compensation. |
| Preparation/body fails before installation | Close, preserve refusal/pending authority under existing rollback handling. A legitimate retry creates a new invocation. |
| Installation succeeds | Record that fact at the existing installation boundary, before callback-capable delivery. |
| Observer/interceptor throws after installation | Close and report the error, while preserving the installed/terminal disposition. Never reopen the continuation. |
| Enclosing selected write exits, normally or exceptionally | Close permanently. Retained continuations cannot execute afterward. |

Two qualifications matter.

**“Refuses unchanged” must mean the selected compensation did not install.** An interceptor or getter can perform an independent write before withholding `proceed`; that write cannot be erased merely to make the phrase true. Preserve existing handling of those writes. Do not claim the entire tree remained unchanged.

**The caller needs invocation-specific installation evidence.** The current rollback catch at [transactions.ts:4931](/private/tmp/st-native-explicit-handoff-successor/candidate/packages/kernel/src/enhancers/transactions/transactions.ts:4931) falls back to physical-clock movement when `completion.selected` is false. Independent interceptor writes can advance that clock even when the selected continuation never executes. Simply throwing “proceed not called” therefore does **not** establish that rollback remains pending. The correction must carry the actual selected installation outcome into existing terminality handling; neither consumption, normal interceptor return, nor unrelated revision movement is sufficient.

For the requested edge cases:

- **Synchronous `coalesce(proceed)` inside the interceptor:** allowed when it drains before the enclosing selected-write boundary exits. The invocation remains open until that boundary, and consumption occurs when the actual projection body starts.
- **Genuinely deferred selected `proceed`:** if it remains unexecuted when that boundary exits, synchronously refuse and close it. Later execution must refuse without mutation. Do not silently bypass the interceptor or extend authority across a promise, timer or retained queue. Supporting asynchronous compensation would be a different contract.
- **Completed then observer throws:** the selected effect remains installed. Existing rollback code explicitly distinguishes installed compensation from delivery failure and retires the pending transaction before rethrowing the observer error. Preserve that distinction. A successful `proceed` followed by an interceptor throw is likewise not a pre-installation refusal.
- **Interceptor catches a body failure and returns normally:** consumption alone cannot turn this into success. If installation never occurred, the enclosing boundary must still refuse.

Keep normal public writes and ordinary `proceed` semantics unchanged; apply these restrictions only to selected private invocations. Keep the existing outer-coalesce rollback guard.

The acceptance controls should distinguish **skipped**, **started-but-failed**, **installed-then-threw**, **deferred-past-close**, and **fresh retry**, including a skipped continuation whose interceptor independently advances the physical clock. This is source-based contract review; no runtime changes or tests performed.
