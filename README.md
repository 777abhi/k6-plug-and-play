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

## Local Sandbox & Observability (Mock API + Prometheus + Grafana)

Start the full local sandbox (mock API on `:3000`, Prometheus on `:9090`, Grafana on `:3001` with a pre-built k6 dashboard):

```bash
npm run build
docker compose up -d mock-api prometheus grafana
docker compose --profile run up k6
```

Or run just the zero-dependency mock API locally:

```bash
npm run mock
# In another terminal:
k6 run -e TARGET_ENV=local -e LOAD_PROFILE=smoke dist/baseline.js
```

## Prometheus / Grafana Remote Write

To stream metrics to Prometheus / Grafana Cloud:

```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run -o experimental-prometheus-rw dist/baseline.js
```

## Adding a New Scenario

1. Scaffold a blank scenario or generate one from an OpenAPI 3.x spec:
   ```bash
   npm run new:scenario my-service
   # or from OpenAPI:
   npm run new:from-openapi data/sample-openapi.json my-openapi-suite
   ```
2. For GraphQL APIs, wrap `ApiClient` with [`GraphQLClient`](src/libs/graphql.ts):
   ```ts
   const gql = new GraphQLClient(apiClient);
   const res = gql.query<MyData>('query GetItems { items { id } }', undefined, 'GetItems');
   ```
3. Run `npm run build` — `scripts/build.mjs` automatically bundles every `.ts` file in `src/scenarios/` into `dist/`.

## Distributed Execution on Kubernetes (`k6-operator`)

Create a `ConfigMap` from the built bundle and apply [k8s/testrun.yaml](k8s/testrun.yaml):

```bash
npm run build
kubectl create configmap k6-scenarios --from-file=dist/baseline.js
kubectl apply -f k8s/testrun.yaml
```

## Module & Script Reference

| Module                                           | Purpose                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/config/env.ts` & `config/environments.json` | Environment config + JSON & `__ENV` overrides                                 |
| `src/config/profiles.ts`                         | `smoke`/`load`/`stress`/`soak`, arrival-rate & multi-scenario composers       |
| `src/libs/auth.ts`                               | `none`, `bearer`, `apikey`, `oauth2` client credentials with caching          |
| `src/libs/client.ts`                             | Typed REST client with retries, correlation IDs, circuit breaker & error logs |
| `src/libs/graphql.ts`                            | Typed `GraphQLClient` (`query`, `mutate`)                                     |
| `src/libs/grpc.ts`                               | `GrpcClient` with proto loading & auth metadata                               |
| `src/libs/websocket.ts`                          | `WebSocketClient` with auth headers & lifecycle handlers                      |
| `src/libs/browser.ts`                            | `openAndMeasure` for `k6/experimental/browser`                                |
| `src/libs/circuit-breaker.ts`                    | Fail-fast `CLOSED`/`OPEN`/`HALF_OPEN` resilience guard                        |
| `src/libs/pacing.ts`                             | `randomSleep` jitter & `paceIteration`                                        |
| `src/libs/assertions.ts`                         | Composable `assertResponse` contract checks                                   |
| `src/libs/data.ts`                               | `SharedArray` CSV/JSON loaders & `DataGenerator`                              |
| `src/libs/metrics.ts` & `src/libs/reporting.ts`  | Custom metrics + `stdout`, HTML, JSON, and JUnit XML reports                  |

| Script                                        | Purpose                                           |
| --------------------------------------------- | ------------------------------------------------- |
| `npm run build`                               | Bundle `src/scenarios/*.ts` into `dist/*.js`      |
| `npm run typecheck` / `lint` / `format:check` | Static quality gates                              |
| `npm test`                                    | Run Vitest unit test suite                        |
| `npm run mock`                                | Start local mock API server on `:3000`            |
| `npm run new:scenario <name>`                 | Scaffold a new scenario in `src/scenarios/`       |
| `npm run new:from-openapi <spec> <name>`      | Generate a scenario from an OpenAPI 3.x JSON spec |
| `npm run compare:baseline <base> <curr>`      | Regression gate comparing `summary.json` files    |
