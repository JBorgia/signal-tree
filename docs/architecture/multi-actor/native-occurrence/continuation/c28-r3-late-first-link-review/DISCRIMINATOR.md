# One public-root split-graph discriminator

**Unreached: registration is in the initial evaluation closure. No runtime failure or late-enrollment success claimed.** Stopped after the first build/graph, per authorization. No behavior invocation, second bundler variant, package install, network access, Nx or profiler run.

Used existing installed consumer `/private/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-entity-artifact-d3NzhJ/baseline`. Independently compared all139 retained kernel package files to8f9 dist: identical paths/bytes (INSTALLED-IDENTITY.json). Fixtures in this review packet resolve that existing installation via node_modules symlink; frozen sources and consumer package contents were untouched.

`initial.mjs` uses only the public kernel root for signalTree/entityMap/transactions, prepares a populated pending row change before dynamic import of `lazy.mjs`, which imports link through the same public root. Planned behavior assertions were pending hold, meaningful confirm/rollback state and exact output; they were deliberately **not executed** because graph reachability failed.

One local esbuild0.25.12 build used ESM splitting, tree shaking, production defines, browser platform, nonminified readable output and the established peer externals. BUILD-COMMAND.json records exact options; first-build.log preserves first output (exit0); metafile.json and emitted files are retained. This is a loading-model discriminator, not a byte/timing comparison.

The initial closure is `split/initial.js` plus `split/chunk-4ZNWTTLN.js`. The latter contains the sole contributing entity-publication module and Link module. Direct code inspection confirms top-level `registerEntityPublicationFactory(createEntityPublicationParticipant)` at chunk line7537. Initial.js statically imports that shared chunk; lazy-YTJPSRU4.js also imports Link from it. The dynamic import occurs only later in the authored run function. Therefore registration has already executed before any tree or pending operation from this entry can run. No duplicate authority was needed to explain the outcome.

GRAPH-RESULT.json classifies `unreached-registration-in-initial-closure`; DISCRIMINATOR-HASHES.json binds fixtures, options, graph and output. No claim that every supported splitting strategy must behave identically. The existing selective no-Link graph remains unchanged. This first actual public-root split graph supplies no evidence for treating the private late-import gap as a public release blocker, and supplies no behavioral proof for genuine first-module lateness.
