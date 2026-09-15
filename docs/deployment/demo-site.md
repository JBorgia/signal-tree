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
assets and the current npm/GitHub links. After the Vercel production domain
works, disable `.github/workflows/deploy-demo.yml` in both repositories to stop
the superseded Pages pipelines. Until that cutover is verified, retain the
existing Pages deployment. Changing the archive pin is a separate reviewed
change; do not replace it with a moving branch.
