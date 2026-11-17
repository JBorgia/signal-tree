"""Validate the registered capture packet and summarize paired raw samples."""
from pathlib import Path
import hashlib
import json
import statistics
import sys

root = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
assert not output.exists(), "Use a new analysis output"
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
plan = json.loads((root / "plan.json").read_text())
report = json.loads((root / "results.json").read_text())
rows = report["children"]
profiles = ["tiny-history"] if plan.get("mode") == "tiny-calibration" else ["no-history", "homogeneous", "mixed"]
expected_count = 14 * len(profiles)
assert len(rows) == len(plan["rows"]) == expected_count
assert len(plan["controls"]) == 3
assert report["planSha256"] == sha(root / "plan.json")
assert sha(root / "source/capture-cost.mjs") == plan["generatorSha256"]
assert sha(root / "source/protocol.json") == plan["protocolSha256"]
for arm, binding in plan["arms"].items():
    assert sha(root / f"source/{arm}-bindings.json") == binding["admission"]["receiptSha256"]
for index, row in enumerate(rows):
    stem = f"run-{index:03d}"
    receipt = json.loads((root / (stem + ".receipt.json")).read_text())
    assert receipt["status"] == 0 and not receipt.get("signal") and not receipt.get("error")
    assert receipt["stdoutSha256"] == sha(root / (stem + ".stdout"))
    assert receipt["stderrSha256"] == sha(root / (stem + ".stderr"))
    assert row == json.loads((root / (stem + ".stdout")).read_text()) == json.loads((root / (stem + ".json")).read_text())
    assert row["task"] == receipt["task"] == plan["rows"][index]
    assert row["generatorSha256"] == plan["generatorSha256"]
    assert row["planSha256"] == report["planSha256"]
    assert row["packageIdentity"] == plan["arms"][row["task"]["arm"]]["identity"]
assert len({row["pid"] for row in rows}) == expected_count
messages = ["missing-capture oracle", "requirement identity/order oracle", "owner identity oracle"]
for index, task in enumerate(plan["controls"]):
    stem = f"control-{index:03d}"
    receipt = json.loads((root / (stem + ".json")).read_text())
    assert receipt["expectedOracleRejected"] and receipt["status"] != 0
    assert not receipt.get("signal") and not receipt.get("error")
    assert receipt["task"] == task
    assert receipt["stdoutSha256"] == sha(root / (stem + ".stdout"))
    assert receipt["stderrSha256"] == sha(root / (stem + ".stderr"))
    assert messages[index] in (root / (stem + ".stderr")).read_text()

getters = {
    "cpuMs": lambda row: row["cpuMs"],
    "elapsedMs": lambda row: row["elapsedMs"],
    "immediateHeapDelta": lambda row: row["heap"]["immediateDelta"],
    "afterGCWithCapturesDelta": lambda row: row["heap"]["afterGCWithCapturesDelta"],
    "afterGCReleasedCapturesDelta": lambda row: row["heap"]["afterGCReleasedCapturesDelta"],
}


def stats(values):
    return {"samples": values, "median": statistics.median(values), "min": min(values), "max": max(values)}


summary = []
for profile in profiles:
    samples = [row for row in rows if row["task"]["profile"] == profile]
    compare = [row for row in samples if row["task"]["group"] == "comparison"]
    aa = [row for row in samples if row["task"]["group"] == "AA"]
    assert len(compare) == 10 and len(aa) == 4
    for row in samples:
        assert row["oracle"] == samples[0]["oracle"]
        assert row["workload"] == samples[0]["workload"]
    metrics = {}
    for name, get in getters.items():
        arms = {arm: [get(row) for row in compare if row["task"]["arm"] == arm] for arm in ["baseline", "candidate"]}
        differences = []
        for pair in range(5):
            pair_rows = [row for row in compare if row["task"]["pair"] == pair]
            assert len(pair_rows) == 2
            paired = {row["task"]["arm"]: get(row) for row in pair_rows}
            differences.append(paired["candidate"] - paired["baseline"])
        same_arm = []
        for pair in range(2):
            paired = [row for row in aa if row["task"]["pair"] == pair]
            assert len(paired) == 2 and {row["task"]["replicate"] for row in paired} == {0, 1}
            assert all(row["task"]["arm"] == "baseline" for row in paired)
            same_arm.append(get(paired[1]) - get(paired[0]))
        metrics[name] = {"arms": {arm: stats(values) for arm, values in arms.items()},
                         "pairedCandidateMinusBaseline": stats(differences), "sameArmDifferences": same_arm,
                         "maxAbsoluteSameArmDifference": max(map(abs, same_arm))}
    counts = {}
    for arm in ["baseline", "candidate"]:
        selected = [row for row in compare if row["task"]["arm"] == arm]
        for row in selected:
            assert row["counters"] == selected[0]["counters"]
            assert row["executionCensus"] == selected[0]["executionCensus"]
        counts[arm] = {key: selected[0][key] for key in ["counters", "executionCensus", "sourceState"]}
    summary.append({"profile": profile, "workload": samples[0]["workload"], "counts": counts, "metrics": metrics,
                    "identicalPrimitiveProofAndCapturedOwnerSummariesAcrossAllSamples": True})

value = {"raw": str(root / "results.json"), "rawSha256": sha(root / "results.json"), "planSha256": sha(root / "plan.json"),
         "analyzer": str(Path(__file__).resolve()), "analyzerSha256": sha(Path(__file__)), "command": sys.argv,
         "children": expected_count, "controls": 3, "summary": summary,
         "limits": "Descriptive paired study of20 direct entity source captures. Immediate heap delta is an allocation/retention proxy; postGC heap is separate. No application startup/total allocation/leak inference. Pilot excluded."}
with output.open("x") as target:
    target.write(json.dumps(value, indent=2) + "\n")
print(json.dumps({"output": str(output), "sha256": sha(output), "children": expected_count, "controls": 3}))
