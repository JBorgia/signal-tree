# Bounded scalar completion / lint successor

Frozen for independent Main/McClintock review, **not composed or self-accepted**. Exact predecessor is composition2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd,3102files; original Main source and own baseline reverified unchanged. MANIFEST.json contains3104files: seven modified original files plus the unchanged eight-case reviewer overlay and new40-case private precedence spec. FREEZE.json pins all identities.

## Scope and proof

18 empty callbacks receive intention comments only. COMMENTS-EQUIVALENCE.json records identical TypeScript-emitted JavaScript with removeComments for each touched file at the comment-only stage. No assertion changed. The single unsubscribePairedBoundaries assignment becomes const at its existing initialization site. Its only read is in cleanup registered later (original3046 initialization,3992 registration,4040 read); structural subscription inserts a listener and returns a remover without calling it (mutation-capture-runtime170). No earlier cleanup/reentrant callback can access this not-yet-created cleanup closure. Initializer-failure/reentry cleanup controls pass.

Four no-unsafe-finally sites are changed: neutral/native frame publish and native replace/derive completion. Retain try/catch/finally; catch stores boolean+unknown, finally runs exactly the existing completion, records completion-only error or reports secondary failure, then the saved error is thrown afterward. Explicit boolean preserves thrown undefined. No return/break/other fallible work exists in these catches or between finally and the final throw. A reporter throw still overrides a pending primary exactly as before. Existing updater invocation before the try remains before it. No new public API, rule suppression or error policy. ALLOCATION-SHAPE.json and diff show unchanged function/object/array literal counts: new per-call state is local primitive flag/error storage, no per-write closure/object.

PREWRITTEN-MATRIX.md pins expectations before edits and records inspected C14 predecessor history. New tests exercise all four actual runtime routes: normal success, primary object/string/undefined, completion object/undefined, both-failure precedence, reporter throw override, completion reentry with primary, exact installed/reentrant values and later useful write. This is private fault injection, not public reporter-failure semantics or framework UI timing evidence.

## Executed qualification

- Exact predecessor matrix40/40; identical successor matrix40/40.
- Kernel focused15files212/212: original completion/error/recovery/reentry, scalar support, metadata, initializer/attachment cleanup, and unchanged8reviewer cases included once.
- Angular8/8; React15/15; Vue8/8; Solid13/13. Existing frame publication/new-key/native-obligation controls plus React receipt and Solid native publication error boundary.
- Candidate unique behavioral total296 (40+212+44); predecessor40separate. No whole suite, large gate, cost or release claim.
- Source types, public types and unchanged spec-type ratchet pass. Reviewer spec retains its explicit Location casts and is typechecked.
- Affected lint27original paths plus2test overlays: **0errors/20warnings**, exit0. Original23errors/20warnings log preserved. No warning/budget ratchet changed.

All runs sequential through Nx for tests, pinned Node24.15.0/pnpm10.17.0, own caches/temp,180s owned-process group cap; no timeouts. Exact command/env/process/log/result per runs directory. Existing source and candidate runtime remained unchanged during each execution. Current broad counted-work failure and two large-gate exclusions remain outside this maintenance scope.

## Preserved first failures and limits

Predecessor matrix first39pass/1fixture failure: neutral direct reentry does not call the bulk locations.publish spy, so its expected hook count2 was wrong; corrected to1 only for that route. Exact b=9, primary error, completion once and recovery assertions retained. Both corrected arms40pass. First fixture/log archived. No original product oracle changed.

Comment-script first included four empty constructors in addition to18callbacks; count guard failed. Six own files restored before a corrected callback-only pass, no tests executed on that variant. Candidate runner initially reused a baseline output-directory name and stopped before test launch; candidate run has its own fresh name. These tooling failures are archived separately and are not runtime failures. Archived-tsconfig warnings remain in Nx logs.

Patches: runtime.patch (four runtime files, including runtime intention comments); fixture-comments.patch (three existing specs, comments only); precedence-tests.patch (new matrix); reviewer-overlay.patch (unchanged independently reviewed8cases, separate promotion). maintenance.patch combines only seven original-file edits. No root, frozen source or canonical candidate touched. Main/McClintock must independently review exact frozen source, parity matrix and cleanup ordering before composition.
