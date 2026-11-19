# Independent replay evidence — final review paused

Owner requested a pause pending a new browser identity on October 29, 2026.
These results concern the copied old source only; they do not review forthcoming fixes.
No author or other reviewer verdict was used as an oracle.

- `local-replay-YthYpA/browser-results.json`: unchanged author scenarios, 7/7 PASS.
- `adversarial-ez4tg7/browser-results.json`: additional probes, 4 PASS / 2 FAIL.
- Both fresh offline installed builds passed strict full Angular AOT; manifests,
  copied inputs, generated output, bundle metafiles, commands and logs are retained.
- Baseline main.ts is unchanged. Adversarial main.ts adds only ApplicationRef.destroy
  and public diagnostic-signal instrumentation. Business actions use DOM buttons.
- Lost rejection acknowledgment, same-turn duplicate apply, overlapping capacity
  ABA/apply, and draft component destruction passed. Page and console error checks
  are included in the added probes.
- Angular destruction while uncertain leaves cleanup count 0 and pending ID 1.
  Angular destruction immediately after apply leaves cleanup count 0 even after
  delivery succeeds and pending becomes empty. Angular destruction cannot be vetoed
  by returning from ngOnDestroy. These demonstrate a lifecycle boundary already
  excluded by the README, not failure of the seven claimed scenarios. Ownership
  needs a longer-lived session or deferred cleanup after reconciliation; forcibly
  abandoning unknown remote outcomes is not an equivalent fix.
- The first adversarial run incorrectly clicked before Angular had rendered the
  enabled Apply control. Its source/log/results remain preserved. The corrected
  fixture waits for reviewed phase and enabled Apply before synchronous click pairs.
  Do not treat those initial interleaving failures as application bugs.
- Sandbox listener EPERM failures remain preserved; approved loopback replay used
  only offline packages, installed Chromium and local tools. No external reviewer.

The original scenario oracle checks pageerror only; the added probes also check
console.error because Angular-handled errors need not become pageerror.
Approval bindings remain client-local objects. Backend conditional version and
permission checks do not prove server-verified human review approval. Input-version
capture origin and the announced host-observation fix await their new identity.
No final P4 verdict is issued here. Production/browser source was not edited.
