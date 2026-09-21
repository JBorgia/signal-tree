#!/usr/bin/env bash
# Frozen v3 CPU experiment — durable, resumable, and patient.
#
# Lives in the repo, not /tmp. A reboot previously erased the runner, its
# results AND the ability to resume, because everything was under /tmp and
# macOS clears that at boot.
#
# Results go to ~/signaltree-cpu-results, which also survives a reboot.
#
# RESUMABLE: rerunning skips candidate builds that already exist and preflights
# already recorded. Killing it or losing power costs you the step in flight, not
# the whole run.
#
# PATIENT: it waits for the host to calm down rather than measuring through
# load or memory pressure, and it never gives up on its own for that reason.
#
# It changes NOTHING about methodology: same frozen harness, same workloads,
# same 5% A/A gate, same thresholds, same stopping rule.
set -u

REPO="$HOME/code/signaltree"
OUT="${OUT:-$HOME/signaltree-cpu-results}"
WT="$OUT/worktrees"
DIST="$OUT/dist"
RESULTS="$OUT/results"
HARNESS="$REPO/tools/bench-build-ab-v3.mjs"
CANDIDATES=(v2-strong v2-cell v2-token v2-angular-native)

mkdir -p "$WT" "$DIST" "$RESULTS"
exec > >(tee -a "$RESULTS/execution.log") 2>&1

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

free_gb() {
  vm_stat | awk '/page size of/ {ps=$8}
    /Pages free/ {f=$3} /Pages inactive/ {i=$3} /Pages speculative/ {s=$3}
    END { gsub(/\./,"",f); gsub(/\./,"",i); gsub(/\./,"",s);
          printf "%.1f", ((f+i+s)*ps)/1073741824 }'
}
load1() { uptime | sed 's/.*load averages*: *//' | awk '{print $1}' | tr -d ','; }

# Waits indefinitely. A busy or memory-pressured host is a reason to WAIT, never
# a reason to record a methodology verdict -- those are different outcomes and
# must not be confusable.
settle() {
  local label="$1" n=0
  echo "  waiting for a calm host before $label  (need load < 3.0 and > 3 GB free)"
  while :; do
    local l m
    l=$(load1); m=$(free_gb)
    if awk -v l="$l" -v m="$m" 'BEGIN { exit !(l < 3.0 && m > 3.0) }'; then
      echo "  calm: load $l, ${m} GB free"
      return 0
    fi
    n=$((n + 1))
    printf '\r    load=%s  free=%sGB  waited %dm ' "$l" "$m" "$((n / 2))"
    # Every 10 minutes, ask the OS to drop caches by touching nothing and just
    # giving it time. Nothing is killed: the user's machine is not ours to prune.
    sleep 30
  done
}

say "repo + candidate state"
cd "$REPO" || exit 1
git rev-parse --short HEAD
for c in "${CANDIDATES[@]}"; do printf "  cpu/%-20s %s\n" "$c" "$(git rev-parse --short "cpu/$c")"; done

say "quieting apps (Terminal is unaffected)"
osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
osascript -e 'quit app "Visual Studio Code"' 2>/dev/null || true
export NX_DAEMON=false
pkill -f 'nx@23' 2>/dev/null || true

settle "building"

say "building candidates (skipping any already built)"
for c in "${CANDIDATES[@]}"; do
  if [ -d "$DIST/$c/kernel" ] && [ -d "$DIST/$c/angular" ]; then
    echo "  $c already built — skipping"
    continue
  fi
  echo "  --- $c ---"
  rm -f "$WT/$c/node_modules" 2>/dev/null || true
  git -C "$REPO" worktree remove "$WT/$c" --force >/dev/null 2>&1 || rm -rf "$WT/$c"
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add --detach "$WT/$c" "cpu/$c" >/dev/null || exit 10
  ln -s "$REPO/node_modules" "$WT/$c/node_modules"
  ( cd "$WT/$c" && rm -rf dist && npx nx run-many -t build -p kernel angular --skip-nx-cache ) \
    >"$RESULTS/build-$c.txt" 2>&1 || { echo "  BUILD FAILED — see $RESULTS/build-$c.txt"; exit 13; }
  mkdir -p "$DIST/$c"
  cp -R "$WT/$c/dist/packages/kernel"  "$DIST/$c/kernel"
  cp -R "$WT/$c/dist/packages/angular" "$DIST/$c/angular"
  echo "  built -> $DIST/$c"
done
pkill -9 -f 'nx@23' 2>/dev/null || true

gate() {
  awk '
    BEGIN { ok=1; seen=0 }
    $1=="updateOne" || $1=="byId-warm" || $1=="byId-cold" || $1=="field-read-held" {
      aa=$5; gsub(/%/,"",aa); seen++
      printf "    %-17s A/A=%s%%\n", $1, aa
      if ((aa+0) > 5.0) ok=0
    }
    END { if (seen != 4) { print "    ERROR: saw", seen, "of 4 workloads"; exit 2 }
          if (!ok) exit 1 }' "$1"
}

say "three formal A/A preflights (token vs token)"
PASS=1
for i in 1 2 3; do
  F="$RESULTS/preflight-$i.txt"
  if [ -s "$F" ] && grep -q scalar-set "$F"; then
    echo "  preflight $i already recorded — re-checking its gate"
  else
    # Up to three attempts, because a preflight ABORTED for memory recorded no
    # verdict -- nothing was measured, so retrying it is not retrying a result.
    # The previous runner died mid-preflight when the host ran out of memory and
    # lost everything; this watches free memory WHILE the harness runs and
    # restarts the attempt on a calm host instead.
    ATTEMPT=0
    while :; do
      ATTEMPT=$((ATTEMPT + 1))
      if [ "$ATTEMPT" -gt 3 ]; then
        cat > "$RESULTS/FINAL-STATUS.txt" <<STATUS
EXECUTION INVALID — HOST RAN OUT OF MEMORY REPEATEDLY

Preflight $i was aborted three times because free memory collapsed below 1.5 GB
while the harness was running. No measurement completed, so NOTHING is known
about whether the v3 harness can resolve the entity workloads.

This is NOT the v3 stopping rule and does NOT settle the CPU question.
Re-running on a host with more headroom is legitimate; methodology, thresholds,
candidates and harness are untouched.
STATUS
        echo "  aborted 3x for memory — recording EXECUTION INVALID"
        PASS=0
        break 2
      fi

      settle "preflight $i (attempt $ATTEMPT)"
      { date; uptime; echo "free: $(free_gb) GB"; } > "$RESULTS/preflight-$i-machine.txt"
      echo "  running preflight $i (attempt $ATTEMPT) ..."

      node "$HARNESS" --roots "a=$DIST/v2-token,b=$DIST/v2-token" --pairs 10 >"$F" 2>&1 &
      HPID=$!
      ABORTED=0
      while kill -0 "$HPID" 2>/dev/null; do
        FM=$(free_gb)
        if awk -v m="$FM" 'BEGIN { exit !(m < 1.5) }'; then
          echo "  free memory fell to ${FM} GB — aborting this attempt"
          kill -9 "$HPID" 2>/dev/null
          pkill -9 -f 'st-ab3-' 2>/dev/null
          ABORTED=1
          break
        fi
        sleep 10
      done
      wait "$HPID" 2>/dev/null
      RC=$?

      [ "$ABORTED" = "1" ] && { echo "  settling before retry"; sleep 120; continue; }
      [ "$RC" != "0" ] && { echo "  harness exited $RC"; PASS=0; break 2; }
      break
    done
  fi
  tail -9 "$F"
  if ! gate "$F"; then echo "  PREFLIGHT $i FAILED THE 5% A/A GATE"; PASS=0; break; fi
  echo "  PREFLIGHT $i PASS"
done

if [ "$PASS" != "1" ]; then
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
else
  say "all three passed — four-way, once"
  settle "the four-way run"
  { date; uptime; echo "free: $(free_gb) GB"; } > "$RESULTS/four-way-machine.txt"
  node "$HARNESS" --roots \
    "strong=$DIST/v2-strong,cell=$DIST/v2-cell,token=$DIST/v2-token,native=$DIST/v2-angular-native" \
    --pairs 15 >"$RESULTS/four-way-v3.txt" 2>&1
  cat "$RESULTS/four-way-v3.txt"
  cat > "$RESULTS/FINAL-STATUS.txt" <<STATUS
THREE A/A PREFLIGHTS PASSED — four-way executed once, uninterpreted.
Apply the thresholds in docs/architecture/CPU-DECISION-PREREGISTRATION-V3.md
Raw: $RESULTS/four-way-v3.txt
STATUS
fi

cd "$REPO"
for c in "${CANDIDATES[@]}"; do
  rm -f "$WT/$c/node_modules" 2>/dev/null || true
  git worktree remove "$WT/$c" --force >/dev/null 2>&1 || true
done
git worktree prune

say "DONE"
cat "$RESULTS/FINAL-STATUS.txt"
echo
echo "raw evidence: $RESULTS"
