# Agent guidance audit — October 1, 2026

Status: owner-approved consolidation applied; validation recorded below.
The findings retain their pre-change references. No frozen product law, release
approval or bundle ceiling is changed by this work. Source inspected: `8fe2664faecbb72c22b14100a41b7060177b1b39`, public
`fix/v15-link-settlement-diagnostics` worktree (15.4.0 unreleased). The checkout
at `~/code/signaltree` is a different development branch; copying its guidance
wholesale would not reconcile the two.

## Conclusion

Reduce default guidance substantially. The evidence is conflicting commands,
duplicated procedures, stale measurements and overbroad conclusions. We have
not measured whether a newer model makes independent review unnecessary. Model
improvement is a reason to reconsider scaffolding, not proof that any particular
correctness safeguard can be removed.

The target should be a short repository contract, thin tool-specific entry
points, task-specific build/release/architecture references, and dated evidence
archives. Preserve historical failures and rejected options without presenting
them as instructions for every new task.

## Inventory and limits

The initial inventory contains 18 explicit instruction/consumer-guidance files:
2,605 lines and 107,099 bytes. It includes vendor entry files, reviewer roles,
release skills, Copilot instructions, adversarial-review assets, AGENTS.md and
the three AI consumer documents. The inventory was produced from current file
bytes, not estimated tokens. Its machine-local JSON is
`/private/tmp/st-takeover-2026-10-01/guidance-inventory.json`.

The linked `RELEASE-1.0.md` alone is 13,715 lines / 697,746 bytes.
`SIGNALTREE-15-CONTEXT.md` adds 2,776 lines. Independent process review identified
680 identical lines across two contiguous blocks (532 and 148 lines) shared
between those two documents. Both
release skills require reading the entire release document before starting.
These are document sizes and explicit loading instructions, not a measurement
of every host's actual context loading.

Also inspected: the corresponding guidance in the main and v15-fix worktrees,
personal Codex/Claude instruction files, validation documentation, repository
map, and supplemental migration/benchmark/example instructions. Private Studio
has no equivalent dedicated guidance files at the checked conventional paths;
this is not a reason to create another rulebook. This audit does not claim to
have searched every personal memory, third-party plugin or document in every
repository.

## Findings requiring correction

| Priority | Evidence in this checkout | Problem and disposition |
| --- | --- | --- |
| High | `.github/instructions/README.md:53–80` vs `release-process.instructions.md:7–10` and `type-declarations-fix.md:15` | The mandatory index recommends `nx release` while the actual guide forbids it; it says to exclude `dist/**/*.d.ts` while the package requires those declarations. Replace the index with links and scope, not another copy of commands. |
| High | `AGENTS.md:414–420` | Fresh-process/cleanup samples are used to say nothing grows unbounded inside one tree and to require “never as a leak” wording. Keep mandatory `destroy()` at bounded lifetime boundaries. Remove the universal conclusion and wording mandate: these samples do not rule out other retention defects. |
| Medium | `.agents/skills/signaltree-release/SKILL.md:22`, matching Claude skill | Full-file reading loads nearly 700 KB of mixed current work and history. Route through a short current release controller and load relevant decisions on demand. |
| Medium | Both release skills and reviewer roles | Commands still target deleted Nx project `core`; current package project is `kernel`. Version/phase descriptions still assume a 1.0 release. Resolve commands and scope from the current checkout. |
| Medium | `AGENTS.md` contributor introduction and `.cursorrules` | AGENTS calls the Cursor file the full rulebook, but that file points back to AGENTS as canonical. Remove the circular authority claim; the thin pointer is the useful part. |
| Medium | `AGENTS.md:285–288` | Budget table and “current measured” values are stale. The executable gate is 10.26/12.45 KiB bare and 22.60/25.25 KiB entities, prod/dev. Do not copy changing measurements into default instructions. Link the generator and dated evidence. |
| Medium | `AGENTS.md:457`, `tools/verify-gates.mjs:1122` | The old ~409-error narrative omits the active per-file spec-type ratchet. Its recorded allowance is 223, not a newly measured error count. Keep the distinction between runtime tests, source typechecking and spec checking; document the actual gate. |
| Medium | `AGENTS.md:492`, `type-declarations-fix.md:5`, kernel manifest and Rollup config | The docs describe two declaration entries; there are three (`index`, `adapter`, `internals`) and shared declaration identity matters. Update from configuration and packed-consumer evidence. |
| Medium | `.codex/agents/release-reviewer.toml:46–54`, equivalent Claude role | The role excludes spec-type debt and micro-optimizations of already-green paths from release-blocker findings. Distinguish old type debt from new regressions, and keep release blockers separate from opportunities requested in a performance audit. A non-blocking improvement can still be worth doing. |
| Medium | `AGENTS.md` release loops, architecture context and release controller | Repeated normative copies drift. Consolidate once; preserve decision identifiers and reopening conditions. Do not silently change owner-approved review governance while deduplicating. |
| Medium | Personal Codex/Claude instructions | Fixed Opus/Sonnet/Haiku routing, assumed agent/skill names, a three-file delegation trigger and “PR + ticket always exist” are not portable facts. Use available capabilities, task risk and best available history. Keep personal preferences separate from project contracts. |

Fresh size measurement at this checkpoint is 9.63/11.75 KiB bare and
23.46/26.12 KiB entities (prod/dev), generated by
`node tools/check-bundle-budget.mjs` after the clean build. Entity budgets fail.
This audit neither raises them nor treats the functional tests as a waiver.

## File dispositions

| Surface | Recommended disposition |
| --- | --- |
| `AGENTS.md` | Shorten to durable repository-specific rules and a task-routing index. Remove snapshots of measurements and narrated old incidents from default guidance. Preserve semantic ownership, public/private boundary, user authority and validation obligations. |
| `CLAUDE.md`, `.cursorrules` | Keep thin pointers. Correct stale namespace/release wording; do not expand them into parallel rulebooks. |
| `.agents/skills/signaltree-release/SKILL.md`, `.claude/skills/signaltree-release/SKILL.md` | Keep host entry points with one canonical workflow body or checked generated copies. Correct commands and remove full-history bootstrap. |
| `.claude/agents/release-reviewer.md`, `.codex/agents/release-reviewer.toml` | Keep independent review, bounded scope, evidence and explicit “not run.” Share the substantive contract; allow host-specific tool setup. A read-only source review is not runtime verification. |
| `.github/instructions/README.md` | Replace conflicting summaries with a short index identifying scope and authority. Remove blanket instructions to create more globally applied rules. |
| `.github/instructions/build-pipeline.instructions.md` | Retain task-specific artifact invariants. Narrow broad application and reference executable configuration rather than duplicating implementation details. |
| `.github/instructions/release-process.instructions.md` | Retain canonical publisher, artifact identity and explicit publication authorization. Scope to release work; avoid another versioned command list where a canonical process already exists. |
| `.github/instructions/rollup-entry-points.instructions.md` | Preserve the filename-collision lesson as build history. Its legacy package examples and index description must not guide current project changes. |
| `.github/instructions/type-declarations-fix.md` | Describe each branch’s actual three-entry declaration implementation; retain consumer verification and prohibit unverified post-build rewrites. See the branch correction below. |
| `.github/skills/adversarial-confirmation/SKILL.md`, assets and protocol | Retain on-demand architecture review. Consolidate repeated rules; keep verbatim frozen premises, normalized rival packets, distinct reviewer questions, narrow conclusions and a bounded return to implementation. Changes to explicitly owner-approved passes are governance decisions. |
| `RELEASE-1.0.md` | Split a short current controller from dated historical checkpoints. Extract genuine outstanding obligations before archiving. Preserve original failed candidates and corrections. |
| `docs/architecture/SIGNALTREE-15-CONTEXT.md` | Retain current contracts, owner decisions and reopening conditions in an index. Archive derivation transcripts; stop requiring full-file reading for unrelated work. |
| `docs/ai/LLM.md`, `docs/ai/agent-templates.md`, `llms.txt` | Keep validated consumer examples and an accurate package/version surface. Reduce duplicated tutorials and copy/paste prompt recipes. Prefer one canonical example source checked against installed types. A discoverability file can remain useful to capable agents. |
| Personal Codex/Claude instructions | Owner explicitly approved this cleanup. Apply capability-based routing, accurate project descriptions, scoped repository rules, and history lookup without inventing a PR/ticket; preserve unrelated personal preferences and backup the original files. |
| `tools/ai-migrations/@nx/vitest/23.1.0/ai-instructions-for-vitest-4.md` | Still referenced by `migrations.json`. Verify migration completion before retiring the prompt and plan entry together; an installed Vitest 4 version does not prove every migration ran. This 725-line checklist is not standing guidance. |
| `specs/examples/m3-prompts/m3-test-prompt.md` | Preserve as a historical v9.2.1 experiment fixture. The original result is explicitly NOT RUN; do not promote its controls into universal agent rules. |
| `docs/architecture/design-thesis-and-benchmarking-rules.md` | Extract current measurement principles; archive old architecture, measured values and optimization agenda while preserving citations. Its gate reference is a comment, not execution of the Markdown. |
| `.release-rules.json` | No tracked consumer found in the inspected release paths. It names removed core/enterprise/guardrails packages. Delete after the reference check rather than reviving a competing release authority. |

## What to keep, simplify and stop doing

**Keep:** inspect the actual branch and dirty state; understand deliberate code
before replacing it; separate current API from historical evidence; preserve the
first red result; validate meaningful success and failure behavior; identify the
exact source and artifact; rebuild after mutation tests; respect package and
framework ownership; require explicit authority for public API/product changes
and publication. Independent review caught concrete defects during this takeover.

**Simplify:** risk-based delegation rather than file-count triggers; a short
handoff rather than a fixed itinerary of chats; relevant frozen premise excerpts
rather than entire histories; a concrete scope for each reviewer rather than
headcount as assurance; investigate missing empirical information rather than
treating every missing fact as a product decision.

**Stop:** imposing vocabulary to predetermine findings; publishing current
measurements from old instructions; inventing unavailable tools/model settings;
restating the same rule in multiple default-loaded files; opening a new review
round without a new concrete question; using a passing baseline to prohibit an
explicitly requested optimization audit.

## Proposed minimum default contract

The following design informed the consolidation; AGENTS.md and its scoped references are the active policy:

1. Identify the repository, branch, version, task scope and unrelated changes.
2. Use current package/configuration/gate sources for executable facts. Historical
   documents explain decisions; they do not establish current behavior.
3. Preserve kernel/framework ownership and public/private package boundaries.
   Load the relevant semantic contract before changing behavior.
4. Investigate deliberate implementation choices and prior reversals with the
   history that exists. Do not fabricate missing evidence.
5. Make authorized changes; validate the affected contract with meaningful
   controls. Preserve failures and label what was not run.
6. Delegate when independent reasoning or parallel work adds value. Supply the
   evidence each reviewer needs without supplying the preferred conclusion.
7. For release work, follow the current controller and canonical tooling. Tie
   evidence to exact source/artifacts; rebuild after mutations; do not publish,
   push or tag without the user's authorization.
8. Escalate genuine semantic, product, compatibility or authority decisions.
   Continue independent authorized work while those decisions are pending.

Acceptance for a cleanup: no lost product invariants or open obligations, no
dead local command targets, no contradictory instructions about the same
artifact, no stale measurement labeled current, no duplicated normative protocol,
and all retained consumer examples checked by the current documentation gates.
Test the routing on an ordinary fix, a build change, a consumer question and a
release task; avoid replacing the old bureaucracy with a new prompt framework.

The existing numeric-claims gate passes on the unchanged live surfaces, but
checks for a named generator, not equality to its latest output. It does not
detect the stale AGENTS table above. This historical audit is outside that
gate's scan; its findings were checked against the cited files and measurements.
Independent factual review corrected the duplicate-line description and narrowed
the reviewer-role finding before this report was finalized.

## Bundle opportunities found alongside the audit

Controlled scratch ablations of the fresh neutral entity bundle identify:

| Opportunity | Observed gzip saving | Qualification |
| --- | ---: | --- |
| Move the testing-only active-order integrity method out of the shipped StructuralStore class | 385 B | Keep the same invariant tests through a non-shipping helper. |
| Put the production-foldable dev guard before wrong-method lookup/table access | 225 B | Preserve development diagnostics; verify production folding. |
| Remove or isolate six test-hook attachments | 99 B | Do not remove a similarly named handle helper used by real node construction. |

Combined measured ablation saves about 740 B, leaving 22.740 KiB: still about
144 B above the 22.60 KiB production ceiling. Individual gzip deltas are not
additive. These are measured optimization candidates, not validated production
patches. The scratch evidence is in
`/private/tmp/signaltree-entity-attribution/clean/results.json`.
Plain-entity output already excludes the Link and restoration implementations;
removing them is not an available explanation for this remaining budget gap.

## Applied consolidation and review corrections

The owner’s “Go with your recommendations” authorized this guidance cleanup,
including personal Codex/Claude guidance. Default repository entry points now
route to scoped contributor, review, measurement, build and release references.
The long release ledger and architecture derivations remain at their original
paths, with historical banners rather than destructive rewrites. Outstanding
obligations were extracted into the branch-specific `RELEASE-CURRENT.md`.

Both the active v15 worktree and the primary development checkout were updated.
They have different current controllers and API/build facts. No kernel/framework behavior, public export, budget ceiling or release
authorization changed. The development demo generator also corrected two stale
version labels from 16.0.0 to that checkout’s existing 16.0.0-dev version. Personal guidance
uses available capabilities and risk instead of fixed model names/file counts;
unrelated creative-content preferences remain unchanged. Original personal files
were backed up outside the repository before the update.

Independent source review caught a mistaken consolidation assumption: the shared
three-entry declaration graph exists on the development branch, but **not** on
this active v15 branch. v15 still emits separate bundles with deliberate marker
and tree-type identity plugins. Its consumer fixtures also differ. Guidance now
describes each implementation separately; this cleanup did not forward-port code.
The shared-graph suggestion in the initial disposition was not applied here.

The callable-value example also needed precision: native Angular `.set(fn)` stores
the function directly; `leaf(fn)` disambiguates an updater at callable write
boundaries. An installed-candidate Angular probe verified `.set(fn)` does not
invoke the function and that reading returns the same function reference.

The manual `tools/cross-review` harness is now labeled historical, with its old
contract preserved. Inspection found no package/workflow invocation. It still
contains old derivation assumptions and an external-service transport; it was
not executed or redesigned. Its dry-run can execute supplied specs and write
packets, so documentation does not call that mode read-only.

Migration instructions referenced by `migrations.json` remain task-specific;
completion was not established, so they were not deleted. The unexecuted M3
prompt experiment remains historical evidence, not default guidance.

### Validation so far

- The same 18-file inventory is now 794 lines / 40,093 bytes, versus 2,605 /
  107,099 before consolidation. Four new scoped contracts/controller files add
  255 lines / 15,027 bytes. These are file counts, not measured model latency
  or a claim about how much every host loads.
- Historical ledger/context/benchmark-charter/old-review-contract bodies remain
  byte-identical after their added banners, checked against each checkout's HEAD.
- Three skill packages pass the skill validator. The Codex reviewer TOML parses.
  Local link checks and an independent source review found no broken routing.
- Import, semantic-discoverability and numeric-claim checks exit 0 in both
  checkouts. The numeric gate proves citation coverage, not measurement freshness.
- A review initially claimed the final clean publish rebuild was absent. Direct
  source verification refuted that: v15 performs it in the workflow; development
  performs it in the publisher. The finding was withdrawn before any workflow
  change. Release documentation now explains the actual distinct routes.
- Ordinary PR guidance now calls for relevant checks. Full registry/mutation
  proofs remain mandatory at release closure, not as a default tax on every edit.

After the browser batches finished, documentation-example checks passed in both
checkouts: v15 35 examples / 29 live documents; development 29 / 25. Both initial
sandboxed production demo builds exited 1 with SIGABRT inside native LMDB
`EnvWrap::openEnv`/deallocation. The corresponding macOS crash reports and first
logs were preserved. Running the same uncached production builds outside the
sandbox exited 0 in both checkouts, without source/build-configuration changes.
This isolates an execution-environment difference; it does not establish the
underlying native crash mechanism. No full release sign-off is claimed.

Validation logs are in `/private/tmp/st-takeover-2026-10-01/`:
`guidance-checks.json`, `guidance-final-results.json`, the `*-guidance-demo-host.log`
files, and the initial `*-guidance-final-demo.log` files. Link, skill, TOML,
historical-body preservation and diff checks passed. Independent reviews checked
branch-specific implementation facts and ordinary-fix/build/release/architecture
routing. Publication and full release suites were not run for this guidance-only
checkpoint.
