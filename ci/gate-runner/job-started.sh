#!/bin/sh
# Job-started hook for the gate runner (BRIEF.md ruling 10: gates run on a
# dedicated self-hosted runner, which Jonathan provisions; #18).
#
# The gate runner is one persistent runner, registered once, running as a
# dedicated unprivileged user. The runner calls this script before every job
# (ACTIONS_RUNNER_HOOK_JOB_STARTED in the runner's .env), so no job starts on
# files an earlier job left in its workspace. Root installs it as
# /opt/signal-tree/job-started.sh and lists it in the toolchain manifest, so the
# gate-host preflight's hash check covers it.
#
# It empties GITHUB_WORKSPACE, the folder the job checks out into, and nothing
# else. The workspace must have the runner's layout,
# <runner>/_work/<repository>/<repository>; anything else is refused, so a bad
# value can't empty another directory. A refusal fails the job.
set -eu

refuse() {
  echo "job-started: $1; refusing to clean" >&2
  exit 1
}

ws=${GITHUB_WORKSPACE:-}
[ -n "$ws" ] || refuse 'GITHUB_WORKSPACE is not set'
case "$ws" in
  /*) ;;
  *) refuse "GITHUB_WORKSPACE ($ws) is not an absolute path" ;;
esac
case "$ws" in
  */ | *//* | */./* | */../* | */. | */..) refuse "GITHUB_WORKSPACE ($ws) is not a plain path" ;;
esac
name=${ws##*/}
parent=${ws%/*}
work=${parent%/*}
[ "${parent##*/}" = "$name" ] && [ "${work##*/}" = _work ] && [ -n "${work%/_work}" ] ||
  refuse "GITHUB_WORKSPACE ($ws) is not <runner>/_work/<repository>/<repository>"

if [ ! -e "$ws" ] && [ ! -L "$ws" ]; then
  echo "job-started: $ws does not exist yet; nothing to clean"
  exit 0
fi
{ [ -d "$ws" ] && [ ! -L "$ws" ]; } || refuse "$ws is not a directory"

find "$ws" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
[ -z "$(find "$ws" -mindepth 1 -maxdepth 1 | head -n 1)" ] || refuse "$ws could not be emptied"
echo "job-started: emptied $ws"
