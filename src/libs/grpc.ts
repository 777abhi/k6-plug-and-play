import grpc, { ConnectParams, Params, Response } from 'k6/net/grpc';
import { AuthProvider, NoAuthProvider } from './auth.js';

export interface GrpcClientOptions {
  authProvider?: AuthProvider;
  logErrors?: boolean;
}

export class GrpcClient {
  private readonly client: grpc.Client;
  private readonly authProvider: AuthProvider;
  private readonly logErrors: boolean;

  constructor(options: GrpcClientOptions = {}) {
    this.client = new grpc.Client();
    this.authProvider = options.authProvider ?? new NoAuthProvider();
    this.logErrors = options.logErrors ?? true;
  }

  public load(importPaths: string[], ...protoFiles: string[]): void {
    this.client.load(importPaths, ...protoFiles);
  }

  public connect(address: string, params?: ConnectParams): void {
    this.client.connect(address, params);
  }

  public invoke<TReq extends object, TRes extends object>(
    method: string,
    request: TReq,
    params?: Params
  ): { response: Response; data: TRes } {
    const authMetadata = this.authProvider.getHeaders();
    const mergedParams: Params = {
      ...params,
      metadata: {
        ...authMetadata,
        ...params?.metadata,
      },
    };

    const response = this.client.invoke(method, request, mergedParams);

    if (this.logErrors && response.status !== grpc.StatusOK) {
      console.error(
        JSON.stringify({
          level: 'error',
          type: 'grpc_error',
          method,
          status: response.status,
          error: response.error,
        })
      );
    }

    return {
      response,
      data: response.message as TRes,
    };
  }

  public close(): void {
    this.client.close();
  }
}
