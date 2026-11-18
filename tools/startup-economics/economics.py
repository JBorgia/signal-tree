"""Auditable conditional economics, not measured productivity or a sales forecast.

Usage: economics.py INPUTS_JSON NEW_OUTPUT_DIRECTORY
All monetary results are USD; time is person-hours. Input hashes bind each run.
"""
import copy
import hashlib
import itertools
import json
from pathlib import Path
import sys


def customer(tier, mode='migration', operations_multiplier=1):
    """Separate free-runtime, incremental v16, and private-tool value buckets."""
    x = copy.deepcopy(tier)
    credit = mode == 'new_bounded_module'
    buckets = ['v15_runtime', 'v16_increment_over_v15', 'private_studio']
    if mode == 'legacy_migration':
        for name in buckets:
            x[name]['one_time_integration_hours'] *= 4
            x[name]['one_time_training_hours'] *= 2
    elif credit:
        for name in buckets:
            x[name]['one_time_integration_hours'] *= .25
    elif mode in ['no_additional_value', 'low_realized_value']:
        fraction = 0 if mode == 'no_additional_value' else .05
        x['v15_runtime']['recurring_build_maintenance_avoided_fraction'] = fraction
        x['v16_increment_over_v15']['recurring_coordination_avoided_fraction'] = fraction
        x['private_studio']['investigation_hours_avoided_fraction'] = fraction
        x['private_studio']['review_hours_avoided_fraction'] = fraction
        if mode == 'low_realized_value':
            x['capacity_realization_fraction'] = .25
    else:
        assert mode == 'migration'
    engineer = x['loaded_engineering_hourly_usd']
    reviewer = x['loaded_reviewer_hourly_usd']
    realized = x['capacity_realization_fraction']
    assert engineer > 0 and reviewer > 0 and 0 <= realized <= 1
    values = {}
    for name in buckets:
        b = x[name]
        if name == 'private_studio':
            saved_engineer = b['investigations_per_month'] * b['baseline_engineering_hours_per_investigation'] * b['investigation_hours_avoided_fraction']
            saved_reviewer = b['baseline_reviewer_hours_per_month'] * b['review_hours_avoided_fraction']
            operations_engineer = b['incremental_engineering_operations_hours_per_month']
            operations_reviewer = b['incremental_reviewer_operations_hours_per_month']
            license_month = b['price_usd_per_account_month']
        else:
            prefix = 'recurring_build_maintenance' if name == 'v15_runtime' else 'recurring_coordination'
            saved_engineer = b[prefix + '_baseline_hours_per_month'] * b[prefix + '_avoided_fraction']
            saved_reviewer = 0
            operations_engineer = b['incremental_maintenance_hours_per_month']
            operations_reviewer = 0
            license_month = b['recurring_license_usd_per_month']
        benefit = 12 * realized * (saved_engineer * engineer + saved_reviewer * reviewer)
        operations = 12 * operations_multiplier * (operations_engineer * engineer + operations_reviewer * reviewer)
        cash_cost = 12 * (license_month + b['incremental_customer_infrastructure_usd_per_month'])
        setup = engineer * sum(b.get(key, 0) for key in ['one_time_integration_hours', 'one_time_training_hours', 'one_time_procurement_security_hours'])
        build_credit = realized * engineer * b.get('one_time_build_hours_avoided', 0) if credit else 0
        values[name] = {
            'annual_usable_capacity_value_usd': benefit,
            'annual_operations_opportunity_cost_usd': operations,
            'annual_license_infrastructure_outlay_usd': cash_cost,
            'one_time_adoption_opportunity_cost_usd': setup,
            'one_time_build_capacity_credit_usd': build_credit,
            'annual_recurring_net_value_usd': benefit - operations - cash_cost,
            'first_year_net_value_usd': benefit + build_credit - operations - cash_cost - setup,
            'saved_task_engineering_hours_per_month': saved_engineer,
            'saved_task_review_hours_per_month': saved_reviewer,
            'incremental_operations_engineering_hours_per_month': operations_engineer * operations_multiplier,
            'incremental_operations_review_hours_per_month': operations_reviewer * operations_multiplier,
            'cash_payroll_savings_usd': benefit * x['cash_release_fraction'],
        }
    combinations = {
        'v15_runtime': ['v15_runtime'],
        'v16_increment_over_v15': ['v16_increment_over_v15'],
        'v16_runtime_total': ['v15_runtime', 'v16_increment_over_v15'],
        'studio_on_existing_runtime': ['private_studio'],
        'v15_plus_studio': ['v15_runtime', 'private_studio'],
        'v16_plus_studio': buckets,
    }
    products = {}
    for name, parts in combinations.items():
        total = {key: sum(values[part][key] for part in parts) for key in values[parts[0]]}
        setup_net = total['one_time_adoption_opportunity_cost_usd'] - total['one_time_build_capacity_credit_usd']
        recurring = total['annual_recurring_net_value_usd']
        total['payback_months'] = max(0, 12 * setup_net / recurring) if recurring > 0 else None
        total['three_year_net_value_usd'] = recurring * 3 - setup_net
        total['annual_net_cents_per_end_user'] = recurring * 100 / x['end_users']
        total['annual_net_cents_per_action'] = recurring * 100 / x['annual_actions']
        total['annual_usable_engineering_capacity_fraction'] = realized * total['saved_task_engineering_hours_per_month'] * 12 / (x['engineers'] * x['annual_hours_per_worker'])
        total['break_even_extra_engineering_task_hours_per_month'] = max(0, -recurring) / (12 * engineer * realized) if realized > 0 else None
        total['first_year_break_even_extra_engineering_task_hours_per_month'] = max(0, -total['first_year_net_value_usd']) / (12 * engineer * realized) if realized > 0 else None
        products[name] = total
    studio = values['private_studio']
    nonprice = studio['annual_operations_opportunity_cost_usd'] + 12 * x['private_studio']['incremental_customer_infrastructure_usd_per_month']
    surplus = studio['annual_usable_capacity_value_usd'] - nonprice
    prices = {
        'recurring_zero_net_price_ceiling_per_month': surplus / 12,
        'first_year_zero_net_price_ceiling_per_month': (surplus - studio['one_time_adoption_opportunity_cost_usd']) / 12,
        'three_year_zero_net_price_ceiling_per_month': (surplus - studio['one_time_adoption_opportunity_cost_usd'] / 3) / 12,
        'interpretation': 'Conditional value ceilings, possibly negative; not observed willingness to pay. They leave no buyer surplus at the stated horizon.',
    }
    risk = x['risk_illustrative_sensitivity']
    hypothetical_risk = risk['eligible_incidents_per_year'] * risk['nonlabor_loss_usd_per_incident'] * risk['attributable_fraction'] * risk['prevented_fraction_of_attributable']
    return {'tier': x['id'], 'mode': mode, 'products': products, 'studio_price_ceilings': prices,
            'risk_in_base_usd': 0, 'separate_hypothetical_annual_nonlabor_risk_value_usd': hypothetical_risk,
            'status': 'Assumed task savings converted to usable capacity; not measured savings or cash earnings.'}


def oss_cost(item):
    support_hours = item['active_free_runtime_organizations'] * item['inbound_support_requests_per_organization_year'] * item['hours_per_request']
    return {'organizations': item['active_free_runtime_organizations'], 'revenue_usd': 0,
            'maintenance_cost_usd': item['fixed_maintenance_fte'] * item['loaded_cost_usd_per_fte_year'],
            'community_triage_hours': support_hours,
            'community_triage_cost_usd': support_hours * item['loaded_support_hourly_usd']}


def supplier(tiers, scale, adverse=False):
    assert abs(sum(t['mix_fraction'] for t in tiers) - 1) < 1e-12
    n = scale['paid_accounts']
    rows = []
    for t in tiers:
        accounts = n * t['mix_fraction']
        churned = accounts * t['annual_account_churn_fraction']
        support = accounts * t['support_hours_per_account_month'] * 12 * (5 if adverse else 1)
        onboarding = churned * t['onboarding_delivery_hours_per_new_account']
        revenue = accounts * t['price_usd_per_account_month'] * 12
        hosting = accounts * t['hosting_usd_per_account_month'] * 12 * (3 if adverse else 1)
        cogs = hosting + (support + onboarding) * t['support_loaded_hourly_usd'] + revenue * t['payment_processing_fraction']
        replacement_cac = churned * t['acquisition_cost_usd_per_new_account'] * (2 if adverse else 1)
        rows.append({'tier': t['id'], 'accounts': accounts, 'arr_usd': revenue,
                     'hosting_usd': hosting, 'cogs_usd': cogs,
                     'replacement_cac_usd': replacement_cac,
                     'replacement_accounts': churned,
                     'support_onboarding_hours': support + onboarding,
                     'initial_acquisition_onboarding_usd': accounts * (t['acquisition_cost_usd_per_new_account'] * (2 if adverse else 1) + t['onboarding_delivery_hours_per_new_account'] * t['support_loaded_hourly_usd'])})
    sums = {k: sum(row[k] for row in rows) for k in rows[0] if k != 'tier'}
    gross = sums['arr_usd'] - sums['cogs_usd']
    fixed = scale['fixed_staff_fte'] * scale['fixed_loaded_cost_usd_per_fte_year'] + scale['fixed_nonpayroll_usd_per_year']
    contribution = gross - sums['replacement_cac_usd']
    return {'paid_accounts': n, 'mode': 'support_heavy' if adverse else 'base', 'tiers': rows, **sums,
            'gross_profit_usd': gross, 'gross_margin_fraction': gross / sums['arr_usd'],
            'fixed_private_operating_cost_usd': fixed,
            'operating_profit_before_oss_usd': contribution - fixed,
            'contribution_per_account_usd': contribution / n,
            'break_even_accounts_at_this_fixed_capacity': fixed / (contribution / n) if contribution > 0 else None,
            'variable_delivery_fte_equivalent': sums['support_onboarding_hours'] / 2080,
            'limits': 'Steady-state maintained account count; initial acquisition/readiness and OSS costs separate. No growth/ramp, taxes or financing assumption.'}


def changed(tier, path, value):
    item = copy.deepcopy(tier)
    target = item
    parts = path.split('.')
    for key in parts[:-1]:
        target = target[key]
    target[parts[-1]] = value
    return item


def telemetry(inputs, sources):
    """Linear raw storage sensitivity, before provider invoice rounding/allowances."""
    facts = next(x for x in sources['sources'] if x['id'] == 'cloudflare-r2-pricing')['facts']
    rates = {x['metric']: x['value'] for x in facts}
    grid = inputs['telemetry_sensitivity_inputs']
    result = []
    for events, size, days, batch in itertools.product(*(grid[k] for k in ['events_per_account_month', 'mean_bytes_per_event', 'retention_days', 'events_per_object'])):
        # Uniform arrival and a 30-day modeling month. Reads are a separate assumption.
        retained_gb = events * size * days / 30 / 1e9
        writes = events / batch
        result.append({'events_per_month': events, 'bytes_per_event': size, 'retention_days': days,
                       'events_per_object': batch, 'steady_retained_decimal_gb': retained_gb,
                       'writes_per_month': writes,
                       'linear_storage_usd_per_month': retained_gb * rates['standard_storage'],
                       'linear_write_usd_per_month': writes / 1e6 * rates['standard_class_a_operations'],
                       'one_full_read_per_object_usd_per_month': writes / 1e6 * rates['standard_class_b_operations']})
    return {'source_id': 'cloudflare-r2-pricing', 'cases': result,
            'limits': 'Uncompressed raw-object illustration; uniform arrival, 30-day month, optional one read/object. Excludes free tiers and invoice rounding, compute, indexing, replication, backup, security and labor. These amounts are not additional to the assumed all-in supplier hosting cost and do not estimate browser heap cost.'}


def run(inputs, sources):
    modes = ['migration', 'new_bounded_module', 'legacy_migration', 'no_additional_value', 'low_realized_value']
    customers = [customer(tier, mode) for tier in inputs['customer_tiers'] for mode in modes]
    sensitivities = []
    for tier in inputs['customer_tiers']:
        for path, settings in tier['sensitivity_ranges'].items():
            for endpoint in ['lower', 'upper']:
                value = settings[endpoint]
                result = customer(tier, operations_multiplier=value) if path == 'ongoing_operations_multiplier' else customer(changed(tier, path, value))
                sensitivities.append({'tier': tier['id'], 'input': path, 'endpoint': endpoint, 'value': value, 'result': result})
    suppliers = [supplier(inputs['supplier_tiers'], scale, adverse) for scale in inputs['supplier_scales'] for adverse in [False, True]]
    mix_cases = []
    for mix_name, fractions in [('mid_only', [0, 1, 0]), ('enterprise_only', [0, 0, 1]), ('mid_enterprise', [0, .5, .5])]:
        tiers = copy.deepcopy(inputs['supplier_tiers'])
        for tier, fraction in zip(tiers, fractions, strict=True):
            tier['mix_fraction'] = fraction
        for scale in inputs['supplier_scales'][:2]:
            for adverse in [False, True]:
                mix_cases.append({'hypothetical_mix': mix_name, **supplier(tiers, scale, adverse),
                                  'mix_limit': 'Alternative customer mix, not a recommended offer or attainable account count. Enterprise delivery requirements and actual support burden remain unvalidated.'})
    oss = [oss_cost(item) for item in inputs['oss_adoption_scales']]
    readiness = inputs['commercial_readiness_one_time']
    ready_cost = readiness['engineering_hours'] * readiness['engineering_loaded_hourly_usd'] + readiness['external_assurance_and_setup_usd']
    supplier_sensitivities = []
    for scale in inputs['supplier_scales']:
        for index, tier in enumerate(inputs['supplier_tiers']):
            for path, settings in tier['sensitivity_ranges'].items():
                for endpoint in ['lower', 'upper']:
                    tiers = copy.deepcopy(inputs['supplier_tiers'])
                    tiers[index][path] = settings[endpoint]
                    supplier_sensitivities.append({'scope': 'tier', 'tier': tier['id'], 'input': path, 'endpoint': endpoint,
                                                  'value': settings[endpoint], 'result': supplier(tiers, scale)})
        for path, settings in scale['sensitivity_ranges'].items():
            for endpoint in ['lower', 'upper']:
                supplier_sensitivities.append({'scope': 'fixed_scale', 'input': path, 'endpoint': endpoint,
                                              'value': settings[endpoint], 'result': supplier(inputs['supplier_tiers'], changed(scale, path, settings[endpoint]))})
    oss_sensitivities = [{'organizations': item['active_free_runtime_organizations'], 'input': path, 'endpoint': endpoint,
                         'value': settings[endpoint], 'result': oss_cost(changed(item, path, settings[endpoint]))}
                        for item in inputs['oss_adoption_scales'] for path, settings in item['sensitivity_ranges'].items() for endpoint in ['lower', 'upper']]
    readiness_sensitivities = []
    for path, settings in readiness['sensitivity_ranges'].items():
        for endpoint in ['lower', 'upper']:
            x = changed(readiness, path, settings[endpoint])
            readiness_sensitivities.append({'input': path, 'endpoint': endpoint, 'value': settings[endpoint],
                                           'one_time_resource_cost_usd': x['engineering_hours'] * x['engineering_loaded_hourly_usd'] + x['external_assurance_and_setup_usd']})
    delay_sensitivities = []
    for row in customers:
        if row['mode'] != 'migration':
            continue
        for product, value in row['products'].items():
            for months in [1, 3, 6]:
                delay_sensitivities.append({'tier': row['tier'], 'product': product, 'benefit_delay_months': months,
                                           'first_year_net_value_usd': value['first_year_net_value_usd'] - value['annual_usable_capacity_value_usd'] * months / 12,
                                           'assumption': 'Benefit delayed while full modeled annual operations/subscription costs and setup remain charged; no benefit ramp in the base.'})
    paired = []
    for firm in suppliers:
        for public in oss:
            oss_total = public['maintenance_cost_usd'] + public['community_triage_cost_usd']
            paired.append({'paid_accounts': firm['paid_accounts'], 'supplier_mode': firm['mode'],
                           'assumed_independent_free_organizations': public['organizations'],
                           'operating_profit_after_oss_usd': firm['operating_profit_before_oss_usd'] - oss_total,
                           'initial_acquisition_and_readiness_resource_cost_usd': firm['initial_acquisition_onboarding_usd'] + ready_cost,
                           'interpretation': 'Independent assumed pairing; not a conversion rate. Readiness reserve is not a validated implementation estimate.'})
    aggregates = []
    for scale in inputs['supplier_scales']:
        n = scale['paid_accounts']
        for product in ['v15_runtime', 'v16_runtime_total', 'studio_on_existing_runtime']:
            for mode in ['migration', 'new_bounded_module']:
                selected = {row['tier']: row['products'][product] for row in customers if row['mode'] == mode}
                net = sum(n * mix['mix_fraction'] * selected[mix['id']]['annual_recurring_net_value_usd'] for mix in inputs['supplier_tiers'])
                setup = sum(n * mix['mix_fraction'] * (selected[mix['id']]['one_time_adoption_opportunity_cost_usd'] - selected[mix['id']]['one_time_build_capacity_credit_usd']) for mix in inputs['supplier_tiers'])
                aggregates.append({'eligible_adopting_organizations': n, 'product': product, 'mode': mode,
                                   'annual_customer_net_capacity_value_usd': net, 'one_time_customer_net_adoption_cost_usd': setup,
                                   'first_year_customer_net_value_usd': net - setup,
                                   'limits': 'Conditional eligible cohort and fixed tier mix. Subscription transfer included in customer view; not an economy-wide net-resource result. No downstream double counting.'})
    # A payment is a transfer in the joint view. Customer net already deducts it;
    # supplier operating profit adds it and deducts service resources exactly once.
    joint = []
    for firm in suppliers:
        for public in oss:
            oss_total = public['maintenance_cost_usd'] + public['community_triage_cost_usd']
            for product in ['v15_plus_studio', 'v16_plus_studio']:
                selected = {row['tier']: row['products'][product] for row in customers if row['mode'] == 'migration'}
                net = sum(firm['paid_accounts'] * mix['mix_fraction'] * selected[mix['id']]['annual_recurring_net_value_usd'] for mix in inputs['supplier_tiers'])
                adoption = sum(firm['paid_accounts'] * mix['mix_fraction'] * selected[mix['id']]['one_time_adoption_opportunity_cost_usd'] for mix in inputs['supplier_tiers'])
                replacement_adoption = sum(row['replacement_accounts'] * selected[row['tier']]['one_time_adoption_opportunity_cost_usd'] for row in firm['tiers'])
                studio_selected = {row['tier']: row['products']['studio_on_existing_runtime'] for row in customers if row['mode'] == 'migration'}
                replacement_studio_only = sum(row['replacement_accounts'] * studio_selected[row['tier']]['one_time_adoption_opportunity_cost_usd'] for row in firm['tiers'])
                pre_replacement = net + firm['operating_profit_before_oss_usd'] - oss_total
                recurring = pre_replacement - replacement_adoption
                joint.append({'paid_accounts': firm['paid_accounts'], 'product': product, 'supplier_mode': firm['mode'],
                              'additional_free_organizations_cost_only': public['organizations'],
                              'replacement_customer_adoption_assumption': 'All replacement accounts are new adopters of the selected runtime plus Studio; full migration cost, instantaneous replacement and no benefit ramp.',
                              'annual_replacement_customer_adoption_cost_usd': replacement_adoption,
                              'annual_joint_net_resource_value_usd': recurring,
                              'replacement_adoption_sensitivity': {
                                  'already_using_runtime_new_studio_annual_adoption_cost_usd': replacement_studio_only,
                                  'already_using_runtime_new_studio_annual_joint_net_usd': pre_replacement - replacement_studio_only,
                                  'returning_no_adoption_annual_joint_net_usd': pre_replacement},
                              'one_time_customer_adoption_cost_usd': adoption,
                              'initial_supplier_acquisition_onboarding_and_readiness_usd': firm['initial_acquisition_onboarding_usd'] + ready_cost,
                              'first_steady_year_net_after_all_initial_costs_usd': recurring - adoption - firm['initial_acquisition_onboarding_usd'] - ready_cost,
                              'limits': 'Conditional maintained paid cohort, no downstream customer duplication. Subscription transfers cancel; payment processor/acquisition spending retained as resource-cost proxies. Replacement-customer adoption is additional to supplier onboarding, which is a different party\'s labor. Free-only organizations contribute support costs but no assumed benefit here. First steady year is a stress calculation, not a growth/ramp forecast.'})
    public_aggregates = []
    for public in oss:
        n = public['organizations']
        for product in ['v15_runtime', 'v16_runtime_total']:
            selected = {row['tier']: row['products'][product] for row in customers if row['mode'] == 'migration'}
            annual = sum(n * mix['mix_fraction'] * selected[mix['id']]['annual_recurring_net_value_usd'] for mix in inputs['supplier_tiers'])
            setup = sum(n * mix['mix_fraction'] * selected[mix['id']]['one_time_adoption_opportunity_cost_usd'] for mix in inputs['supplier_tiers'])
            maintenance = public['maintenance_cost_usd'] + public['community_triage_cost_usd']
            public_aggregates.append({'eligible_free_organizations': n, 'product': product,
                                      'annual_net_resource_capacity_value_usd': annual - maintenance,
                                      'first_year_net_resource_capacity_value_usd': annual - maintenance - setup,
                                      'annual_runtime_revenue_usd': 0,
                                      'limits': 'Independent original free-runtime cohort, same illustrative tier mix; no churn/replacement growth assumed. Not added to the paid-cohort joint model; includes no incident-prevention value. All would need the assumed relevant recurring work.'})
    return {'currency': 'USD', 'status': 'Conditional scenario arithmetic, not measured savings or forecast',
            'customers': customers, 'one_at_a_time_sensitivities': sensitivities,
            'suppliers': suppliers, 'oss': oss, 'supplier_oss_pairings': paired,
            'supplier_mix_sensitivities': mix_cases,
            'supplier_one_at_a_time_sensitivities': supplier_sensitivities,
            'oss_one_at_a_time_sensitivities': oss_sensitivities,
            'commercial_readiness_sensitivities': readiness_sensitivities,
            'customer_benefit_delay_sensitivities': delay_sensitivities,
            'commercial_readiness_reserve_usd': ready_cost, 'conditional_customer_aggregates': aggregates,
            'conditional_joint_resource_cases': joint, 'conditional_public_runtime_resource_cases': public_aggregates,
            'raw_storage_sensitivity': telemetry(inputs, sources),
            'eligible_market_size': None, 'base_risk_prevention_value': 0,
            'limits': inputs['missing_evidence']}


if __name__ == '__main__':
    source, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
    assert not output.exists(), 'Preserve previous model runs'
    inputs = json.loads(source.read_text())
    sources_path = source.with_name('sources.json')
    sources = json.loads(sources_path.read_text())
    assert inputs['schema_version'] == 1
    result = run(inputs, sources)
    result['provenance'] = {'command': [sys.executable, *sys.argv], 'inputs': str(source),
                            'python': sys.version,
                            'inputsSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                            'sourcesSha256': hashlib.sha256(sources_path.read_bytes()).hexdigest(),
                            'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    output.mkdir(parents=True)
    for name, path in [('generator.py', Path(__file__)), ('inputs.json', source), ('sources.json', sources_path)]:
        (output / name).write_bytes(path.read_bytes())
    (output / 'results.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'output': str(output), 'customerCases': len(result['customers']),
                      'sensitivityCases': len(result['one_at_a_time_sensitivities']),
                      'supplierCases': len(result['suppliers'])}))
