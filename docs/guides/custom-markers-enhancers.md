# Custom Markers & Enhancers

The public custom-marker and enhancer-helper authoring surfaces were removed for
SignalTree 15.0. The low-level `Enhancer` function type remains available for
advanced consumers that can implement the function contract directly.

SignalTree 15.0 keeps app-facing state construction and `entityMap` on the
kernel barrel alongside the built-in enhancers. Custom marker registration and
enhancer-author internals are no longer published as an extension SDK.

For app-local behavior, prefer ordinary Angular signals, computed values, services, and small helper functions around the tree you own. If a future third-party extension need survives greenfield review, it should earn a new, specific contract from that need rather than reviving the old generic authoring subpath.

Historical versions of this guide taught APIs from `@signaltree/core/authoring`, including `registerMarkerProcessor`, `createEnhancer`, and `ENHANCER_META`. That subpath no longer exists.
