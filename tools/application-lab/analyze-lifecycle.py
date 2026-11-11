#!/usr/bin/env python3
"""Validate and summarize two complete finite lifecycle diagnostics, offline."""
from __future__ import annotations

import datetime
import hashlib
import json
import math
import platform
import statistics
import sys
import uuid
from pathlib import Path


MODES = ("inventory-aging", "publication-payloads")
SIZES = (1000, 10000)
EDITS = (400, 1200, 2400, 4800)
WEAK_COUNTS = (
    "trackedUnique", "alive", "collected", "stillCurrent",
    "transportIdentity", "observedSuperseded",
)
LIMITS = [
    "Three matched fresh-browser pairs per size/mode; no A/A controls. All individual pairs and min/median/max are descriptive; no ratios, latency, significance, noise-band or winner claims.",
    "Heap is whole-application forced-GC JS used bytes, including diagnostic WeakRefs/metadata and warmed framework/library state. Publication mode retains common backend history until final late delivery releases the old backend reference.",
    "Heap is sampled before post-GC weak-reference inspection. Current-identity getter reads can materialize objects during inspection. Observed public identities do not enumerate every internal allocation or retained path.",
    "WeakRef survival is not a leak verdict, and collection of sampled targets does not establish universal leak freedom or unlimited boundedness. Final survivors require the recorded complete heap snapshot for later retaining-path attribution.",
    "The bound browser helper asserted full payload equality/digests in-page and each checked edit. Raw receipts preserve compact stage evidence, not every full historical payload or intermediate DOM state; this analyzer does not replay the browser.",
    "Hash checks establish consistency with included bindings, not authenticity or comprehensive reproducibility. Source/library versions, workload and host observations remain attached to the raw receipts.",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_new(path, value):
    with Path(path).open("x") as stream:
        if isinstance(value, str):
            stream.write(value)
        else:
            json.dump(value, stream, indent=2, allow_nan=False)
            stream.write("\n")


def integer(value, name, minimum=0):
    require(type(value) is int and value >= minimum, f"Invalid {name}: {value!r}")


def host(value):
    require(isinstance(value, dict), "Missing host observations")
    require(len(value["load"]) == 3, "Three host load observations")
    for number in value["load"]:
        require(type(number) in (int, float) and math.isfinite(number) and number >= 0,
                "Finite nonnegative host load")
    integer(value["freeBytes"], "host free bytes")


class Verifier:
    def __init__(self):
        self.hashes = {}
        self.originals = {}

    def file(self, path, expected):
        require(isinstance(path, str) and Path(path).is_absolute(), "Absolute recorded identity required")
        require(isinstance(expected, str) and len(expected) == 64 and
                all(char in "0123456789abcdef" for char in expected), f"Invalid hash: {path}")
        canonical = str(Path(path).resolve())
        if canonical in self.hashes:
            require(self.hashes[canonical] == expected, f"Conflicting binding: {path}")
        else:
            require(sha(path) == expected, f"File hash mismatch: {path}")
            self.hashes[canonical] = expected
        self.originals[path] = expected

    def receipt(self, receipt, expected_path=None):
        require(set(receipt) == {"path", "sha256"}, "Exact receipt shape")
        if expected_path is not None:
            require(Path(receipt["path"]).resolve() == Path(expected_path).resolve(),
                    f"Unexpected receipt path: {receipt['path']}")
        self.file(receipt["path"], receipt["sha256"])

    def mapping(self, values):
        require(isinstance(values, dict) and values, "Missing hash bindings")
        for path, digest in values.items():
            self.file(path, digest)


def stage_names(mode):
    names = ["initial-view", "populated"]
    if mode == "inventory-aging":
        for end in EDITS:
            names += [f"checked-edits-through-{end}", f"after-{end}-edits"]
        return names + ["destroy", "after-destroy"]
    for end in (8, 16):
        names += [f"start-plans-through-{end}", f"detach-after-accepted-write-{end}",
                  f"{end}-total-started-held", f"acknowledge-through-{end}",
                  f"{end}-total-acknowledged", f"dismiss-through-{end}", f"{end}-total-pruned"]
    return names + ["submit-pending-teardown", "before-pending-teardown", "destroy-pending",
                    "after-destroy-before-late", "deliver-retired", "after-destroy-after-late"]


def checkpoint_names(mode):
    if mode == "inventory-aging":
        return ["populated", *[f"after-{end}-edits" for end in EDITS], "after-destroy"]
    return ["populated", "8-total-started-held", "8-total-acknowledged", "8-total-pruned",
            "16-total-started-held", "16-total-acknowledged", "16-total-pruned",
            "before-pending-teardown", "after-destroy-before-late", "after-destroy-after-late"]


def validate_weak(weak, live, mode):
    for name in WEAK_COUNTS:
        integer(weak[name], f"weak.{name}")
    total, alive = weak["trackedUnique"], weak["alive"]
    require(alive + weak["collected"] == total, "Weak alive/collected accounting")
    require(weak["stillCurrent"] <= alive and weak["transportIdentity"] <= alive,
            "Weak classifications exceed live targets")
    require(weak["observedSuperseded"] <= total, "Superseded count exceeds targets")
    require(weak["currentIdentityChecksAvailable"] is live, "Current identity availability")
    require(len(weak["survivors"]) == alive, "All survivor metadata must be present")
    keys = set()
    for item in weak["survivors"]:
        integer(item["key"], "survivor key")
        require(item["key"] < total and item["key"] not in keys, "Unique tracked survivor key")
        keys.add(item["key"])
        require(isinstance(item["id"], str) and item["id"], "Survivor subject ID")
        for flag in ("observedSuperseded", "stillCurrent", "transportIdentity"):
            require(type(item[flag]) is bool, "Boolean weak classification")
        if mode == "inventory-aging":
            integer(item["capturedAt"], "captured edit")
            require(item["capturedAt"] < 4800, "Bounded captured edit")
        else:
            require(item["capturedAt"] in ("started", "acknowledged"), "Captured publication state")
    require(sum(item["stillCurrent"] for item in weak["survivors"]) == weak["stillCurrent"],
            "Current classification count")
    require(sum(item["transportIdentity"] for item in weak["survivors"]) == weak["transportIdentity"],
            "Transport classification count")
    require(sum(item["observedSuperseded"] for item in weak["survivors"]) <= weak["observedSuperseded"],
            "Superseded classification count")
    if not live:
        require(weak["stillCurrent"] == weak["transportIdentity"] == 0, "Destroyed current identities")
    if mode == "inventory-aging":
        require(weak["transportIdentity"] == 0, "Inventory has no transport identity")
    else:
        require(weak["observedSuperseded"] == 0, "Publication probe has no row supersession marker")


def inventory_state(state, rows, edits):
    require(state == {"completedEdits": edits, "checkedRows": 100, "total": rows,
                      "matched": rows, "visibleIDs": [f"J-{index}" for index in range(40)]},
            "Exact checked inventory state")


def publication_state(state, starts, status, active, accepted, acknowledged, operations):
    first = starts - 8
    expected_ids = [f"life-plan-{index}" for index in range(first, starts)] if active else []
    owner = ("Operator 0", "Accepted after eight", "Accepted after sixteen")[accepted]
    require(state == {"publicIDs": expected_ids, "publicState": status, "starts": starts,
                      "attempts": starts, "acknowledgements": acknowledged,
                      "operations": operations, "applications": accepted,
                      "canonicalOwner": owner, "canonicalOwnerRevision": 10 + accepted},
            "Exact publication lifecycle state")


def validate_stages(mode, rows, evidence):
    require(evidence["initial-view"] == {"rows": rows, "visibleIDs": [f"J-{i}" for i in range(40)]},
            "Exact initial viewport")
    checkpoints = checkpoint_names(mode)
    previous_total = previous_collected = 0
    for name in checkpoints:
        item = evidence[name]
        integer(item["heapBytes"], "heap bytes", 1)
        if "backingStorageBytes" in item:
            integer(item["backingStorageBytes"], "backing storage bytes")
        require(item["diagnosticObjectsIncluded"] is True, "Diagnostic allocation disclosure")
        live = not name.startswith("after-destroy")
        validate_weak(item["weak"], live, mode)
        require(item["weak"]["trackedUnique"] >= previous_total and
                item["weak"]["collected"] >= previous_collected, "Monotone tracked/collected counters")
        previous_total, previous_collected = item["weak"]["trackedUnique"], item["weak"]["collected"]
        if name == "populated":
            require(item["weak"]["trackedUnique"] == 0, "No premature weak targets")
        else:
            require(item["weak"]["trackedUnique"] > 0, "Nonvacuous tracked lifecycle objects")
        if mode == "inventory-aging":
            require(item["backendLifetime"] == "not-applicable", "Inventory backend label")
    if mode == "inventory-aging":
        inventory_state(evidence["populated"]["state"], rows, 0)
        for end in EDITS:
            inventory_state(evidence[f"checked-edits-through-{end}"], rows, end)
            inventory_state(evidence[f"after-{end}-edits"]["state"], rows, end)
            require(evidence[f"after-{end}-edits"]["weak"]["trackedUnique"] <= end,
                    "At most one captured unique public object per edit")
        require(evidence["destroy"] == {"renderedScreens": 0, "completedEdits": 4800}, "Destroyed inventory DOM")
        require(evidence["after-destroy"]["state"] == {"completedEdits": 4800, "renderedScreens": 0},
                "Final inventory checkpoint")
        return
    publication_state(evidence["populated"]["state"], 0, "started", False, 0, 0, 0)
    require(evidence["populated"]["backendLifetime"] == "live-service-empty-history", "Initial service history")
    for batch, end in enumerate((8, 16), 1):
        publication_state(evidence[f"start-plans-through-{end}"], end, "started", True,
                          batch - 1, end - 8, 0)
        detach = evidence[f"detach-after-accepted-write-{end}"]
        integer(detach["checkedHistoricalPayloads"], "Checked historical payloads")
        require(detach["owner"] == ("Accepted after eight" if end == 8 else "Accepted after sixteen")
                and detach["revision"] == 10 + batch, "Accepted write detachment evidence")
        publication_state(evidence[f"{end}-total-started-held"]["state"], end, "started", True,
                          batch, end - 8, 1)
        publication_state(evidence[f"acknowledge-through-{end}"], end, "acknowledged", True,
                          batch, end, 1)
        publication_state(evidence[f"{end}-total-acknowledged"]["state"], end, "acknowledged", True,
                          batch, end, 1)
        publication_state(evidence[f"dismiss-through-{end}"], end, "acknowledged", False,
                          batch, end, 0)
        publication_state(evidence[f"{end}-total-pruned"]["state"], end, "acknowledged", False,
                          batch, end, 0)
        for suffix in ("started-held", "acknowledged", "pruned"):
            item = evidence[f"{end}-total-{suffix}"]
            require(item["backendLifetime"] == "live-service-retains-all-started-plan-copies", "Common plan-history label")
            require(item["weak"]["trackedUnique"] >= end, "Nonvacuous public payload sampling")
    pending = {"publications": 1, "operations": 1, "starts": 16, "attempts": 16,
               "applications": 2, "waitingInputs": ["teardown-owner"]}
    require(evidence["submit-pending-teardown"] == pending and
            evidence["before-pending-teardown"]["state"] == pending, "Held final pending plan")
    require(evidence["before-pending-teardown"]["backendLifetime"] == "live-service-retains-sixteen-plan-copies",
            "Pre-teardown service history")
    require(evidence["destroy-pending"] == {"renderedScreens": 0} and
            evidence["after-destroy-before-late"]["state"] == {"renderedScreens": 0}, "Destroyed dispatch DOM")
    require(evidence["after-destroy-before-late"]["backendLifetime"] == "old-service-intentionally-retained",
            "Retained old backend checkpoint")
    retired = {"applications": 3, "starts": 16, "publicationAttempts": 16}
    require(evidence["deliver-retired"] == retired and
            evidence["after-destroy-after-late"]["state"] == retired, "No publication after late retired response")
    require(evidence["after-destroy-after-late"]["backendLifetime"] == "old-service-reference-released", "Released old backend checkpoint")


def validate_admission(schedule, bindings, directory, mode):
    command, packets = schedule["command"], schedule["packets"]
    require(len(command) in (6, 7) and command[5] == mode, "Recorded generating command")
    require(Path(command[4]).resolve() == directory.resolve(), "Generating output identity")
    require(Path(command[1]).resolve() == Path(__file__).with_name("lifecycle-followup.mjs").resolve(),
            "Identified lifecycle runner")

    def bound(path, expected=None):
        path = str(path)
        require(path in bindings, f"Required binding absent: {path}")
        require(bindings[path] == (sha(path) if expected is None else expected), f"Required binding differs: {path}")

    bound(command[1])
    bound(Path(command[1]).parents[2] / "docs/audits/2026-11-11-application-comparison/LIFECYCLE-FOLLOWUP.md")
    scenario = "inventory" if mode == "inventory-aging" else "dispatch"
    for index, variant in enumerate(("before", "after"), 2):
        require(Path(command[index]).resolve() == Path(packets[variant]).resolve(), "Generating packet identity")
        packet = Path(packets[variant])
        plan_path = packet / "plan.json"
        build_path = packet / ("build.json" if scenario == "inventory" else "dispatch-build.json")
        conformance_path = packet / f"{scenario}-conformance/results.json"
        for path in (plan_path, build_path, conformance_path):
            bound(path)
        plan, build, conformance = read(plan_path), read(build_path), read(conformance_path)
        require(build["planSha256"] == sha(plan_path) == conformance["planSha256"], "Exact admitted plan")
        require(conformance["buildSha256"] == sha(build_path), "Exact admitted build")
        checker = Path(command[1]).with_name(f"{scenario}-check.mjs")
        bound(checker, conformance["runnerSha256"])
        expected_faults = ({"drop-filter", "stale-count", "invalid-add", "stale-editor", "skip-destroy"}
                           if scenario == "inventory" else
                           {"drop-write", "stale-preview", "premature-publication", "clobber-other-field",
                            "blanket-block", "stale-editor", "drop-reentry", "skip-destroy", "false-rejection", "stale-success"})
        require(set(conformance["controls"]) == expected_faults, "Exact conformance controls")
        require(set(build["arms"]) == set(plan["arms"]), "Exact built arm set")
        require(len(conformance["results"]) == len(plan["arms"]) * (len(expected_faults) + 1), "Complete admitted conformance")
        for arm in plan["arms"]:
            admitted = [entry for entry in conformance["results"] if entry["arm"] == arm]
            require({entry["fault"] for entry in admitted} == expected_faults | {None}, "One baseline and each planted control")
            for entry in admitted:
                require(entry["passed"] is True, "Passing admitted conformance")
                child = packet / f"{scenario}-conformance/{arm}-{entry['fault'] or 'baseline'}.json"
                bound(child)
                require(read(child) == entry, "Admitted conformance raw identity")
        for path, digest in plan["inputs"].items():
            bound(path, digest)
        for arm in build["arms"].values():
            for collection in (arm["dependencies"], arm["served"]):
                for path, digest in collection.items():
                    bound(path, digest)
    if mode == "publication-payloads":
        require(len(command) == 7, "Publication mode requires payload admission")
    if len(command) == 7:
        proof_path = Path(command[6]) / "results.json"
        bound(proof_path)
        proof = read(proof_path)
        require(proof["passed"] is True and len(proof["results"]) == 4 and
                all(entry["passed"] is True for entry in proof["results"]), "Complete payload exposure proof")
        bound(Path(command[6]) / "schedule.json", proof["scheduleSha256"])
        for mapping in (proof["bindings"], proof["receipts"]):
            for path, digest in mapping.items():
                bound(path, digest)


def validate_run(directory, mode, verifier):
    directory = Path(directory).absolute()
    result_path, schedule_path, preflight_path = [directory / name for name in ("results.json", "schedule.json", "preflight.json")]
    aggregate, schedule, preflight = read(result_path), read(schedule_path), read(preflight_path)
    require(aggregate["passed"] is True and preflight["passed"] is True, "Only complete passing diagnostics admitted")
    require(aggregate["mode"] == schedule["mode"] == preflight["mode"] == mode, "Diagnostic mode identity")
    require(aggregate["bindings"] == schedule["bindings"] == preflight["bindings"], "Identical frozen bindings")
    verifier.mapping(aggregate["bindings"])
    validate_admission(schedule, aggregate["bindings"], directory, mode)
    verifier.file(str(schedule_path), aggregate["scheduleSha256"])
    for path in (result_path, preflight_path):
        verifier.file(str(path), sha(path))
    require(len(aggregate["results"]) == len(schedule["schedule"]) == 12, "Exact twelve-child cohort")
    expected = []
    for rows in SIZES:
        for round_number in range(3):
            for variant in (("after", "before") if round_number % 2 else ("before", "after")):
                expected.append({"index": len(expected), "mode": mode, "arm": "tanstack",
                                 "rows": rows, "round": round_number, "variant": variant})
    pids, identities, versions, receipt_union, children = set(), set(), set(), {}, []
    for sample, fixed, entry in zip(schedule["schedule"], expected, aggregate["results"]):
        require(set(sample) == set(fixed) | {"processIdentity"}, "Exact schedule fields")
        require({key: sample[key] for key in fixed} == fixed, "Registered schedule order/profile")
        identity = sample["processIdentity"]
        require(str(uuid.UUID(identity)) == identity and identity not in identities, "Unique process identity")
        identities.add(identity)
        require(all(entry[key] == value for key, value in sample.items()), "Aggregate child schedule match")
        prefix = f"{sample['index']:03d}-{sample['variant']}-{sample['rows']}"
        verifier.receipt(entry["receipt"], directory / f"{prefix}.json")
        raw = read(entry["receipt"]["path"])
        require(raw == {key: value for key, value in entry.items() if key != "receipt"}, "Raw child differs from aggregate")
        require(raw["passed"] is True and raw["browserErrors"] == [] and
                not raw.get("finalizationErrors") and "error" not in raw and "failedAt" not in raw,
                "Child contains failure evidence")
        process = raw["process"]
        integer(process["browserPid"], "Chromium PID", 1)
        integer(process["harnessPid"], "Harness PID", 1)
        require(process["browserPid"] not in pids and process["identity"] == identity, "Fresh Chromium PID")
        pids.add(process["browserPid"])
        require(isinstance(process["browserVersion"], str) and process["browserVersion"], "Recorded browser version")
        versions.add(process["browserVersion"])
        host(raw["hostStart"]); host(raw["hostEnd"])
        names = stage_names(mode)
        if raw.get("finalSnapshot"):
            names.append("final-survivor-snapshot")
        require([step["name"] for step in raw["stages"]] == names, "Complete ordered lifecycle stages")
        evidence, stage_receipts, expected_child_receipts = {}, {}, {}
        for index, step in enumerate(raw["stages"]):
            require(step["passed"] is True, "Every stage must pass")
            verifier.receipt(step["receipt"], directory / f"{prefix}-stage-{index:02d}.json")
            recorded = read(step["receipt"]["path"])
            require(recorded["sample"] == sample and recorded["stage"] == step["name"] and recorded["passed"] is True,
                    "Raw stage identity")
            evidence[step["name"]] = recorded["evidence"]
            stage_receipts[step["name"]] = step["receipt"]
            expected_child_receipts[step["receipt"]["path"]] = step["receipt"]["sha256"]
        validate_stages(mode, sample["rows"], evidence)
        final_name = checkpoint_names(mode)[-1]
        final_weak = evidence[final_name]["weak"]
        require(raw["finalWeakCounts"] == {key: final_weak[key] for key in ("trackedUnique", "alive", "collected")},
                "Final weak summary matches checkpoint")
        snapshot = raw.get("finalSnapshot")
        if final_weak["alive"]:
            require(snapshot is not None and snapshot["complete"] is True, "Survivors require a complete final snapshot")
            verifier.receipt({"path": snapshot["path"], "sha256": snapshot["sha256"]}, directory / f"{prefix}-final.heapsnapshot")
            integer(snapshot["bytes"], "Snapshot bytes", 1)
            require(snapshot["bytes"] == Path(snapshot["path"]).stat().st_size <= 512 * 1024 * 1024, "Snapshot size integrity")
            require(snapshot["survivingWeakTargetsBeforeSnapshot"] == final_weak["alive"] and
                    evidence["final-survivor-snapshot"] == snapshot, "Snapshot survivor attribution")
            expected_child_receipts[snapshot["path"]] = snapshot["sha256"]
        else:
            require(snapshot is None, "No untriggered survivor snapshot")
        require(raw["receipts"] == expected_child_receipts, "Exact stage/snapshot receipt closure")
        receipt_union.update(expected_child_receipts)
        receipt_union[entry["receipt"]["path"]] = entry["receipt"]["sha256"]
        children.append({"sample": sample, "process": process, "hostStart": raw["hostStart"],
                         "hostEnd": raw["hostEnd"], "receipt": entry["receipt"],
                         "stageReceipts": stage_receipts, "evidence": evidence,
                         "finalWeakCounts": raw["finalWeakCounts"], "finalSnapshot": snapshot})
    require(len(versions) == 1 and len(pids) == 12, "One browser version and twelve fresh browser PIDs")
    require(aggregate["receipts"] == receipt_union, "Exact aggregate receipt closure")
    return {"mode": mode, "directory": str(directory), "packets": schedule["packets"],
            "browserVersion": next(iter(versions)), "generatingCommand": schedule["command"],
            "scheduleReceipt": {"path": str(schedule_path), "sha256": sha(schedule_path)},
            "resultsReceipt": {"path": str(result_path), "sha256": sha(result_path)},
            "preflightReceipt": {"path": str(preflight_path), "sha256": sha(preflight_path)},
            "registeredLimits": schedule["limits"], "children": children}


def descriptive(values):
    require(len(values) == 3 and all(type(value) in (int, float) and math.isfinite(value) for value in values),
            "Three finite independent paired observations")
    return {"n": 3, "min": min(values), "median": statistics.median(values), "max": max(values)}


def paired(samples, unit):
    require([sample["round"] for sample in samples] == [0, 1, 2], "Exact nonvacuous round pairing")
    before = [sample["before"] for sample in samples]
    after = [sample["after"] for sample in samples]
    for sample in samples:
        require(sample["difference"] == sample["after"] - sample["before"], "Matched signed difference")
    return {"unit": unit, "pairedN": 3, "before": descriptive(before), "after": descriptive(after),
            "difference": descriptive([sample["difference"] for sample in samples]), "samples": samples}


def summarize(run):
    groups = []
    checkpoints = checkpoint_names(run["mode"])
    for rows in SIZES:
        children = {(child["sample"]["round"], child["sample"]["variant"]): child
                    for child in run["children"] if child["sample"]["rows"] == rows}
        require(len(children) == 6, "Six children per size")
        stages = []
        for index, name in enumerate(checkpoints):
            getters = {"heapBytes": lambda child, name=name: child["evidence"][name]["heapBytes"],
                       "heapDeltaFromPopulatedBytes": lambda child, name=name: child["evidence"][name]["heapBytes"] - child["evidence"]["populated"]["heapBytes"]}
            if index:
                previous = checkpoints[index - 1]
                getters["heapDeltaFromPreviousCheckpointBytes"] = lambda child, name=name, previous=previous: child["evidence"][name]["heapBytes"] - child["evidence"][previous]["heapBytes"]
            for counter in WEAK_COUNTS:
                getters[f"weak.{counter}"] = lambda child, name=name, counter=counter: child["evidence"][name]["weak"][counter]
            metrics = {}
            for key, getter in getters.items():
                samples = []
                for round_number in range(3):
                    before, after = children[round_number, "before"], children[round_number, "after"]
                    bv, av = getter(before), getter(after)
                    samples.append({"round": round_number, "before": bv, "after": av, "difference": av - bv,
                                    "beforeReceipt": before["stageReceipts"][name], "afterReceipt": after["stageReceipts"][name]})
                metrics[key] = paired(samples, "count" if key.startswith("weak.") else "bytes")
            stages.append({"name": name, "metrics": metrics})
        groups.append({"mode": run["mode"], "rows": rows, "arm": "tanstack", "direction": "after - before",
                       "stages": stages})
    return groups


def markdown(summary):
    lines = ["# Finite lifecycle diagnostics", "", "Both twelve-child schedules, recorded bindings, raw children and ordered stage receipts passed offline validation. No timing or leak verdict is inferred.", "",
             "Heap values below are MiB (1,048,576 bytes), median [minimum, maximum]. JSON preserves exact bytes, all three before/after/difference pairs for every metric and raw receipt identities.", "",
             "Command: `" + " ".join(json.dumps(part) for part in summary["command"]) + "`", ""]
    def fmt(value):
        return f"{value['median']/1048576:.4f} [{value['min']/1048576:.4f}, {value['max']/1048576:.4f}]"
    for cohort in summary["cohorts"]:
        lines += [f"## {cohort['mode']} / {cohort['rows']} rows", "",
                  "| Checkpoint | Before heap | After heap | Paired difference | Three pairs, before → after |",
                  "| --- | ---: | ---: | ---: | --- |"]
        for stage in cohort["stages"]:
            metric = stage["metrics"]["heapBytes"]
            pairs = "; ".join(f"r{sample['round']}: {sample['before']/1048576:.4f} → {sample['after']/1048576:.4f}" for sample in metric["samples"])
            lines.append(f"| {stage['name']} | {fmt(metric['before'])} | {fmt(metric['after'])} | {fmt(metric['difference'])} | {pairs} |")
        lines.append("")
    lines += ["## Final weak-reference observations", "",
              "| Mode | Rows | Round | Variant | Tracked | Alive | Collected | Snapshot |",
              "| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |"]
    for child in summary["children"]:
        sample, weak, snapshot = child["sample"], child["finalWeakCounts"], child["finalSnapshot"]
        reference = f"[{Path(snapshot['path']).name}]({snapshot['path']})" if snapshot else "Not triggered"
        lines.append(f"| {sample['mode']} | {sample['rows']} | {sample['round']} | {sample['variant']} | {weak['trackedUnique']} | {weak['alive']} | {weak['collected']} | {reference} |")
    lines += ["", "## Limits", "", *[f"- {limit}" for limit in LIMITS], ""]
    return "\n".join(lines)


def main(argv):
    require(len(argv) == 3, "analyze-lifecycle.py INVENTORY_DIAGNOSTIC PUBLICATION_DIAGNOSTIC NEW_OUT")
    output = Path(argv[2]).absolute()
    require(not output.exists(), "Preserve prior analysis attempts")
    output.mkdir(parents=True)
    command = [sys.executable, str(Path(__file__).absolute()), *argv]
    try:
        verifier = Verifier()
        runs = [validate_run(directory, mode, verifier) for directory, mode in zip(argv[:2], MODES)]
        require(runs[0]["packets"] == runs[1]["packets"], "Both modes must use the same before/after packets")
        require(runs[0]["browserVersion"] == runs[1]["browserVersion"], "Same browser version across modes")
        children = [child for run in runs for child in run["children"]]
        require(len({child["sample"]["processIdentity"] for child in children}) == 24, "Twenty-four distinct scheduled process identities")
        summary = {"schemaVersion": 1, "createdUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   "command": command, "python": platform.python_version(), "analyzerSha256": sha(__file__),
                   "packets": runs[0]["packets"], "browserVersion": runs[0]["browserVersion"],
                   "validation": {"passed": True, "childrenPerMode": 12, "roundsPerSize": 3,
                                  "bindingsVerified": len(verifier.originals), "stageOrderAndRawEvidenceChecked": True},
                   "sourceRuns": [{key: value for key, value in run.items() if key != "children"} for run in runs],
                   "cohorts": [group for run in runs for group in summarize(run)],
                   "children": [{key: value for key, value in child.items() if key != "evidence"} for child in children],
                   "limits": LIMITS}
        write_new(output / "summary.json", summary)
        write_new(output / "summary.md", markdown(summary))
        write_new(output / "receipt.json", {"passed": True, "command": command,
                  "analyzerSha256": summary["analyzerSha256"], "bindings": verifier.originals,
                  "summarySha256": sha(output / "summary.json"), "markdownSha256": sha(output / "summary.md")})
        print(f"PASS: 24 lifecycle children; four size/mode cohorts; paired descriptive summary in {output}")
    except Exception as error:
        write_new(output / "failure.json", {"passed": False, "command": command,
                  "error": f"{type(error).__name__}: {error}"})
        raise


if __name__ == "__main__":
    main(sys.argv[1:])
