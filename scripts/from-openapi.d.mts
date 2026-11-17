export interface GeneratedScenarioResult {
  content: string;
  operationCount: number;
}

export declare function generateScenarioFromOpenApi(
  spec: Record<string, unknown>,
  scenarioName: string
): GeneratedScenarioResult;
