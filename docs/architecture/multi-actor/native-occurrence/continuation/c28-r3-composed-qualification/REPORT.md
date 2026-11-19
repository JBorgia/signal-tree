# Composed R3 qualification checkpoint

**Broad selected coverage complete; not whole acceptance.** See BROAD-REPORT.md for immutable3102-file execution and ORIGINAL26-RECONCILIATION.md/JSON for each original failure.

- 768/768 selected ordinary files complete: **7849ordinary passes,1failure,5satisfied expected failures,15skips**. All127 framework files pass. No new assertion failures.
- Original26:25current cases pass (nine unchanged regression assertions, twelve reviewed private-fixture corrections, four approved oracle corrections); unchanged counted-work case remains13000 vs<2000.
- Source/public/spec types pass. Affected27-file lint fails:23errors/20warnings. Raw failures preserved, no fixes.
- Exactly two excluded large files remain explicit and unqualified on combinedsource; their status blocks whole acceptance. No watchdog fired in completed selections; all owned children gone. Zero-test first kernel routing failure preserved separately.
- Separately added unchanged reviewer spec: **8/8 pass plus spec-types pass**, runtime unchanged. This test-only3103-file overlay is distinct from the frozen broadsource and is not broad requalification.

Frozen composition source: `2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd`.
Broad evidence freeze: `8fe64fb8e16fb8b3f51f6a58067b16ab83827deb5c0a9286a645bdcd6170138f`.
Test overlay manifest: `4a2511bd274eeca5bbb9a4af30a83b8dca00e28458dd708593488f45411a5c50`.

BROAD-FREEZE.json, OVERLAY-IDENTITY.json, OVERLAY-REPORT.md, full-runs/, gates/, runs/ preserve distinct phases and exact commands. Original Main3102files, own3103overlayfiles and frozen broad evidence hashes reverified after the final gate. Main/root/canonical candidates untouched. No build/artifact/cost acceptance.
