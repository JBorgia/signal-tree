"""Summarize complete-app costs and explicitly hypothetical capacity envelopes.

Usage: application-cost.py COMPLETED_RUN SCENARIO_INPUTS NEW_OUTPUT
No library-only heap, real-user INP, hardware budget or cash saving is inferred.
"""
import hashlib
import json
from pathlib import Path
import sys
import math
from admission import completed_application


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def transfer_ms(byte_count, mbps):
    return byte_count * 8 / (mbps * 1e6) * 1000


def delay_hours(milliseconds, sessions, blocking, recoverable):
    return max(0, milliseconds) * sessions * blocking * recoverable / 3_600_000


def checked_delay_pairs(summary, inputs):
    wanted = [('v15', 'ngrx'), ('v16', 'v15')]
    required = {(rows, numerator, denominator) for rows in [500, 10000, 50000]
                for numerator, denominator in wanted}
    pairs = [p for p in summary['pairs'] if p['kind'] == 'timing'
             and (p['numerator'], p['denominator']) in wanted]
    actual = [(p['rows'], p['numerator'], p['denominator']) for p in pairs]
    assert len(actual) == len(required) and set(actual) == required
    assert len(inputs['customer_tiers']) == 3
    assert len({tier['id'] for tier in inputs['customer_tiers']}) == 3
    for tier in inputs['customer_tiers']:
        assert math.isfinite(tier['annual_sessions']) and tier['annual_sessions'] > 0
        assert math.isfinite(tier['loaded_reviewer_hourly_usd']) and tier['loaded_reviewer_hourly_usd'] >= 0
    for pair in pairs:
        metric = pair['metrics']['startup.factory']
        assert metric['unit'] == 'ms'
        value = metric['difference']
        assert value['n'] == 5 and value['missing'] == 0
        assert all(math.isfinite(value[key]) for key in ['median', 'min', 'max'])
    return pairs


def main():
    run, assumptions, output = map(lambda s: Path(s).resolve(), sys.argv[1:])
    assert not output.exists(), 'Preserve previous summaries'
    read = lambda p: json.loads(Path(p).read_text())
    summary_path = run / 'analysis/summary.json'
    summary = read(summary_path)
    admitted = completed_application(run)
    build_path = run / 'packet/dispatch-build.json'
    build, inputs = read(build_path), read(assumptions)
    assert sha(build_path) == summary['source']['buildSha256']
    assert summary['source']['buildPath'] == str(build_path)
    for path, digest in summary['bindings'].items():
        assert sha(path) == digest
    assert transfer_ms(500000, 8) == 500
    assert delay_hours(3600, 1000, 1, 1) == 1
    assert delay_hours(-1, 100000, 1, 1) == 0
    assert delay_hours(1000, 10000, 0, 1) == 0
    arms = ['native', 'ngrx', 'v15', 'v16', 'tanstack', 'tanstack-variant']
    names = {'native': 'Native Angular implementation', 'ngrx': 'NgRx Signals', 'v15': 'Selected v15', 'v16': 'Selected v16', 'tanstack': 'TanStack DB', 'tanstack-variant': 'TanStack application variant', 'v15-before': 'Current v15 baseline', 'v16-before': 'Current v16 baseline'}
    groups = {(g['arm'], g['rows'], g['kind']): g['metrics'] for g in summary['groups']}
    def m(arm, rows, kind, metric):
        item = groups[(arm, rows, kind)][metric]
        assert item['n'] == 5 and item['missing'] == 0
        return item['median']
    app = []
    for rows in [500, 10000, 50000]:
        for arm in arms:
            app.append({'rows': rows, 'arm': arm,
                        'factory_ms': m(arm, rows, 'timing', 'startup.factory'),
                        'navigation_to_layout_ms': m(arm, rows, 'timing', 'startup.navigationToLayout'),
                        'populated_absolute_heap_bytes': m(arm, rows, 'memory', 'heap.populated'),
                        'populated_above_blank_bytes': m(arm, rows, 'memory', 'heap.populatedAboveBlank'),
                        'pending128_above_populated_bytes': m(arm, rows, 'memory', 'heap.pending128AbovePopulated'),
                        'settled128_absolute_heap_bytes': m(arm, rows, 'memory', 'heap.settled-128'),
                        'settled128_above_populated_bytes': m(arm, rows, 'memory', 'heap.settled128AbovePopulated'),
                        'destroyed_above_blank_bytes': m(arm, rows, 'memory', 'heap.destroyedAboveBlank'),
                        'full_context_repeated_p95_ms': m(arm, rows, 'timing', 'context.full.repeated.p95.totalMs'),
                        'enqueue_to_layout_p95_ms': m(arm, rows, 'timing', 'interleaved.user.p95.enqueueToLayoutMs'),
                        'settlement128_elapsed_ms': m(arm, rows, 'timing', 'pressure.128.settled.elapsed'),
                        'settlement128_per_response_p95_ms': m(arm, rows, 'timing', 'pressure.128.settled.p95'),
                        'complete180_elapsed_ms': m(arm, rows, 'timing', 'interleaved.complete.elapsed'),
                        'checked_commands_per_second': m(arm, rows, 'timing', 'interleaved.checkedCommandsPerSecond')})
    envelopes = [{'rows': row['rows'], 'arm': row['arm'], 'illustrative_app_heap_allocation_decimal_mb': mb,
                  'populated_heap_fraction': row['populated_absolute_heap_bytes'] / (mb * 1e6)}
                 for row in app for mb in [32, 128, 512]]
    transfer = [{'arm': arm, 'hypothetical_connection_mbps': mbps, 'gzip_transfer_floor_ms': transfer_ms(build['arms'][arm]['jsGzipBytes'], mbps)}
                for arm in arms for mbps in [1, 10, 100]]
    delay = []
    for pair in checked_delay_pairs(summary, inputs):
        metric = pair['metrics']['startup.factory']
        difference_summary = metric['difference']
        difference = difference_summary['median']
        for tier in inputs['customer_tiers']:
            for blocking, recovery in [(0, 0), (.25, .25), (1, 1)]:
                hours = delay_hours(difference, tier['annual_sessions'], blocking, recovery)
                delay.append({'rows': pair['rows'], 'numerator': pair['numerator'], 'denominator': pair['denominator'],
                              'paired_factory_delta_ms': difference, 'hypothetical_account_tier': tier['id'],
                              'annual_sessions': tier['annual_sessions'], 'store_constructions_per_session': 1,
                              'blocking_fraction': blocking, 'recoverable_fraction': recovery,
                              'annual_recoverable_delay_hours': hours,
                              'conditional_capacity_penalty_usd': hours * tier['loaded_reviewer_hourly_usd']})
    result = {'application_rows': app, 'hypothetical_heap_envelopes': envelopes, 'hypothetical_transfer_floors': transfer,
              'hypothetical_blocking_delay_values': delay,
              'base_delay_or_heap_money_value_usd': 0,
              'provenance': {str(p): sha(p) for p in [summary_path, build_path, assumptions, run / 'driver-results.json', Path(__file__), Path(__file__).with_name('admission.py')]},
              'completedApplicationAdmission': {'identities': admitted['identities'], 'counts': admitted['counts'], 'verifiedBindings': len(admitted['bindings'])},
              'limits': ['Workload row counts are not representative industry populations.',
                         'Optimistic UI latency ends before authoritative responses. New synthetic human input waits for prior-round settlement; this closed-loop schedule does not measure independently arriving input during response work, paint or INP.',
                         'Settlement-128 includes serial processing, stabilization and individual decision checks, and excludes subsequent aggregate assertions and dismissal. Complete-180 includes checks, logs, dismissal and yields; neither isolates library CPU.',
                         'Heap is whole-app live JavaScript after forced GC, not library-exclusive, peak RAM or a cloud bill.',
                         '32/128/512 MB allocations and 1/10/100 Mbps connections are illustrations, not measured application/device budgets.',
                         'Transfer floor assumes gzip payload only, no latency/cache/parse/other assets; not a measured load prediction.',
                         'Delay scenarios cross every account session-volume assumption with every workload; no tier mapping is implied.',
                         'One store construction/session, one blocked user, and the stated recovery fractions are assumptions. Delta floors at zero for penalty only; no negative penalty is promoted to savings.',
                         'Default monetization is zero. No measured business benefit or cost recovery is inferred from browser timings.']}
    lines = ['# Complete-application startup and live cost', '',
             'Fresh current-to-successor production Angular cohort: five main samples per arm, workload and measurement kind, plus separate A/A controls for both release lines. CPU-facing browser measurements and forced-GC heap use separate fresh browser processes. These workload sizes do not represent sampled industries or device classes.', '',
             '## Delivered application JavaScript', '',
             '| Implementation | Raw JS bytes | Gzip bytes | Gzip difference from native |', '| --- | ---: | ---: | ---: |']
    for arm in ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant']:
        x = build['arms'][arm]
        lines.append(f"| {names[arm]} | {x['jsBytes']:,} | {x['jsGzipBytes']:,} | {x['jsGzipBytes'] - build['arms']['native']['jsGzipBytes']:+,} |")
    lines += ['', 'These are actual complete emitted application JavaScript files, not padded enterprise bundles or isolated package minima. Maps are excluded. Transfer floors in the machine-readable report are illustrative and omit request latency, caching, parse/execute time and non-JavaScript assets.', '']
    for rows in [500, 10000, 50000]:
        lines += [f'## {rows:,} resident rows', '', '| Implementation | Factory ms | Navigation-to-layout ms | Absolute app heap MB | Heap above blank MB | Additional pending-128 MB |', '| --- | ---: | ---: | ---: | ---: | ---: |']
        for x in [x for x in app if x['rows'] == rows]:
            lines.append(f"| {names[x['arm']]} | {x['factory_ms']:.1f} | {x['navigation_to_layout_ms']:.1f} | {x['populated_absolute_heap_bytes']/1e6:.3f} | {x['populated_above_blank_bytes']/1e6:.3f} | {x['pending128_above_populated_bytes']/1e6:.3f} |")
        lines += ['', '| Implementation | Full context repeated p95 ms | Optimistic user enqueue-to-layout p95 ms | Settle 128 responses ms | Complete 180 commands ms | Checked commands/s |', '| --- | ---: | ---: | ---: | ---: | ---: |']
        for x in [x for x in app if x['rows'] == rows]:
            lines.append(f"| {names[x['arm']]} | {x['full_context_repeated_p95_ms']:.2f} | {x['enqueue_to_layout_p95_ms']:.2f} | {x['settlement128_elapsed_ms']:.1f} | {x['complete180_elapsed_ms']:.1f} | {x['checked_commands_per_second']:.1f} |")
        lines.append('')
    lines += ['## Matched changes and observed A/A variation', '',
              '| Rows | Candidate vs its current baseline | Factory paired median [min, max] ms | Same-candidate A/A range ms | Populated heap paired median bytes |', '| ---: | --- | ---: | ---: | ---: |']
    for rows in [500, 10000, 50000]:
        for arm in ['v15', 'v16']:
            t = next(p for p in summary['pairs'] if p['rows'] == rows and p['kind'] == 'timing' and p['numerator'] == arm and p['denominator'] == arm + '-before')['metrics']['startup.factory']['difference']
            h = next(p for p in summary['pairs'] if p['rows'] == rows and p['kind'] == 'memory' and p['numerator'] == arm and p['denominator'] == arm + '-before')['metrics']['heap.populated']['difference']
            aa = next(p for p in summary['sameArm'] if p['rows'] == rows and p['kind'] == 'timing' and p['arm'] == arm)['metrics']['startup.factory']['difference']
            lines.append(f"| {rows:,} | {arm} | {t['median']:+.2f} [{t['min']:+.2f}, {t['max']:+.2f}] | [{aa['min']:+.2f}, {aa['max']:+.2f}] | {h['median']:+,.0f} |")
    lines += ['', '| Rows | Line | Settle-128 paired median [range] ms | Absolute settled-128 heap difference B | Settled-minus-populated increment difference B | Destroyed-minus-blank difference B |', '| ---: | --- | ---: | ---: | ---: | ---: |']
    for rows in [500, 10000, 50000]:
        for arm in ['v15', 'v16']:
            pairs = {kind: next(p for p in summary['pairs'] if p['rows'] == rows and p['kind'] == kind and p['numerator'] == arm and p['denominator'] == arm + '-before')['metrics'] for kind in ['timing', 'memory']}
            t = pairs['timing']['pressure.128.settled.elapsed']['difference']
            h = [pairs['memory'][metric]['difference']['median'] for metric in ['heap.settled-128', 'heap.settled128AbovePopulated', 'heap.destroyedAboveBlank']]
            lines.append(f"| {rows:,} | {arm} | {t['median']:+.2f} [{t['min']:+.2f}, {t['max']:+.2f}] | {h[0]:+,.0f} | {h[1]:+,.0f} | {h[2]:+,.0f} |")
    lines += ['', 'The v16 settled-minus-populated increment grows by roughly 42–46 KB even while its absolute settled heap is lower than its current baseline. At 10,000 rows its 128-response elapsed time increases in all five pairs. These adverse observations remain; startup/allocation improvements do not establish a general active-work win. Destroyed-minus-blank is signed whole-process residual heap, not proof of retained trees or universally zero residual cost.', '',
              'A/A comprises two pairs per line/workload/kind and is descriptive, not a confidence interval or proof of equivalence. Small rankings require their paired variation and host load to be considered. No sample is dropped.', '',
              '## Interpretation limits', '',
              'Heap includes Angular, application, selected library and in-memory service state. Pending growth includes retained receipts/logs. Full-context demand follows UI and selected-context reads; it is not an untouched-store first read. Per-child p95s are summarized across children, never pooled. The 180-command throughput includes asynchronous validation and service work. Synthetic enqueue timing is not real-user INP. Nested intervals and browser-duration categories must not be added.', '',
              'Optimistic UI latency samples one synthetic human action at each round\'s start; authoritative responses follow after that sample. Next-round human arrival waits for settlement, so latency is schedule-dependent and does not estimate independently arriving input during response work. Settlement and complete checked throughput expose that omitted cost; neither layout completion nor rAF gaps measure INP or paint. Settlement-128 includes serial processing, stabilization and individual decision checks, stopping before subsequent aggregate assertions and dismissal. Complete-180 also includes checks, logs, dismissal and yields.', '',
              'At 50,000 rows, NgRx\'s small optimistic UI interval coexists with slower complete-command throughput and response settlement. The inspected implementation patches a small operation list for optimistic registration but calls NgRx updateEntity for authoritative receipts; that implementation copies the entity map and ID array. This is a source-supported explanation for a scaling cost, not a CPU-profile attribution of its exact share. Timer/frame alignment also affects the narrow UI interval; the recordings do not establish its exact causal contribution or a missed-frame catastrophe.', '',
              'The common application outcome checks do not reproduce every v16 native guarantee in peer libraries. Native ownership/publication, retirement, reentry and the point-work bound require the separate runtime and installed-application evidence. Construction may be one-time for a long-lived store, but this experiment does not establish a universal later-performance crossover.', '',
              'The accompanying capacity envelopes and delay-money scenarios are explicit assumptions, not new release gates. The base economics assigns no cash value to browser heap or fractional-second delays.', '']
    output.mkdir(parents=True)
    (output / 'results.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    (output / 'COMPARISON.md').write_text('\n'.join(lines))
    print(json.dumps({'output': str(output), 'applicationRows': len(app), 'delayScenarios': len(delay)}))


if __name__ == '__main__':
    main()
