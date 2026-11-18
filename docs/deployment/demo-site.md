# Demo site deployment

The Vercel project connects to `JBorgia/signal-tree`. Its production branch
builds the current public demo at `/`; `vercel.json` serves `dist/apps/demo/browser`.
Use the repository Node version in `.nvmrc` and the pnpm version in `package.json`.

`node scripts/build-demo-site.mjs` builds the current demo and its SPA route
shells, then fetches the public `JBorgia/signaltree` archive at immutable commit
`71fe0224ce2929fbe59def5b3b1d62802ec870de` into a temporary directory. It installs
that revision's frozen development dependencies with lifecycle scripts disabled,
builds it with `/v14/` as its base, and copies its output under `/v14/`.
It checks representative pages and base paths, removes nested Pages metadata,
and removes its temporary checkout on success or failure. No Studio source or
packages participate in this site build.

Vercel first serves existing files, then sends unknown `/v14` paths to the
archive shell and other paths to the current demo shell. Preserve this routing
order so archive deep links never load the current application.

Before transferring `signaltree.io`, verify a Vercel deployment at `/`,
`/why-causality/`, `/v14/`, and `/v14/examples/fundamentals/`, including JavaScript
assets and the current npm/GitHub links. The Pages pipeline in this repository is
**removed as of 2026-09-22**; `.github/workflows/deploy-demo.yml` is deleted and
recoverable from git history. The archive repository `JBorgia/signaltree` still
carries its own superseded Pages workflow and has not been cut over.

Evidence for the cutover, measured before removal: `/`, `/why-causality/`,
`/v14/`, and `/v14/examples/fundamentals/` all returned HTTP 200; JavaScript
assets returned 200 on both the current demo and the `/v14/` archive; and the
two shells stayed distinct (`/v14/` served the v14 title, `/` the current one),
so the routing order above still holds. The Pages workflow itself had never
succeeded — GitHub Pages was never enabled for the repository
(`has_pages=false`), so `actions/configure-pages` failed with `HttpError: Not
Found` on all 30 of its most recent runs while Vercel served the real site.

The hosting build makes one explicit presentation adaptation in that temporary
archive checkout: its banner link says **“Open the current site”** instead of
“Open the current v15 site,” because the host root can also be a v16 preview.
Before replacement, the build verifies the pinned `apps/demo/src/app/app.ts`
SHA-256 (`6e4591a28b394fc8d8121af02752e244833ee4cd9af024347955af4665d3b10a`)
and exactly one matching label. It preserves the historical v15 explanation,
root destination, arrow and all API content, then compiles normally so emitted
asset names reflect the adapted content. The frozen Git revision and archive
repository remain unchanged; hosted output is deliberately **not byte-identical**
to an unadapted archive build. There is no additional client script or observer.

Changing the archive pin is a separate reviewed change; do not replace it with a
moving branch.
