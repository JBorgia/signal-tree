# Record validation

Executed against baseline ffc50d3be5b19bd76c1cd4c20bc7d8144972b73b with only research/controller documentation added. No package source changes.

- `node tools/check-doc-links.mjs`: 611 relative links across 159 live surfaces; 611 resolve.
- `git diff --check`: exit 0.
- Extracted `evidence.tar.gz` independently, then `shasum -a 256 -c SHA256SUMS` inside bridge/: all 31 entries OK.
- Root bundle/model replay, strict typecheck and two reviewer counterexamples are preserved inside archive root/. Input hash verification: 88/88 match for each arm; baseline zero transformations, private build exactly Link and PathNotifier changed in memory.

No full runtime suites, benchmarks, production artifact builds or release sign-off were performed for this documentation-only result. Existing evidence does not transfer acceptance to the failed research bridge.
