# Grid audit 2026-09-26 — KEEP OFF MAIN until the D8 disclosure decision

Six independent auditors, a skeptic per non-trivial finding, and a completeness
critic re-checked the v16/L19 decision grid. 52 findings survived verification;
1 was refuted. Full result: `audit-result.json`.

## Two correctness defects in shipped 15.3.0, reproduced on the INSTALLED package

`repro-installed-15.3.0.mjs` uses only `@signal-tree/kernel` root exports and
`@signal-tree/kernel/internals` (`observeWrites`), installed from npm:

    INSTALLED D1: endpoint=[5] tree x=1 linkSettled=false -> DEFECT
    INSTALLED D2: transactThrew=true handle=false x=1 laterLinkSent=[] -> DEFECT

D1  Two overlapping transactions write x; the earlier confirms, the later rolls
    back. The tree ends at x=1; the Link endpoint holds the rolled-back 5, and
    on 15.3.0 link.settled() never resolves.
D2  A throwing notifier subscriber during transact()'s post-callback flush makes
    transact() throw with no handle, leaves the write applied with no turn, and
    Link on that tree goes silent for the rest of its life.

`repro-v15-defects.mjs [REV]` reproduces both from source at HEAD and v15.3.0.

Third reported defect, NOT reproduced here: realization descriptors retained per
retired entity subject (auditor + skeptic reproduced from source).

## Errata to the earlier record (not yet applied on main)

- REGISTER.md acceptance gate / l19-profile-diff.md: "emission survives removing
  every observer registration" is WRONG. NO-BOTH never removed onFlush; removing
  subscribe AND onFlush takes notify calls 1000 -> 0 (call-count probe, HEAD and
  v15.3.0).
- L19-DORMANT-GUARD and the tree-scoped guard (9/9) are UNSAFE: both gate
  emission and silence other consumers. Not gate evidence.
- WAKEUP-2 and WAKEUP-3 do not show kernel delivery: the harness releases the
  parked closures itself; an unsafe variant sends a pending value.
- Option (a)'s blocker is misnamed: a set-only Link endpoint never writes back.
- 45f4ed8e: "Eight new specs" lists nine; kill counts 8/4/1/1 are stale (final
  9/5/1/1); +86% / 12/12 exist only in commit text (no JSON); "matches v15 +88%"
  is cross-run, not measured equivalence; scope is the scalar dormant path only.
- AUTHORITY-1 is 11/12 (exit non-zero); the frozen refuse-ingress rule is unbuilt.
- "Every eliminated candidate died at structural" is wrong (draft and A only).
