# Frozen scalar discriminator result

Runtime base: `b9eef50de5cdded79792ac043ab99ce03d0144ee`. No runtime diff.
Entity draft61689286 is not present in this checkout. New spec SHA-256:
`758335b2450855bc3050ad16b15f3a56ef1cab395fe383858b17aac7880e0d26`.
The original12 assertions were written and hashed before execution. No assertion
correction or post-failure test revision was made.

Node24.15.0; pnpm10.17.0 via Corepack wrapper; Nx kernel runner, cache skipped.
Raw output: FIRST.log. Result: **6 ordinary passes /6 failures /0 skips /0 expected
failures**. This is a frozen-runtime discriminator, not a passing implementation.

| Case | Direct | Saved | First divergence or completed evidence |
| --- | --- | --- | --- |
| p confirms, q pending, then q confirms | Fail | Fail | Sends7 at p confirmation; later q/r assertions unexecuted |
| q confirms, p pending, then p confirms | Pass | Pass | Holds until p; sends7 while later r remains pending |
| p confirms, q pending, then q rejects | Fail | Fail | Sends7 before q rejection; fresh post-rejection assertions unexecuted |
| q rejects, p pending, then p confirms | Pass | Pass | Holds until p; physical display99, ordinary outgoing7, later r pending |
| Qualified independent write inside p, unrelated q | Fail | Fail | Throws declaration contradiction during p callback; useful-progress assertions unexecuted |

Two additional controls pass: a saved7 authored only after source q rejection is
new surviving truth; and a native supplied speculative q input falsely declared
independent contradicts, retains writes, holds after p confirmation and delivers
only after q confirms. This last control prevents an overly broad removal of all
native known owners from declaration checking.

That last negative control is not yet causal proof of correct input promotion:
the rejected implementation also raises the erroneous destination-p contradiction.
Only a successor passing both the independent-in-p positive control and actual-q
negative control can establish the distinction. Independent review identified
this limit; the result is not overstated as a verified native combination rule.

Four failures discriminate omitted foreign-window responsibility. Two discriminate
destination authorship entering the declaration-input contradiction set. These are
two causal mechanisms, not six independent defects. Q-first successes alone do
not prove the window was captured: the destination p still provides a local gate.

## Source explanation verified by the primary agent

At b9eef50d, lifecycle.ts58 disables W whenever native known owners are nonempty.
Private nativeAuthorship supplies p, so p's own settlement clears the only retained
gate. Raw direct and saved copies expose the same missing q support.

Lifecycle nativeProof at51 unions destination known owners with native inputs and
frames. Lines63–64 and prepareRevision117–130 use that union both as delivery
requirements and declaration input assertions. Independent literal inside p therefore
contradicts even though it consumes no q or speculative native input. The proposed
rule must separate these two uses and promote source authorship to input support
only when an actual native argument consumes that source revision.

## Validation and limits

SPEC-TYPES.log passes the unchanged spec-types ratchet. This is not a claim that
all historical spec diagnostics are zero. Suggested unrelated ratchet improvements
were not applied. No broad suites or runtime typecheck were needed for this test-only
stage. Existing12 test expectations, original root010 and the prior78 controls
remain separate evidence. Those older controls were not rerun here.

The12 cases do not prove the proposed rule is sufficient in native completion,
receipt cleanup, membership, entity installation, reentry, aggregate composition,
or delivery lifecycle. Runtime remains rejected; no cost acceptance follows.

## Review-added normalization controls

Independent review requested an explicit inherited-W(p) plus actual-I(p)
discriminator. The revised specification forbids erasing inherited uncertainty
because the same identity also appears in D, I or validation V. Only this
installation's newly acquired window may normalize duplicate required identities.
The original draft remains SPEC-FIRST.md; no assertion in the first12 changed.

Two appended cases execute inherited W(p) under a complete dependent(p) declaration,
without/with an additional actual native I(p). SECOND.log: **2 passes /12 filtered
skips**. Both preserve conservative/unknown then useful surviving-basis delivery
after p confirms while later r remains pending. This is not14 passing tests.
The first12 were not rerun; emitted JavaScript is identical before/after the local
declaration type extension (FIRST12-EMISSION.json). FINAL-SPEC-TYPES.log passes the
unchanged ratchet. No runtime source was changed for either run.
