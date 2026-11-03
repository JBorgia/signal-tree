# Fresh updater loses pending input after equal support refresh

**Concrete public safety counterexample on captured preliminary C28. C27 passes; C28 fails. Stop: no runtime correction, fixture correction, second experiment, or retry.**

## Frozen identity and command

Own copies: `c27-copy` and `c28-copy`. Each contains all 3086 C27 manifest paths, copied with modes from its respective source and hash-verified against the live source both before and after capture. Extra author-only fixtures were not copied. C27 manifest SHA256 `bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`; captured preliminary C28 manifest SHA256 `bc09d719916da43d7bf7ae5b4d5cf05eb34f3db85ae18f59143eba5e3a9e89a7`. The only differing manifested files are experimental-publication/private.ts and lifecycle.ts. Full captured diff and manifests preserved. This identity does not claim to describe a later author's freeze.

Same one-test overlay on both, Node24.15.0 / pnpm10.17.0:

```sh
corepack pnpm nx test kernel cached-current-input --skip-nx-cache --maxWorkers=1
```

Separate run-owned Nx cache/workspace data/TMPDIR and diagnostic sinks; root dependency symlink. COMMAND.json records exact executable/environment, PROCESS.json launch identity, RESULT.json exit/timeout/hashes. Both runs finished without timeout; all 3086 source hashes and fixture unchanged after each. No author's scratch or root writes. No typecheck or broad suite in this bounded run. Existing archived tsconfig diagnostic noise retained unsuppressed in logs; actual test execution established below.

## Public sequence and outcome

1. Construct source `{pair:{x:7}}`, cache `source.$()`; construct an opaque holder of that saved object for a separately observed historical-snapshot contrast.
2. Foreign transaction q authors 7 and remains pending.
3. Real `foreign.updateAndReport` callback passes its current q value into equal `source.$.pair.x(current.q)` and returns `{}`. This supplies a genuine new pending input, not a literal or private proof injection.
4. NEW independent declaration on linked target y invokes `source.updateAndReport(current => { target.y(current.pair.x); return {}; })`. It consumes current source input, not the saved object. No second source write can provide the expected contradiction.
5. Separately consume the saved object through its holder's public updater and separate linked destination. Record contrast, without a new historical-snapshot assertion.
6. Record pre-confirm sends, confirm q, await both connections settled, drain and assert exact single final 7 plus no premature fresh send.

| Observation | C27 | captured C28 |
| --- | --- | --- |
| author/fresh/saved callback counts | 1/1/1 | 1/1/1 |
| q inspect unchanged before confirm | true | true |
| fresh independent declaration | after-callback contradiction | no error |
| fresh sends BEFORE q confirm | [] | [7] |
| fresh sends AFTER q confirm/settled/drain | [7] | [7] |
| saved-object declaration | contradiction | no error |
| saved sends before / after confirm | [] / [7] | [7] / [7] |
| current root object === earlier saved root | false | false |
| Nx outcome | 1 test passed, exit 0 | 1 test failed, exit 1 |

C28 first failure: `cached-current-input.spec.ts:67`, `expect(before).toEqual([])` receives `[7]`. Final exact payload assertion already passed. The later fresh-error assertion is blocked by this first failure, but output-only diagnostic records `freshError:null`. Both observations are preserved; no claim that the blocked assertion executed. All diagnostics are recorded before assertions and after q settlement so the useful final behavior is also captured.

## Contract classification and bounded source explanation

This is supported public input consumption and premature publication, not a private observer injection or an arbitrary receipt-state oracle. q was pending at capture and remained pending through delivery. Approved C28 authority explicitly protects fresh inputs and pending responsibility; obsolete confirmed history is not this scenario. Existing C27 input controls ground contradiction and hold behavior; the C27 comparator passes this exact fixture.

Exact captured source locations (relative to packages/kernel/src/lib):

- `signal-tree.ts:2145–2147`: updateAndReport unwraps current root, begins publication input using that supplied current object, then calls user updater.
- `utils.ts:314–317`: accessor unwrap consults memoized snapshots. `utils.ts:455–458`: root construction takes child accessor snapshot by reference; `:554` records the resulting snapshot certificate.
- `experimental-publication/private.ts:110–112`: supplied snapshot certificate takes precedence over collecting current native views; `:119–121` recursively consults supplied child objects. `:125` records that selected certificate; `:126–132` captures its native inputs.
- Captured C28 `private.ts:177–180` replaces the NativeView whenever requirement identity changes. C27 `:179–180` reuses the equal physical view and updates its requirement. The preliminary C28 comment at :99 still describes reuse, but the executable install path differs.

Source-supported explanation: equal support refresh installs a new current leaf view while the memoized child snapshot can still carry the old view. A freshly built root can inherit the child's old certificate through suppliedViews; fresh root identity alone is insufficient. The experiment measured fresh root identity as different, so this is NOT evidence that the same root object was returned. Child-certificate reuse is a source trace, not an instrumented identity measurement. Other C28 lifecycle changes are also in the captured diff; this pair establishes the public regression and the relevant read/certificate path, not a one-line isolation mutant.

The C28 historical saved-object contrast can legitimately retain old evidence; it is deliberately not designated a defect here. The decisive failure is fresh current input missing newly pending q. This does not authorize mutating historical snapshots to fix fresh reads, change public snapshot identity, or reopen the approved no-write policy.

Preliminary source includes author diagnostic exports/wrapper in private.ts. They were captured unchanged, not imported or enabled; __captureEnabled defaults false. No private inspection ingress, proof injection, comparator assertions, or observer hooks used by this fixture. No framework generalization or retention conclusion.

## Evidence

`runs/c27/first.log`, `runs/c28/first.log`: original first outputs.
`runs/{c27,c28}/observations.jsonl`: exact sequence observations.
`CAPTURE.json`, `{c27,c28}-MANIFEST.json`, `CAPTURED-DIFF.patch`: source identity and diff.
`cached-current-input.spec.ts`, `TESTS.patch`: original fixture, unchanged.
`SNAPSHOT.json`: evidence hashes, excluding copies/cache artifacts which are covered by source manifests.
