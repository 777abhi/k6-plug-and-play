# k6 Plug-and-Play TypeScript Framework

An enterprise-ready, plug-and-play [k6](https://k6.io/) performance testing template built with TypeScript, `esbuild`, strict linting, unit tests, and GitHub Actions CI/CD.

## Features

- **TypeScript + esbuild Bundling:** Strict TypeScript (`no explicit any`) compiled into k6-ready ESM bundles under `dist/`.
- **Environment Configuration (`src/config/env.ts`):** Preconfigured `local`, `dev`, `staging`, and `prod` targets with `__ENV` overrides (`TARGET_ENV`, `BASE_URL`, `REQUEST_TIMEOUT`) and URL validation.
- **Load Profiles & Dynamic Thresholds (`src/config/profiles.ts`):** Built-in `smoke`, `load`, `stress`, and `soak` profiles plus per-endpoint tag threshold builders (`buildEndpointThresholds`).
- **Pluggable Authentication (`src/libs/auth.ts`):** Out-of-the-box support for `none`, `bearer`, `apikey`, and `oauth2` (Client Credentials with expiry-aware token caching).
- **Hardened API Client (`src/libs/client.ts`):** Typed `get`, `post`, `put`, `patch`, and `del` methods with automatic auth header injection, `X-Request-ID` correlation IDs, custom metrics recording, and structured error logging.
- **Parameterized & Synthetic Data (`src/libs/data.ts`):** `SharedArray`-backed CSV/JSON loaders and `DataGenerator` helpers.
- **Observability & Reporting (`src/libs/metrics.ts`, `src/libs/reporting.ts`):** Shared custom metrics (`business_errors`, `api_duration`, `api_success_rate`, `active_iterations`) and `createSummaryHandler()` generating HTML, JSON, and JUnit XML reports in `reports/`.
- **Containerized Execution (`Dockerfile`):** Zero-setup k6 execution via `grafana/k6`.
- **CI/CD Ready (`.github/workflows/`):** PR quality gates (`ci.yml`) and manual/scheduled k6 execution with report artifact uploads (`perf-test.yml`).

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Copy environment template (optional for local runs):**

   ```bash
   cp .env.example .env
   ```

3. **Run quality checks & unit tests:**

   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

4. **Build k6 bundles:**

   ```bash
   npm run build
   ```

5. **Run a scenario with k6:**
   ```bash
   # Smoke test against dev
   k6 run -e TARGET_ENV=dev -e LOAD_PROFILE=smoke dist/baseline.js

   # Override base URL and use Bearer auth
   k6 run -e BASE_URL=https://api.example.com -e AUTH_TYPE=bearer -e AUTH_TOKEN=my-jwt dist/baseline.js
   ```

## Docker Execution

```bash
npm run build
docker build -t k6-perf .
docker run --rm -e TARGET_ENV=dev -e LOAD_PROFILE=smoke -v "$(pwd)/reports:/app/reports" k6-perf
```

## Prometheus / Grafana Remote Write

To stream metrics to Prometheus / Grafana Cloud:

```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run -o experimental-prometheus-rw dist/baseline.js
```

## Adding a New Scenario

1. Create `src/scenarios/my-service.ts`.
2. Export `options` via `buildOptions(...)`, instantiate `ApiClient`, and export `handleSummary = createSummaryHandler(...)`.
3. Run `npm run build` — `scripts/build.mjs` automatically bundles every `.ts` file in `src/scenarios/` into `dist/`.
