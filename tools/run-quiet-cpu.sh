#!/usr/bin/env bash
# Quiet-host four-way CPU run for the v2 entity-realization candidates.
#
# Run this from a PLAIN TERMINAL after quitting VS Code / Chrome. It does not
# quit anything for you: killing your editor would end the session that wrote
# this file, and your browser tabs are not mine to close.
#
# It is safe to re-run. It builds nothing into your working tree and leaves the
# repository untouched.
set -euo pipefail

REPO="${REPO:-$HOME/code/signaltree}"
WORK="${WORK:-/tmp/qcpu}"
PAIRS="${PAIRS:-15}"
CANDIDATES=(v2-strong v2-cell v2-token v2-angular-native)

# nx daemons are the main self-inflicted noise: every `nx` invocation can leave
# one behind, and they keep burning CPU for days. Disable them for this run.
export NX_DAEMON=false

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "0/6  clearing stale worktrees from any previous run"
# A candidate branch can only be checked out in one worktree. An interrupted
# run leaves one behind and every later run dies with
# "fatal: 'cpu/v2-token' is already used by worktree at ...".
for c in "${CANDIDATES[@]}"; do
  for stale in $(git -C "$REPO" worktree list --porcelain | awk -v b="cpu/$c" '/^worktree /{w=$2} /^branch /{if ($2=="refs/heads/"b) print w}'); do
    echo "  removing stale worktree $stale"
    rm -f "$stale/node_modules" 2>/dev/null || true
    git -C "$REPO" worktree remove "$stale" --force 2>/dev/null || rm -rf "$stale"
  done
done
git -C "$REPO" worktree prune
rm -rf "$WORK"

step "1/6  stopping nx daemons and orphans"
(cd "$REPO" && npx nx daemon --stop >/dev/null 2>&1 || true)
[ -d "$HOME/code/signaltree-14x" ] && (cd "$HOME/code/signaltree-14x" && npx nx daemon --stop >/dev/null 2>&1 || true)
pkill -f 'nx@23' 2>/dev/null || true
sleep 3
pkill -9 -f 'nx@23' 2>/dev/null || true
sleep 2
echo "remaining nx processes: $(pgrep -fc 'nx@23' 2>/dev/null || echo 0)"

step "2/6  letting the machine settle (90s)"
sleep 90
uptime
ps aux | sort -nrk 3 | awk 'NR<=5 {printf "  %5.1f%%  %s\n", $3, $11}'

step "3/6  building the four candidates"
rm -rf "$WORK"; mkdir -p "$WORK/dist"
for c in "${CANDIDATES[@]}"; do
  git -C "$REPO" worktree add "$WORK/$c" "cpu/$c" >/dev/null
  ln -s "$REPO/node_modules" "$WORK/$c/node_modules"
  ( cd "$WORK/$c" && npx nx run-many -t build -p kernel angular --skip-nx-cache >"$WORK/$c-build.log" 2>&1 ) \
    || { echo "BUILD FAILED for $c — see $WORK/$c-build.log"; exit 1; }
  mkdir -p "$WORK/dist/$c"
  cp -R "$WORK/$c/dist/packages/kernel"  "$WORK/dist/$c/kernel"
  cp -R "$WORK/$c/dist/packages/angular" "$WORK/dist/$c/angular"
  # provenance: one realization file must differ from the common base
  echo "  $c  $(git -C "$WORK/$c" rev-parse --short HEAD)  diff-from-v2-base=$(git -C "$WORK/$c" diff --name-only cpu/v2-base HEAD | wc -l | tr -d ' ')  dirty=$(git -C "$WORK/$c" status --porcelain | wc -l | tr -d ' ')"
done

# Building respawns daemons. Stop them again before measuring anything.
pkill -9 -f 'nx@23' 2>/dev/null || true

step "4/6  waiting for filesystem indexing to settle"
# Creating worktrees and writing dist churns thousands of files, and Spotlight
# indexes them: `mds_stores` was observed at 99.6% of a core immediately after
# this step. Benchmarking through that would measure the indexer. Wait for it to
# drop rather than assuming a fixed sleep is enough.
for i in $(seq 1 40); do
  mds=$(ps -eo pcpu,comm | awk '/mds_stores|mdworker/ {s+=$1} END {printf "%.0f", s+0}')
  printf '\r  indexing load: %s%%   (check %s/40)' "${mds:-0}" "$i"
  [ "${mds:-0}" -lt 10 ] && { echo; echo "  settled"; break; }
  sleep 15
done
echo
uptime

step "5/6  A/A PREFLIGHT — same build against itself"
echo "If this does not come in comfortably under 5%, STOP. The host cannot"
echo "resolve the effect and the four-way run would only produce noise."
node "$REPO/tools/bench-build-ab.mjs" \
  --roots a="$WORK/dist/v2-token",b="$WORK/dist/v2-token" --pairs 5 \
  | tee "$WORK/preflight.txt"

printf '\nPreflight done. Continue to the four-way run? [y/N] '
read -r reply
[ "$reply" = "y" ] || { echo "stopped after preflight; results in $WORK/preflight.txt"; exit 0; }

step "6/6  four-way run"
node "$REPO/tools/bench-build-ab.mjs" \
  --roots strong="$WORK/dist/v2-strong",cell="$WORK/dist/v2-cell",token="$WORK/dist/v2-token",native="$WORK/dist/v2-angular-native" \
  --pairs "$PAIRS" | tee "$WORK/four-way.txt"

echo
echo "Results: $WORK/four-way.txt   (preflight: $WORK/preflight.txt)"
echo "Clean up worktrees with:"
for c in "${CANDIDATES[@]}"; do echo "  rm -f $WORK/$c/node_modules && git -C $REPO worktree remove $WORK/$c --force"; done
