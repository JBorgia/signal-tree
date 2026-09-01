# Custom Enhancers

SignalTree 15 retains the low-level `Enhancer` function type, so an advanced
consumer can supply a typed enhancer directly. It no longer publishes the
helper and dependency-metadata authoring SDK.

Use built-in enhancers from `@signal-tree/kernel` (`batching`, `restoration`,
`transactions`, and `devTools`) and declare them together:
`signalTree(state, { enhancers: [...] })`.

Application-local helper functions can still wrap normal SignalTree usage, but
SignalTree no longer publishes enhancer-author plumbing such as `ENHANCER_META`,
`createEnhancer`, or dependency-order resolution as public API.

Historical versions of this guide taught APIs from
`@signaltree/core/authoring`. That package and subpath no longer exist.
