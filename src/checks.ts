/**
 * GA4GH Schema Registry Compliance Checks (TypeScript port)
 *
 * CHECK INVENTORY (keep in sync with schema-registry/compliance/compliance.py):
 * - checkServiceInfo
 * - checkListNamespacesStructure
 * - checkNamespaceRecordFields
 * - checkPaginationDefaults
 * - checkListSchemasStructure
 * - checkSchemaRecordFields
 * - checkListVersionsStructure
 * - checkSchemaVersionFields
 * - checkGetSchemaDocument
 * - checkLatestAlias
 * - checkFilterSchemaName
 * - checkFilterMaintainer
 * - checkFilterMaturityLevel
 * - checkFilterUnknownReturnsEmpty
 * - checkUnknownNamespace404
 * - checkUnknownSchema404
 * - checkUnknownVersion404
 * - checkListedNamespacesResolvable
 * - checkListedSchemasResolvable
 * - checkListedVersionsResolvable
 * - checkLatestMatchesListed
 * - checkSchemaDocumentIdConsistency
 * - checkCorsHeaders
 * - checkOpenapiAvailable
 * - checkContentType
 */

import type { NamespaceRecord, SchemaRecord, VersionRecord, PagedResponse } from './types';

const COMPLIANCE_TIMEOUT = 5000;

interface CachedResponse {
  status: number;
  body: string;
  headers: Headers;
}

let fetchCache = new Map<string, Promise<CachedResponse>>();

export function resetFetchCache(): void {
  fetchCache = new Map();
}

// Append trailing slash for directory-style paths so static hosts that index
// JSON via /index.json (e.g. GitHub Pages) don't 301-redirect and double the
// subrequest count.
function normalize(url: string): string {
  const u = new URL(url);
  if (!u.pathname.endsWith('/') && !/\.(json|yaml|yml|xml|html|txt)$/i.test(u.pathname)) {
    u.pathname += '/';
  }
  return u.toString();
}

async function cachedFetch(url: string): Promise<CachedResponse> {
  url = normalize(url);
  const cached = fetchCache.get(url);
  if (cached) return cached;

  const pending = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMPLIANCE_TIMEOUT);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const body = await res.text();
      return { status: res.status, body, headers: res.headers };
    } finally {
      clearTimeout(timeoutId);
    }
  })();
  fetchCache.set(url, pending);
  return pending;
}

export async function cachedFetchJson<T>(url: string): Promise<{ status: number; data: T; headers: Headers }> {
  const res = await cachedFetch(url);
  return { status: res.status, data: JSON.parse(res.body) as T, headers: res.headers };
}

const fetchJson = cachedFetchJson;

async function fetchRaw(url: string): Promise<{ status: number; headers: Headers }> {
  const res = await cachedFetch(url);
  return { status: res.status, headers: res.headers };
}

export async function checkServiceInfo(apiRoot: string): Promise<void> {
  const { status, data } = await fetchJson<Record<string, unknown>>(
    `${apiRoot}/service-info`
  );
  if (status !== 200) throw new Error(`service-info returned HTTP ${status}`);
  for (const field of ['id', 'name', 'type', 'organization', 'version']) {
    if (!(field in data)) throw new Error(`service-info missing '${field}' field`);
  }
}

export async function checkListNamespacesStructure(apiRoot: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<NamespaceRecord>>(
    `${apiRoot}/namespaces`
  );
  if (status !== 200) throw new Error(`/namespaces returned HTTP ${status}`);
  if (!('results' in data)) throw new Error("/namespaces missing 'results' field");
  if (!Array.isArray(data.results)) throw new Error("/namespaces 'results' should be a list");
  if (!('pagination' in data)) throw new Error("/namespaces missing 'pagination' field");
  if (!('page' in data.pagination)) throw new Error("pagination missing 'page'");
  if (!('page_size' in data.pagination)) throw new Error("pagination missing 'page_size'");
}

export async function checkNamespaceRecordFields(apiRoot: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<NamespaceRecord>>(
    `${apiRoot}/namespaces`
  );
  if (status !== 200) throw new Error(`/namespaces returned HTTP ${status}`);
  for (const ns of data.results) {
    if (!('server' in ns)) throw new Error(`Namespace record missing 'server': ${JSON.stringify(ns)}`);
    if (!('namespace_name' in ns)) throw new Error(`Namespace record missing 'namespace_name': ${JSON.stringify(ns)}`);
    if (!/^[a-z0-9-]+$/.test(ns.namespace_name)) {
      throw new Error(`namespace_name '${ns.namespace_name}' does not match [a-z-]+`);
    }
    if (!('contact_url' in ns)) throw new Error(`Namespace record missing 'contact_url': ${JSON.stringify(ns)}`);
  }
}

export async function checkPaginationDefaults(apiRoot: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<NamespaceRecord>>(
    `${apiRoot}/namespaces`
  );
  if (status !== 200) throw new Error(`/namespaces returned HTTP ${status}`);
  const pag = data.pagination;
  if (typeof pag.page !== 'number') throw new Error(`pagination.page must be int, got ${typeof pag.page}`);
  if (typeof pag.page_size !== 'number') throw new Error(`pagination.page_size must be int, got ${typeof pag.page_size}`);
  if (pag.page < 0) throw new Error(`pagination.page must be >= 0, got ${pag.page}`);
  if (pag.page_size <= 0) throw new Error(`pagination.page_size must be > 0, got ${pag.page_size}`);
}

export async function checkListSchemasStructure(apiRoot: string, namespace: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<SchemaRecord>>(
    `${apiRoot}/schemas/${namespace}`
  );
  if (status !== 200) throw new Error(`/schemas/${namespace} returned HTTP ${status}`);
  if (!('results' in data)) throw new Error(`/schemas/${namespace} missing 'results'`);
  if (!Array.isArray(data.results)) throw new Error(`/schemas/${namespace} 'results' should be a list`);
  if (!('pagination' in data)) throw new Error(`/schemas/${namespace} missing 'pagination'`);
  if (!('page' in data.pagination)) throw new Error("pagination missing 'page'");
  if (!('page_size' in data.pagination)) throw new Error("pagination missing 'page_size'");
}

export async function checkSchemaRecordFields(apiRoot: string, namespace: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<SchemaRecord>>(
    `${apiRoot}/schemas/${namespace}`
  );
  if (status !== 200) throw new Error(`/schemas/${namespace} returned HTTP ${status}`);
  const validLevels = new Set(['draft', 'trial_use', 'normative', 'deprecated']);
  for (const schema of data.results) {
    if (!('namespace' in schema)) throw new Error(`Schema record missing 'namespace': ${JSON.stringify(schema)}`);
    if (!('schema_name' in schema)) throw new Error(`Schema record missing 'schema_name': ${JSON.stringify(schema)}`);
    if (!/^[a-z0-9-]+$/.test(schema.schema_name)) {
      throw new Error(`schema_name '${schema.schema_name}' does not match [a-z-]+`);
    }
    if (!('latest_released_version' in schema)) throw new Error(`Schema record missing 'latest_released_version': ${JSON.stringify(schema)}`);
    if (!('maintainers' in schema)) throw new Error(`Schema record missing 'maintainers': ${JSON.stringify(schema)}`);
    if (!Array.isArray(schema.maintainers)) throw new Error("maintainers must be a list");
    if (!('maturity_level' in schema)) throw new Error(`Schema record missing 'maturity_level': ${JSON.stringify(schema)}`);
    if (!validLevels.has(schema.maturity_level)) {
      throw new Error(`maturity_level '${schema.maturity_level}' not in ${JSON.stringify([...validLevels])}`);
    }
  }
}

export async function checkListVersionsStructure(apiRoot: string, namespace: string, schemaName: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions`;
  const { status, data } = await fetchJson<PagedResponse<VersionRecord>>(url);
  if (status !== 200) throw new Error(`${url} returned HTTP ${status}`);
  if (!('results' in data)) throw new Error("Versions response missing 'results'");
  if (!Array.isArray(data.results)) throw new Error("versions 'results' should be a list");
  if (!('pagination' in data)) throw new Error("Versions response missing 'pagination'");
}

export async function checkSchemaVersionFields(apiRoot: string, namespace: string, schemaName: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions`;
  const { status, data } = await fetchJson<PagedResponse<VersionRecord>>(url);
  if (status !== 200) throw new Error(`${url} returned HTTP ${status}`);
  const validStatuses = new Set(['current', 'deprecated', 'latest']);
  for (const ver of data.results) {
    if (!('schema_name' in ver)) throw new Error(`Version record missing 'schema_name': ${JSON.stringify(ver)}`);
    if (!('version' in ver)) throw new Error(`Version record missing 'version': ${JSON.stringify(ver)}`);
    if (!('status' in ver)) throw new Error(`Version record missing 'status': ${JSON.stringify(ver)}`);
    if (!validStatuses.has(ver.status)) {
      throw new Error(`status '${ver.status}' not in ${JSON.stringify([...validStatuses])}`);
    }
    if (!('contributors' in ver)) throw new Error(`Version record missing 'contributors': ${JSON.stringify(ver)}`);
    if (!Array.isArray(ver.contributors)) throw new Error("contributors must be a list");
    if (!('tags' in ver)) throw new Error(`Version record missing 'tags': ${JSON.stringify(ver)}`);
    if (typeof ver.tags !== 'object' || Array.isArray(ver.tags)) throw new Error("tags must be an object");
  }
}

export async function checkGetSchemaDocument(apiRoot: string, namespace: string, schemaName: string, version: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions/${version}`;
  const { status, data } = await fetchJson<Record<string, unknown>>(url);
  if (status !== 200) throw new Error(`${url} returned HTTP ${status}`);
  if (typeof data !== 'object' || data === null) throw new Error("Schema document must be a JSON object");
  const schemaMarkers = ['$schema', '$id', '$defs', 'definitions', 'type', 'properties', 'allOf', 'anyOf', 'oneOf', '$ref'];
  const hasSchemaMarker = schemaMarkers.some(k => k in data);
  if (!hasSchemaMarker) {
    throw new Error(`Schema document does not look like a JSON Schema (missing any of ${schemaMarkers.join(', ')}): keys=${Object.keys(data)}`);
  }
}

export async function checkLatestAlias(apiRoot: string, namespace: string, schemaName: string, latestReleasedVersion: string): Promise<void> {
  const latestUrl = `${apiRoot}/schemas/${namespace}/${schemaName}/versions/latest`;
  const versionedUrl = `${apiRoot}/schemas/${namespace}/${schemaName}/versions/${latestReleasedVersion}`;
  const [latestRes, versionedRes] = await Promise.all([
    fetchJson<Record<string, unknown>>(latestUrl),
    fetchJson<Record<string, unknown>>(versionedUrl),
  ]);
  if (latestRes.status !== 200) throw new Error(`/versions/latest returned HTTP ${latestRes.status}`);
  if (versionedRes.status !== 200) throw new Error(`/versions/${latestReleasedVersion} returned HTTP ${versionedRes.status}`);
  if (JSON.stringify(latestRes.data) !== JSON.stringify(versionedRes.data)) {
    throw new Error("/versions/latest response does not match /versions/{latest_released_version}");
  }
}

export async function checkFilterSchemaName(apiRoot: string, namespace: string, schemaName: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<SchemaRecord>>(
    `${apiRoot}/schemas/${namespace}?schema_name=${encodeURIComponent(schemaName)}`
  );
  if (status !== 200) throw new Error(`Filter by schema_name returned HTTP ${status}`);
  const names = data.results.map(s => s.schema_name);
  if (!names.includes(schemaName)) {
    throw new Error(`schema_name filter '${schemaName}' not in results: ${JSON.stringify(names)}`);
  }
  for (const name of names) {
    if (name !== schemaName) {
      throw new Error(`Filter returned unexpected schema_name '${name}' when filtering for '${schemaName}'`);
    }
  }
}

export async function checkFilterMaintainer(apiRoot: string, namespace: string, maintainer: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<SchemaRecord>>(
    `${apiRoot}/schemas/${namespace}?maintainers=${encodeURIComponent(maintainer)}`
  );
  if (status !== 200) throw new Error(`Filter by maintainers returned HTTP ${status}`);
  for (const schema of data.results) {
    if (!schema.maintainers?.includes(maintainer)) {
      throw new Error(`Filter by maintainer '${maintainer}' returned schema without that maintainer: ${JSON.stringify(schema)}`);
    }
  }
}

export async function checkFilterMaturityLevel(apiRoot: string, namespace: string, level: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<SchemaRecord>>(
    `${apiRoot}/schemas/${namespace}?maturity_level=${encodeURIComponent(level)}`
  );
  if (status !== 200) throw new Error(`Filter by maturity_level returned HTTP ${status}`);
  for (const schema of data.results) {
    if (schema.maturity_level !== level) {
      throw new Error(`Filter by maturity_level='${level}' returned schema with '${schema.maturity_level}'`);
    }
  }
}

export async function checkFilterUnknownReturnsEmpty(apiRoot: string, namespace: string): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<SchemaRecord>>(
    `${apiRoot}/schemas/${namespace}?schema_name=__missing__`
  );
  if (status !== 200) {
    throw new Error(`Filter with unknown schema_name returned HTTP ${status} (expected 200)`);
  }
  if (data.results.length !== 0) {
    throw new Error(`Filter with unknown schema_name should return empty results, got ${JSON.stringify(data.results)}`);
  }
}

export async function checkUnknownNamespace404(apiRoot: string): Promise<void> {
  const { status } = await fetchRaw(`${apiRoot}/schemas/__missing__`);
  if (status !== 404) {
    throw new Error(`/schemas/__missing__ returned HTTP ${status} (expected 404)`);
  }
}

export async function checkUnknownSchema404(apiRoot: string, namespace: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/__missing__/versions`;
  const { status } = await fetchRaw(url);
  if (status !== 404) {
    throw new Error(`${url} returned HTTP ${status} (expected 404)`);
  }
}

export async function checkUnknownVersion404(apiRoot: string, namespace: string, schemaName: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions/9999.9.9`;
  const { status } = await fetchRaw(url);
  if (status !== 404) {
    throw new Error(`${url} returned HTTP ${status} (expected 404)`);
  }
}

export async function checkListedNamespacesResolvable(apiRoot: string, maxNamespaces: number): Promise<void> {
  const { status, data } = await fetchJson<PagedResponse<NamespaceRecord>>(
    `${apiRoot}/namespaces`
  );
  if (status !== 200) throw new Error(`/namespaces returned HTTP ${status}`);
  for (const ns of data.results.slice(0, maxNamespaces)) {
    const nsName = ns.namespace_name;
    const r = await fetchRaw(`${apiRoot}/schemas/${nsName}`);
    if (r.status !== 200) {
      throw new Error(`Namespace '${nsName}' from /namespaces does not resolve: HTTP ${r.status}`);
    }
  }
}

export async function checkListedSchemasResolvable(apiRoot: string, namespace: string, schemaName: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions`;
  const { status } = await fetchRaw(url);
  if (status !== 200) {
    throw new Error(`Schema '${namespace}/${schemaName}' listed but does not resolve: HTTP ${status}`);
  }
}

export async function checkListedVersionsResolvable(apiRoot: string, namespace: string, schemaName: string, version: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions/${version}`;
  const { status, data } = await fetchJson<Record<string, unknown>>(url);
  if (status !== 200) {
    throw new Error(`Version '${namespace}/${schemaName}/${version}' listed but returned HTTP ${status}`);
  }
  if (typeof data !== 'object' || data === null) throw new Error("Schema document must be a JSON object");
}

export async function checkLatestMatchesListed(apiRoot: string, namespace: string, schemaName: string): Promise<void> {
  const schemasRes = await fetchJson<PagedResponse<SchemaRecord>>(`${apiRoot}/schemas/${namespace}`);
  if (schemasRes.status !== 200) throw new Error(`/schemas/${namespace} returned HTTP ${schemasRes.status}`);
  const schema = schemasRes.data.results.find(s => s.schema_name === schemaName);
  if (!schema) throw new Error(`Schema '${schemaName}' not found in namespace '${namespace}'`);
  const latest = schema.latest_released_version;
  const versionsRes = await fetchJson<PagedResponse<VersionRecord>>(
    `${apiRoot}/schemas/${namespace}/${schemaName}/versions`
  );
  if (versionsRes.status !== 200) throw new Error(`/versions returned HTTP ${versionsRes.status}`);
  const versionIds = versionsRes.data.results.map(v => v.version);
  if (!versionIds.includes(latest)) {
    throw new Error(`latest_released_version '${latest}' not found in versions list: ${JSON.stringify(versionIds)}`);
  }
}

export async function checkSchemaDocumentIdConsistency(apiRoot: string, namespace: string, schemaName: string, version: string): Promise<void> {
  const url = `${apiRoot}/schemas/${namespace}/${schemaName}/versions/${version}`;
  const { status, data } = await fetchJson<Record<string, unknown>>(url);
  if (status !== 200) throw new Error(`${url} returned HTTP ${status}`);
  if ('$id' in data && typeof data['$id'] === 'string') {
    if (!data['$id'].includes(schemaName)) {
      throw new Error(`$id '${data['$id']}' does not contain schema_name '${schemaName}'`);
    }
  }
}

export async function checkCorsHeaders(apiRoot: string): Promise<void> {
  const { status, headers } = await fetchRaw(`${apiRoot}/namespaces`);
  if (status !== 200) throw new Error(`/namespaces returned HTTP ${status}`);
  const cors = headers.get('Access-Control-Allow-Origin') || '';
  if (cors !== '*') {
    throw new Error(`Expected Access-Control-Allow-Origin: *, got '${cors}'`);
  }
}

export async function checkOpenapiAvailable(apiRoot: string): Promise<void> {
  for (const path of ['/openapi.json', '/openapi.yaml']) {
    const { status } = await fetchRaw(`${apiRoot}${path}`);
    if (status === 200) return;
  }
  throw new Error("Neither /openapi.json nor /openapi.yaml returned 200");
}

export async function checkContentType(apiRoot: string): Promise<void> {
  const { status, headers } = await fetchRaw(`${apiRoot}/namespaces`);
  if (status !== 200) throw new Error(`/namespaces returned HTTP ${status}`);
  const ct = headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`Expected Content-Type application/json, got '${ct}'`);
  }
}
