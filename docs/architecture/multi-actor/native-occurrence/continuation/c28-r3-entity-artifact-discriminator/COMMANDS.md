# Commands and first results

Pinned node /Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node.

1. node consumer.mjs (cwd-independent absolute script): exit1; unbundled-first.log.
2. node bundle.mjs: exit0; bundle-first.log, production-metafile.json. Browser ESM production bundle, minify/treeShaking true, ngDevMode:false and NODE_ENV:production; package sideEffects untouched; no plugin overrides. Only normal framework externals @angular/*,rxjs,rxjs/*,tslib. Public kernel entry resolves through exact installed tarballs from composed artifact proof.
3. node consumer.production.mjs: exit1; production-first.log.
4. python3 run-source.py source-first test kernel src/lib/packed-entity-counterpart.spec.ts --skip-nx-cache --maxWorkers=1: exit0,8pass; raw command/process/results/log in runs/source-first. Own reconstructed source copy, only added harness spec; it imports exact same cases.mjs with source public barrel. No runtime edits/private hooks.180s external cap unused.

First public scripts each completed within the initial tool call. No retries, private enable, altered manifests, runtime instrumentation, config weakening or receipt-oracle repairs. Node executes browser-target neutral output without browser-specific APIs. Eight logical cases across three routes; counts overlap and are not24 unique controls.
