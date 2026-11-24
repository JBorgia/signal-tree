#!/usr/bin/env bash
# Supervisor for the unattended rebuild (BRIEF.md section 11.4).
#
# Run it inside the isolated container or VM, in the agent's checkout of
# JBorgia/signal-tree, from main's copy of this script installed root-owned and
# read-only under /opt/signal-tree (see Installed copy), with the variables
# under Environment set. On the agent VM, /opt/signal-tree/start-supervisor
# does this (#18):
#
#   cd ~/signal-tree && SIGNAL_TREE_ISOLATED=1 tmux new-session -d -s rebuild /opt/signal-tree/ci/unattended/supervise.sh
#
# `supervise.sh --self-test` runs every startup check, through the workflow
# self-test, prints "Startup self-test: PASS" and exits 0, without taking the
# agent lock or starting a session (the startup self-test in #18).
#
# Each pass: sync a clean checkout of origin/main (the verifier), run the done
# check there, and stop when it passes. Otherwise start or resume one Claude
# Code session with /goal and the Stop hook from the verifier checkout. A crash
# ends the claude process; the loop resumes the same session with backoff. A
# usage limit pauses it: the loop waits until the limit resets, then resumes
# the same session (see Authentication). If the Stop hook let the session stop
# as stuck (20 blocked stops with no new commit) and nothing has been committed
# since, the supervisor posts on the Rebuild status issue and exits instead of
# looping.
#
# Sessions run with -p, which `--continue` does not pick up, so the session is
# resumed by its fixed ID with `--resume`.
#
# Environment:
#   SIGNAL_TREE_ISOLATED=1        required; confirms this is the isolated machine
#   SIGNAL_TREE_STATE_DIR         default ~/.signal-tree-unattended (session ID, hook state, logs, App token);
#                                 made mode 700, and refused inside the agent's checkout or the verifier
#   SIGNAL_TREE_VERIFY_DIR        default $SIGNAL_TREE_STATE_DIR/verify
#   SIGNAL_TREE_CLAUDE_ARGS       default "--permission-mode bypassPermissions"; may not set the model
#   SIGNAL_TREE_STATUS_ISSUE      issue number of "Rebuild status" (looked up by title if unset)
#   CLAUDE_CODE_OAUTH_TOKEN       required: the long-lived token of Jonathan's Claude subscription, made with
#                                 `claude setup-token` as the agent user; the root-owned launcher reads it
#                                 from the agent user's secret store and exports it (#18)
#   ANTHROPIC_API_KEY             must not be set, not even empty: the subscription is the only Claude credential
#   ANTHROPIC_AUTH_TOKEN          must not be set, not even empty, for the same reason
#   SIGNAL_TREE_MINT_COMMAND      default "sudo -n -u st-mint /opt/signal-tree/mint-token": prints a
#                                 GitHub App token as the user that owns the App's key (mint-token.mjs)
#   SIGNAL_TREE_APP_CONFIG        default /etc/signal-tree/app.json: the mint config whose keyFile this
#                                 user must not be able to read (the mint command itself reads only the default)
#   SIGNAL_TREE_GIT_NAME          default "Jonathan Borgia": author and committer name of every commit
#   SIGNAL_TREE_GIT_EMAIL         default jonathanborgia@gmail.com: author and committer email
#   SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST  for tests only: 1 skips the workflow self-test, with a
#                                 warning, when origin is a fake remote; ignored when origin is on github.com
#
# Exit status: 0 done, or the self-test passed; 1 setup failed; 2 not the
# isolated machine, an argument other than --self-test, extra arguments set a
# model, or the state directory is inside a checkout; 3 stuck;
# 4 the agent lock is held or could not be taken; 5 a run used another model;
# 6 no CLAUDE_CODE_OAUTH_TOKEN, or ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is
# set; 7 a run could not authenticate to Anthropic (a usage limit is not a
# failure and never ends the supervisor); 8 is no
# longer used; 9 the mint command gave no GitHub App token, or git would not use
# it; 10 origin is not https://github.com/JBorgia/signal-tree(.git) for fetch
# and push, git config sets an extra HTTP header, or `git ls-remote origin`
# fails as the App; 11 no real gh outside the wrapper, or gh has a stored login;
# 12 main's rules do not require an approving review, code-owner review and
# status checks, or could not be read; 13 this user can read the App's private
# key, or the mint config naming it cannot be read; 14 the workflow self-test
# failed: GitHub accepted the App's push of a workflow file (the branch is then
# deleted), refused it for another reason, or did not answer in time; 15 this
# script or a helper it installs is not main's, or main could not be fetched to
# compare them (check_installed_copy).
#
# Installed copy (BRIEF.md 11.4 and rule 4; Jonathan's ruling of 2026-11-24):
# the supervisor runs from main's copy, installed root-owned and read-only
# under /opt/signal-tree as mint-token.mjs is, never from the agent's checkout,
# whose branch the agent controls. Before it takes the lock it refuses to start
# (exit 15) unless this script and the helpers it installs (see GitHub
# identity) have the SHA-256 hashes of ci/unattended/supervise.sh,
# ci/unattended/app-token.mjs, ci/unattended/bin/gh and ci/codeowners.mjs at
# origin/main, fetched as the App. A copy that main has moved past is
# reinstalled from main before the supervisor can start again.
#
# Authentication (Jonathan's ruling of 2026-11-23, replacing the API-key ruling
# on #16): Claude Code uses Jonathan's Claude subscription, never an API key or
# a browser login. Its credential is the long-lived token that
# `claude setup-token` makes as the agent user, kept in that user's secret
# store and exported by the launcher as CLAUDE_CODE_OAUTH_TOKEN; the session
# inherits it. The supervisor refuses to start (exit 6) without that token, or
# with ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN set at all, even empty, so the
# subscription is the only Claude credential. When a run ends on an
# authentication error it stops (exit 7) instead of retrying, and its report
# says to re-run `claude setup-token` as the agent user and replace the token
# in the secret store (#18).
#
# A usage limit of the subscription is a pause, not a failure (the same
# ruling). When a run ends on one (usage_limit), the supervisor notes
# "<time> usage limit (<type>) reached; paused until <reset>" in the session
# log, waits until a minute after the limit resets (30 minutes when the run
# gives no usable reset time), and resumes the same session. It never exits,
# reports or counts toward stuck for it. The wait reads the time once
# (date +%s) and runs sleep through PATH.
#
# GitHub identity (BRIEF.md 12.3 and Jonathan's rulings): the signal-tree-ci
# GitHub App authenticates every push and gh call, and turns on auto-merge
# (merge commit) for each PR it opens from a JBorgia/signal-tree branch into
# main that touches no code-owned path; commits keep Jonathan as author and
# committer. At start the supervisor copies app-token.mjs and the gh wrapper
# (bin/gh) from its own directory, and the CODEOWNERS matcher the wrapper runs
# (ci/codeowners.mjs), into $SIGNAL_TREE_STATE_DIR/github-app, so a branch
# switch in the agent's checkout cannot remove or change them.
#
# The agent never holds the App's private key (Jonathan's ruling: "the VM uses
# a separate Unix user that owns the key. The agent may run only the
# token-minting command through sudo and receives 1-hour tokens."). The
# supervisor refuses to start if its own user can read the key named in the
# mint config, and gets one token from the mint command, bypassing the cache,
# to fail fast. In its own environment, which the session and its hooks
# inherit, it then
#   - unsets GH_TOKEN and GITHUB_TOKEN, so no personal token is ever used;
#   - replaces the machine's git config with github-app/gitconfig
#     (GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM), so none of its insteadOf rules,
#     extra headers or credential helpers apply; the checkout's own config
#     still does;
#   - makes app-token.mjs git's only credential helper for https://github.com,
#     turns off askpass programs and terminal prompts, and allows only HTTPS
#     and local paths (GIT_ALLOW_PROTOCOL=https:file), so SSH cannot be used;
#   - sets GIT_AUTHOR_* and GIT_COMMITTER_* from SIGNAL_TREE_GIT_NAME and
#     SIGNAL_TREE_GIT_EMAIL (the agent lock's commit uses them too);
#   - puts the gh wrapper first on PATH, drops relative PATH entries, resolves
#     the real gh once (SIGNAL_TREE_REAL_GH, for the wrapper), and points gh at
#     the empty config directory $SIGNAL_TREE_STATE_DIR/gh-config
#     (GH_CONFIG_DIR).
# Before it takes the lock it refuses to start unless origin's fetch and push
# URLs are exactly https://github.com/JBorgia/signal-tree(.git), no git config
# sets an extra HTTP header, gh has no stored login, main's rules require at
# least one approving review, code-owner review and status checks (so
# auto-merge still waits for them; see check_main_rules), and
# `git ls-remote origin` works as the App, and this script and its helpers are
# main's (check_installed_copy). Last, it checks that GitHub refuses the App's
# push of a workflow file to a scratch branch (workflow_selftest).
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
# Everything the supervisor and the session create is private to this user.
umask 077

readonly MODEL=claude-opus-5-5
readonly REPO=JBorgia/signal-tree
# The files that make up the supervisor, as "<path under this script's
# directory>:<path in the repository>": this script and what install_helpers copies.
readonly SUPERVISOR_FILES='supervise.sh:ci/unattended/supervise.sh app-token.mjs:ci/unattended/app-token.mjs bin/gh:ci/unattended/bin/gh ../codeowners.mjs:ci/codeowners.mjs'

main() {
  local self_test=0
  if [[ $# -eq 1 && $1 == --self-test ]]; then
    self_test=1
  elif (( $# > 0 )); then
    echo "Usage: supervise.sh [--self-test]" >&2
    exit 2
  fi
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
  # The subscription token is the only Claude credential (Jonathan's ruling of
  # 2026-11-23); the session inherits it. ${!name+set} is "set at all, even
  # empty", like [[ -v ]], which bash 3.2 lacks.
  local credential
  for credential in ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN; do
    if [[ -n ${!credential+set} ]]; then
      echo "Refusing to start: $credential is set. This VM uses Jonathan's Claude subscription (CLAUDE_CODE_OAUTH_TOKEN) as its only Claude credential; unset $credential, even if empty." >&2
      exit 6
    fi
  done
  if [[ -z ${CLAUDE_CODE_OAUTH_TOKEN:-} ]]; then
    echo "Refusing to start: set CLAUDE_CODE_OAUTH_TOKEN to the token of Jonathan's Claude subscription, made with \`claude setup-token\` as the agent user, from that user's secret store (#18). This VM uses the subscription, never an API key or a browser login." >&2
    exit 6
  fi
  # GitHub sees only the signal-tree-ci App, never a personal token. The
  # App's key and IDs belong to the mint user, not this environment.
  unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN
  unset SIGNAL_TREE_APP_ID SIGNAL_TREE_APP_INSTALLATION_ID SIGNAL_TREE_APP_KEY_FILE
  check_state_dir || exit 2
  check_key_unreadable || exit 13
  local log=$SIGNAL_TREE_STATE_DIR/session.log
  mkdir -p "$SIGNAL_TREE_STATE_DIR" && chmod 700 "$SIGNAL_TREE_STATE_DIR" || exit 1
  use_github_app "$SCRIPT_DIR" "$SIGNAL_TREE_STATE_DIR/github-app" || exit 9
  check_origin "$WORK_DIR" || exit 10
  use_real_gh "$SIGNAL_TREE_STATE_DIR/gh-config" "$SIGNAL_TREE_STATE_DIR/github-app/bin/gh" "$SCRIPT_DIR/bin/gh" || exit 11
  check_main_rules || exit 12
  if ! git -C "$WORK_DIR" ls-remote -q origin HEAD > /dev/null; then
    echo "Refusing to start: git ls-remote origin failed as the App (the error is above)." >&2
    exit 10
  fi
  check_installed_copy "$WORK_DIR" "$SCRIPT_DIR" 30 || exit 15
  workflow_selftest "$WORK_DIR" 30 || exit 14
  if (( self_test )); then
    echo "Startup self-test: PASS (every startup check, through the workflow self-test; no lock taken, no session started)."
    exit 0
  fi

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

  run_sessions "$session_id" "$fresh" "$settings" "$claude_args" "$log"
}

# Starts session $1 (when $2 is 1) or resumes it, with settings $3 and the
# extra arguments $4, until the done check passes on origin/main (exit 0),
# appending each run's events to the session log $5. Exits when a run is stuck
# (3), used another model (5) or could not authenticate (7); waits out a usage
# limit (pause_for_usage_limit) and backs off after any other quick exit.
run_sessions() {
  local session_id=$1 fresh=$2 settings=$3 claude_args=$4 log=$5
  local backoff=60 limit
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
    # Every model the run reports other than Opus: the init event and each
    # assistant message. <synthetic> is not a model: Claude Code writes its own
    # messages under that name, such as "Goal set: ..." when /goal starts a
    # session, an API error or a usage limit, so it never counts as another
    # model.
    ran_on=$(jq -r 'select(.type == "system" and .subtype == "init") .model, select(.type == "assistant") .message.model' "$run_log" 2>/dev/null | sort -u | grep -v -x -e "$MODEL" -e '<synthetic>' -e '' | paste -sd, -)
    # A usage limit is a pause, not a failure (Jonathan's ruling of 2026-11-23):
    # wait for the reset, then resume the same session. A run that reports
    # another model still stops below.
    limit=$(usage_limit "$run_log")
    if [[ -n $limit && -z $ran_on ]]; then
      pause_for_usage_limit "$limit" "$log"
      backoff=60
      continue
    fi
    # An authentication failure will not fix itself: stop and say so instead of retrying.
    if [[ -n $(auth_failure "$run_log") ]]; then
      report "The unattended session could not authenticate: $(auth_failure "$run_log"). The supervisor has stopped; as the agent user, re-run \`claude setup-token\` and replace the token in the agent user's secret store (#18)."
      exit 7
    fi
    if [[ -n $ran_on ]]; then
      report "The unattended session ran on $ran_on instead of $MODEL. The supervisor has stopped; the main loop must run on Opus."
      exit 5
    fi
    echo "$(date -u +%FT%TZ) claude exited with $status after $((SECONDS - started))s" >> "$log"

    # A quick exit usually means an outage (a usage limit is waited out above): back off, up to 30 minutes.
    if (( SECONDS - started < 300 )); then
      sleep "$backoff"
      backoff=$(( backoff * 2 > 1800 ? 1800 : backoff * 2 ))
    else
      backoff=60
    fi
  done
}

# Refuses a state directory inside the agent's checkout or the verifier: it
# holds the App token, which must stay out of anything treated as the repository.
check_state_dir() {
  local state work verify
  state=$(physical_path "$SIGNAL_TREE_STATE_DIR")
  work=$(physical_path "$WORK_DIR")
  verify=$(physical_path "$SIGNAL_TREE_VERIFY_DIR")
  if [[ $state == "$work" || $state == "$work"/* || $state == "$verify" || $state == "$verify"/* ]]; then
    echo "Refusing to start: SIGNAL_TREE_STATE_DIR ($SIGNAL_TREE_STATE_DIR) is inside the agent's checkout or the verifier; it holds the App token, so keep it outside both." >&2
    return 1
  fi
}

# The absolute physical path of $1, which need not exist yet.
physical_path() {
  local dir=$1 rest='' base
  while [[ ! -d $dir ]]; do
    rest=/$(basename "$dir")$rest
    dir=$(dirname "$dir")
  done
  base=$(cd "$dir" && pwd -P)
  if [[ -n $rest ]]; then echo "${base%/}$rest"; else echo "$base"; fi
}

# Refuses to start if this user can read the App's private key: the keyFile
# that the mint config ($SIGNAL_TREE_APP_CONFIG, default
# /etc/signal-tree/app.json) names. A config it cannot read counts as a
# failure too, so a misconfigured VM cannot expose the key unnoticed.
check_key_unreadable() {
  local config=${SIGNAL_TREE_APP_CONFIG:-/etc/signal-tree/app.json} key
  if ! key=$(jq -er '.keyFile | select(type == "string" and startswith("/"))' "$config" 2> /dev/null); then
    echo "Refusing to start: cannot read the key path (keyFile) from $config, so cannot check that $(id -un) cannot read the App's private key; see ci/unattended/mint-token.mjs." >&2
    return 1
  fi
  if [[ -r $key ]]; then
    echo "Refusing to start: $(id -un) can read the App's private key $key; only the mint user may (see ci/unattended/mint-token.mjs)." >&2
    return 1
  fi
}

# Sets this environment up to reach GitHub as the signal-tree-ci App (see
# "GitHub identity" above): installs the helpers from $1 into $2
# (install_helpers), points git, gh and the commit identity at them, then gets
# a token from the mint command, bypassing the cache, and checks that git
# would use it. Prints the reason and returns 1 on any failure.
use_github_app() {
  local from=$1 app_dir=$2 helper user
  if ! { install_helpers "$from" "$app_dir" && write_git_config "$app_dir/gitconfig"; }; then
    echo "Refusing to start: could not install the GitHub App helpers into $app_dir." >&2
    return 1
  fi
  # None of the machine's git config (insteadOf rules, extra headers, credential
  # helpers) applies; the checkout's own config still does, and check_origin
  # rejects the bypasses it could hold.
  export GIT_CONFIG_GLOBAL=$app_dir/gitconfig GIT_CONFIG_NOSYSTEM=1
  unset GIT_CONFIG_PARAMETERS SSH_ASKPASS
  # The App's helper comes after any repository config, behind an empty entry
  # that clears every other helper. An empty GIT_ASKPASS also skips
  # core.askPass and SSH_ASKPASS, and with terminal prompts off nothing else
  # can supply credentials. SSH is not allowed at all.
  printf -v helper '!node %q git-credential' "$app_dir/app-token.mjs"
  export GIT_CONFIG_COUNT=2 \
    GIT_CONFIG_KEY_0=credential.https://github.com.helper GIT_CONFIG_VALUE_0= \
    GIT_CONFIG_KEY_1=credential.https://github.com.helper GIT_CONFIG_VALUE_1="$helper" \
    GIT_ALLOW_PROTOCOL=https:file GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=
  export SIGNAL_TREE_GIT_NAME=${SIGNAL_TREE_GIT_NAME:-Jonathan Borgia}
  export SIGNAL_TREE_GIT_EMAIL=${SIGNAL_TREE_GIT_EMAIL:-jonathanborgia@gmail.com}
  export GIT_AUTHOR_NAME=$SIGNAL_TREE_GIT_NAME GIT_COMMITTER_NAME=$SIGNAL_TREE_GIT_NAME \
    GIT_AUTHOR_EMAIL=$SIGNAL_TREE_GIT_EMAIL GIT_COMMITTER_EMAIL=$SIGNAL_TREE_GIT_EMAIL
  export PATH=$app_dir/bin:$PATH

  rm -f "$SIGNAL_TREE_STATE_DIR/app-token.json"
  if ! node "$app_dir/app-token.mjs" token > /dev/null; then
    echo "Refusing to start: the mint command gave no GitHub App installation token (the reason is above)." >&2
    return 1
  fi
  user=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^username=//p')
  if [[ $user != x-access-token ]]; then
    echo "Refusing to start: git would not use the App's credentials for https://github.com (the GIT_CONFIG_* environment needs git 2.31 or later)." >&2
    return 1
  fi
}

# Installs the App helpers from $1 (this directory) into $2: app-token.mjs,
# the gh wrapper as bin/gh, and ci/codeowners.mjs, which the wrapper runs as
# ../codeowners.mjs.
install_helpers() {
  mkdir -p "$2/bin" &&
    install_file "$1/app-token.mjs" "$2/app-token.mjs" 600 &&
    install_file "$1/../codeowners.mjs" "$2/codeowners.mjs" 600 &&
    install_file "$1/bin/gh" "$2/bin/gh" 700
}

# Copies $1 to $2 with mode $3, replacing $2 in one step.
install_file() {
  cp "$1" "$2.new.$$" && chmod "$3" "$2.new.$$" && mv -f "$2.new.$$" "$2"
}

# Writes the only global git config the session sees (GIT_CONFIG_GLOBAL): nothing but this note.
write_git_config() {
  printf '%s\n' \
    '# Written by ci/unattended/supervise.sh at every start. The unattended session' \
    "# uses this file instead of the machine's global git config, so no insteadOf" \
    '# rule, extra header or credential helper from there applies. The App credential' \
    '# helper is set in the environment (GIT_CONFIG_COUNT).' > "$1.new.$$" &&
    chmod 600 "$1.new.$$" && mv -f "$1.new.$$" "$1"
}

# Refuses an origin through which git could reach GitHub as anyone but the
# App: every fetch and push URL of origin in checkout $1, after insteadOf
# rewriting, must be https://github.com/$REPO(.git) with no credentials, and no
# git config may set an extra HTTP header (which could carry a token).
check_origin() {
  local work=$1 fetch push url headers
  fetch=$(git -C "$work" remote get-url --all origin 2> /dev/null) || fetch=
  push=$(git -C "$work" remote get-url --push --all origin 2> /dev/null) || push=
  if [[ -z $fetch || -z $push ]]; then
    echo "Refusing to start: $work has no origin remote." >&2
    return 1
  fi
  while IFS= read -r url; do
    if [[ $url != "https://github.com/$REPO" && $url != "https://github.com/$REPO.git" ]]; then
      echo "Refusing to start: origin fetches or pushes through $(redact_url "$url"); it must be https://github.com/$REPO(.git), with no credentials, for both." >&2
      return 1
    fi
  done <<< "$fetch
$push"
  headers=$(git -C "$work" config --name-only --get-regexp '^http\..*extraheader$' | paste -sd, -)
  if [[ -n $headers ]]; then
    echo "Refusing to start: git config sets $headers; an extra HTTP header could authenticate as someone other than the App." >&2
    return 1
  fi
}

# URL $1 with any user name and password replaced by ***.
redact_url() {
  sed -E 's#^([A-Za-z][A-Za-z0-9+.-]*://)[^/@]*@#\1***@#' <<< "$1"
}

# Resolves the real gh once, for the wrapper (SIGNAL_TREE_REAL_GH): the first
# gh in an absolute PATH directory that is none of the wrappers $2.... Drops
# relative and empty PATH entries (the current directory) from PATH. Then
# points gh at the empty config directory $1 (GH_CONFIG_DIR) and refuses a
# stored login there, so gh run past the wrapper cannot fall back to one.
use_real_gh() {
  local config_dir=$1 dir wrapper real='' kept='' entries
  shift
  IFS=: read -r -a entries <<< "$PATH"
  for dir in "${entries[@]}"; do
    [[ $dir == /* ]] || continue
    kept+=${kept:+:}$dir
    [[ -z $real && -f $dir/gh && -x $dir/gh ]] || continue
    for wrapper in "$@"; do [[ $dir/gh -ef $wrapper ]] && continue 2; done
    real=$(cd "$dir" && pwd -P)/gh
  done
  export PATH=$kept
  if [[ -z $real ]]; then
    echo "Refusing to start: no gh in an absolute PATH directory other than the wrapper's." >&2
    return 1
  fi
  export SIGNAL_TREE_REAL_GH=$real
  if ! { mkdir -p "$config_dir" && chmod 700 "$config_dir"; }; then
    echo "Refusing to start: could not create $config_dir for gh." >&2
    return 1
  fi
  export GH_CONFIG_DIR=$config_dir
  if [[ -s $config_dir/hosts.yml ]] || env -u GH_TOKEN -u GITHUB_TOKEN "$real" auth status > /dev/null 2>&1; then
    echo "Refusing to start: gh has a stored login (in $config_dir); remove it, the agent reaches GitHub only as the App." >&2
    return 1
  fi
}

# Refuses to start unless main's active rules require at least one approving
# review, code-owner review and status checks, so a PR the App auto-merges
# still waits for review by the code owner where CODEOWNERS applies, an
# approval elsewhere, and the checks. Each requirement may come from any rule
# of the type (GitHub applies the strictest).
check_main_rules() {
  local rules missing
  if ! rules=$(gh api "repos/$REPO/rules/branches/main"); then
    echo "Refusing to start: could not read the rules for main of $REPO (the error is above)." >&2
    return 1
  fi
  if ! missing=$(jq -r '
    if type != "array" then error("not a list of rules") else . end
    | def pr(f): any(.[]; .type == "pull_request" and (.parameters | f));
      (if pr((.required_approving_review_count | type) == "number" and .required_approving_review_count >= 1) then empty
       else "a pull_request rule requiring at least one approving review (required_approving_review_count >= 1)" end),
      (if pr(.require_code_owner_review == true) then empty
       else "a pull_request rule requiring code-owner review (require_code_owner_review: true)" end),
      (if any(.[]; .type == "required_status_checks") then empty
       else "a required_status_checks rule" end)' <<< "$rules" 2> /dev/null); then
    echo "Refusing to start: could not read the rules for main of $REPO: GitHub's answer is not a list of rules." >&2
    return 1
  fi
  if [[ -n $missing ]]; then
    echo "Refusing to start: main of $REPO lacks what a PR the App auto-merges must wait for:" >&2
    sed 's/^/  /' <<< "$missing" >&2
    return 1
  fi
}

# Refuses to start unless this script and the helpers it installs are main's
# (see Installed copy): fetches main into the checkout $1, within the deadline
# $3 (as with_timeout takes it), and compares the SHA-256 of each file of
# SUPERVISOR_FILES under $2, this script's directory, with that of its path at
# the fetched commit. Prints both hashes of every file that differs or is
# missing, and returns 1.
check_installed_copy() {
  local work=$1 dir=$2 deadline=$3 err main entry file path mine theirs differs=''
  err=$(mktemp "${TMPDIR:-/tmp}/signal-tree-fetch.XXXXXX") || return 1
  if ! with_timeout "$deadline" git -C "$work" fetch -q --no-tags origin main 2> "$err" ||
    ! main=$(git -C "$work" rev-parse --verify -q 'FETCH_HEAD^{commit}'); then
    echo "Refusing to start: could not fetch main to check that the supervisor is main's:" >&2
    sed 's/^/  /' "$err" >&2
    rm -f "$err"
    return 1
  fi
  rm -f "$err"
  for entry in $SUPERVISOR_FILES; do
    file=$dir/${entry%%:*} path=${entry#*:}
    if [[ -f $file ]]; then mine=$(sha256 < "$file"); else mine=missing; fi
    if git -C "$work" cat-file -e "$main:$path" 2> /dev/null; then
      theirs=$(git -C "$work" cat-file blob "$main:$path" | sha256)
    else
      theirs=missing
    fi
    if [[ $mine == missing || $mine != "$theirs" ]]; then
      differs+="  $file: $mine; main's $path: $theirs"$'\n'
    fi
  done
  if [[ -n $differs ]]; then
    echo "Refusing to start: the supervisor is not main's (origin/main ${main:0:12}). SHA-256 of each file that differs:" >&2
    printf '%s' "$differs" >&2
    echo "Run main's copy, installed root-owned and read-only under /opt/signal-tree from main (#18)." >&2
    return 1
  fi
  echo "Supervisor check passed: this script and its helpers are main's (origin/main ${main:0:12})."
}

# The SHA-256 of standard input, in hex: sha256sum, or shasum where there is none (macOS).
sha256() {
  if command -v sha256sum > /dev/null; then sha256sum; else shasum -a 256; fi | awk '{print $1}'
}

# Checks at startup that the App cannot change workflows. Jonathan: "The App
# does not get Workflows permission ... Workflow changes come from me." and
# "Add a self-test on a scratch branch: a push that adds a workflow file is
# rejected for a non-bypass actor." GitHub offers no push rulesets on this
# repository, so the protection is GitHub refusing any App push that creates
# or updates a file under .github/workflows/ without that permission.
#
# As the App, through the credential helper, this fetches main into the
# checkout $1, builds a commit of main's tree plus
# .github/workflows/selftest-<random>.yml with `git commit-tree` (the
# checkout's files, index and branches stay as they are, and the commit's
# objects stay out of its object store), and pushes it to
# refs/heads/selftest/workflow-push-<random>. $2 is the deadline for each
# network step, as with_timeout takes it: 30 (seconds) in main, a FIFO in
# tests. It passes only if GitHub refuses the push
# with its message for the missing permission (is_workflow_refusal) and the
# branch does not exist afterwards. Otherwise it prints why and returns 1,
# deleting the branch if it exists.
#
# SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST=1 skips it, with a warning, for tests
# against a fake remote; with origin on github.com it is ignored.
workflow_selftest() {
  local work=$1 deadline=$2 tmp status
  if [[ ${SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST:-} == 1 ]]; then
    if [[ $(git -C "$work" remote get-url --push origin 2> /dev/null) != https://github.com/* ]]; then
      echo "WARNING: SKIPPING THE WORKFLOW SELF-TEST (SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST=1, fake remote). Nothing has checked that the App cannot push workflow files." >&2
      return 0
    fi
    echo "SIGNAL_TREE_SKIP_WORKFLOW_SELFTEST=1 is only for tests against a fake remote; origin is on github.com, so the workflow self-test runs." >&2
  fi
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/signal-tree-selftest.XXXXXX") || return 1
  workflow_push "$work" "$deadline" "$tmp"
  status=$?
  rm -rf "$tmp"
  return "$status"
}

# The body of workflow_selftest; $3 is a scratch directory that holds the
# commit's objects, its index and the push output.
workflow_push() {
  local work=$1 deadline=$2 tmp=$3 id ref file main objects blob tree commit status found outcome=''
  local -a scratch
  id=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
  ref=refs/heads/selftest/workflow-push-$id
  file=.github/workflows/selftest-$id.yml
  if ! with_timeout "$deadline" git -C "$work" fetch -q --no-tags origin main 2> "$tmp/fetch.err" ||
    ! main=$(git -C "$work" rev-parse --verify -q 'FETCH_HEAD^{commit}'); then
    echo "Refusing to start: the workflow self-test could not fetch main:" >&2
    sed 's/^/  /' "$tmp/fetch.err" >&2
    return 1
  fi
  # The commit's objects go to $tmp, reading the checkout's as alternates.
  objects=$(git -C "$work" rev-parse --path-format=absolute --git-path objects) && mkdir "$tmp/objects" || return 1
  scratch=(env "GIT_OBJECT_DIRECTORY=$tmp/objects" "GIT_ALTERNATE_OBJECT_DIRECTORIES=$objects" "GIT_INDEX_FILE=$tmp/index" git -C "$work")
  if ! { blob=$("${scratch[@]}" hash-object -w --stdin <<'YAML'
# Pushed by the workflow self-test of ci/unattended/supervise.sh. GitHub must
# refuse it: the signal-tree-ci App has no Workflows permission.
name: selftest
on: workflow_dispatch
jobs:
  noop:
    runs-on: ubuntu-latest
    steps:
      - run: echo "This workflow must never reach GitHub."
YAML
  ) &&
    "${scratch[@]}" read-tree "$main" &&
    "${scratch[@]}" update-index --add --cacheinfo "100644,$blob,$file" &&
    tree=$("${scratch[@]}" write-tree) &&
    commit=$("${scratch[@]}" commit-tree "$tree" -p "$main" -m "Workflow self-test by ci/unattended/supervise.sh: GitHub must refuse this push"); }; then
    echo "Refusing to start: the workflow self-test could not build its commit." >&2
    return 1
  fi

  with_timeout "$deadline" "${scratch[@]}" push origin "$commit:$ref" > "$tmp/push.out" 2>&1
  status=$?
  if (( status == 0 )); then
    outcome="GitHub accepted it, so the App can change workflows: remove its Workflows permission (workflow changes come only from Jonathan)."
  elif (( status == 124 )); then
    outcome="The push did not finish $(deadline_text "$deadline")."
  elif ! is_workflow_refusal "$tmp/push.out"; then
    outcome="GitHub refused it, but not for the missing workflows permission, so this proves nothing."
  fi

  # Whatever happened, the branch must not exist.
  with_timeout "$deadline" git -C "$work" ls-remote --exit-code origin "$ref" > /dev/null 2>&1
  found=$?
  if (( found == 0 )); then
    [[ -n $outcome ]] || outcome="GitHub refused the push, yet the branch exists."
    with_timeout "$deadline" git -C "$work" push -q origin ":$ref" > /dev/null 2>&1
    with_timeout "$deadline" git -C "$work" ls-remote --exit-code origin "$ref" > /dev/null 2>&1
    found=$?
    (( found == 2 )) && outcome+=" The branch has been deleted."
  fi
  (( found == 2 )) || outcome+=" Could not confirm that the branch is gone; if it exists, delete it: git push origin :$ref"

  if [[ -n $outcome ]]; then
    echo "Refusing to start: the workflow self-test failed (it pushed $file to $ref as the App). ${outcome# } Push output:" >&2
    sed 's/^/  /' "$tmp/push.out" >&2
    return 1
  fi
  echo "Workflow self-test passed: GitHub refused the App's push of a workflow file, and left no branch."
}

# True when push output (file $1) holds GitHub's refusal of a workflow file
# from an App without the workflows permission: one line that contains
# "workflow" and either "permission" or "refusing", in any case. GitHub's
# line reads
#   ! [remote rejected] <sha> -> <branch> (refusing to allow a GitHub App to
#   create or update workflow `<path>` without `workflows` permission)
is_workflow_refusal() {
  awk '{ line = tolower($0) } line ~ /workflow/ && line ~ /permission|refusing/ { found = 1 } END { exit !found }' "$1"
}

# Runs the command "$@" until the deadline $1 and kills it if that comes
# first. Returns the command's status, or 124 when it was killed. $1 is a
# number of seconds, or the path of a FIFO, in which case the deadline is the
# moment a line, or end of file, arrives on it: tests decide when it passes,
# rather than the clock. A watchdog waits for the deadline; when the command
# ends first the watchdog is killed. Waiting on a FIFO it holds no other
# process, so nothing is left behind. Waiting on the clock it leaves its
# sleep to run out, with no caller's pipe open.
with_timeout() {
  local deadline=$1 pid watchdog status
  shift
  "$@" &
  pid=$!
  # Exits 0 only if it killed the command.
  (
    if [[ $deadline =~ ^[0-9]+$ ]]; then sleep "$deadline"; else read -r < "$deadline"; fi
    kill -TERM "$pid"
  ) > /dev/null 2>&1 &
  watchdog=$!
  wait "$pid"
  status=$?
  kill "$watchdog" 2> /dev/null
  if wait "$watchdog"; then return 124; fi
  return "$status"
}

# How a message names the deadline $1 (see with_timeout).
deadline_text() {
  if [[ $1 =~ ^[0-9]+$ ]]; then echo "within $1 s"; else echo "before its deadline"; fi
}

# The error text of a run that failed to authenticate, or nothing. A usage
# limit is not an authentication failure: a line about a usage or rate limit
# never counts, and 401 counts only as a number of its own, not inside a reset
# time such as 1764014010.
auth_failure() {
  jq -r 'select(.type == "result" and .is_error == true) | .result // empty' "$1" 2>/dev/null |
    grep -i -v -E 'usage limit|hit your limit|rate limit' |
    grep -i -m1 -E 'authenticat|api key|oauth token|please run /login|unauthori[sz]ed|(^|[^0-9])401([^0-9]|$)'
}

# The usage limit that the run with log $1 ended on, as
# "<rateLimitType> <resetsAt>", or nothing. Claude Code's stream-json reports
# the subscription's limits in rate_limit_event lines; a limit was hit when the
# run's last one has rate_limit_info.status "rejected" ("allowed" and
# "allowed_warning" are not limits), or when an assistant or result event has
# error "rate_limit" or apiError (api_error) "usage_limit_reached". The type and
# reset time come from the last rejected event: the type is "unknown" when
# there is none or it is not a plain word, and resetsAt, in epoch seconds
# (milliseconds when above 1e12), is empty when there is no positive number.
# Lines that are not JSON are skipped.
usage_limit() {
  jq -nrR '
    [inputs | fromjson? | objects] as $events
    | [$events[] | select(.type == "rate_limit_event") | .rate_limit_info | objects] as $infos
    | select(($infos | last | .status) == "rejected"
        or any($events[]; (.type == "assistant" or .type == "result")
          and (.error == "rate_limit" or .apiError == "usage_limit_reached" or .api_error == "usage_limit_reached")))
    | ([$infos[] | select(.status == "rejected")] | last // {})
    | "\((.rateLimitType | strings | select(test("^[A-Za-z0-9_]{1,40}$"))) // "unknown") \((.resetsAt | numbers | select(. > 0) | if . > 1e12 then . / 1000 else . end | floor) // "")"' "$1" 2>/dev/null
}

# Waits out the usage limit $1 (as usage_limit prints it), first noting it in
# the session log $2: until a minute after the reset time, or for 30 minutes
# when the reset time is missing, not in the future or more than 8 days ahead.
# It reads the current time once, with date +%s, and runs sleep through PATH,
# so tests can supply both.
pause_for_usage_limit() {
  local type=${1%% *} resets=${1#* } now wait resume
  now=$(date +%s)
  if [[ $resets =~ ^[0-9]+$ ]] && (( resets > now && resets - now <= 8 * 86400 )); then
    wait=$(( resets + 60 - now )) resume=$resets
  else
    wait=1800 resume=$(( now + 1800 ))
  fi
  echo "$(utc_time "$now") usage limit ($type) reached; paused until $(utc_time "$resume")" >> "$2"
  sleep "$wait"
}

# Epoch seconds $1 as UTC, in the form date -u +%FT%TZ prints, without GNU or BSD date options.
utc_time() {
  jq -rn --argjson t "$1" '$t | todate' 2>/dev/null
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
