# L19 profile diff — BASE vs NO-BOTH vs TX-FULL

Control is NO-BOTH (both notifier registrations removed), per review.

    function            BASE    NO-BOTH   TX-FULL   NB-BASE
    coalesceEntry       0.0ms    13.9ms     7.5ms    +13.9ms
    read2               0.0ms    12.3ms     2.5ms    +12.3ms
    notify              0.0ms     7.6ms    67.2ms     +7.6ms
    enqueuePending      0.0ms     6.8ms     4.5ms     +6.8ms
    mergeOrigin         0.0ms     3.0ms     0.0ms     +3.0ms
    TOTAL                93ms      140ms     189ms

600k writes, `--cpu-prof`, self time.

## BASE records ZERO samples in this machinery

notify, coalesceEntry, enqueuePending and read2 do not appear at all without the
enhancer. None of it runs on the ordinary write path.

## Two mechanisms, both now identified

    EMISSION     every write notifies and coalesces, and must read `prev` to do
                 so. SURVIVES removing both registrations -- roughly 31ms across
                 notify/coalesceEntry/enqueuePending/mergeOrigin in NO-BOTH.
                 `read2` at +12.3ms is the same fact from the other side: a
                 notification needs the previous value, so the write path reads
                 before writing.

    OBSERVATION  a registered enqueue observer makes notify itself far more
                 expensive: 67.2ms in TX-FULL against 7.6ms in NO-BOTH.

So installing transactions() puts every ordinary write on a
notify-and-coalesce path whether or not anything observes it.

## What this means for the L19 repair

Lazy REGISTRATION alone is not sufficient. With no observer registered, emission
still costs. A dormant tree must not EMIT, which is a larger change than
deferring a subscription.

The correctness gate stands either way: notification must be active BEFORE the
first write that creates causal responsibility, and remain active until every
pending transaction and consequence has resolved. A lazily enabled path that
misses the write which opened the responsibility loses causal evidence silently.

## Estimate discipline

The +105% remainder is THIS RUN'S estimate, not a stable allocation of "half".
Two arms in that run showed 27-38% relative IQR. What the arms support is
ordinal only:

    TX-FULL  >  NO-ENQUEUE-OBS  ~  NO-BOTH  >  BASE
