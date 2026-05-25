import type { Check, SSEEvent, NamespaceRecord, SchemaRecord, VersionRecord, PagedResponse } from './types';
import * as checks from './checks';

const MAX_NAMESPACES = 5;
const MAX_SCHEMAS_PER_NS = 5;
const MAX_VERSIONS_PER_SCHEMA = 3;
const COMPLIANCE_TIMEOUT = 5000;

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMPLIANCE_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status !== 200) return null;
    return await res.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function buildChecks(apiRoot: string): Promise<Check[]> {
  const checkList: Check[] = [];

  checkList.push({
    name: 'service_info',
    description: 'Service-info returns 200 with required GA4GH fields.',
    recommended: false,
    run: () => checks.checkServiceInfo(apiRoot),
  });

  checkList.push({
    name: 'list_namespaces_structure',
    description: 'GET /namespaces returns 200 with results array and pagination object.',
    recommended: false,
    run: () => checks.checkListNamespacesStructure(apiRoot),
  });

  checkList.push({
    name: 'namespace_record_fields',
    description: 'Each namespace record has server, namespace_name matching [a-z0-9-]+, and contact_url.',
    recommended: false,
    run: () => checks.checkNamespaceRecordFields(apiRoot),
  });

  checkList.push({
    name: 'pagination_defaults',
    description: 'Pagination fields have valid types: page >= 0 and page_size > 0.',
    recommended: false,
    run: () => checks.checkPaginationDefaults(apiRoot),
  });

  checkList.push({
    name: 'unknown_namespace_404',
    description: 'GET /schemas/__missing__ returns 404.',
    recommended: false,
    run: () => checks.checkUnknownNamespace404(apiRoot),
  });

  checkList.push({
    name: 'cors_headers',
    description: 'CORS header Access-Control-Allow-Origin: * present on /namespaces.',
    recommended: true,
    run: () => checks.checkCorsHeaders(apiRoot),
  });

  checkList.push({
    name: 'openapi_available',
    description: 'OpenAPI spec is accessible at /openapi.json or /openapi.yaml.',
    recommended: true,
    run: () => checks.checkOpenapiAvailable(apiRoot),
  });

  checkList.push({
    name: 'content_type',
    description: 'JSON endpoints return Content-Type: application/json.',
    recommended: true,
    run: () => checks.checkContentType(apiRoot),
  });

  checkList.push({
    name: 'listed_namespaces_resolvable',
    description: 'Every namespace_name from /namespaces resolves at /schemas/{ns}.',
    recommended: false,
    run: () => checks.checkListedNamespacesResolvable(apiRoot, MAX_NAMESPACES),
  });

  const nsData = await fetchJson<PagedResponse<NamespaceRecord>>(`${apiRoot}/namespaces`);
  if (!nsData) return checkList;

  const namespaces = nsData.results.slice(0, MAX_NAMESPACES);
  let firstNs: string | null = null;
  let firstSchema: string | null = null;

  for (const nsRecord of namespaces) {
    const ns = nsRecord.namespace_name;
    if (firstNs === null) firstNs = ns;

    const tag = ns;

    checkList.push({
      name: `list_schemas_structure[${tag}]`,
      description: 'GET /schemas/{ns} returns 200 with PagedResponse of SchemaRecords.',
      recommended: false,
      run: () => checks.checkListSchemasStructure(apiRoot, ns),
    });

    checkList.push({
      name: `schema_record_fields[${tag}]`,
      description: 'Each schema record has namespace, schema_name [a-z0-9-]+, latest_released_version, maintainers[], maturity_level.',
      recommended: false,
      run: () => checks.checkSchemaRecordFields(apiRoot, ns),
    });

    checkList.push({
      name: `unknown_schema_404[${tag}]`,
      description: 'GET /schemas/{ns}/__missing__/versions returns 404.',
      recommended: false,
      run: () => checks.checkUnknownSchema404(apiRoot, ns),
    });

    checkList.push({
      name: `filter_unknown_returns_empty[${tag}]`,
      description: '?schema_name=__missing__ returns 200 with empty results (not 404).',
      recommended: true,
      run: () => checks.checkFilterUnknownReturnsEmpty(apiRoot, ns),
    });

    const schemasData = await fetchJson<PagedResponse<SchemaRecord>>(`${apiRoot}/schemas/${ns}`);
    if (!schemasData) continue;

    const schemaRecords = schemasData.results.slice(0, MAX_SCHEMAS_PER_NS);

    for (const schemaRecord of schemaRecords) {
      const schemaName = schemaRecord.schema_name;

      if (firstSchema === null && firstNs === ns) {
        firstSchema = schemaName;

        checkList.push({
          name: `filter_schema_name[${ns}/${schemaName}]`,
          description: '?schema_name=<known> returns exactly that schema in results.',
          recommended: true,
          run: () => checks.checkFilterSchemaName(apiRoot, ns, schemaName),
        });

        if (schemaRecord.maintainers?.length > 0) {
          const maintainer = schemaRecord.maintainers[0];
          checkList.push({
            name: `filter_maintainer[${ns}/${schemaName}]`,
            description: '?maintainers=<known> includes schemas with that maintainer.',
            recommended: true,
            run: () => checks.checkFilterMaintainer(apiRoot, ns, maintainer),
          });
        }

        if (schemaRecord.maturity_level) {
          const level = schemaRecord.maturity_level;
          checkList.push({
            name: `filter_maturity_level[${ns}/${schemaName}]`,
            description: '?maturity_level=<val> returns only schemas with that maturity_level.',
            recommended: true,
            run: () => checks.checkFilterMaturityLevel(apiRoot, ns, level),
          });
        }
      }

      const stag = `${ns}/${schemaName}`;

      checkList.push({
        name: `list_versions_structure[${stag}]`,
        description: 'GET /schemas/{ns}/{schema}/versions returns 200 with PagedResponse.',
        recommended: false,
        run: () => checks.checkListVersionsStructure(apiRoot, ns, schemaName),
      });

      checkList.push({
        name: `schema_version_fields[${stag}]`,
        description: 'Each version has schema_name, version, status in {current, deprecated, latest}.',
        recommended: false,
        run: () => checks.checkSchemaVersionFields(apiRoot, ns, schemaName),
      });

      checkList.push({
        name: `listed_schemas_resolvable[${stag}]`,
        description: 'Schema from /schemas/{ns} resolves at /schemas/{ns}/{schema}/versions.',
        recommended: false,
        run: () => checks.checkListedSchemasResolvable(apiRoot, ns, schemaName),
      });

      checkList.push({
        name: `latest_matches_listed[${stag}]`,
        description: 'latest_released_version appears in the versions list.',
        recommended: false,
        run: () => checks.checkLatestMatchesListed(apiRoot, ns, schemaName),
      });

      checkList.push({
        name: `unknown_version_404[${stag}]`,
        description: 'GET /schemas/{ns}/{schema}/versions/9999.9.9 returns 404.',
        recommended: false,
        run: () => checks.checkUnknownVersion404(apiRoot, ns, schemaName),
      });

      const latest = schemaRecord.latest_released_version;
      if (latest) {
        checkList.push({
          name: `latest_alias[${stag}]`,
          description: 'GET /schemas/{ns}/{schema}/versions/latest body equals the latest_released_version document.',
          recommended: false,
          run: () => checks.checkLatestAlias(apiRoot, ns, schemaName, latest),
        });
      }

      const versionsData = await fetchJson<PagedResponse<VersionRecord>>(
        `${apiRoot}/schemas/${ns}/${schemaName}/versions`
      );
      if (!versionsData) continue;

      const versionRecords = versionsData.results.slice(0, MAX_VERSIONS_PER_SCHEMA);

      for (const verRecord of versionRecords) {
        const ver = verRecord.version;
        const vtag = `${ns}/${schemaName}/${ver}`;

        checkList.push({
          name: `get_schema_document[${vtag}]`,
          description: 'GET /schemas/{ns}/{schema}/versions/{ver} returns 200 and valid JSON Schema.',
          recommended: false,
          run: () => checks.checkGetSchemaDocument(apiRoot, ns, schemaName, ver),
        });

        checkList.push({
          name: `listed_versions_resolvable[${vtag}]`,
          description: 'Version from /versions list resolves and parses as JSON.',
          recommended: false,
          run: () => checks.checkListedVersionsResolvable(apiRoot, ns, schemaName, ver),
        });

        checkList.push({
          name: `schema_document_id_consistency[${vtag}]`,
          description: '$id field (if present) is consistent with the schema_name.',
          recommended: false,
          run: () => checks.checkSchemaDocumentIdConsistency(apiRoot, ns, schemaName, ver),
        });
      }
    }
  }

  return checkList;
}

export async function* runComplianceStream(apiRoot: string): AsyncGenerator<SSEEvent> {
  const checkList = await buildChecks(apiRoot);

  yield { type: 'start', total: checkList.length, server_url: apiRoot };

  let requiredPassed = 0;
  let requiredFailed = 0;
  let recommendedPassed = 0;
  let recommendedFailed = 0;

  for (const check of checkList) {
    const t0 = performance.now();
    try {
      await check.run();
      const duration_ms = Math.round(performance.now() - t0);
      yield {
        type: 'result',
        name: check.name,
        passed: true,
        duration_ms,
        description: check.description,
        recommended: check.recommended,
      };
      if (check.recommended) {
        recommendedPassed++;
      } else {
        requiredPassed++;
      }
    } catch (e: unknown) {
      const duration_ms = Math.round(performance.now() - t0);
      const error = e instanceof Error ? e.message : String(e);
      yield {
        type: 'result',
        name: check.name,
        passed: false,
        duration_ms,
        description: check.description,
        error,
        recommended: check.recommended,
      };
      if (check.recommended) {
        recommendedFailed++;
      } else {
        requiredFailed++;
      }
    }
  }

  yield {
    type: 'done',
    total: checkList.length,
    passed: requiredPassed + recommendedPassed,
    failed: requiredFailed + recommendedFailed,
    required_passed: requiredPassed,
    required_failed: requiredFailed,
    recommended_passed: recommendedPassed,
    recommended_failed: recommendedFailed,
  };
}
