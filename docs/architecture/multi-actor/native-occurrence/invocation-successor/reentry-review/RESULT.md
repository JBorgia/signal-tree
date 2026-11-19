# Invocation review remains failed

Independent review replayed the author controls, then produced a getter-reentry
failure (two additional controls pass, one fails). The reviewer service subsequently
terminated with an error before returning a final verdict. This is not independent
acceptance or a completed review report.

Main reproduced the same failure after removing all private write-context reads
from its trigger: the first armed getter read calls a nested `updateOne`. Private
source evidence and an intrinsic observer are still used to observe the boundary.
Do not describe this as a fully black-box endpoint test.

The nested write receives the inverse baseline certificate before the intended
setter claims it. A separate diagnostic replay records `nestedBaseline: true`,
`finalBaseline: false`, and unknown final responsibility with destination records.
The exact-invocation isolation claim is unmet. No outgoing endpoint leak or general
public exploit is established by this fixture; external behavior needs separate
qualification. Original author controls and first failures remain preserved.

Commands run through Nx in the independent review replica, Node 24.15.0/pnpm
10.17.0, NX_DAEMON=false NX_ISOLATE_PLUGINS=false:

```sh
corepack pnpm nx test kernel --skip-nx-cache main-invocation-scope.spec.ts
corepack pnpm nx test kernel --skip-nx-cache main-invocation-trace.spec.ts
```

Both exit 1 with two passing controls and the preserved reentry failure. Runtime
is frozen. No structural integration, production activation or release followed.
