import { RefinedResponse, ResponseType } from 'k6/http';
import { ApiClient, RequestOptions } from './client.js';

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
}

export interface GraphQLPayload<TVars> {
  query: string;
  variables?: TVars;
  operationName?: string;
}

export interface GraphQLResponseBody<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

export interface GraphQLResult<TData> {
  response: RefinedResponse<ResponseType>;
  data: TData | null;
  errors: GraphQLError[];
}

export class GraphQLClient {
  private readonly apiClient: ApiClient;
  private readonly endpointPath: string;

  constructor(apiClient: ApiClient, endpointPath = '/graphql') {
    this.apiClient = apiClient;
    this.endpointPath = endpointPath;
  }

  public execute<TData, TVars = Record<string, unknown>>(
    operation: string,
    variables?: TVars,
    operationName?: string,
    options?: RequestOptions
  ): GraphQLResult<TData> {
    const payload: GraphQLPayload<TVars> = {
      query: operation,
      ...(variables !== undefined ? { variables } : {}),
      ...(operationName ? { operationName } : {}),
    };

    const tags = {
      ...(operationName ? { endpoint: `gql_${operationName}` } : {}),
      ...options?.tags,
    };

    const res = this.apiClient.post<GraphQLPayload<TVars>, GraphQLResponseBody<TData>>(
      this.endpointPath,
      payload,
      { ...options, tags }
    );

    const errors = res.data?.errors ?? [];
    if (errors.length > 0) {
      console.error(
        JSON.stringify({
          level: 'error',
          type: 'graphql_error',
          operationName: operationName ?? 'anonymous',
          errors,
        })
      );
    }

    return {
      response: res.response,
      data: res.data?.data ?? null,
      errors,
    };
  }

  public query<TData, TVars = Record<string, unknown>>(
    query: string,
    variables?: TVars,
    operationName?: string,
    options?: RequestOptions
  ): GraphQLResult<TData> {
    return this.execute<TData, TVars>(query, variables, operationName, options);
  }

  public mutate<TData, TVars = Record<string, unknown>>(
    mutation: string,
    variables?: TVars,
    operationName?: string,
    options?: RequestOptions
  ): GraphQLResult<TData> {
    return this.execute<TData, TVars>(mutation, variables, operationName, options);
  }
}
