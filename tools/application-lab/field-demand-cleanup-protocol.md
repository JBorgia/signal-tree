# Field-demand cleanup confirmation

Registered November 11, 2026 after the 80-child field-demand diagnostic. That
original cohort remains unchanged. Its final GC executes inside the async phase
frame, where a descriptor/iteration temporary may keep an acquired field alive.
This separate witness returns completely from the async phase before checking
collection. It has no comparative timing or population-memory claim.

Use the same frozen production bundles. On each arm create 1,000 or 10,000 rows
with 32 numeric fields, acquire/read all fields on 200 rows, verify exact values,
and destroy the tree. Keep weak references to the actual tree, a retained row
handle, its f0 carrier, and its current row payload. The async phase returns only
those WeakRefs and counts. End the job before GC; inspect booleans only, never
retain dereferenced objects across a collection. Require all sampled objects to
collect in the released case within 12 GC/event-loop passes (at least three).

Five fresh released children per arm/row count. One planted pin control per arm
at 10,000 rows explicitly holds the actual field carrier after tree destruction:
the field must remain alive while pinned, then all sampled objects must collect
after releasing the pin. This demonstrates that the witness detects a retained
consumer handle. It does not prove bounded growth or absence of every leak.
Absolute heap and weakref observations are reported separately. Do not pool this
confirmation with the original demand-phase heap measurements.

```sh
node tools/application-lab/field-demand-cleanup.mjs compare /absolute/baseline /absolute/ordinary-cohort /fresh/cleanup
```
