# Exact C8 parent snapshot discriminator

Runtime is byte-identical to C8 manifest `3ad1adb2de2936e52baf2ca06d630babc858d4186c2c4fed48818639056b388a`. All 3,031 baseline files verified after execution. The unchanged C7a test-only patch was applied in a separate disposable copy.

Kernel: 3 pass / 2 fail. Angular: 2 pass / 3 fail. Post-install ordinary completion observes stale `{}`; nested read-derived whole assignment loses installed `a`. Warmed native computed timing remains preserved; direct SignalTree snapshot freshness fails. Original raw commands, assertion failures and source-before/after checks are retained under runs.

This is a current-candidate reproduction, not proof of a repair. No runtime or original expectations changed; no broad qualification.
