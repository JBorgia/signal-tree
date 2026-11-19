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
#   SIGNAL_TREE_CLAUDE_ARGS       default "--permission-mode bypassPermissions"; may not set the model
#
# One session at a time: the supervisor holds the agent lock (refs/agent/lock
# on the remote, see lock.mjs) for as long as it runs, and refuses to start
# while another session holds it.
#
# The main loop always runs on Opus (MODEL below): every run passes --model and
# the same model in its settings, extra arguments may not set a model or a
# fallback model, and a run that reports any other model stops the supervisor.
#   SIGNAL_TREE_STATUS_ISSUE      issue number of "Rebuild status" (looked up by title if unset)
set -uo pipefail

readonly MODEL=claude-opus-5-5

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
  if [[ $claude_args == *--model* || $claude_args == *--fallback-model* ]]; then
    echo "Refusing to start: the main loop is pinned to $MODEL; SIGNAL_TREE_CLAUDE_ARGS may not set a model." >&2
    exit 2
  fi
  # These would override the model the settings give (ANTHROPIC_MODEL outranks settings).
  unset ANTHROPIC_MODEL ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL
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

  # One agent session at a time, across machines.
  sync_verifier || exit 1
  local lock_cmd="node $SIGNAL_TREE_VERIFY_DIR/ci/unattended/lock.mjs"
  (cd "$WORK_DIR" && $lock_cmd acquire --session "$session_id") || exit 4
  trap '(cd "$WORK_DIR" && '"$lock_cmd"' release --session '"$session_id"')' EXIT

  # The hook command resets the verifier to origin/main before running the hook
  # from it, so the hook and the done check are always main's versions.
  local hook='git -C "$SIGNAL_TREE_VERIFY_DIR" fetch -q origin main && git -C "$SIGNAL_TREE_VERIFY_DIR" reset -q --hard origin/main && git -C "$SIGNAL_TREE_VERIFY_DIR" clean -qfdx -e node_modules && node "$SIGNAL_TREE_VERIFY_DIR/ci/unattended/stop-hook.mjs"'
  local settings
  # switchModelsOnFlag: false stops Claude Code re-running a flagged request on an older model.
  settings=$(jq -cn --arg cmd "$hook" --arg model "$MODEL" '{model: $model, switchModelsOnFlag: false, hooks: {Stop: [{hooks: [{type: "command", command: $cmd, timeout: 600}]}]}}')

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
    local run_log=$SIGNAL_TREE_STATE_DIR/run.log
    if (( fresh )); then
      # shellcheck disable=SC2086
      claude -p --session-id "$session_id" --settings "$settings" $claude_args --model "$MODEL" --output-format stream-json --verbose \
        "/goal node ci/done-check.mjs exits 0" > "$run_log" 2>&1
      fresh=0
    else
      # shellcheck disable=SC2086
      claude -p --resume "$session_id" --settings "$settings" $claude_args --model "$MODEL" --output-format stream-json --verbose \
        "Continue the rebuild from BRIEF.md where you left off. The goal stands: node ci/done-check.mjs exits 0." > "$run_log" 2>&1
    fi
    local status=$?
    cat "$run_log" >> "$log"
    local ran_on
    # Every model the run reports: the init event and each assistant message.
    ran_on=$(jq -r 'select(.type == "system" and .subtype == "init") .model, select(.type == "assistant") .message.model' "$run_log" 2>/dev/null | sort -u | grep -v -x -e "$MODEL" -e '' | paste -sd, -)
    if [[ -n $ran_on ]]; then
      report "The unattended session ran on $ran_on instead of $MODEL. The supervisor has stopped; the main loop must run on Opus."
      exit 5
    fi
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

report() {
  local issue=${SIGNAL_TREE_STATUS_ISSUE:-}
  if [[ -z $issue ]]; then
    issue=$(gh issue list --state open --search 'in:title "Rebuild status"' --json number,title --jq '.[] | select(.title == "Rebuild status") | .number' | head -1)
  fi
  if [[ -n $issue ]]; then gh issue comment "$issue" --body "$1"; else echo "$1" >&2; fi
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
