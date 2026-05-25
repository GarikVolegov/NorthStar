export type FeatureAuth = "public" | "authenticated" | "admin";
export type FeatureOwner = "web" | "server" | "ai" | "full-stack";
export type FeatureStatus = "legacy" | "pilot" | "protocol";
export type FeatureHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type WendyToolPolicy = "read" | "navigate" | "write" | "delete";
export type WendyToolRisk = "low" | "medium" | "high";

export interface FeatureWebRoute {
  path: string;
  auth: FeatureAuth;
  title: string;
  smoke?: boolean;
}

export interface FeatureApiRoute {
  method: FeatureHttpMethod;
  path: string;
  auth: FeatureAuth;
  schema?: string;
  smoke?: boolean;
}

export interface FeatureWendyTool {
  name: string;
  description: string;
  policy: WendyToolPolicy;
  risk: WendyToolRisk;
  requiresConfirmation: boolean;
  inputSchema: string;
  outputSchema: string;
  telemetry: string;
}

export interface FeatureManifest {
  id: string;
  name: string;
  owner: FeatureOwner;
  status: FeatureStatus;
  webRoutes: FeatureWebRoute[];
  apiRoutes: FeatureApiRoute[];
  wendyTools: FeatureWendyTool[];
  telemetry: string[];
  smoke: string[];
  migrations: string[];
  tests: string[];
}

export interface FeatureValidationResult {
  ok: boolean;
  errors: string[];
}

export interface RegisteredWendyTool extends FeatureWendyTool {
  featureId: string;
  featureName: string;
}

export interface FeatureProtocolCoverage {
  total: number;
  protocol: number;
  pilot: number;
  legacy: number;
  protocolRatio: number;
  wendyToolCount: number;
}
