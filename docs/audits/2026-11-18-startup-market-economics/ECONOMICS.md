# Economic value of v15, v16 and optional private tooling

This is a conditional business model, not a sales forecast or measured customer
ROI. The strongest candidate market is a software team repeatedly building
interactive operational workflows. A new bounded module has a better economic
case than replacing a working store. The incremental case for v16 requires an
actual need for coordinated pending work; AI branding alone creates no benefit.

The public runtime remains free. The paid scenarios below concern a possible
private investigation/support offer. Hosted multitenancy, production identity,
commercial service levels and complete Studio-v15 qualification are not established
by the existing local proofs. Their delivery cost cannot be ignored.

## Inputs and arithmetic

[Inputs](../../../tools/startup-economics/market-research/scenario-inputs.json),
[source register](../../../tools/startup-economics/market-research/sources.json),
[generator](../../../tools/startup-economics/economics.py),
[bound result summary](ECONOMIC-RESULTS.json) and
[arithmetic controls](../../../tools/startup-economics/economics-controls.py) are
versioned. Each output binds input, source and generator hashes. The completed
study receipt identifies the selected run and preserves earlier attempts.

All amounts are USD, annual unless stated otherwise, undiscounted and before
tax/financing. Three hypothetical accounts have 3/10/30 engineers and 25/200/2,000
application users. They are not sampled industry averages. Engineering time is
valued at an assumed $100/hour; review time at $54/hour. Only 50% of avoided task
time becomes usable capacity. Integration and operations are charged in full.
Payroll cash savings and incident-prevention value are **zero** in the base case.

The rate anchors are the BLS May 2025 developer median of $135,980/year and June
2026 employer-compensation data. Combining wages, an assumed 2,080-hour year and
broad benefits loading is a modeling approximation across different populations,
not a measured developer cost. [Developer pay](https://www.bls.gov/ooh/computer-and-information-technology/software-developers.htm),
[employer compensation](https://www.bls.gov/news.release/ecec.nr0.htm).

Benefits are disjoint: v15 state-maintenance work; additional v16 coordination
work; private-tool investigation; operational review. The model does not credit
replacing existing tracing, backend authorization or durable workflow systems.
Investigation excludes implementation/fix work already in the maintenance bucket.
The counterfactual is a competent team using available free alternatives. If AI
assistance reduces the cost of that alternative, the incremental hours saved by
SignalTree may fall too; the low/zero-benefit sensitivities cover that hypothesis.
More agent activity does not automatically create more buyer value. The benefit
must come from less required work or better controlled outcomes in the actual
workflow, not from charging for code that was never necessary.

Recurring net value is usable capacity value minus incremental operations,
subscription and infrastructure. First-year value also deducts integration,
training and procurement. A separately labeled new-module case reduces assumed
integration to one quarter and credits avoided initial implementation once.
The base first year assumes twelve months of benefit despite charging setup.
Separate one-, three- and six-month benefit-delay sensitivities retain all annual
modeled costs; these are stress cases, not an observed adoption schedule.

## Customer value: migration is a substantial cost

Base assumptions save 4/16/50 engineering task-hours per month with v15, and an
additional 0/4/16 with v16. These are hypotheses to measure, not observed savings.

| Account | Choice | Annual recurring net capacity value | First-year migration net | Migration payback | New-module payback |
| --- | --- | ---: | ---: | ---: | ---: |
| Small | v15 | $1,200 | −$3,800 | 50 months | 18 months |
| Small | v16 increment over v15 | −$600 | −$1,600 | None | None |
| Mid | v15 | $6,000 | −$14,000 | 40 months | 14.4 months |
| Mid | v16 increment over v15 | $1,200 | −$3,600 | 48 months | 16 months |
| Enterprise | v15 | $18,000 | −$58,000 | 50.7 months | 18 months |
| Enterprise | v16 increment over v15 | $4,800 | −$13,600 | 46 months | 14.5 months |

V16 totals add the two relevant rows; its incremental row must not be mistaken
for the whole application's cost or benefit. The small account has no assumed
coordination need and still pays adoption/maintenance cost: v16 is a poor fit.
All three base v15 migrations remain negative after three years. The modeled
new-module cases become positive over that horizon. A free license is insufficient
reason to migrate an established application.

For a first-year break-even target in the mid account, v15 needs another 23.33
engineering task-hours saved per month beyond the assumed 16—39.33 in total,
at the unchanged 50% realization factor and adoption/operation costs. The v16
increment needs another six beyond the assumed four—ten in total. These are
testable thresholds for a pilot, not claimed productivity gains. Lower integration
cost or a longer acceptable payback horizon changes the decision.

At the assumed 50,000/1 million/20 million annual actions, v15 recurring net value
equals 2.4/0.60/0.09 cents per action. The additional v16 value is −1.2/0.12/0.024
cents per action. These divide organizational engineering capacity by action
volume; they are neither per-action invoices nor measured transaction savings.

## Potential paid tooling: value ceilings, not willingness to pay

The private-tool cases assume 2/12/50 investigation hours and 1/8/40 review hours
avoided each month, before the 50% realization factor. Existing monitoring bills
remain. Illustrative account prices are $29/$199/$1,499 monthly, with no extra
seat charge.

| Account | Assumed monthly price | Annual recurring net value | First-year net | Three-year net | Three-year zero-net monthly price ceiling |
| --- | ---: | ---: | ---: | ---: | ---: |
| Small | $29 | $414 | −$986 | −$158 | $24.61 |
| Mid | $199 | $4,956 | −$1,044 | $8,868 | $445.33 |
| Enterprise | $1,499 | $15,180 | −$12,820 | $17,540 | $1,986.22 |

These figures concern tooling on an existing runtime. Adding runtime migration
requires adding that cost separately. A ceiling leaves the customer no net
surplus at its stated horizon; it is not a recommended selling price. Even the
small $29 hypothesis fails a three-year migration case. At first-year break-even,
the monthly ceilings are negative $53.17, positive $112 and positive $430.67.
Integration help or a new-module entry point can therefore matter more than
reducing a modest subscription.

Current public anchors span Langfuse $29/$199 account plans, LangSmith Plus
$39/seat and Sentry Team $29/month, all with differing included usage and scope.
They establish price context, not equivalent products or SignalTree demand.
[Langfuse](https://langfuse.com/pricing), [LangSmith](https://www.langchain.com/pricing),
[Sentry](https://sentry.io/pricing/).

The model retains zero-value, low-realization and expensive-legacy-migration cases
and one-at-a-time sensitivities. Zero incremental benefit produces negative value
at every size. An illustrative nonlabor risk branch yields $125/$2,500/$30,000
annually, but assumes incident frequency, attribution and prevention rates that
have not been measured. It is excluded from every base table and supplier claim.

## Supplier economics: scale alone does not guarantee a business

The base mix is 80% small, 18% mid and 2% enterprise accounts. Variable costs
include hosting, support, replacement onboarding, payment processing and customer
acquisition needed to replace churn. Fixed staffing includes paid founder labor;
variable support and acquisition are not counted again in fixed payroll.

| Maintained paid accounts | ARR | Operating profit before public maintenance | After a separate 10,000-free-organization maintenance scenario | Initial acquisition/onboarding, separate |
| --- | ---: | ---: | ---: | ---: |
| 100 | $106,800 | −$370,492 | −$557,992 | $90,000 |
| 1,000 | $1,068,000 | −$704,920 | −$892,420 | $900,000 |
| 10,000 | $10,680,000 | $1,550,800 | $1,363,300 | $9,000,000 |

The free-user axis is an independent assumption, not a paid-conversion estimate.
An additional $425,000 one-time commercial-readiness reserve is shown separately;
it is a planning allowance, not an implementation estimate. These steady-state
figures omit a growth ramp, financing and taxes. The initial acquisition figure
cannot be compared directly with one year's recurring profit as if growth were
instantaneous or free.
Labor valued as capacity is a resource cost and need not be a new cash payment.
The model therefore does not establish a required cash-funding amount.

At five times the support hours, three times hosting cost and twice acquisition
cost, all three supplier scales lose money; the 10,000-account case loses about
$9.27 million before public maintenance. Its variable support/onboarding burden
is about 56.6 full-time equivalents, separate from fixed product staff. This
makes retention limits, efficient delivery and customer fit business necessities.
Alternative mid/enterprise account mixes are sensitivities, not evidence that
those customers are available or can be served at the assumed cost.

Concentration matters as much as account count. Keeping the same two-person fixed
staffing assumption at 100 paid accounts gives these alternatives before public
maintenance and initial acquisition/readiness:

| Hypothetical 100-account mix | ARR | Base operating profit | Heavy-support operating profit |
| --- | ---: | ---: | ---: |
| All mid | $238,800 | −$304,864 | −$550,864 |
| Half mid, half enterprise | $1,018,800 | $227,786 | −$555,214 |
| All enterprise | $1,798,800 | $760,436 | −$559,564 |

A focused high-value offer could therefore be viable at far lower volume than a
mostly low-price offer **if** buyers receive the assumed value and delivery stays
within the modeled burden. The adverse cases reverse that conclusion. Enterprise
prices cannot be justified solely by industry profitability or hypothetical risk.

Free-runtime adoption creates no license revenue. The 1,000/10,000/100,000 free
organization cases cost $90,750/$187,500/$435,000 annually for assumed maintenance
and community triage. Joint resource calculations cancel subscription transfers,
deduct supplier costs once and avoid counting the same vendor engineering benefit
again at all of its downstream customers. Maintaining paid accounts also charges
replacement customers' adoption costs: the base joint model assumes new runtime
and Studio adopters; sensitivities cover an already-installed runtime and returning
customers with no new adoption. Customer integration and supplier onboarding are
different parties' labor. The separate free-runtime model must
not be added to an overlapping paid cohort.

## Industries and buyers

| Priority | Buyer and application | v15 fit | Additional v16 fit | Commercial constraint |
| --- | --- | --- | --- | --- |
| 1 | Vertical B2B software vendor: dispatch, orders, service exceptions | Reusable entity/state work across modules | Overlapping proposals and approvals | Prove marginal labor savings beyond existing tools; count vendor benefit once. |
| 2 | Fintech/insurance operations engineering: reconciliation, claims, payment exceptions | Interactive state and entity identity | Pending coordinated edits while authoritative services settle | Procurement, privacy and backend correctness can dominate integration cost. |
| 3 | Logistics/field-service software vendor or large internal team | Long-lived operational consoles | Concurrent dispatch/assignment changes and delayed responses | Thin-margin operators need a specific labor case; small carriers are not necessarily buyers. |
| 4 | Manufacturing/wholesale/commerce platform team | New bounded UI modules | Multi-record exception/approval workflows | Replacing mature ERP state wholesale is a weak entry strategy. |
| 5 | Healthcare IT administrative software vendor | Bounded administrative work | Coordinated scheduling/billing review | No clinical claim; data and deployment requirements may make present fit unacceptable. |

January 2026 US listed-company analysis reports net margins of 25.49% for system
and application software, 12.37% for general insurance, 10.58% for machinery,
7.45% for healthcare IT and 3.79% for trucking. Money-center banks report 28.89%,
but banking accounting differs. These are sector context, not customer budgets,
absolute profit rankings or evidence of willingness to pay.
[Published sector analysis](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/margin.html).

NgRx, native framework state and TanStack remain credible free alternatives.
TanStack's current documentation includes optimistic, persistent and offline
workflows; feature names alone do not establish equivalent contracts. Model and
application tracing, OpenTelemetry, Temporal and Inngest address other parts of
the stack. SignalTree does not replace their full responsibilities.
[TanStack DB](https://tanstack.com/db/latest/docs/overview),
[OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/),
[Temporal](https://temporal.io/pricing), [Inngest](https://www.inngest.com/pricing).

## Full-application cost and what would establish value

The [completed application comparison](APPLICATION-COMPARISON.md) measures
complete production Angular bundles, startup, useful work and heap across
500/10,000/50,000 resident rows. At 50,000 rows, selected v15 uses 26.946 MB of
populated app heap versus NgRx's 21.105 MB and the native implementation's
48.626 MB; selected v16 uses 31.338 MB. The implementation and demanded behavior
matter more than a blanket ranking of “library versus native.” At that size,
factory medians are 40.8 ms for v15 and 638.7 ms for v16; the v16 successor improves
its paired factory time by 201.6 ms but still has a meaningful absolute cost.

The 50,000-row checked command throughput is 210.8/s for v15, 216.0/s for v16,
224.3/s for native, 89.6/s for NgRx and 211.5/s for TanStack in this particular
application. These are complete checked asynchronous workflows, not isolated
library operations. NgRx's much shorter optimistic UI interval excludes later
authoritative responses; separate 128-response settlement takes 1,310.1 ms versus
roughly 229–230 ms for those other implementations. The closed-loop arrival
schedule does not establish general real-user responsiveness or INP.

Client heap is
not a cloud-memory bill. A few saved milliseconds are not automatically recovered
payroll, and a large application's total size does not excuse a blocked UI thread.
Any delay valuation needs an explicit blocking fraction, frequency and recovery
factor; the base money model assigns it zero until those facts are known.

Raw evidence storage is also separate. At one million 2 KB events per month and
30-day retention, uncompressed data is about 2 decimal GB. The linear R2 anchor
is $0.03/month storage; one write per event adds $4.50, versus $0.0045 with
1,000 events per object, before provider rounding and allowances. Compute,
indexing, backup, access control and labor remain absent from this illustration.
It is not an actual hosting bill or proposed persistence design.
[R2 rates](https://developers.cloudflare.com/r2/pricing/).

The defensible next commercial proof is a bounded real workflow with recorded
baseline maintenance, investigation and review hours; unchanged business outcomes;
measured integration/operating cost; and a buyer willing to pay for the marginal
benefit. No eligible market count or total addressable market is inferred from
AI spending, developer populations or downloads. Widespread use makes economic
sense only for the deployments whose measured benefit exceeds their complete
cost, with a funded maintenance path.
