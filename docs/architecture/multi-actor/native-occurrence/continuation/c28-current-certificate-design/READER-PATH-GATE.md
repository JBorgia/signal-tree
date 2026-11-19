# Conditional cached-snapshot certificate gate

This supplements DESIGN.md after the executed public A/B discriminator. It is a concrete reader-path obligation, not runtime authorization, an API proposal, or an executed alias defect.

In frozen C27 experimental-publication/private.ts, registerPublicationSnapshots records `suppliedViews(node, value)`. For an object already in snapshotViews, suppliedViews returns that existing certificate before consulting current nativeViews. Therefore replacing the current NativeView with a fresh object does **not** establish that a later cached snapshot read obtains the fresh certificate: the same snapshot object may continue selecting its old certificate.

Conversely, overwriting snapshotViews for that same object may retarget an older issued alias, because old and new references can be the identical object. Freshness and issued-certificate isolation cannot both be inferred from source-map replacement alone. Do not assume a repeated snapshot-registration call fixes this: its suppliedViews lookup can preserve the existing association.

The earlier design's new-current-view proposal is necessary to avoid directly mutating an issued NativeView, but is not sufficient reader-path qualification. It remains conditional, alongside the now-observed A/B receipt distinction documented at `/private/tmp/st-c28-no-write-discriminator/REVIEW.md`.

Before any implementation claim, distinguish these exact routes without changing their APIs:

1. A retained snapshot object issued before the proposed fresh admission, later consumed through a supported input path.
2. A post-admission ordinary snapshot read returning the SAME cached object; record object identity and the certificate actually selected on consumption.
3. A fresh current updater capture through the existing uncached branch-capture path, compared with direct scalar capture.

For each, establish whether the contract treats it as old issued evidence or fresh current evidence. Preserve old inspection/snapshot meaning and input obligations. Verify the actual certificate-selection route, not merely current nativeValues/nativeViews contents. If the same-object route requires both incompatible certificate meanings, report that specific collision; do not resolve it by silently replacing snapshots, changing memo/value identities, adding an API, or retargeting issued aliases.

No additional runtime experiment or source edit was performed for this supplement. This gate follows A/B adjudication and does not broaden the current task.
