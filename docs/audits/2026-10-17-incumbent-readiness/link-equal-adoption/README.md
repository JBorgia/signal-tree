# Authorized inspection-value adoption: bounded native candidate

October 20, 2026. Source checkpoint `18cd8d7d` (documentation-only descendant of
`db82b8ae7b75cd2d1a968a46fd8d79f489e45857`). Production runtime remains
`87f6831fa60cafe87508f0ace84b7638698ca3b0`; no production runtime or public API changed.
The [preceding investigation and owner decision](../link-equal-write-boundary/README.md)
remain preserved.

## Result

The bounded scalar candidate implements the owner-authorized distinction:
ordinary7, inspection-displayed99, explicit ordinary99 adopts99; rejection of
transactional adoption restores both physical and publication authority7.
A genuine ordinary99-to99 call remains a no-op. Exiting inspection metadata
without writing does not adopt its displayed value. Updaters still read display99.
This resolves the tested native-versus-declaration boundary; complete Link API,
entity/restoration coverage and production acceptance are not established.

The distinction is native, not a declaration receipt exception. Slots retain a
prior ordinary value only while inspection differs. Capture/preparation uses
that ordinary-before value; admission separately reports responsibility change
and physical change. Equal adoption records responsibility without duplicating
value notifications. Point/frame realization retires inspection baseline state.
Root/branch equal-value dispatch consults an internal substrate query before
skipping work; true no-op fast paths and diagnostics remain. No public export
or rollback ownership engine is added.

## Preserved failures and corrections

1. Initial neutral success did not qualify native facades. Native derive code
   failed compilation; corrected derive separately reads displayed callback input
   and ordinary capture-before. First source/log retained.
2. Transformed kernel typecheck found TS2345 in a publication result union;
   explicit discriminated result objects fix it without discarding types.
3. Focused Nx first result: **53 pass / 1 fail**. Existing unchanged P5 in
   `link-authority-carrier.spec.ts` failed after root acquisition equal to display.
   Baseline P5 file independently passes **13/13**. Root/branch physical-equality
   optimization bypassed scalar admission, leaving a stale ordinary baseline.
   The shared query correction fixes that route; no Link-specific clearing.
4. Root's initial outbound-count oracle expected no baseline7 send on rollback;
   native delivery may send7 when that baseline was never delivered. Original
   assertions/output retained; corrected oracle requires effective endpoint7,
   no rejected99, and unchanged value-notification suppression. It does not
   force or prohibit redundant delivery beyond the existing contract.
5. Early fault harness used an unsupported `config.equal` and did not exercise
   comparator faults. Those rows are not counted. Actual configurable-slot
   tests subsequently exercise comparator/preparer throws and reentry.

## Final evidence, kept separate

| Instrument | Result |
| --- | --- |
| Native-only focused Nx, 8 files | **96/96** |
| Transformed kernel `tsconfig.typecheck.json` | Clean, exit0 |
| Broader worker `tsconfig.lib` differential | Same 11 existing research diagnostics; not clean |
| Worker adoption scenarios | 32/32 assertions across ten scenarios |
| Root independent adoption assertions | 35/35 |
| Independent direct facade cases | 16/16, Angular/React/Vue/Solid, with/without Link, setters/updaters |
| Independent native-only root/branch cases | 24/24, four facades, adoption/acquisition/genuine no-op |
| Frame/point controls; overlap controls | 4/4; 3/3 |
| Original safety controls and old nested failure | 25/25 ordinary, 13/13 prior, nested passes; misuse separate |
| Prior 31 assertions | 28 pass / 3 old no-adoption expectations fail under authorized adoption |
| Historical delivery | 32 pass / 2 old permanent-hold expectations fail under approved post-confirmation semantics |

No counts above should be added into an independent coverage total. Original
assertions remain unchanged in their archived instruments. The three adoption
changes expect no send/no-write after explicit ordinary99; actual send99/started
now matches the owner's new rule. They are distinct from the two historical
delivery expectations. The omission-leak demonstration remains misuse, never a
safety pass. Atomic overlap refusal preserves newer99/101; newest-open-first
adoption rollback99-to7 then prior rollback7-to0 succeeds.

Actual slot faults leave physical99 and record-before7 unchanged on comparator
or preparation failure. Comparator reentry preserves newer77 and rejects stale
outer installation. These are bounded synchronous fault tests, not OOM claims.

## Review and limits

[Independent review](REVIEW.md) supports the tested shared native mechanism.
The internal query uses the existing weak binding registry; that is source
structure, not a heap/reclamation proof. Per-leaf closure cost, inspection
baseline retention after destruction/held references, dynamic removal and
entity coverage remain unqualified. No package artifacts, budgets, benchmark,
full suite or release qualification was run. No SDK surface was added.
Production conservative hold remains unchanged; B stays closed.

The experimental declaration implementation remains scalar-only. Aggregate
native tests use native Link or explicitly disable the private scalar declaration
policy; those runs do not qualify aggregate declarations. Real facades were
executed in Node; no browser/native effect-timing qualification is claimed.

## Replay and exact inputs

Node24.15.0, pnpm10.17.0, source project's pinned dependencies. Final patch SHA256:
`fa397f9f9fbc29db3d10b332627e89b5c21c9321d793102af4d167f87577e107`.
Its required frame fragment SHA256:
`86006a66926bfc71b20123f6960edf1972a9f924e6def005eb36f9795fda39a7`.
Archive includes transformed native source, first/final bundles, raw module hash
receipts, assertions, diagnostics, review inputs and logs. Candidate and review
loaders contain original absolute private paths: update those paths including
the frame fragment when rebuilding elsewhere; frozen bundles need no rebuild.

```sh
node --input-type=module -e 'const {run}=await import("./root/query-root-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
```

Other saved bundles export `run()` likewise. Native-only Nx reproduction uses
a disposable copy of the recorded source/dependencies, overlays the five files
under `native-nx/packages/kernel/src`, and adds the archived spec to `lib`:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test kernel --skip-nx-cache --args='equal-inspection-adoption link-authority-carrier inspection-egress-conformance tree-scalar-slot-runtime update-and-report change-reporting noop-write-warning noop-copy-write'
node node_modules/typescript/bin/tsc --noEmit -p packages/kernel/tsconfig.typecheck.json
```

The native-only overlay deliberately contains no experimental Link declaration
implementation. Exact experimental Link receipt tests use the archived loader
and unchanged helper. No earlier passing source's verification is inherited.
