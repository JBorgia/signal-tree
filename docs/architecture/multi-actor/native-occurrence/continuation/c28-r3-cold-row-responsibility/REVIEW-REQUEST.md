# Independent interpretation review request

Review isolated prototype after focused receipts complete. No activation/integration authority is requested. Base8f9 and root remain unchanged.

Candidate: /private/tmp/st-c28-r3-cold-row-responsibility/candidate
First candidate identity (3127-file source manifest): 812a3ad5d6843e95a791aaf001927d54f67738626360a50afb9f7871fdfcd302
Patch: candidate.patch (five paths). Pre-change tests: FROZEN-ORACLES.json; raw baseline receipts and first failures: runs/. Current candidate receipts: runs/candidate-first and runs/candidate-types.

Questions:
- Does collection reader preserve the old lookup / initial epoch / current subject acquisition / collection owner / activation / handle resolution / final epoch and visibility phases, including reentry, ABA and disappearance? Is any supported cached-facade behavior lost?
- Does dispatch distinguish absent capability from undefined result and propagate present errors, with exact absent fallback receiver/callable-value behavior?
- Are the four caller clone/reference branches unchanged, and do P/R actual getter and removal reference fixtures reach the stated paths without substituting spies for clone callbacks?
- Are cold metadata, inspection, Link holds and later field/selected restoration evidence useful and nonvacuous? Check initial/pending/rollback chronology and capture-drain calibration against README.md:212 rather than microtick assumptions.
- Identify any remaining semantic discriminator or unsupported claim before considering integration. Do not treat native factory/facade counts as performance evidence.

Original P spy and unsupported C historical oracle are preserved, with historical hashes recorded. Review should distinguish source inspection from execution evidence and baseline-only calibrated failures from candidate semantic differences. Main owns integration/activation; worker is not asserting independent review has happened.
