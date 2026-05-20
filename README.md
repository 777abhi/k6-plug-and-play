# k6 TypeScript Framework

This repository is a reusable, pluggable k6 performance testing framework built with TypeScript. It is based on the `grafana/k6-template-typescript` structure and configured to use ES modules.

## Current Features

Currently, the framework contains the following features:
*   **TypeScript Support:** Fully configured with TypeScript for strong typing and explicit avoidance of the `any` type.
*   **ES Modules:** Configured to use ES modules (`"type": "module"`) with `NodeNext` module resolution.
*   **API Client (`src/libs/client.ts`):** A wrapper around the `k6/http` module that provides strongly-typed methods for making `GET`, `POST`, `PUT`, and `DELETE` requests. It handles payload serialization, response parsing, and standard headers.
*   **Environment Configuration (`src/config/env.ts`):** Supports multiple environments (e.g., `dev`, `staging`) with environment-specific base URLs and standard headers. It uses `__ENV.TARGET_ENV` to determine the active environment.
*   **Sample Scenario (`src/scenarios/baseline.ts`):** A baseline k6 script demonstrating how to use the API client, configure options (stages, thresholds), and validate responses with checks.

## Incremental Next Features

The following features should be incrementally built for this utility to enhance its capabilities:

1.  **Authentication & Authorization Helpers:** Implement utilities for handling common auth flows, such as fetching and caching JWT tokens, or supporting OAuth login flows.
2.  **Shared Metrics Collection:** Add support for reusable custom metrics (Counters, Trends, Gauges, Rates) to track business-specific metrics across different scenarios.
3.  **Advanced Threshold Configurations:** Expand the threshold definitions to be configurable per service or endpoint, potentially reading from centralized configs.
4.  **CI/CD Integration:** Provide example configurations or scripts for integrating the tests into CI/CD pipelines (e.g., GitHub Actions, GitLab CI).
5.  **Data Generation & Parameterized Data:** Introduce helpers for generating synthetic test data and utilities for loading parameterized test data from external files like CSVs.
6.  **Reporting:** Integrate tools or configurations for generating visual HTML reports from k6 results.
7.  **Dynamic Scenarios:** Add the ability to dynamically compose k6 scenarios based on environment or configuration instead of hardcoding them in the test scripts.
