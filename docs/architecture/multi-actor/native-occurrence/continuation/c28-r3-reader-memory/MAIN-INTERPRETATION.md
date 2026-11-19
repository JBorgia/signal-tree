# Main raw-outcome check

Four valid invocations produced 120 boundary samples: one baseline/reader pair at 128 and at 512 rows. Each executes the same two logical tests, not eight unique contracts. Main independently read RESULT/STATUS and numeric rows; MAIN-VALID-BOUNDARIES.csv preserves every valid boundary in order.

The fifth invocation (baseline 2048) was terminated by the no-progress180s watchdog before any reporter event or memory sample. No assertion failure, measured heap-limit breach or OOM was recorded. The reader2048 run and both512 repeats were not executed. C0 administrative cancellation is separately preserved and produced no samples.

At128 the final-drain observed heap is58.68MiB baseline versus59.45MiB reader. At512 it is73.18MiB versus60.94MiB. These are single boundary observations; starting heaps differ and some operation deltas are negative due to GC. No confidence interval, retained-memory/peak/allocated-byte inference, timing ranking or OOM-resolution claim follows. Missing repeats and larger-size comparison prevent accepting general memory superiority or equivalence.

The bounded semantic/facade-avoidance evidence remains valid independently. The incomplete campaign is a measurement qualification limitation, not a falsifier of the reader's semantic implementation. No further sample or favorable retry was added.
