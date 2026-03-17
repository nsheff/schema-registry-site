export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.BASE_URL + 'api');

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PagedResponse<T> {
  pagination: Pagination;
  results: T[];
}

export interface Namespace {
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

export interface SchemaVersion {
  schema_name: string;
  version: string;
  status: string;
  release_date: string;
  contributors: string[];
  release_notes: string;
  tags: Record<string, string>;
}

export interface ComponentRecord {
  component_name: string;
  schema_id: string;
  description: string;
}

export function getNamespaces() {
  return fetchJSON<PagedResponse<Namespace>>('namespaces/');
}

export function getSchemas(ns: string) {
  return fetchJSON<PagedResponse<SchemaRecord>>(`schemas/${ns}/`);
}

export function getVersions(ns: string, schema: string) {
  return fetchJSON<PagedResponse<SchemaVersion>>(`schemas/${ns}/${schema}/versions/`);
}

export function getSchema(ns: string, schema: string, version: string) {
  return fetchJSON<Record<string, unknown>>(`schemas/${ns}/${schema}/versions/${version}/`);
}

export function getComponents(ns: string, schema: string, version: string) {
  return fetchJSON<PagedResponse<ComponentRecord>>(`schemas/${ns}/${schema}/versions/${version}/components/`);
}

export function getComponent(ns: string, schema: string, version: string, component: string) {
  return fetchJSON<Record<string, unknown>>(`schemas/${ns}/${schema}/versions/${version}/components/${component}/`);
}
