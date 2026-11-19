# Key evidence successor — frozen for independent review

Candidate: `/private/tmp/st-key-evidence-successor/candidate`. Source manifest SHA256 `8d21743cefbc8f114def732c8f6ec465678c9fc7d1bfd4bf8d71d83c15f707e1`. Runtime patch SHA256 `f1c1d7f26d8a8a255daa1f810a3303876596f088a0e5017b7409b72fc6192f76`. Exact file hashes in SOURCE-SHA256.json; runtime delta source.patch; test delta tests.patch.

## Bounded change

Ordinary admission now consumes the structural source record's explicit own key (rekey destination), otherwise a present prepared placement descriptor. It refuses absent evidence rather than treating undefined/null as missing evidence. Raw Map key identity is retained. It uses the existing prepared placement, with no index/scan, public export, policy expansion, public type change or handle-policy relaxation. Existing generic K narrowing remains at the source collection boundary; no any added. The helper is module-private to the package (not exported from any public barrel).

The helper's missing-evidence rejection is unit-tested directly, including a malformed add record without an own key. This does not claim an end-to-end public operation can naturally produce that internal corruption. Present placement is a trusted source descriptor, not arbitrary public evidence. Existing active undefined-key handle refusal remains unchanged and is asserted against StructuralStore.

## Results and limits

- `runs/before-runtime`: original 3 + initial 4 controls: 2 passed / 5 failed. Source undefined/null admission failures preserved.
- Initial production comparison: original3 pass, four new controls hit a fixture accessor error. Initial patched run:15 pass/4 fixture failures. FIRST-public-fixture.ts and HARNESS-CORRECTION.md preserve the error: removed map() accessor corrected to asMap(), no oracle weakening.
- `runs/final-focused`: **37 passed**, 4 files, Nx exit0: original missing-ID3 unchanged; public5; private key-evidence13; unchanged structural-store16.
- `production/runs/final-public`: **8 passed**, Nx exit0 on retained87f: same original3 and identical public5. Tests cover undefined/null separately and together, literal spelled keys, numeric/string collisions, valid neighbours, duplicate refusal, production-mode warning suppression. Production source preexisting files verified byte-identical to the earlier verified87f archive; added fixture only.
- `runs/source-types`: strict source tsc exit0.
- `runs/final-spec-types` versus `baseline-types/runs/spec-types`: exit2 on each, **202 inherited errors each**, complete logs identical after replacing candidate root only. No added diagnostics. Original fixtures/public types unchanged.

Commands, pinned PATH, exits and logs are retained in each run directory. Node24.15.0 / pnpm10.17.0 via existing dependency link; Nx test runner, no timeout increases. The copy is an archive with no Git metadata; source manifests supply identity. No broad suites, retention/performance claims, activation or independent acceptance implied.

Predecessor row-source files reverified unchanged (VERIFIED-COPIES.json). Structural successor was not edited. Independent review should assess evidence provenance and placement fallback on existing admission routes; the public runtime controls establish the narrow tolerated-input boundary, not comprehensive undefined-key support for transactions/handles.
