# TRANSACTION-SEMANTICS-2 — mutation testing the TESTS

The most important quality step, and the gate before any production code.

A green suite proves nothing about the suite. 2359 kernel tests pass today
while both R6 and R8 ship. If a mutation below survives, we do not have proofs
— we have a hole, and the suite is strengthened before implementation starts.

Each mutation implements deliberately-wrong semantics in the candidate under
test. Every one must turn at least one test RED.

    M01  rollback = write the captured baseline
    M02  retire the turn before settlement succeeds                 <- R6
    M03  ignore a newer pending owner of the same location          <- R8/A
    M04  confirmation gives the contribution a NEW sequence         <- L6
    M05  key identity = String(key)                                 <- identity
    M06  SubjectId = business key                                   <- L7
    M07  allow partial settlement of a mixed transaction            <- L9
    M08  drop ambient context when a mutation is queued             <- coalesce
    M09  resurrect the predecessor after a newer rejection          <- R8/E
    M10  remove the dependency edge on a structural add             <- L8

M04 exists because the SEMANTICS-1 draft missed Law 6 entirely: a model can
satisfy all eight earlier laws and still let `accept P2; accept P1` end at
P1's value. M04 is the mutation that would have caught that on paper.

M03 is the specific check that a passing suite is not merely a two-writer
suite: it should be killed by S04/S12 (three writers), not only by S05.
