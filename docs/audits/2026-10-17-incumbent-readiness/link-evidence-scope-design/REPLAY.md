# Replay and evidence boundaries

Runtime base: `2d71d73305fea23173b3b681c2a897ef1a7dffba` (rejected).
Use the retained test-only checkout or apply the archived patches to that base.
Node 24.15.0; Corepack pnpm 10.17.0. Dependencies use the existing pinned installation.
No installation/network operation is required by these commands.

```sh
cd /private/tmp/link-evidence-scope-design/checkout
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/ordinary-presence-independent.spec.ts --skip-nx-cache
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=packages/kernel/src/lib/publication-enrollment-invariance.spec.ts --skip-nx-cache
node tools/check-spec-types.mjs
git diff --check
```

The first command passes 3/3. The enrollment matrix deliberately remains red on
this rejected runtime: 8/16 pass, eight fail. Four branch cases send but their
receipt basis is surviving instead of declared; four root cases install x1 but
send nothing. Assertions after each first failure were not reached. This is a
reproduction, not a proposed runtime correction or a new safety-pass campaign.

The final spec-type command passes the existing ratchet, including the new
matrix. It does not mean all repository specs have zero diagnostics. No baseline
was updated. The same three preexisting improved files are reported.

`fixture/EMISSION.json` records exact before/after fixture hashes and identical
TypeScript-transpiled JavaScript with comments removed. `FIXTURE-TYPE-ONLY.patch`
changes only the local populated-branch type assertion and comment. No assertion,
callback, runtime construction, production type or export changes.

`SOURCE-MANIFEST.json` was generated after execution and verifies tracked runtime
against the base. It is explicitly not a before-run manifest. The new enrollment
spec is byte-identical to `ENROLLMENT.spec.ts`, written with expectations before
execution. The four original scalar failures and original recipient tests remain
unchanged in the base and previous archive; no duplicate run is claimed here.

No full kernel/framework suite, artifact build, cost, collectibility or release
verification ran as part of this design correction. Source-inspected producer
gaps are not counted as executed failures.

The raw Nx logs preserve terminal CRLF bytes. Default staged diff-check flags
four CR line endings as trailing whitespace. Source diff-check passes unchanged;
archive verification explicitly permits CR at end of line with
`git -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --cached --check`.
Raw output is not rewritten to satisfy a text-formatting check.
