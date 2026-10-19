# Immutable evidence / terminal outcomes — private model slice

No repository source or public API changed. Original engine, original 42-assertion fixture, raw review and original run are under `original/`. New engine supplies runtime-enforced private owner state and copied immutable read facades for dependency facts. Frozen Set alone was insufficient; facade methods close over an inaccessible copied Set. A WeakMap authenticates admitted revisions; caller-created revisions cancel. Terminal owner outcomes cannot reverse or register again. Same outcome repeat is idempotent. Destroyed engine cannot be resurrected by assigning `alive`.

## Evidence

- `first-red.log`: first 10 adversarial controls against unchanged old engine.
- `expanded-red.log`: exact final 13 adversarial controls against unchanged old engine: 4 pass, 9 fail.
- `adversarial-run.log`: same 13 all pass after correction. Includes duplicate/reset owners, reversal, malformed outcome, exposed fact mutations, source mutation, forged revision, two-owner confirmation, callback throw/reentry and teardown registration.
- `lifecycle-first-red.log`: root review showed assigning public alive after destroy permitted new authority. `engine-before-lifecycle.ts` preserves failing revision. `lifecycle-run.log` passes after private lifecycle state.
- `engine-test-original.ts` is byte-identical to old fixture. `original-fixture-rejected.log` preserves its failure: original confirms p then rejects p. That setup violates newly explicit irreversible terminality. It is not counted as a passing rerun.
- `engine-test.ts` changes only that negative-control setup to a separate rejected owner and its subsequent observed-owner reference. All 42 assertion names and expected values remain unchanged; 42 pass. This retains the deliberately false-declaration leakage witness, not a safety claim for false declarations.
- `typecheck-first.log`: invocation omitted Node types; infrastructure/config diagnostic. Final strict typecheck with explicit installed Node types passes (`typecheck.log` empty).

## Replay

```sh
cd /private/tmp/link-delivery-evidence
export PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH
node original/adversarial-test.ts # expected failure, 9 of 13
node engine-test-original.ts # expected terminal-outcome fixture rejection
node adversarial-test.ts
node lifecycle-test.ts
node engine-test.ts
/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree/node_modules/.bin/tsc --noEmit --strict --target es2023 --module nodenext --allowImportingTsExtensions --types node --typeRoots /Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree/node_modules/@types engine.ts engine-test.ts adversarial-test.ts lifecycle-test.ts
```

## Trust boundary and limitations

This enforces persistence of supplied evidence. It cannot discover an owner deliberately omitted from observed input or a false complete declaration. Same hidden-omission negative still sends7 by design. Each engine is one owner domain; string IDs are not authenticated cross-domain tokens. Instrumentation supplying facts and callers submitting complete declarations remain trusted. Public current/requested are finite harness scheduling fields: a caller may assign an older genuine revision, so this is NOT a protected production delivery queue. Model send is synchronous and has no acknowledgement/in-flight state. Private facade methods and TypeScript casts test ordinary runtime mutation, not arbitrary monkey-patching of engine prototypes. Plain structured-record/scalar payload freezing remains the existing bounded claim; exotic mutable Date/Map payloads are outside it. The owner Map is not reclaimed; no memory or production lifecycle qualification. No automatic causal inference, framework integration, Link scheduling fix, new options, or public API selection follows from these model passes.
