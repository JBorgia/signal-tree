# SSR And Hydration

The previous SSR guide depended on the removed `serialization()` enhancer. That enhancer is not part of the current release-candidate public API, so the old hydrate/deserialize recipe has been withdrawn from the live docs.

For this RC, hydrate server data in application code and write the resolved plain state into SignalTree through the surviving state APIs. A future SSR transfer contract needs fresh release authority before this guide can become prescriptive again.
