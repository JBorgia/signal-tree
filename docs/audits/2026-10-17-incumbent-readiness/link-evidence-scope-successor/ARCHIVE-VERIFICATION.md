# Archive verification

2026-10-26: all thirteen payload hashes in the initial archive manifest matched
on reread in the readiness checkout. Raw source snapshots and test logs remain
inside raw-evidence.tar.gz. The exact diff is compressed as successor.patch.gz
without changing its bytes, so whitespace in diff context is preserved.

The incremental bundle verifies successfully in the candidate repository and
names2dacae7b9e9137018d05c4e00382ac9287bc76d4. Verification attempted inside the
readiness repository first reported the missing prerequisite
2d71d73305fea23173b3b681c2a897ef1a7dffba; this is an incremental-bundle prerequisite,
not a test failure or evidence that readiness contains candidate runtime. The
predecessor remains preserved separately; replay explicitly requires that base.

The readiness documentation command was:

```sh
node --import /private/tmp/link-a1-doc-loader.mjs tools/check-doc-links.mjs
```

Result857/857 relative links resolve across196 live surfaces. This verifies
archive/controller links, not runtime qualification. Source candidate was clean,
714 final observed files matched the before/after run manifest and frozen commit,
and source diff checks passed. Final readiness commit checks are reported by the
committing agent; no hidden full suite or artifact result is implied.
