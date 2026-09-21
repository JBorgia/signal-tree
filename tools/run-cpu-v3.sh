#!/usr/bin/env bash
# Frozen v3 CPU experiment — durable, resumable, patient, restartable.
#
# ## What this survives
#
# Earlier attempts were lost to, in order: the launching editor being quit
# (SIGKILL through the process tree), a reboot that wiped /tmp along with the
# runner and every result, and the host running out of memory mid-preflight
# with nothing watching. Each loss cost the entire run.
#
#   lives in the repo, results in $HOME  -> a reboot cannot erase it
#   every step checkpointed              -> rerun continues where it stopped
#   memory watched DURING each measure   -> an attempt aborts and retries
#   waits, indefinitely, for a calm host -> never measures through trouble
#   lockfile                             -> two copies cannot fight
#   traps                                -> Ctrl-C leaves a clean state file
#
# ## What it will not do
#
# It never retries a measurement that COMPLETED. An attempt killed for memory
# recorded no verdict, so restarting it completes a measurement that never
# happened; that is categorically different from re-rolling a result you did
# not like, which the preregistration forbids.
#
# Methodology is untouched: same frozen harness, workloads, 5% A/A gate,
# thresholds and stopping rule.
#
#   ~/code/signaltree/tools/run-cpu-v3.sh          # run, or resume
#   STATE=1 ~/code/signaltree/tools/run-cpu-v3.sh  # just print progress
set -u

REPO="$HOME/code/signaltree"
OUT="${OUT:-$HOME/signaltree-cpu-results}"
WT="$OUT/worktrees"; DIST="$OUT/dist"; RESULTS="$OUT/results"
HARNESS="$REPO/tools/bench-build-ab-v3.mjs"
LOCK="$OUT/.lock"; STATEF="$RESULTS/STATE.txt"
CANDIDATES=(v2-strong v2-cell v2-token v2-angular-native)
MIN_FREE_GB="${MIN_FREE_GB:-1.5}"      # abort an attempt below this
CALM_FREE_GB="${CALM_FREE_GB:-3.0}"    # required before starting one
CALM_LOAD="${CALM_LOAD:-3.0}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"

mkdir -p "$WT" "$DIST" "$RESULTS"

# --- progress query ----------------------------------------------------------
if [ "${STATE:-0}" != "0" ]; then
  echo "state:   $(cat "$STATEF" 2>/dev/null || echo 'not started')"
  echo "results: $RESULTS"
  for c in "${CANDIDATES[@]}"; do
    [ -d "$DIST/$c/kernel" ] && echo "  built    $c" || echo "  pending  $c"
  done
  for i in 1 2 3; do
    if [ -s "$RESULTS/preflight-$i.txt" ] && grep -q scalar-set "$RESULTS/preflight-$i.txt"; then
      echo "  done     preflight $i"
    else
      echo "  pending  preflight $i"
    fi
  done
  [ -s "$RESULTS/FINAL-STATUS.txt" ] && { echo; cat "$RESULTS/FINAL-STATUS.txt"; }
  exit 0
fi

# --- single instance ---------------------------------------------------------
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "already running as PID $(cat "$LOCK"). Progress:  STATE=1 $0"
  exit 1
fi
echo $$ > "$LOCK"

exec > >(tee -a "$RESULTS/execution.log") 2>&1

state() { echo "$1" > "$STATEF"; }
say()   { printf '\n\033[1m== %s\033[0m\n' "$1"; }

cleanup_children() { pkill -9 -f 'st-ab3-' 2>/dev/null || true; }

on_exit() {
  local rc=$?
  cleanup_children
  rm -f "$LOCK"
  if [ "$rc" != "0" ] && [ ! -s "$RESULTS/FINAL-STATUS.txt" ]; then
    state "INTERRUPTED — rerun the same command to resume"
    echo; echo "interrupted; nothing lost. Rerun to resume:  $0"
  fi
}
trap on_exit EXIT
trap 'exit 130' INT TERM

free_gb() {
  vm_stat | awk '/page size of/ {ps=$8}
    /Pages free/ {f=$3} /Pages inactive/ {i=$3} /Pages speculative/ {s=$3}
    END { gsub(/\./,"",f); gsub(/\./,"",i); gsub(/\./,"",s);
          printf "%.1f", ((f+i+s)*ps)/1073741824 }'
}
load1() { uptime | sed 's/.*load averages*: *//' | awk '{print $1}' | tr -d ','; }
disk_gb() { df -g "$OUT" | awk 'NR==2 {print $4}'; }

# Waits forever by design. A loaded or memory-pressured host is a reason to
# WAIT. It is never a reason to record a verdict about the methodology.
settle() {
  local label="$1" n=0 l m
  echo "  waiting for a calm host before $label  (load < $CALM_LOAD, > $CALM_FREE_GB GB free)"
  while :; do
    l=$(load1); m=$(free_gb)
    awk -v l="$l" -v m="$m" -v L="$CALM_LOAD" -v M="$CALM_FREE_GB" \
      'BEGIN { exit !(l < L && m > M) }' && { echo "  calm: load $l, ${m} GB free"; return 0; }
    n=$((n+1)); printf '\r    load=%s  free=%sGB  waiting %dm ' "$l" "$m" "$((n/2))"
    sleep 30
  done
}

# Run the harness with a memory watchdog. Retries only ever follow an attempt
# that produced NO result.
guarded() {
  local out="$1" label="$2"; shift 2
  local attempt=0 rc abort fm
  while :; do
    attempt=$((attempt+1))
    if [ "$attempt" -gt "$MAX_ATTEMPTS" ]; then
      cat > "$RESULTS/FINAL-STATUS.txt" <<STATUS
EXECUTION INVALID — HOST COULD NOT COMPLETE A MEASUREMENT

$label was aborted $MAX_ATTEMPTS times because free memory fell below
${MIN_FREE_GB} GB while the harness was running. No measurement completed, so
NOTHING is known about whether the v3 harness can resolve the entity workloads.

This is NOT the v3 stopping rule and does NOT settle the CPU question. Re-running
on a host with more headroom is legitimate; methodology, thresholds, candidates
and harness are untouched.
STATUS
      return 2
    fi
    settle "$label (attempt $attempt)"
    state "$label — attempt $attempt, started $(date '+%H:%M')"
    echo "  running $label (attempt $attempt)"
    node "$HARNESS" "$@" >"$out" 2>&1 &
    local hpid=$! ; abort=0
    while kill -0 "$hpid" 2>/dev/null; do
      fm=$(free_gb)
      if awk -v m="$fm" -v M="$MIN_FREE_GB" 'BEGIN { exit !(m < M) }'; then
        echo "  free memory fell to ${fm} GB — aborting attempt $attempt"
        kill -9 "$hpid" 2>/dev/null; cleanup_children; abort=1; break
      fi
      sleep 10
    done
    wait "$hpid" 2>/dev/null; rc=$?
    [ "$abort" = "1" ] && { echo "  cooling down 2m"; sleep 120; continue; }
    [ "$rc" != "0" ] && { echo "  harness exited $rc"; return 1; }
    return 0
  done
}

# --- preconditions -----------------------------------------------------------
say "preconditions"
[ -x "$HARNESS" ] || [ -f "$HARNESS" ] || { echo "missing harness $HARNESS"; exit 1; }
[ "$(disk_gb)" -lt 5 ] && { echo "less than 5 GB free on $OUT — free space first"; exit 1; }
cd "$REPO" || exit 1
echo "  repo $(git rev-parse --short HEAD), disk $(disk_gb)GB free"
for c in "${CANDIDATES[@]}"; do
  git rev-parse --verify "cpu/$c" >/dev/null 2>&1 || { echo "  missing branch cpu/$c"; exit 1; }
  printf "  cpu/%-20s %s\n" "$c" "$(git rev-parse --short "cpu/$c")"
done

say "quieting apps (Terminal unaffected)"
osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
osascript -e 'quit app "Visual Studio Code"' 2>/dev/null || true
export NX_DAEMON=false
pkill -f 'nx@23' 2>/dev/null || true

# --- build, checkpointed -----------------------------------------------------
say "candidates (skipping any already built)"
for c in "${CANDIDATES[@]}"; do
  if [ -d "$DIST/$c/kernel" ] && [ -d "$DIST/$c/angular" ]; then
    echo "  $c already built"; continue
  fi
  state "building $c"
  settle "building $c"
  for try in 1 2; do
    rm -f "$WT/$c/node_modules" 2>/dev/null || true
    git -C "$REPO" worktree remove "$WT/$c" --force >/dev/null 2>&1 || rm -rf "$WT/$c"
    git -C "$REPO" worktree prune
    git -C "$REPO" worktree add --detach "$WT/$c" "cpu/$c" >/dev/null || exit 10
    ln -s "$REPO/node_modules" "$WT/$c/node_modules"
    if ( cd "$WT/$c" && rm -rf dist && npx nx run-many -t build -p kernel angular --skip-nx-cache ) \
         >"$RESULTS/build-$c.txt" 2>&1; then
      rm -rf "$DIST/$c"; mkdir -p "$DIST/$c"
      cp -R "$WT/$c/dist/packages/kernel"  "$DIST/$c/kernel"
      cp -R "$WT/$c/dist/packages/angular" "$DIST/$c/angular"
      echo "  built $c"; break
    fi
    echo "  build $c failed (try $try) — see $RESULTS/build-$c.txt"
    [ "$try" = "2" ] && { state "BUILD FAILED for $c"; exit 13; }
    sleep 60
  done
done
pkill -9 -f 'nx@23' 2>/dev/null || true

gate() {
  awk '
    BEGIN { ok=1; seen=0 }
    $1=="updateOne" || $1=="byId-warm" || $1=="byId-cold" || $1=="field-read-held" {
      aa=$5; gsub(/%/,"",aa); seen++
      printf "    %-17s A/A=%s%%\n", $1, aa
      if ((aa+0) > 5.0) ok=0 }
    END { if (seen != 4) { print "    ERROR: saw", seen, "of 4 workloads"; exit 2 }
          if (!ok) exit 1 }' "$1"
}

# --- preflights, checkpointed ------------------------------------------------
say "three formal A/A preflights (token vs token)"
PASS=1
for i in 1 2 3; do
  F="$RESULTS/preflight-$i.txt"
  if [ -s "$F" ] && grep -q scalar-set "$F"; then
    echo "  preflight $i already recorded — re-checking its gate"
  else
    { date; uptime; echo "free: $(free_gb) GB"; } > "$RESULTS/preflight-$i-machine.txt"
    guarded "$F" "preflight $i" --roots "a=$DIST/v2-token,b=$DIST/v2-token" --pairs 10
    case $? in 2) PASS=0; break;; 1) PASS=0; break;; esac
  fi
  tail -9 "$F"
  if ! gate "$F"; then echo "  PREFLIGHT $i FAILED THE 5% A/A GATE"; PASS=0; break; fi
  echo "  PREFLIGHT $i PASS"
done

if [ "$PASS" != "1" ]; then
  if [ ! -s "$RESULTS/FINAL-STATUS.txt" ]; then
    cat > "$RESULTS/FINAL-STATUS.txt" <<STATUS
CPU UNKNOWN — V3 STOPPING RULE TRIGGERED

A required entity workload exceeded the preregistered 5% A/A gate in a
token-vs-token preflight taken on a calm host.

Per CPU-DECISION-PREREGISTRATION-V3.md:
- no candidate CPU result is admissible
- the four-way experiment was NOT run
- no v4 methodology revision is permitted
- the architecture decision proceeds from semantics and memory
STATUS
  fi
else
  say "all three passed — four-way, once"
  F="$RESULTS/four-way-v3.txt"
  if [ -s "$F" ] && grep -q scalar-set "$F"; then
    echo "  four-way already recorded"
  else
    { date; uptime; echo "free: $(free_gb) GB"; } > "$RESULTS/four-way-machine.txt"
    guarded "$F" "the four-way run" --roots \
      "strong=$DIST/v2-strong,cell=$DIST/v2-cell,token=$DIST/v2-token,native=$DIST/v2-angular-native" \
      --pairs 15 || true
  fi
  [ -s "$F" ] && cat "$F"
  [ -s "$RESULTS/FINAL-STATUS.txt" ] || cat > "$RESULTS/FINAL-STATUS.txt" <<STATUS
THREE A/A PREFLIGHTS PASSED — four-way executed once, uninterpreted.
Apply the thresholds in docs/architecture/CPU-DECISION-PREREGISTRATION-V3.md
Raw: $F
STATUS
fi

cd "$REPO"
for c in "${CANDIDATES[@]}"; do
  rm -f "$WT/$c/node_modules" 2>/dev/null || true
  git worktree remove "$WT/$c" --force >/dev/null 2>&1 || true
done
git worktree prune
state "COMPLETE"

say "DONE"
cat "$RESULTS/FINAL-STATUS.txt"
echo
echo "raw evidence: $RESULTS"
