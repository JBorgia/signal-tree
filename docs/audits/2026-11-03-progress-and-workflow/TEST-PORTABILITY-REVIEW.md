# Independent bounded sink portability code review

**No implementation blocker demonstrated. Ready for the planned no-environment Nx/spec-type qualification.** Reviewed actual portability.patch, overlay helper/spec, before/after hunks and check.cjs; source inspection only. Did not execute the AST checker, tests, typecheck, patch application or builds. Worker's CHECKS.txt is its receipt, not my execution result.

## Implementation

The patch has the intended13 existing mandatory writers plus one test-only helper and its spec. Six historical destinations become explicit optional directories; seven existing environment sinks become optional without changing their file/directory meanings. Existing16 optional ordinary files, GC/perf/fault controls and runtime/config files are absent from the patch.

All payloads remain eagerly evaluated as string arguments at the same call sites. Helper's string API is particularly suitable here: JSON.stringify, getters, nativeProof/Set replacer, receipt.read(), tree snapshots, inspect() and record arguments execute before its no-sink return. This is not a lazy thunk conversion. Completion observed.push/serialization still precede unconditional write777. No drain, scenario, useful assertion, cleanup or native observer is moved under a sink branch. Four missing-output throws are intentionally removed; this enables no-env execution rather than weakening a semantic assertion.

Explicit sinks get recursive parent creation then exact append/replace bytes; filesystem and serialization errors remain visible. Missing/empty paths do no filesystem work. Import-time diagnosticDirectory reads do not gate tests; they intentionally select diagnostics for the invocation, not support mid-test environment toggling. Final inspected directory declarations follow imports. Existing declarations using dot-form process.env access are preserved, not newly introduced by the helper.

Helper tests are meaningful: mock wrappers call real fs for positive/failure paths, absence checks cover mkdir/write/append, exact append/replacement bytes are asserted, and real parent-not-directory/directory-as-file failures propagate. Per-case temporary cleanup is present. Mock/API typing and test-runner behavior await the normal spec-types/Nx check; parsing does not establish these.

## AST comparison: useful but deliberately incomplete

The current raw diff confirms the exclusions cover only intended persistence changes in THIS patch. No hidden assertion/evaluation change was found. However check.cjs must not be advertised as a general proof that every non-persistence change is impossible:

- It drops an entire variable statement if ANY declaration is named diagnosticDirectory; a future multi-declaration statement or side-effectful initializer could be hidden.
- It drops any if statement whose printed text contains one of four messages; it does not structurally require the exact missing-sink guard and sole throw. An enclosing if containing extra behavior could be erased.
- It discards sink argument0 for persistence calls and broadly removes node:fs imports. Side effects in a changed destination expression or different imported bindings would escape comparison.
- It normalizes recipient-window's output initializer and ignores extra persistence-call arguments beyond the second payload/mode interpretation.

For the inspected code, manually reviewed guards contain only the named prerequisite throws, new directory declarations only read the intended env variables, sink expressions contain no runtime mutations, and fs imports contain only replaced writers. Payload and sequencing comparison remains informative. Minimal future hardening, if this checker is reused: restrict each exclusion to exact file/node shapes and expected counts, reject extra declarations/arguments, and compare allowlisted destination replacements explicitly. This need not delay qualifying this manually reviewed patch or trigger a new campaign. Do not describe normalized AST equality alone as proof of semantic equivalence.

## Production boundary and remaining qualification

Helper is under tools/testing, imported only by the13 specs and its new helper spec in this patch. Kernel tsconfig.lib.json includes src/**/*.ts and excludes specs; production config inherits that boundary. Rollup entry roots are src/index.ts, adapter.ts and internals.ts, not tests/tools. No production import/export is added, so source inspection shows no path pulling this helper or node:fs into the production graph. This is not a fresh emitted-artifact proof; final build/package checks remain authoritative.

Proceed with already planned no-sink13+helper Nx selection, then the narrowly identified sink-on callback/getter/inspection controls and spec-types. No historical output directories need manufacturing. Keep existing GC gate's required receipts and performance/fault selectors unchanged. Preserve source hashes when composing; this review covers the observed overlay, not future unrelated edits. No broader test deduplication or new reviewer cycle is required.
