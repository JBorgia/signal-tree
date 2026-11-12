# Field-demand allocation checkpoints

Registered November 11, 2026, before execution. Reuse the exact selective
production bundles from the completed ordinary long-lived cohort. This is a
whole-process forced-GC checkpoint experiment, not timing or a byte-per-feature
allocation attribution. No runtime source changes or optional configuration.

Four arms (native, NgRx, released v15, qualified v16), 1,000/10,000 rows,
8/32 numeric fields plus ID, 200 held rows. Five serial fresh children per profile
with rotating arm order. The producer modules are imported before measurement.
Checkpoints: populated without a whole-collection read; acquired row handles
without calling them; read those rows; acquire f0 without calling it; read f0;
acquire remaining numeric fields; read every acquired field; destroy and drop all
fixture references. Three event-loop-separated GC passes at each checkpoint.

SignalTree row acquisition installs enumerable configurable field getters for
its creation-time keyset. Count those descriptors without invoking getters,
and verify enumeration/descriptor attributes is preserved by field acquisition.
Repeated acquisition of the same SignalTree field must return the same carrier.
All row/field reads must match generated values. A planted wrong expected value
must fail, establishing that reads are actually verified.

Native holds its existing per-row Angular signal. NgRx holds an application-owned
ID/token context and reads its SignalStore entity map; the custom token retires
on replacement. Their field views are Angular computed readers plus application
write closures as in the long-lived consumer. They are not NgRx deep-signal
property access, and they are not equivalent to all SignalTree field semantics.
The comparison diagnoses these specific consumer representations. A field carries
one reference per acquired location; f0 is reused in the all-fields phase rather
than allocating duplicate consumer wrappers. No operation schedules are retained.

Inputs/oracle data, imported code, heap bookkeeping and fixture arrays are part of
absolute memory. Checkpoint differences are signed within-process observations;
GC/JIT and array bookkeeping prevent assigning every byte to a specific feature.
Do not derive a universal per-field price or leak claim. Descriptor counts and
source inspection identify the structures; heap checkpoints quantify transitions.

Commands:

```sh
node tools/application-lab/field-demand.mjs control /absolute/baseline /absolute/ordinary-cohort /fresh/control
node tools/application-lab/field-demand.mjs compare /absolute/baseline /absolute/ordinary-cohort /fresh/cohort
node tools/application-lab/field-demand-analyze.mjs /absolute/cohort /fresh/summary.json
```
