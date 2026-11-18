"""Independent arithmetic identities and adverse cases for the scenario model."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('economics', HERE / 'economics.py')
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)


def main():
    inputs_path, output = map(Path, sys.argv[1:])
    assert not output.exists(), 'Preserve previous controls'
    inputs = json.loads(inputs_path.read_text())
    sources = json.loads(inputs_path.with_name('sources.json').read_text())
    checks = []

    def check(name, condition):
        assert condition, name
        checks.append(name)

    small = model.customer(inputs['customer_tiers'][0])
    v15 = small['products']['v15_runtime']
    check('hand-calculated small v15: annual 1200, first year -3800, payback 50 months',
          v15['annual_recurring_net_value_usd'] == 1200 and v15['first_year_net_value_usd'] == -3800 and v15['payback_months'] == 50)
    increment = small['products']['v16_increment_over_v15']
    check('unneeded v16 costs remain negative with no payback', increment['annual_recurring_net_value_usd'] == -600 and increment['first_year_net_value_usd'] == -1600 and increment['payback_months'] is None)
    studio = small['products']['studio_on_existing_runtime']
    check('hand-calculated Studio capacity, operations and price', studio['annual_usable_capacity_value_usd'] == 1524 and studio['annual_operations_opportunity_cost_usd'] == 762 and studio['annual_recurring_net_value_usd'] == 414)
    no_value = model.customer(inputs['customer_tiers'][0], 'no_additional_value')
    check('no benefit cannot produce positive economics', all(x['annual_recurring_net_value_usd'] < 0 and x['first_year_net_value_usd'] < 0 for x in no_value['products'].values()))
    greenfield = model.customer(inputs['customer_tiers'][0], 'new_bounded_module')['products']['v15_runtime']
    check('new module discounts only integration and credits avoided build once', greenfield['one_time_adoption_opportunity_cost_usd'] == 2000 and greenfield['one_time_build_capacity_credit_usd'] == 200 and greenfield['first_year_net_value_usd'] == -600)
    zero = copy.deepcopy(inputs['customer_tiers'][0])
    zero['capacity_realization_fraction'] = 0
    zero_result = model.customer(zero)['products']['v15_runtime']
    check('zero realized capacity retains full setup and operations', zero_result['annual_recurring_net_value_usd'] == -1200 and zero_result['one_time_adoption_opportunity_cost_usd'] == 5000)
    result = model.run(inputs, sources)
    check('risk and payroll cash release excluded from base', result['base_risk_prevention_value'] == 0 and all(p['cash_payroll_savings_usd'] == 0 for c in result['customers'] for p in c['products'].values()))
    increased = copy.deepcopy(inputs)
    # Remove payment fees to isolate the subscription transfer, not a payment-service cost.
    for t in inputs['supplier_tiers']:
        t['payment_processing_fraction'] = 0
    for t in increased['supplier_tiers']:
        t['payment_processing_fraction'] = 0
        t['price_usd_per_account_month'] += 10
    for t in increased['customer_tiers']:
        t['private_studio']['price_usd_per_account_month'] += 10
    a, b = model.run(inputs, sources), model.run(increased, sources)
    check('subscription transfers cancel in joint resource calculation', all(abs(x['annual_joint_net_resource_value_usd'] - y['annual_joint_net_resource_value_usd']) < 1e-7 for x, y in zip(a['conditional_joint_resource_cases'], b['conditional_joint_resource_cases'], strict=True)))
    check('higher price is a customer cost and supplier revenue', b['customers'][0]['products']['studio_on_existing_runtime']['annual_recurring_net_value_usd'] == a['customers'][0]['products']['studio_on_existing_runtime']['annual_recurring_net_value_usd'] - 120 and abs(b['suppliers'][0]['arr_usd'] - a['suppliers'][0]['arr_usd'] - 12000) < 1e-7)
    check('support-heavy cases decrease profit', all(result['suppliers'][i+1]['operating_profit_before_oss_usd'] < result['suppliers'][i]['operating_profit_before_oss_usd'] for i in range(0, 6, 2)))
    joint = next(x for x in result['conditional_joint_resource_cases'] if x['paid_accounts'] == 100 and x['product'] == 'v15_plus_studio' and x['supplier_mode'] == 'base')
    check('replacement buyers adoption charged apart from supplier onboarding', abs(joint['annual_replacement_customer_adoption_cost_usd'] - 214840) < 1e-8 and abs(joint['replacement_adoption_sensitivity']['already_using_runtime_new_studio_annual_adoption_cost_usd'] - 48680) < 1e-8)
    one = next(x for x in result['raw_storage_sensitivity']['cases'] if x['events_per_month'] == 1000000 and x['bytes_per_event'] == 2000 and x['retention_days'] == 30 and x['events_per_object'] == 1)
    batched = next(x for x in result['raw_storage_sensitivity']['cases'] if x['events_per_month'] == 1000000 and x['bytes_per_event'] == 2000 and x['retention_days'] == 30 and x['events_per_object'] == 1000)
    check('raw storage bytes and batching are independent', one['steady_retained_decimal_gb'] == batched['steady_retained_decimal_gb'] == 2 and one['linear_storage_usd_per_month'] == .03 and abs(one['linear_write_usd_per_month'] / batched['linear_write_usd_per_month'] - 1000) < 1e-8)
    check('cents per action uses annual actions', v15['annual_net_cents_per_action'] == 2.4)
    payload = {'checks': checks, 'passed': len(checks), 'inputsSha256': hashlib.sha256(inputs_path.read_bytes()).hexdigest(), 'generatorSha256': hashlib.sha256((HERE / 'economics.py').read_bytes()).hexdigest(), 'controlSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + '\n')
    print(json.dumps({'passed': len(checks), 'output': str(output)}))


if __name__ == '__main__':
    main()
