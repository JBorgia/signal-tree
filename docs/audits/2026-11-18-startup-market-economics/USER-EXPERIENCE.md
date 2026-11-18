# What an application user would notice

This is interpretation of the [identified application comparison](APPLICATION-COMPARISON.md)
and [native guarantee checks](VERIFICATION.md), recorded November 18, 2026.
No physical-phone study, human perception study or AI-assisted adoption experiment
was performed. The [findings register](FINDINGS-AND-HYPOTHESES.md) records those
questions and tests under H01–H08.

## A small administration screen

A user opens a customer, changes an address and saves. With a few hundred loaded
records, competent implementations using native Angular signals, NgRx, v15 or
v16 may feel similar. Our 500-row factories were 4.2 ms for v15 and 13.8 ms for
v16, but that is one part of opening a page. Rendering, network work, layout and
other application code still matter. We have not shown that people can or cannot
perceive the difference. Adding a stronger state contract brings little visible
benefit if the workflow never needs it.

## A dispatcher working while updates arrive

A dispatcher changes an order from Standard to Rush. The server then reports it
Shipped. The dispatcher undoes their priority change: Standard returns while
Shipped remains. The useful experience is that undo does not erase somebody
else's update. V15 supplies state/identity/causal foundations for building this
behavior; the exercised preview demonstrates the recipe. Other libraries can
also implement it. The economic question is how much application machinery and
testing each competent implementation needs, not exclusive ownership of an Undo
button. Correctness becomes visible precisely when concurrent work would
otherwise surprise the user.

## A user reviewing an agent proposal

An agent proposes changes while a user edits related information. The application
can distinguish what is proposed, current, superseded, awaiting approval or in
need of recovery. In the checked v16 refusal case, pending work stays pending and
dependent consequences stay withheld. The application can show an honest recovery
state rather than announce success. V15's checked refusal contract does not
provide that same containment. That difference matters when the application
actually connects the relevant owned state and presents the result clearly.

Neither version automatically supplies that review interface. The application
must map business rules to state/owners; backend authority must authenticate,
authorize and durably reconcile external effects. V16 is a stronger coordination
foundation, not a substitute for those responsibilities or proof that an AI's
proposal is correct. More explicit states help oversight only if people can
understand and act on them; that human benefit is still a hypothesis.

## A large cold store versus an all-day session

At 50,000 resident rows, v15 factory time was 40.8 ms and v16 638.7 ms on the test
host. If that work blocks the main thread before a useful screen can paint, a
user could see a longer loading state or delayed input. V16's prior 840.3 ms was
reduced by about 0.2 seconds, but a large remaining gap exists. Rendering only 40
rows does not avoid constructing 50,000 records already loaded into the store.
Loading only necessary data can change the experience; ownership and semantics
must remain correct when changing that design.

During a long session, one startup charge may become less important. In the
common application, selected v15 and v16 handled roughly 211 and 216 checked
commands per second at this size. Those synthetic throughput numbers are not a
prediction of perceived smoothness. Full native v16 work also has adverse CPU
cases, so we cannot promise that stronger guarantees eventually pay for
themselves through speed. Their primary return is required behavior and reduced
application coordination work, if demonstrated for the product.

## Mobile and desktop

Desktop measurements do not establish phone performance. A device with less CPU
or memory headroom may expose construction, download or garbage-collection costs
earlier. A high-end phone and an inexpensive phone need not behave alike. The
measured whole-app heap difference of about 4.4 MB between v15 and v16 at 50,000
rows is neither total browser RAM nor evidence of a battery, crash or tab-reload
threshold. Actual field inventories may also be much smaller than office boards.

The next useful device evidence would use real supported Android/iOS tiers and
representative data, cold and warm navigation, first useful paint, interaction
latency, long tasks, GC and prolonged sessions. Our enqueue-to-layout metric is
not [Interaction to Next Paint](https://web.dev/articles/inp); browser paint and
independent user arrivals must be measured before claiming a responsiveness win.

## Choosing for a new Angular application

These are fit judgments, not a universal benchmark ranking:

| Application need | Starting choice | Reason |
| --- | --- | --- |
| Local UI state and simple forms | Native Angular signals | Small primitive set; build only the behavior required. |
| Conventional shared CRUD state with familiar Angular store conventions | NgRx SignalStore | Composable state, computed values, methods and entity features. |
| Entity-heavy editing with stable identity and meaningful authored/external changes, undo or coordination | SignalTree v15 | Its semantics may replace otherwise bespoke application code. Measure the actual workflow and adoption cost. |
| Overlapping user/agent work requiring v16's native pending/publication/refusal behavior | SignalTree v16 | Choose it because those guarantees are requirements, then budget startup, history and backend integration. |
| Query-heavy client collections and optimistic server-data reconciliation | TanStack DB | Evaluate its live relational query and synchronization model against the data architecture. |

For a new complex Angular operations product, v15 is a credible first candidate.
For a simple app, native signals or NgRx are easier to justify. V16 merits the
extra cost when the specified coordination behavior is central. A working
application should not migrate solely because a benchmark column is favorable.
The selected SignalTree improvements are review-branch candidates, not a claim
of new npm publication. Current competitor releases also need fresh evaluation;
the comparison pinned NgRx 22.0.1 and TanStack DB 0.15.2/Angular DB 0.2.12.

Primary feature references: [Angular](https://angular.dev/guide/signals),
[NgRx](https://ngrx.io/guide/signals/signal-store),
[TanStack](https://tanstack.com/db/latest/docs/overview).

## AI-assisted adoption with excellent guidance

Good guidance can make correct APIs discoverable: pin the installed release,
provide small compiling examples, use one framework facade, show native leaf
writes, define store lifetime/teardown and include replacement and overlap cases.
An agent should run the examples and tests against installed types. Avoid mixing
v14 package names with v15/v16 semantics or treating a browser operation as a
durably authorized backend effect. Existing [AI guidance](../../../llms.txt) is
version-sensitive and includes behavior limits; it is not evidence of measured
agent adoption success.

My expectation is that this makes ordinary v15 adoption fairly approachable for
an Angular-capable agent. V16's API use can also be taught, but deciding which
changes depend on which pending work, who can approve, what refusal means and
how to recover remains domain engineering. Optimal text cannot supply missing
business policy. [Angular's own guidance](https://angular.dev/ai/develop-with-ai)
supports keeping instructions current; it does not establish a SignalTree
success rate or a guarantee that agents stop inventing APIs.

A fair adoption evaluation would give every library equally good instructions
and the same agent/model budget. Score correctly completed workflows, hidden
concurrency/recovery/teardown tests, repair rounds, token/cost usage and human
review burden. A first successful compile or impressive generated demo is not
enough. Until then, adoption ease is an informed expectation rather than a
measured advantage over popular alternatives.
