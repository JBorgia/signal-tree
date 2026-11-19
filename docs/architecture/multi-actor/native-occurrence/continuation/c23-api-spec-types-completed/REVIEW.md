# Frozen public API successor — final spec-type retry

**PASS: canonical spec-types gate exits0 on the unchanged final source.** One authorized retry only. No build, runtime test, baseline update, source edit or new candidate copy.

Candidate: /private/tmp/st-c23-declare-public-successor/candidate. Frozen manifest SHA256 081e2114166b06506da5ea4e9b25544de8f4b2214b9fd16e93a0ad2423d35aaa. Preflight found no existing typecheck process. All manifest entries verified before and after; SOURCE-BEFORE.json and SOURCE-AFTER.json agree. Exact command: Node24.15.0 `node tools/check-spec-types.mjs`; gate invokes its installed compiler with --noEmit --pretty false -p tsconfig.typecheck-specs.json. No --update: existing ratchet remains untouched despite three pre-existing per-file improvement notices.

Own output/cache/data/tmp. External 180-second no-progress watchdog tracked gate startup, actual compiler child and gate output; stable process census was not counted as progress. No watchdog trigger; final owned-group census empty. COMMAND.json, PROCESS-PREFLIGHT.json, PROCESS.json, PROGRESS.json, first.log and RESULT.json preserve raw evidence.

This closes only the pending final spec-type qualification for the frozen type/export checkpoint. It does not resolve the separately reported React runtime safety or direct-row receipt adjudication, qualify release/activation, or supersede original failures. Both previous watchdog attempts and original compiler failures remain untouched in the earlier packet. The prior emission comparison remains separate evidence; no further compiler emission run was needed.
