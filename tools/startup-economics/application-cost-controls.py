"""Missing-data and unit controls for the hypothetical delay-value calculation."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
from admission import sha

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('application_cost', here / 'application-cost.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
out = Path(sys.argv[1]).resolve(); assert not out.exists(); out.mkdir(parents=True)
summary = {'pairs': [
    {'rows': rows, 'kind': 'timing', 'numerator': numerator, 'denominator': denominator,
     'metrics': {'startup.factory': {'unit': 'ms', 'difference': {'n': 5, 'missing': 0, 'median': 2, 'min': 1, 'max': 3}}}}
    for rows in [500, 10000, 50000] for numerator, denominator in [('v15', 'ngrx'), ('v16', 'v15')]]}
inputs = {'customer_tiers': [{'id': str(n), 'annual_sessions': 1000, 'loaded_reviewer_hourly_usd': 54} for n in range(3)]}
assert len(module.checked_delay_pairs(summary, inputs)) == 6
cases = [
    ('missing pair', lambda s, i: s['pairs'].pop()),
    ('duplicate pair', lambda s, i: s['pairs'].append(copy.deepcopy(s['pairs'][0]))),
    ('wrong units', lambda s, i: s['pairs'][0]['metrics']['startup.factory'].update(unit='seconds')),
    ('missing sample', lambda s, i: s['pairs'][0]['metrics']['startup.factory']['difference'].update(n=4, missing=1)),
    ('nonfinite median', lambda s, i: s['pairs'][0]['metrics']['startup.factory']['difference'].update(median=float('nan'))),
    ('empty tiers', lambda s, i: i.update(customer_tiers=[])),
    ('duplicate tiers', lambda s, i: i['customer_tiers'][0].update(id='1')),
    ('invalid sessions', lambda s, i: i['customer_tiers'][0].update(annual_sessions=0)),
]
checks = []
for name, mutate in cases:
    s, i = copy.deepcopy(summary), copy.deepcopy(inputs); mutate(s, i)
    try:
        module.checked_delay_pairs(s, i)
    except AssertionError:
        checks.append({'name': name, 'rejected': True})
    else:
        raise AssertionError('Accepted: ' + name)
assert module.transfer_ms(500000, 8) == 500
assert module.delay_hours(3600, 1000, 1, 1) == 1
assert module.delay_hours(-100, 1000, 1, 1) == 0
assert module.delay_hours(100, 1000, 0, 1) == 0
(out / 'results.json').write_text(json.dumps({
    'passed': True, 'syntheticPositivePairs': 6, 'negative': checks, 'arithmeticChecks': 4,
    'bindings': {str(p): sha(p) for p in [Path(__file__), here / 'application-cost.py', here / 'admission.py']},
    'limits': 'Synthetic data/unit admission and arithmetic, not observed performance or business value.'}, indent=2) + '\n')
print(json.dumps({'passed': True, 'negative': len(checks), 'arithmetic': 4}))
