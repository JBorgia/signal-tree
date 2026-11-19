# Independent invocation-marker error review

**Concrete finding: the Vue candidate suppresses a fresh dependency error. `evaluated === false` is insufficient to identify a cached recipe error.** Own-recipe error identity and recovery controls pass; the dependency-poll counterexample fails.

## Identity and location

Candidate: `/private/tmp/st-current-read-capability-proof`.

- Vue adapter SHA-256: `c208a37a6db85727a4c7b85e768a2963c6e18d9ba58842fbfd5a4d7bcffbe6c2`.
- Angular adapter SHA-256: `a348ac8562703ce3bd6179673c36343527779b48ca79e9968ddc06524fe39336`.
- Installed Vue 3.5.42, Angular 22.0.7, Node 24.15.0.

Finding location: `packages/vue/src/lib/vue-observation.ts:66–69`. The catch rethrows only when this invocation executed the outer recipe; otherwise it unconditionally calls readCurrent again. No SDK/runtime source was changed by this review.

## Executed counterexample

Use public Vue primitives:

```js
const inner = computed(() => {
  epoch.value;
  if (fail) { fail = false; throw sentinel; }
  return raw;
});
const readCurrent = () => inner.value;
```

Construct an ordinary computed control or the actual candidate current-read cell over readCurrent. Warm it to X. Set raw to Y, arm the one-shot failure, increment epoch, and read again.

Observed:

```text
native:    sameError=true,  sourceRuns=1, innerRuns=2
candidate: sameError=false, returned=X, sourceRuns=2, innerRuns=2
```

The native control propagates the exact fresh sentinel object. The candidate suppresses it and returns stale X. SourceRuns=1 in the native control establishes that the error occurred before another outer recipe execution. SourceRuns=2 in the candidate records the catch fallback.

Installed Vue implementation explains this result: `@vue/reactivity/dist/reactivity.cjs.js:391–411` refreshes computed dependencies through isDirty before executing the outer computed.fn. A dependency can throw there while the outer marker remains false. The inner computed has already updated its global-version bookkeeping; the second read can return its old cached value rather than rethrowing. The marker cannot distinguish this fresh dependency failure from a cached failure of its own recipe.

The reproducer performs no reactive mutation/publication inside a getter, imports no private framework API, and does not mutate native nodes or metadata. A one-shot dependency failure is enough to expose the swallowed exception. This violates preservation of fresh errors independently of the allowed ST-fresh/native-cached distinction.

## Exact command and evidence

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-current-reader-marker-error-controls.mjs /private/tmp/st-current-read-capability-proof
```

Script: `/private/tmp/st-current-reader-marker-error-controls.mjs`.
Preserved stdout/stderr: `/private/tmp/st-current-reader-marker-error-controls.log`.
**Ran, exit 1:** “Fresh dependency error was suppressed by the invocation-marker fallback.” This is a failing regression oracle, not a passing characterization disguised as acceptance.

The same script's positive controls pass on Angular and Vue: fresh source-thrown objects propagate by identity, a different subsequent error propagates by identity without publication, and recovery returns the new value, with exactly one source execution per direct call. Those controls establish the narrower own-recipe behavior only.

Earlier held/ABA, identity, readonly, lazy construction, native timing and dependency-switch controls still pass on the actual adapters:

```sh
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-current-reader-independent-controls.mjs /private/tmp/st-current-read-capability-proof
```

Their saved output is `/private/tmp/st-current-reader-independent-controls.log`. These passing controls do not cover dependency-poll errors.

## Bounded interpretation

The marker establishes whether this invocation ran this recipe; it does not establish the provenance of every exception thrown by the native getter. A fallback must not suppress a fresh dependency/framework error simply because its own marker stayed false. No private introspection, weakened types, eager application computeds, or changed error policy is authorized by this finding.

Angular's inspected native implementation also contains a pre-recipe cycle-detection throw, but this review did not establish an equivalent non-cyclic Angular suppression counterexample. Do not generalize the Vue result to Angular, or infer universal safety from Angular's passing own-error controls.

Not run: integrated ST reproduction, alternate peer versions, or an author repair. The public adapter accepts this nested computed source; the standalone actual-adapter counterexample refutes the current catch classification as a general error guarantee. It does not refute source-linked wrappers as an architectural class.
