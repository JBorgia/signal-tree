# Preserved local audit evidence

Archive: `/private/tmp/st-b-dependency-audit.tar.gz`

SHA-256: `0498d682b576f6a554bf186328b364a8a5d2b9139f4e0dbfa71ed981da0d8230`

Includes first ten-case source/results, twelve-case results, root 25-case JSON/log, spec-type and lint logs, independent review, final test source and runtime seal. `evidence-manifest.json` hashes every evidence file except itself. Runtime files in source-seal.json were compared byte-for-byte with the audited checkpoint; no runtime repair is included.
