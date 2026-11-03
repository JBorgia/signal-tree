# Review disposition

Nested validation state added. Input validation now begins inside a conservative
horizon before property/iterator access. Outer unknown cannot be erased by nested
independence. Final disposal clarification is per-connection: disposing outer does
not cancel another nested connection; shared validation must still unwind.

The final draft names the proposed declaration error SignalTreePublicationError with
code/stage/reason/cause, completing the already-reviewed error-channel semantics.
That naming and enum are proposals for owner approval, not existing exports. Callback
error identity and diagnostic-secondary-error precedence remain unchanged.

Only type sketches executed. Initial unexported recovery-type import failure preserved;
corrected types derive recovery through the exported SignalTreeRollbackError. Final
strict noEmit example check passes with negative ordinary async/promise cases and
missing-owner declarations. Fake facade shapes are not framework compatibility proof.

Final record validation: documentation links659/659 resolve; git diff --check passes.
Archive extracted separately; every internal SHA256SUMS entry verifies. No runtime
or package suite/build run. Unrelated AGENTS.md and measurement-contract edits excluded.
