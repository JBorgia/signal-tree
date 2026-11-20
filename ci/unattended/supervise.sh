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
#   SIGNAL_TREE_STATE_DIR         default ~/.signal-tree-unattended (session ID, hook state, logs, App token);
#                                 made mode 700, and refused inside the agent's checkout or the verifier
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
# Exit status: 0 done; 1 setup failed; 2 not the isolated machine, extra
# arguments set a model, or the state directory is inside a checkout; 3 stuck;
# 4 the agent lock is held or could not be taken; 5 a run used another model;
# 6 no ANTHROPIC_API_KEY; 7 a run could not authenticate to Anthropic; 8 the
# GitHub App variables are missing or the key file is unreadable; 9 no GitHub
# App token could be minted, or git would not use it; 10 origin is not
# https://github.com/JBorgia/signal-tree(.git) for fetch and push, git config
# sets an extra HTTP header, or `git ls-remote origin` fails as the App; 11 no
# real gh outside the wrapper, or gh has a stored login; 12 main lacks a rule
# in REQUIRED_MAIN_RULES, or its rules could not be read.
#
# Authentication (Jonathan's ruling on #16): Claude Code uses an Anthropic API
# key from the VM's secret store, never a browser login. The supervisor
# refuses to start without one, clears any OAuth token from its environment,
# and stops (instead of retrying) when a run ends on an authentication error.
#
# GitHub identity (BRIEF.md 12.3 and Jonathan's rulings): the signal-tree-ci
# GitHub App authenticates every push and gh call, and turns on auto-merge
# (merge commit) for each PR it opens from a JBorgia/signal-tree branch into
# main; commits keep Jonathan as author and committer. At start the supervisor
# copies app-token.mjs and the gh wrapper (bin/gh) from its own directory into
# $SIGNAL_TREE_STATE_DIR/github-app, so a branch switch in the agent's checkout
# cannot remove them, and mints one token to fail fast. In its own environment,
# which the session and its hooks inherit, it then
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
# sets an extra HTTP header, gh has no stored login, main has the rules in
# REQUIRED_MAIN_RULES (so auto-merge still waits for them), and
# `git ls-remote origin` works as the App.
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
# Rule types (from GET /repos/{repo}/rules/branches/main) that main must have
# before the App may auto-merge its PRs. Adjust as the code-owner review
# mechanism is settled.
readonly REQUIRED_MAIN_RULES='pull_request required_status_checks'

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
  check_state_dir || exit 2
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

# Sets this environment up to reach GitHub as the signal-tree-ci App (see
# "GitHub identity" above): installs app-token.mjs and bin/gh from $1 into $2,
# points git, gh and the commit identity at them, then mints a token and checks
# that git would use it. Prints the reason and returns 1 on any failure.
use_github_app() {
  local from=$1 app_dir=$2 helper user
  if ! { mkdir -p "$app_dir/bin" &&
    install_file "$from/app-token.mjs" "$app_dir/app-token.mjs" 600 &&
    install_file "$from/bin/gh" "$app_dir/bin/gh" 700 &&
    write_git_config "$app_dir/gitconfig"; }; then
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

# Refuses to start unless main of REPO has every rule type in
# REQUIRED_MAIN_RULES, so a PR the App auto-merges still waits for them.
check_main_rules() {
  local rules type
  if ! rules=$(gh api "repos/$REPO/rules/branches/main" | jq -r '.[].type'); then
    echo "Refusing to start: could not read the rules for main of $REPO (the error is above)." >&2
    return 1
  fi
  for type in $REQUIRED_MAIN_RULES; do
    if ! grep -qx -- "$type" <<< "$rules"; then
      echo "Refusing to start: main of $REPO has no active $type rule, so a PR the App auto-merges would not wait for it (REQUIRED_MAIN_RULES: $REQUIRED_MAIN_RULES)." >&2
      return 1
    fi
  done
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
