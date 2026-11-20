#!/usr/bin/env bash
# Supervisor for the unattended rebuild (BRIEF.md section 11.4).
#
# Run it inside the isolated container or VM, from the agent's checkout of
# JBorgia/signal-tree, with the variables under Environment set:
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
#   SIGNAL_TREE_STATUS_ISSUE      issue number of "Rebuild status" (looked up by title if unset)
#   ANTHROPIC_API_KEY             required: the API key from the VM's secret store (#16)
#   SIGNAL_TREE_APP_ID            required: the signal-tree-ci GitHub App's ID
#   SIGNAL_TREE_APP_INSTALLATION_ID  required: the App's installation ID on JBorgia/signal-tree
#   SIGNAL_TREE_APP_KEY_FILE      required: path to the App's private key (.pem) in the VM's secret store
#   SIGNAL_TREE_GIT_NAME          default "Jonathan Borgia": author and committer name of every commit
#   SIGNAL_TREE_GIT_EMAIL         default jonathanborgia@gmail.com: author and committer email
#
# Exit status: 0 done; 1 setup failed; 2 not the isolated machine, or extra
# arguments set a model; 3 stuck; 4 the agent lock is held or could not be
# taken; 5 a run used another model; 6 no ANTHROPIC_API_KEY; 7 a run could not
# authenticate to Anthropic; 8 the GitHub App variables are missing or the key
# file is unreadable; 9 no GitHub App token could be minted, or git would not
# use it.
#
# Authentication (Jonathan's ruling on #16): Claude Code uses an Anthropic API
# key from the VM's secret store, never a browser login. The supervisor
# refuses to start without one, clears any OAuth token from its environment,
# and stops (instead of retrying) when a run ends on an authentication error.
#
# GitHub identity (BRIEF.md 12.3 and Jonathan's rulings): the signal-tree-ci
# GitHub App authenticates every push and gh call, and turns on auto-merge
# (merge commit) for each PR it opens; commits keep Jonathan as author and
# committer. At start the supervisor copies app-token.mjs and the gh wrapper
# (bin/gh) from its own directory into $SIGNAL_TREE_STATE_DIR/github-app, so a
# branch switch in the agent's checkout cannot remove them, and mints one token
# to fail fast. In its own environment only, which the session and its hooks
# inherit (no git config file is written), it then
#   - unsets GH_TOKEN and GITHUB_TOKEN, so no personal token is ever used;
#   - makes app-token.mjs git's only credential helper for https://github.com,
#     and rewrites github.com SSH remotes to HTTPS so pushes go through it;
#   - sets GIT_AUTHOR_* and GIT_COMMITTER_* from SIGNAL_TREE_GIT_NAME and
#     SIGNAL_TREE_GIT_EMAIL (the agent lock's commit uses them too);
#   - puts the gh wrapper first on PATH.
#
# One session at a time: the supervisor holds the agent lock (refs/agent/lock
# on the remote, see lock.mjs) for as long as it runs, and refuses to start
# while another session holds it.
#
# The main loop always runs on Opus (MODEL below): every run passes --model and
# the same model in its settings, extra arguments may not set a model or a
# fallback model, and a run that reports any other model stops the supervisor.
#
# No tool attribution: the session's settings turn attribution off
# ("attribution": false from Claude Code 2.1.281; on older versions the
# commit and PR attribution texts are emptied and the session URL is off).
set -uo pipefail

readonly MODEL=claude-opus-5-5

main() {
  if [[ "${SIGNAL_TREE_ISOLATED:-}" != 1 ]]; then
    echo "Refusing to start: run this only in the isolated container or VM (BRIEF.md 11.4), with SIGNAL_TREE_ISOLATED=1." >&2
    exit 2
  fi

  SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
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
  if [[ -z ${ANTHROPIC_API_KEY:-} ]]; then
    echo "Refusing to start: set ANTHROPIC_API_KEY from the VM's secret store; the agent never uses a browser login (#16)." >&2
    exit 6
  fi
  unset CLAUDE_CODE_OAUTH_TOKEN
  # GitHub sees only the signal-tree-ci App, never a personal token.
  unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN
  local missing='' name
  for name in SIGNAL_TREE_APP_ID SIGNAL_TREE_APP_INSTALLATION_ID SIGNAL_TREE_APP_KEY_FILE; do
    [[ -n ${!name:-} ]] || missing+=" $name"
  done
  if [[ -n $missing ]]; then
    echo "Refusing to start: set$missing from the VM's secret store; the agent reaches GitHub only as the signal-tree-ci GitHub App." >&2
    exit 8
  fi
  if [[ ! -f $SIGNAL_TREE_APP_KEY_FILE || ! -r $SIGNAL_TREE_APP_KEY_FILE ]]; then
    echo "Refusing to start: SIGNAL_TREE_APP_KEY_FILE ($SIGNAL_TREE_APP_KEY_FILE) is not a readable file; it must be the App's private key." >&2
    exit 8
  fi
  export SIGNAL_TREE_APP_ID SIGNAL_TREE_APP_INSTALLATION_ID SIGNAL_TREE_APP_KEY_FILE
  local log=$SIGNAL_TREE_STATE_DIR/session.log
  mkdir -p "$SIGNAL_TREE_STATE_DIR"
  use_github_app "$SCRIPT_DIR" "$SIGNAL_TREE_STATE_DIR/github-app" || exit 9

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
  local attribution
  attribution=$(attribution_setting "$(claude --version 2>/dev/null | awk '{print $1}')")
  settings=$(jq -cn --arg cmd "$hook" --arg model "$MODEL" --argjson attribution "$attribution" \
    '{model: $model, switchModelsOnFlag: false, attribution: $attribution, hooks: {Stop: [{hooks: [{type: "command", command: $cmd, timeout: 600}]}]}}')

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
    # An authentication failure will not fix itself: stop and say so instead of retrying.
    if [[ -n $(auth_failure "$run_log") ]]; then
      report "The unattended session could not authenticate: $(auth_failure "$run_log"). The supervisor has stopped; check the API key in the VM's secret store (#16)."
      exit 7
    fi
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

# Sets this environment up to reach GitHub as the signal-tree-ci App (see
# "GitHub identity" above): installs app-token.mjs and bin/gh from $1 into $2,
# points git, gh and the commit identity at them, then mints a token and checks
# that git would use it. Prints the reason and returns 1 on any failure.
use_github_app() {
  local from=$1 app_dir=$2 helper user
  if ! { mkdir -p "$app_dir/bin" &&
    install_file "$from/app-token.mjs" "$app_dir/app-token.mjs" 644 &&
    install_file "$from/bin/gh" "$app_dir/bin/gh" 755; }; then
    echo "Refusing to start: could not install the GitHub App helpers into $app_dir." >&2
    return 1
  fi
  printf -v helper '!node %q git-credential' "$app_dir/app-token.mjs"
  # The empty helper clears any inherited one (a gh login, a keychain), so the App's is the only one.
  export GIT_CONFIG_COUNT=4 \
    GIT_CONFIG_KEY_0=credential.https://github.com.helper GIT_CONFIG_VALUE_0= \
    GIT_CONFIG_KEY_1=credential.https://github.com.helper GIT_CONFIG_VALUE_1="$helper" \
    GIT_CONFIG_KEY_2=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_2=git@github.com: \
    GIT_CONFIG_KEY_3=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_3=ssh://git@github.com/ \
    GIT_TERMINAL_PROMPT=0
  export SIGNAL_TREE_GIT_NAME=${SIGNAL_TREE_GIT_NAME:-Jonathan Borgia}
  export SIGNAL_TREE_GIT_EMAIL=${SIGNAL_TREE_GIT_EMAIL:-jonathanborgia@gmail.com}
  export GIT_AUTHOR_NAME=$SIGNAL_TREE_GIT_NAME GIT_COMMITTER_NAME=$SIGNAL_TREE_GIT_NAME \
    GIT_AUTHOR_EMAIL=$SIGNAL_TREE_GIT_EMAIL GIT_COMMITTER_EMAIL=$SIGNAL_TREE_GIT_EMAIL
  export PATH=$app_dir/bin:$PATH

  if ! node "$app_dir/app-token.mjs" token > /dev/null; then
    echo "Refusing to start: could not mint a GitHub App installation token (the reason is above)." >&2
    return 1
  fi
  user=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^username=//p')
  if [[ $user != x-access-token ]]; then
    echo "Refusing to start: git would not use the App's credentials for https://github.com (the GIT_CONFIG_* environment needs git 2.31 or later)." >&2
    return 1
  fi
}

# Copies $1 to $2 with mode $3, replacing $2 in one step.
install_file() {
  cp "$1" "$2.new.$$" && chmod "$3" "$2.new.$$" && mv -f "$2.new.$$" "$2"
}

# The error text of a run that failed to authenticate, or nothing.
auth_failure() {
  jq -r 'select(.type == "result" and .is_error == true) | .result // empty' "$1" 2>/dev/null | grep -i -m1 -E 'authenticat|api key|unauthori[sz]ed|401'
}

# True when version $1 is at least $2 (dotted numbers).
version_ge() {
  [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" == "$2" ]]
}

# The attribution setting for Claude Code version $1, as JSON.
attribution_setting() {
  if [[ -n $1 ]] && version_ge "$1" 2.1.281; then
    echo false
  else
    echo '{"commit": "", "pr": "", "sessionUrl": false}'
  fi
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
