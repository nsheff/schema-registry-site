export interface CheckResult {
  name: string;
  passed: boolean;
  duration_ms: number;
  description?: string;
  message?: string;
  error?: string;
  recommended?: boolean;
}

export interface Check {
  name: string;
  description: string;
  recommended: boolean;
  run: () => Promise<void>;
}

export type SSEEvent =
  | { type: 'start'; total: number; server_url: string }
  | { type: 'result'; name: string; passed: boolean; duration_ms: number; description?: string; error?: string; recommended?: boolean }
  | { type: 'done'; total: number; passed: number; failed: number; required_passed: number; required_failed: number; recommended_passed: number; recommended_failed: number }
  | { type: 'error'; message: string };

export interface NamespaceRecord {
  server: string;
  namespace_name: string;
  contact_url: string;
}

export interface SchemaRecord {
  namespace: string;
  schema_name: string;
  latest_released_version: string;
  maintainers: string[];
  maturity_level: string;
}

export interface VersionRecord {
  schema_name: string;
  version: string;
  status: string;
  contributors: string[];
  tags: Record<string, string>;
}

export interface PagedResponse<T> {
  results: T[];
  pagination: {
    page: number;
    page_size: number;
    total?: number;
  };
}
