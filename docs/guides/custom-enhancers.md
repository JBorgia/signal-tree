# Custom Enhancers

The public custom-enhancer authoring surface was removed for SignalTree 15.0.

Use built-in enhancers from `@signaltree/core` (`batching`, `restoration`, `transactions`, `serialization`, `persistence`, `devTools`) and declare them together: `signalTree(state, { enhancers: [...] })`.

Application-local helper functions can still wrap normal SignalTree usage, but SignalTree no longer publishes enhancer-author plumbing such as `ENHANCER_META`, `createEnhancer`, or dependency-order resolution as public API.

Historical versions of this guide taught APIs from `@signaltree/core/authoring`. That subpath no longer exists.
