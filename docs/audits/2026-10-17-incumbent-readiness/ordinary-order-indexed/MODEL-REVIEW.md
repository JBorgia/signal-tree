# Independent indexed-successor model review

Bounded model gate passes: no correctness or locality blocker demonstrated within the declared trusted-command order model. This supports the user's conditional bounded native experiment decision; it is not native adoption, later-slice qualification, public API approval or release sign-off.

## Exact evidence

Frozen model7f9354d7932eafea6069d82700f053319cc2d4d3f463cf38609f107d21cc0dbd; unchanged semantic harness7e944eb44c3bcf3a668531324716c725e70483029de95ba81778374c6c28032b; indexed harness339f4fac46ce056ac7716e1cd816538b637d8ba88f7d33e549afcd19f7fa2e94. Read DESIGN before diff/code/result review. FROZEN.sha256 and review/AUTHOR-AFTER.sha256 identify unchanged inputs.

Independent copied-source replay, Node24.15.0:

- `node review/replay/acceptance.mjs`: all26 original semantic executions pass, including the four unchanged source-failure scenarios. Original fixed-local work assertion remains unchanged; successor recorded1414 atN16/256/1024.
- `node review/replay/indexed-tests.mjs`: all32 successor rows pass, N16/256/1024/4096, local cycles1/8/32/128, full divergence/convergence, shared/staggered leases and stale/failed source preparation.
- `node review/replay/adversarial.mjs`: four partial-convergence cases plus explicit lease replacement/fault probe pass. Script hash recorded before execution. No author output was overwritten; no native/model edits.

## Independent adversarial results

At full adjacency divergenceN, physically converging exactly four records produces exactlyfour normalization visits andfour installed agreement updates for everyN16/256/1024/4096. RemainingN-4 exceptions remain correct. Draining an absent lease performs no exception scan or accidental semantic deletion. This directly falsifies the old cleanupN-scan behavior for the bounded local convergence workload.

Exact-unit alias probe: leaseone and leasetwo share unitU; replace leaseone with U/V/U, retaining a distinct fact membership rule despite duplicate unit entries. U fact counts remain2, V1. Releasing leasetwo leavesU1. Replacing leaseone withV removesU keys whileV stays1. Controlled throw from a later unit's ordinary accessor during private index preparation leaves the prior recoveryIndex, leases and leaseFacts memberships unchanged. Last drain removes all three maps' entries; repeated drain is idempotent. This fault uses a test-only malformed input to exercise preparation failure, not a new public input contract.

## Mechanism findings

Sparse finish considers union(Ostage.patch,Pstage.patch), including P-only slots with existing Oexceptions. It compares against prepared physical answers before live installation and prepares per-slot updates. Install applies only those updates, including deleting converged overrides, and normalizes head/tail. Sparse cleanup no longer scans exceptions. Physical Stage already includes reciprocal endpoints, so the same local certificate retains source fallback safety. No whole-exception-map clone or scan was found in this prepare/install path.

Recovery index keys exact immutable fact identity, with distinct fact membership per lease and reference counts across leases. Retain privately constructs new membership and old/new replacement updates before mutating live maps. Drain touches only the named lease's facts, removes exact keys on last obligation, and never uses recoveryIndex as current ordinary authority. Shared facts/aliases therefore cannot clear current divergence or another lease merely by sharing a lifetime/key. Retain cost is proportional to old/new lease fact membership; drain proportional to released lease facts, not total global ordinary divergence/index size.

The unchanged source plan revision check guards current physical/ordinary installation after reentry. Existing tests demonstrate failed/stale source prep leaves recovery index and ordinary exceptions unchanged. Lease index installation has no generic OOM/recoverable-Map-failure transaction guarantee; design explicitly excludes it. No user callbacks occur in its trusted immutable fact index installation loop. Admission nonces may be consumed by failed preparation without changing admitted state or physical revision, as in the prior model.

No hidden whole baseline/fixture oracle or changed inverse semantics found. Original source facts and common inverse/redo consumers remain unchanged. Snapshot branch remains the unchanged reference, including its global cleanup behavior; it is not advertised as indexed-local.

## Accounting and retention limits

Selected instrumented counts show local touched/dependent work, not CPU, heap bytes or exhaustive JavaScript allocations. Source patch construction, normalization, per-lease fact iteration and index writes are visible; reporting/verification scans are separate and not needed to execute retirement. Full order/large lease legitimately touches its members.

Unique recoveryIndexRecords is not total recovery storage. leaseFacts holds per-lease Set membership references; leases holds unit arrays; old retained() counts fact/image references per lease and can count shared images repeatedly. Explicit retained membership-slot totals/map-object overhead are not reported, and two new constructor Map allocations are not counted. Do not call unique index size total memory or use these omissions for byte/GC claims. Per-lease membership work is counted at creation/replacement/release, so this does not conceal anN-sized unrelated cleanup path.

Current divergence survives last lease where required; indexed equality retirement and recovery image retirement are separate. Externally held source facts, old identity descriptors and prepared closures may retain data beyond model maps. Same-key stale field/rekey rejection is demonstrated, but trusted add(lifetime) can reinstall a supplied absent ID. Public retirement authorization, general key collision preflight, arbitrary transaction ownership, native physical compiler coverage and actual collection remain unproved, as previously declared.

## Final scope

The successor represents the missing ordinary placement information and meets bounded indexed-normalization/last-obligation work for tested paths without changing the original four assertions. No negative result was optimized away in this review; frozen predecessor logs and linear cleanup controls remain separate artifacts. Native source/path obligations and recurrence/later-slice gates still apply to any separately authorized bounded experiment. No native file was edited or qualified by this model pass.
