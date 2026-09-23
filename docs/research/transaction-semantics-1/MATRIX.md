# TRANSACTION-SEMANTICS-1 — conformance matrix

Preregistered case list. Expected states are recorded per case in the contract
module before it is run. Cases map to the laws in LAWS.md.

## Scalar ownership

    S1  clean rollback, no competing writer                     L1 L2
    S2  later unrelated field write                             L2 L3
    S3  later same-field CONFIRMED write                        L2 L3
    S4  later same-field PENDING write                          L2 L3
    S5  three overlapping pending writers                       L2 L3 L5
    S6  reject the MIDDLE writer                                L2 L3 L4
    S7  reject the OLDEST writer                                L3      <- R8/A
    S8  reject the NEWEST writer                                L2
    S9  confirm/reject permutations over two writers            L4 L5   <- R8/A..H

## Structural lifetime

    L1c add -> rollback                                         L1 L7
    L2c add -> later field edit                                 L2 L7
    L3c add -> later remove                                     L2
    L4c remove -> same-key NEW lifetime                         L6      <- R6
    L5c rekey -> later field edit                               L6
    L6c rekey -> later remove                                   L6
    L7c rekey -> remove -> same-key replacement                 L6
    L8c multiple pending structural writers                     L3 L6

## Settlement failure

    F1  compensation validation fails                           L1 L7 L8
    F2  structural destination occupied                         L1 L7   <- R6
    F3  subject no longer exists                                L1 L6
    F4  later PENDING dependency                                L1 L3
    F5  later CONFIRMED dependency                              L1

For every F case:

    state unchanged
    pending authority retained
    no confirmed record created
    retry semantics explicit and stated

## Cross-system composition

Isolated transaction tests were demonstrably insufficient, so each of the
above runs under:

    transactions
    transactions + link
    transactions + batching
    transactions + restoration
    transactions + entityMap
    transactions + link + batching
    transactions + entityMap + link

## Identity hostility

Every keyed case is additionally run with these business keys. The
implementation may not flatten identity ambiguously anywhere:

    "jo.doe@example.com"
    "1.2.3"
    "a/b"
    "KEY::foo"
    1
    "1"

The last pair is deliberate: numeric `1` and string `"1"` are different keys
and must not collide.
