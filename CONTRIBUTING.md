# Contributing

## Development Workflow

1. Install dependencies:

   ```bash
   npm install
   ```

2. Scaffold a new scenario:

   ```bash
   npm run new:scenario my-new-flow
   ```

3. Run quality gates before opening a PR:

   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm test
   npm run build
   ```

4. Test locally against the mock API:
   ```bash
   npm run mock
   # In another terminal:
   k6 run -e TARGET_ENV=local -e LOAD_PROFILE=smoke dist/my-new-flow.js
   ```

## Coding Standards

- **No `any`:** Strict TypeScript (`strict: true`) and `@typescript-eslint/no-explicit-any: error`.
- **Endpoint Tags:** Always pass `tags: { endpoint: '<name>' }` to [`ApiClient`](src/libs/client.ts) calls so per-endpoint thresholds and metrics work consistently.
- **Unit Tests:** Pure framework logic in `src/config/` and `src/libs/` should have corresponding Vitest tests in `tests/`.
