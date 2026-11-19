# Enumerable declare: exact authority and candidate boundary

**Recommendation:** qualify the named scalar surface assertion for the explicitly authorized experimental candidate. Do not change the production/public Link contract or infer activation. The exact approval found here refines the earlier classification: the mismatch is inherited, but there is specific authority for this method on a bounded experimental scalar handle. There is not authority for an unconditional new shipped API.

## Exact authority

Frozen C10 promoted manifest SHA256 `de88e207c66e65a1a191d05ab4f2b5b2a4deeead71a06f239f278e28dee70dc4`. All seven archived candidate source/authority files match it (IDENTITY.json).

- `candidate-evidence/RELEASE-CURRENT.md:714–724`: “Owner approved the proposed surface at247cfec7 for the bounded native experiment, not production activation or release acceptance.” This is more specific than the earlier proposal's pending-approval heading and must not be overlooked.
- `candidate-evidence/docs/audits/2026-10-17-incumbent-readiness/link-declared-native/README.md:3–8` repeats that approval, names native baseline `247cfec70c87c591e69e87dc3ee514840dad3f61`, retains production `87f6831fa60cafe87508f0ace84b7638698ca3b0`, and states source-loader changes were in-memory with no public exports or production edits.
- The approved proposal's “Binding and scope” specifies the new connection method initially for scalar owned locations. Existing branch/entity public Link surfaces are not thereby approved for the method. Its pending-approval prose is historical; the later explicit bounded approval controls the experiment.
- Root `docs/architecture/multi-actor/PLAN.md` authorizes implementation and P3 native mechanism work, not unspecified exports, activation, or release. It requires exact semantics and owner disposition for new public seams. EXPLICIT-HANDOFF.md and continuation/README.md authorize continued private corrections while preserving frozen public semantics and unchanged production.
- Root product audit describes qualified declaration progress as the approved target, while explicitly withholding production qualification. Target semantics are not public API shipment approval.

The existing public contract remains `Link { retrieve, settled, dispose }`: candidate link.ts:138–154 and root v15-production-surface-audit.md:13193–13216 agree. No registry/tarball was inspected; this is adjudication against the preserved repository public contract, not a claim about a newly fetched npm artifact.

## Actual candidate gating

Candidate link.ts imports the experimental module unconditionally. It enrolls each accepted source through research.bindSource at :559; its support predicate includes scalar, branch/root and collection shapes. At :1162–1176 it constructs an object literal containing enumerable declare and at :1265 returns it unconditionally. Ordinary `link(theme, endpoint)` therefore has four enumerable members without a per-connection opt-in. Prior independent focused runs already prove this exact scalar behavior on both C8a and C10.

private.ts:43 defaults `enabled=true`; :44 exposes private mode(value). That flag participates in delivery/admission decisions, including :453 and :457. It is not a surface gate: method construction does not inspect it; private.ts:470 delegates declare to lifecycle.runDeclaration without testing enabled; bindSource registers the connection irrespective of enabled. Therefore even mode(false) does not remove the property or disable the declaration call (source conclusion; no off-mode runtime probe run).

The source's supported/disposed admission checks are not experimental opt-in or public-export authorization. Likewise, keeping declare out of the public Link interface does not prevent JavaScript consumers from observing/calling a runtime property. Making it non-enumerable alone would conceal the failing enumeration without restoring the three-member runtime surface.

**Distinction:** an ordinary scalar connection created inside the explicitly experimental checkout is not a production connection. The owner-approved scoped-declaration design places the method on that connection before it is called; absence of a declaration invocation is not a reason to hide it. Thus its presence in the enabled bounded candidate is explained by exact approval, rather than evidence of production activation. Conversely, this candidate supplies no verified ordinary/off-mode surface isolation. It cannot be represented as preserving the ordinary production surface in all modes.

## Concrete disposition

1. Preserve the original three-member test and red logs as production-contract evidence. For this exact candidate's scalar experiment, a separately labelled candidate-only assertion may require exactly `declare, dispose, retrieve, settled`. Explicitly assert the enabled experimental context and use the existing scalar source. Do not silently relabel the four-member result as the published PUBLIC contract. The approval covers the experimental method; enumerability is merely the existing candidate's object shape, not a newly frozen public requirement.
2. Do not edit Link's public interface/barrels, production documentation, production runtime, or aggregate public-surface expectations on this evidence. The scalar approval is sufficient for the named theme-leaf test, not for a general four-member public Link.
3. Do not add a new runtime gating policy merely to make this enabled experiment's old public assertion green. The selected isolation boundary is currently the private candidate/overlay, not an established per-connection public option. No authority was found defining mode(false) as a full production-equivalent mode.
4. Before claiming an ordinary/off-mode lane within a shared candidate, require actual gated presence and declaration admission for that lane: three members, no accessible declare capability, and ordinary behavior. A property-only/non-enumerability workaround is insufficient. Any gate must leave the explicitly enabled scalar experiment testable and cannot be presented as complete production qualification; other experimental enrollment/admission paths remain. This is a qualification requirement, not authorization here to activate, add a public toggle, or implement that broader integration.

This is the bounded test-disposition option permitted by the exact recorded approval. No further owner question is needed to label and verify the already-approved scalar experiment. Production integration/public API acceptance remains outside this review.

## Evidence and falsifiers

Source-only in this turn; no runtime or test edit, additional test execution, or full suite. Archived source paths and hashes are in IDENTITY.json. Earlier exact enumeration command/log/result: `../full-run-classification/runs/focused-c10/{COMMAND.json,first.log,RESULT.json}` and matching focused-c8a. The ordinary scalar input exposes declare in both, so this is inherited.

The cheapest new off-mode discriminator, if Main intends such a lane, is to construct a scalar Link with the candidate's private mode(false), assert its property presence/keys, then restore mode in finally. Source currently predicts declare remains available. It was not run and would not alone prove ordinary production behavior. The bounded enabled-scalar expectation correction likewise has not been applied or rerun here. The separate three fixture-activation and held-reader classifications remain unchanged.
