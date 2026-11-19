# Main replay on composed C27

Exact C27 manifest bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd: all 3,086 entries verified before copying. Applied the unchanged read-only diagnostic exports and exact independent public-operation test. No production decision or assertion changed. PREPARE.json and patch.log preserve identities and application.

Command: `python3 run-focused.py first test kernel owner-history-independent.spec.ts --skip-nx-cache --maxWorkers=1` from this packet, targeting its isolated candidate. Pinned Node24.15.0/pnpm10.17.0, own cache/data/tmp, 180-second owned-group limit. Two tests pass, exit0, no timeout, source unchanged. ST_HISTORY_OUTPUT is recorded in COMMAND.json. Original Nx archived-tsconfig warnings remain visible.

The confirm and rollback arms both execute useful exact publication, settlement, duplicate suppression and teardown. Fixed-size public state and one pending destination accumulate 1/2/3/5 actual owner identities after 0/1/2/4 input-owner confirmations. At the last checkpoint four identities are confirmed and one remains pending. After destination confirmation all five confirmed identities remain selected; rollback restores a proof with none. Component ancestry remains flat. MAIN-RESULT.json records exact counts and comparison with the independent C26 run.

This independently reproduces the separate historical-owner retention issue on composed public C27. Passing behavioral assertions are not a retention-bound pass. Counts are source/role observations, not heap bytes or a universal leak claim. No new numeric ceiling, runtime repair, terminal-policy change, source normalization or activation.
