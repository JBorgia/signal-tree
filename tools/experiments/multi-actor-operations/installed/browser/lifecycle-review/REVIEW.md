# Disposal correction replay and Faraday handoff

The only coordinator difference from the preserved failing source is clearing
`#adapter` after every operation passes the existing terminal-status guard.
No kernel or browser implementation was changed by this replay.

Independent execution using Node 24.15.0:
- Original source, unchanged GC falsifier: exit 1, expected retained-dependency assertion.
- Current source, same GC falsifier: exit 0; sampled collectibility only.
- Original five test files: 27 passed, zero failures (exact commands in results.json).
- Fresh installed Angular browser consumer: seven passed, zero page errors.
- Current protocol tests: nine passed.

Raw logs and both coordinator snapshots are adjacent. Previous browser evidence
is preserved at ../history/pre-adapter-release. Its 20 manifest hashes were
independently verified before replacement; the original 114-file installed
checksum inventory passed. First failures remain intact.

Current browser work: /private/tmp/st-p4-browser-jEZJfT.
Current evidence: ../evidence/manifest.json and browser-results.json.
All 20 current manifest hashes match. Both SignalTree tarball hashes are unchanged.
All SignalTree bundle inputs resolve inside the isolated consumer's installed
node_modules; no runtime compiler or library source aliases occur. The current
coordinator snapshot hash matches the working helper at the time of verification.

Types: full AOT, strict, strictTemplates, strictInjectionParameters,
skipLibCheck=false, types=[], no path aliases. Package declarations are the real
installed declarations. Narrow fixture .d.mts files contain no any or ambient
package replacement; they specify fixture APIs but do not type-check the JS
implementation. Prior kernel consumer negative assertions remain archived;
this refresh reran browser AOT, not all earlier P2 gates.

Replay from any directory (requires existing root tooling and Chromium):

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /Users/jonathanborgia/code/signaltree/tools/experiments/multi-actor-operations/installed/browser/run.mjs
```

No library rebuild: the runner verifies/reuses pinned SignalTree tarballs, packs
local peers, installs offline, compiles the consumer AOT and runs Chromium.
Current root fixture bytes and peers are copied and hashed per run; the entire
fixture environment is not frozen solely by the library hashes.

For Faraday: review current browser sources/checks/declarations against archived
consumer inputs and the disposal diff/logs here. No independent final verdict is
claimed by this implementation worker. This covers an in-browser backend stand-in
and explicit disposal controls, not HTTP persistence or four-facade acceptance.
