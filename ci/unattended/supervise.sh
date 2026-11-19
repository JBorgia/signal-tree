#!/usr/bin/env bash
# Supervisor for the unattended rebuild (BRIEF.md section 11.4).
#
# Run it inside the isolated container or VM, signed in to gh as the bot
# account, from the agent's checkout of JBorgia/signal-tree:
#
#   SIGNAL_TREE_ISOLATED=1 tmux new-session -d -s rebuild ci/unattended/supervise.sh
#
# Each pass: sync a clean checkout of origin/main (the verifier), run the done
# check there, and stop when it passes. Otherwise start or resume one Claude
# Code session with /goal and the Stop hook from the verifier checkout. A crash
# or usage limit ends the claude process; the loop resumes the same session
# with backoff. If the Stop hook let the session stop as stuck (20 blocked
# stops with no new commit) and nothing has been committed since, the
# supervisor posts on the Rebuild status issue and exits instead of looping.
#
# Sessions run with -p, which `--continue` does not pick up, so the session is
# resumed by its fixed ID with `--resume`.
#
# Environment:
#   SIGNAL_TREE_ISOLATED=1        required; confirms this is the isolated machine
#   SIGNAL_TREE_STATE_DIR         default ~/.signal-tree-unattended (session ID, hook state, logs)
#   SIGNAL_TREE_VERIFY_DIR        default $SIGNAL_TREE_STATE_DIR/verify
#   SIGNAL_TREE_CLAUDE_ARGS       default "--permission-mode bypassPermissions"
#   SIGNAL_TREE_STATUS_ISSUE      issue number of "Rebuild status" (looked up by title if unset)
set -uo pipefail

main() {
  if [[ "${SIGNAL_TREE_ISOLATED:-}" != 1 ]]; then
    echo "Refusing to start: run this only in the isolated container or VM (BRIEF.md 11.4), with SIGNAL_TREE_ISOLATED=1." >&2
    exit 2
  fi

  WORK_DIR=$(git rev-parse --show-toplevel)
  export SIGNAL_TREE_WORK_DIR=$WORK_DIR
  export SIGNAL_TREE_STATE_DIR=${SIGNAL_TREE_STATE_DIR:-$HOME/.signal-tree-unattended}
  export SIGNAL_TREE_VERIFY_DIR=${SIGNAL_TREE_VERIFY_DIR:-$SIGNAL_TREE_STATE_DIR/verify}
  local claude_args=${SIGNAL_TREE_CLAUDE_ARGS:---permission-mode bypassPermissions}
  local log=$SIGNAL_TREE_STATE_DIR/session.log
  mkdir -p "$SIGNAL_TREE_STATE_DIR"

  if [[ ! -d $SIGNAL_TREE_VERIFY_DIR/.git ]]; then
    git clone -q "$(git -C "$WORK_DIR" remote get-url origin)" "$SIGNAL_TREE_VERIFY_DIR" || exit 1
  fi

  local session_file=$SIGNAL_TREE_STATE_DIR/session-id
  local fresh=0
  if [[ ! -s $session_file ]]; then
    uuidgen | tr 'A-Z' 'a-z' > "$session_file"
    fresh=1
  fi
  local session_id
  session_id=$(cat "$session_file")

  # The hook command resets the verifier to origin/main before running the hook
  # from it, so the hook and the done check are always main's versions.
  local hook='git -C "$SIGNAL_TREE_VERIFY_DIR" fetch -q origin main && git -C "$SIGNAL_TREE_VERIFY_DIR" reset -q --hard origin/main && git -C "$SIGNAL_TREE_VERIFY_DIR" clean -qfdx -e node_modules && node "$SIGNAL_TREE_VERIFY_DIR/ci/unattended/stop-hook.mjs"'
  local settings
  settings=$(jq -cn --arg cmd "$hook" '{hooks: {Stop: [{hooks: [{type: "command", command: $cmd, timeout: 600}]}]}}')

  local backoff=60
  while true; do
    sync_verifier
    if (cd "$SIGNAL_TREE_VERIFY_DIR" && node ci/done-check.mjs); then
      echo "Done: node ci/done-check.mjs passes on origin/main."
      exit 0
    fi
    if node "$SIGNAL_TREE_VERIFY_DIR/ci/unattended/stop-hook.mjs" --is-stuck; then
      report_stuck
      exit 3
    fi

    local started=$SECONDS
    if (( fresh )); then
      # shellcheck disable=SC2086
      claude -p --session-id "$session_id" --settings "$settings" $claude_args --output-format stream-json --verbose \
        "/goal node ci/done-check.mjs exits 0" >> "$log" 2>&1
      fresh=0
    else
      # shellcheck disable=SC2086
      claude -p --resume "$session_id" --settings "$settings" $claude_args --output-format stream-json --verbose \
        "Continue the rebuild from BRIEF.md where you left off. The goal stands: node ci/done-check.mjs exits 0." >> "$log" 2>&1
    fi
    local status=$?
    echo "$(date -u +%FT%TZ) claude exited with $status after $((SECONDS - started))s" >> "$log"

    # A quick exit usually means a usage limit or an outage: back off, up to 30 minutes.
    if (( SECONDS - started < 300 )); then
      sleep "$backoff"
      backoff=$(( backoff * 2 > 1800 ? 1800 : backoff * 2 ))
    else
      backoff=60
    fi
  done
}

sync_verifier() {
  git -C "$SIGNAL_TREE_VERIFY_DIR" fetch -q origin main &&
    git -C "$SIGNAL_TREE_VERIFY_DIR" reset -q --hard origin/main &&
    git -C "$SIGNAL_TREE_VERIFY_DIR" clean -qfdx -e node_modules &&
    (cd "$SIGNAL_TREE_VERIFY_DIR" && pnpm install --frozen-lockfile --prefer-offline > /dev/null)
}

report_stuck() {
  local issue=${SIGNAL_TREE_STATUS_ISSUE:-}
  if [[ -z $issue ]]; then
    issue=$(gh issue list --state open --search 'in:title "Rebuild status"' --json number,title --jq '.[] | select(.title == "Rebuild status") | .number' | head -1)
  fi
  local next
  next=$(cd "$SIGNAL_TREE_VERIFY_DIR" && node ci/done-check.mjs 2>&1 | head -20)
  local body="The unattended session stopped as stuck: 20 consecutive stops were blocked with no new commit. The supervisor has stopped resuming it.

\`\`\`text
$next
\`\`\`"
  if [[ -n $issue ]]; then
    gh issue comment "$issue" --body "$body"
  else
    echo "$body" >&2
  fi
}

# Parse the whole script before running it, so edits to this file while it
# runs cannot change what the running loop does.
main "$@"
exit
