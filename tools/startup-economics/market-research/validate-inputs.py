#!/usr/bin/env python3
"""Validate research inputs only; does not calculate economic model results."""

import hashlib
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
sources = json.loads((ROOT / "sources.json").read_text())
inputs = json.loads((ROOT / "scenario-inputs.json").read_text())
fit = json.loads((ROOT / "industry-fit.json").read_text())
source_ids = {row["id"] for row in sources["sources"]}
checks = []


def require(condition, message):
    if not condition:
        raise ValueError(message)


require(len(source_ids) == len(sources["sources"]), "Duplicate source ID")
for source in sources["sources"]:
    require(source["url"].startswith("https://"), "Missing HTTPS source")
    require(source["retrieved_on_utc"] == "2026-11-18", "Unexpected source date")
    words = len(json.dumps(source["facts"]).split())
    words += len(" ".join(source["limits"]).split())
    require(words <= 200, f"Source extraction exceeds word limit: {source['id']}")
checks.append("dated_distinct_sources_and_bounded_extractions")

for row in fit["ranked_beachheads"]:
    require(row["profitable_context_source"] in source_ids, "Missing industry source")
for row in fit["comparators"]:
    require(set(row["supported_sources"]) <= source_ids, "Missing comparator source")
for field in ["pricing_evidence_source_ids", "hosting_evidence_source_ids"]:
    require(set(inputs[field]) <= source_ids, "Missing input source")
require(set(inputs["rate_basis"]["source_ids"]) <= source_ids, "Missing wage source")
checks.append("source_references_resolve")


def check_numbers(value):
    if isinstance(value, dict):
        if all(key in value for key in ["lower", "base", "upper"]):
            require(value["lower"] <= value["base"] <= value["upper"], "Unordered range")
        for child in value.values():
            check_numbers(child)
    elif isinstance(value, list):
        for child in value:
            check_numbers(child)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        require(math.isfinite(value) and value >= 0, "Nonfinite or negative input")


check_numbers(inputs)
checks.append("finite_nonnegative_inputs_and_ordered_ranges")
for account in inputs["customer_tiers"]:
    require(not account["risk_default"]["enabled"], "Base risk enabled")
    for field in ["eligible_incidents_per_year", "nonlabor_loss_usd_per_incident",
                  "attributable_fraction", "prevented_fraction_of_attributable"]:
        require(account["risk_default"][field] == 0, "Nonzero base risk")
    require(account["cash_release_fraction"] == 0, "Assumed cash release")
    v15 = account["v15_runtime"]
    v16 = account["v16_increment_over_v15"]
    studio = account["private_studio"]
    pairs = [
        (v15["recurring_build_maintenance_avoided_hours_per_month"],
         v15["recurring_build_maintenance_baseline_hours_per_month"] *
         v15["recurring_build_maintenance_avoided_fraction"]),
        (v16["recurring_coordination_avoided_hours_per_month"],
         v16["recurring_coordination_baseline_hours_per_month"] *
         v16["recurring_coordination_avoided_fraction"]),
        (studio["investigation_hours_avoided_per_month"],
         studio["investigations_per_month"] * studio["baseline_engineering_hours_per_investigation"] *
         studio["investigation_hours_avoided_fraction"]),
        (studio["review_hours_avoided_per_month"],
         studio["baseline_reviewer_hours_per_month"] * studio["review_hours_avoided_fraction"]),
    ]
    for actual, expected in pairs:
        require(math.isclose(actual, expected), "Redundant hour inputs disagree")
    engineering_hours = v15["recurring_build_maintenance_baseline_hours_per_month"]
    engineering_hours += v16["recurring_coordination_baseline_hours_per_month"]
    engineering_hours += studio["investigations_per_month"] * studio["baseline_engineering_hours_per_investigation"]
    require(engineering_hours * 12 <= account["engineers"] * account["annual_hours_per_worker"],
            "Engineering baseline exceeds staff capacity")
    require(studio["baseline_reviewer_hours_per_month"] * 12 <=
            account["operational_reviewers"] * account["annual_hours_per_worker"],
            "Review baseline exceeds staff capacity")
checks.extend(["base_hours_reconcile_and_fit_staff_capacity", "base_risk_and_cash_release_zero"])

require(math.isclose(sum(row["mix_fraction"] for row in inputs["supplier_tiers"]), 1),
        "Supplier mix does not sum to one")
for account in inputs["customer_tiers"]:
    supplier = next(row for row in inputs["supplier_tiers"] if row["id"] == account["id"])
    require(account["private_studio"]["price_usd_per_account_month"] ==
            supplier["price_usd_per_account_month"], "Customer/supplier prices disagree")
    require(account["private_studio"]["paid_tool_users"] == supplier["included_paid_tool_users"],
            "Customer/supplier seats disagree")
require([row["paid_accounts"] for row in inputs["supplier_scales"]] == [100, 1000, 10000],
        "Unexpected conditional scale")
require(inputs["eligible_paid_account_count"] is None and
        fit["eligibility"]["eligible_account_count"] is None, "Unsupported eligible-market count")
checks.append("prices_seats_mix_and_conditional_scale_consistent")
require(all(row["annual_runtime_revenue_usd"] == 0 for row in inputs["oss_adoption_scales"]),
        "Free runtime assigned license revenue")
checks.append("free_runtime_license_revenue_zero")

files = []
for name in ["sources.json", "industry-fit.json", "scenario-inputs.json", "validate-inputs.py"]:
    payload = (ROOT / name).read_bytes()
    files.append({"path": name, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})
print(json.dumps({"status": "pass", "checks": checks, "files": files}, indent=2))
