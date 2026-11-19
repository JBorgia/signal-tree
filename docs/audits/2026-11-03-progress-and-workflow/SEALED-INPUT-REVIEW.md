# Installed workflow: explicit sealed input patch

Prepared, not applied: `sealed-input.patch`. Scope is run.mjs, angular.mjs, and one shared 62-line input validator. Root harnesses and frozen candidate remain unchanged. HASHES.json binds original/proposed bytes. The patch applies cleanly against the inspected root harnesses (`git apply --check`); all three modules pass `node --check`.

Default positional invocation still checks HEAD5727cd8, archives it, and builds as before. New opt-in requires all four flags; partial/unknown/duplicate flags refuse rather than falling back:

```sh
node tools/experiments/multi-actor-operations/installed/run.mjs \
  --candidate /private/tmp/st-v16-integration-candidate \
  --manifest /private/tmp/st-v16-integration-evidence/MANIFEST.json \
  --manifest-sha256 8bd6920bb81f676466a1c7d12d61395766694d881fcf2aa8c2dcdd35b5dce670 \
  --sealed-build /private/tmp/st-v16-integration-evidence/BUILD-SEAL.json
```

Then invoke angular.mjs with the printed evidence directory as its first positional argument and the same four flags. It requires the explicit identity to match the parent receipt. Candidate mode writes sourceHead:null and sealedInput metadata rather than falsely labeling the selected runtime5727. Execute from the reviewed harness checkout after Main applies the patch; the isolated proposed directory intentionally does not contain repository dependencies/fixtures.

Both harnesses reuse candidate dist; neither archives nor builds in this mode. Kernel/Angular still get locally packed and installed into isolated consumers, preserving offline installation, installed-byte comparisons, strict types, Angular AOT, runtime and bundle checks. The five-package buildIntegrity seal is checked before consumption and at completion, including error exits. No consumer source aliases or assertion changes. This reuses built outputs, not necessarily one set of tarballs; five packages are validated, while these two harnesses consume kernel/Angular only.

Validation follows the existing MANIFEST.json path→SHA256 map convention, pinned by the SHA256 of exact manifest bytes (not the obsolete compact-map digest), and the existing BUILD-SEAL.json root/packages/seal format. The candidate integrity module is itself source-validated before import. Manifest entries reject path traversal, links and byte drift. Receipt root must resolve to the selected candidate and packages must be exactly kernel/angular/react/vue/solid in canonical order. Receipt and source hashes are rechecked alongside buildIntegrity.

## Checks and limits

CHECKS.json:13 isolated checks passed, including valid tiny five-package artifacts; default no-flag dispatch; absent seal flag, absent manifest, wrong digest, duplicate/unknown/mixed options, source drift, artifact drift, wrong seal, partial package receipt, and receipt mutation. These invoke only the helper with tiny fixtures and the real candidate buildIntegrity implementation; no pack/build/test/consumer command ran.

First tooling mistakes preserved here: initial preparation used unavailable `python` (corrected to python3); the first standalone check script had one extra closing parenthesis, producing SyntaxError before any check. Corrected check script and results are retained. An optional actual-candidate hash validation was interrupted with SIGINT/exit130 after exceeding the intended cheap-check scope; ACTUAL-INPUT-CHECK.json is empty, NOT a pass. Process inspection via ps was denied by the sandbox. The started command was terminated through its owned exec session. No actual selected-artifact validation verdict is claimed.

Remaining pitfalls:

- BUILD-SEAL currently has no source-manifest field or successful build-command attestation. Checking both inputs proves current bytes match the supplied records, not that the build was generated from those source bytes. Main must bind the existing successful five-build receipts and source-preservation evidence to this pair. Do not manufacture a new seal around arbitrary dist and call it provenance.
- Like existing source preservation checks, validation covers the supplied manifest entries, not discovery of all unlisted source files. The manifest digest must come from the trusted selected identity. Candidate code is trusted local code, not sandboxed by hashing. Avoid concurrent source/dist writes; pre/post checks are not a filesystem snapshot or protection against change-and-restore races.
- Existing root tool dependencies/peer packing are retained. Exact candidate dependency-lock equivalence is not newly proved. The existing installed-byte loop validates installed files against dist; it is not a new completeness proof. Reuse the separate packed-agreement gate for that claim.
- Probe payloads still hardcode sourceHead5727 and encode historical behavior. In particular probe.ts expects unchanged inspection across external dependency changes/ABA and Link.settled resolution after send failure; settlement.ts expects older overlapping rollback refusal and terminal post-install observer-error settlement. Do not treat their embedded sourceHead as selected identity; the outer harness receipt is authoritative. Any mismatch requires interpreting the unchanged assertion against the supported contract, not altering expectations in this tooling patch.
- Existing allowedFailure commands still enter failedChecks and yield nonzero overall status; there is no new historical-failure exemption. Angular can continue from a parent packet with recorded consumer failures, as before; it is not aggregate sign-off.
- Historical full replay and opt-in end-to-end consumers were not run. Hash checks may incur substantial filesystem latency; they do not rebuild. Use Main/Noether's ordinary bounded orchestration for actual execution. No extra campaign is needed to review this patch.
