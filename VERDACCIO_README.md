Quick guide to using Verdaccio locally for reproducible builds

1. Start Verdaccio in a separate terminal:

```bash
./scripts/run-verdaccio.sh
```

2. In another terminal, set npm registry for scope and login (one-time):

```bash
npm set registry http://localhost:4873
npm adduser --registry http://localhost:4873
```

3. Publish your package(s) for testing:

```bash
cd dist/packages/core
npm publish --registry http://localhost:4873
```

4. In the workspace, install the published dev version:

```bash
pnpm add @signaltree/core@1.1.9 --registry http://localhost:4873
```

5. Build dependents and run the bundle-size report. Use `pnpm remove` to cleanup.

Notes:

- Verdaccio in this repo is configured in `.verdaccio/config.yml`.
- Use CI to run a private registry in production if you prefer.
