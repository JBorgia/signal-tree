# Test-only E1/E2 facade packet — NOT EXECUTED

Baseline C23 manifest bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b. Four new files only,8 cases each: leaf/whole branch × actual-owned/unowned possible-only × confirm/rollback. No runtime candidate, root writes, config changes, new API, shipping type claims or test execution. Main must compose into a frozen runtime candidate before any run.

`TESTS.patch` adds the four files at their ordinary framework spec paths. `files/` contains the exact same bytes, TEST-FILES.json their hashes. Generator is research tooling only, outside the patch. No shared helper is added to package discovery.

## Public behavior oracle

All tests use actual facade roots and authentic transaction handles. The sole cast exposes C23's existing declare method, after checking it exists; no private lifecycle/requirement/admission APIs are imported. Each source has the identical pair shape and initial x0/y0. Whole writes use an explicit new literal, not a read-derived update. Scalar setters follow their actual framework API.

Before declaration: actual-owned variant writes x7 inside destination p; unowned variant opens foreign q.z7 then writes x7 ordinarily. Both must prove x7, native display7 and sent=[] before proceeding. No clearing sends. Pending.inspect is saved and must remain equal after the equal declaration and while checking settlement. Declaration executes once and receipt/state are frozen.

| Variant | Before owner settles | Terminal payload | Receipt requirement |
|---|---|---|---|
| owned / confirm | no send; settled unresolved | exactly7 (or {x:7,y:0}) | final started |
| owned / rollback | no send; settled unresolved | exactly0 (or {x:0,y:0}); never7 | original receipt started OR superseded, with exact useful surviving payload/settlement mandatory |
| unowned / confirm | exactly7; started/declared; settled resolves while q pending | no duplicate7; q.z stays7 | same started/declared receipt |
| unowned / rollback | exactly7; started/declared; settled resolves while q pending | no duplicate7; q.z becomes0; destination remains7 | same started/declared receipt |

Owned intermediate receipt follows preserved raw coverage: held/pending-dependency or a documented conservative reason; no started/no-write/superseded/disposed accepted at that point. This packet does not silently turn intermediate receipt vocabulary into a stronger new API contract. Owned rollback's old-receipt distinction follows the accepted supersession adjudication, not weakened payload expectations.

After settlement each case drains again and asserts no duplicate, writes8 and requires the exact second payload8, then disposes Link, writes9 and requires native/local progress with no third send. Prior receipt remains terminal/immutable. Cleanup disposes Link/native root or mounted hook and destroys both trees even on assertion failure. Test failures before final release remain failures; they are not marked skipped/expected failure.

## Native observation coverage and limits

- Angular: real facade WritableSignal `.set`/call reads; Angular computed over x, lazily read at checkpoints. No component/effect fixture or render claim.
- Vue: real ref `.value` setters/readers; Vue computed, nextTick after microtask drain. No watchEffect or component fixture.
- Solid: actual `.set` accessor, createMemo inside createRoot, explicit owner disposal. No DOM renderer/effect-count claim.
- React: actual callable setters, renderHook/useSignalTree selecting x, all writes/terminal actions within act, explicit unmount. No invented native-computed layer.

All four have native derived/read consumers, not only neutral stand-in reads; only React exercises a real hook render. Assertions occur after established framework drains, never inside install/notification. No native effect/render scheduling or render-count budget is changed. This packet checks equal-value displayed stability, but does NOT independently measure absence of all equal-write notifications or assert native effect counts. Original React6 contains its separate subscription notification assertions and remains unchanged elsewhere. No forced GC, timers, microbenchmarks or source-counter budgets added.

## Execution hold and scope

No Vitest/Nx/compiler/formatter/build run performed on these files. Static source inspection/generation only; type correctness remains to be validated on Main's exact composed candidate. Do not claim32 passes from generated cardinality. No new type baseline entries or assertion edits are authorized by fixture failures. Preserve first command/failure and source identity before correcting any fixture.

Original React6 path/hash is recorded in INPUTS.json; no edits or replacements there. E5's withdrawn historical-owner hold is absent. Transitive consumed-input, inspection, reentry and source-kind breadth beyond leaf/ordinary branch remain separate test-plan scope, not claimed by this packet. Runtime repair acceptance and shipping declaration typing remain separate.
