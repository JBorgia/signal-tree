# Persistence Guide

The old `stored(key, default, options?)` marker, storage-key helpers, and cache-aware loader persistence path are not part of the current release-candidate public API.

For this RC, keep persistence in application-owned services or framework storage primitives, then write resolved values into SignalTree through ordinary state or `entityMap()` APIs. A future persistence surface needs a fresh public contract and release authority before it returns to these docs.
