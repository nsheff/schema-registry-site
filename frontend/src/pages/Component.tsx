import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getComponent, API_BASE } from '../api';
import { SchemaViewer } from '../components/SchemaViewer';
import { MaturityBadge } from '../components/Badge';
import { RefLink } from '../components/RefLink';

interface PropertyInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
  refs: string[];
}

function extractProperties(schema: Record<string, unknown>): PropertyInfo[] {
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[]) || [];
  if (!props) return [];

  return Object.entries(props).map(([name, def]) => {
    const refs: string[] = [];
    let typeStr = '';

    if (def.$ref) {
      refs.push(def.$ref as string);
      typeStr = 'ref';
    } else if (def.oneOf) {
      const options = def.oneOf as Record<string, unknown>[];
      options.forEach((o) => {
        if (o.$ref) refs.push(o.$ref as string);
      });
      typeStr = 'oneOf';
    } else if (def.type === 'array' && def.items) {
      const items = def.items as Record<string, unknown>;
      if (items.$ref) {
        refs.push(items.$ref as string);
        typeStr = 'array of ref';
      } else {
        typeStr = `array of ${items.type || 'unknown'}`;
      }
    } else if (def.const) {
      typeStr = `string (const: "${def.const}")`;
    } else {
      typeStr = (def.type as string) || 'unknown';
    }

    return {
      name,
      type: typeStr,
      required: required.includes(name),
      description: (def.description as string) || '',
      refs,
    };
  });
}

export function Component() {
  const { namespace, schema, version, component } = useParams<{
    namespace: string;
    schema: string;
    version: string;
    component: string;
  }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<'properties' | 'json'>('properties');

  useEffect(() => {
    if (namespace && schema && version && component) {
      getComponent(namespace, schema, version, component).then(setData);
    }
  }, [namespace, schema, version, component]);

  if (!data) return <div>Loading...</div>;

  const properties = extractProperties(data);
  const maturity = data.maturity as string | undefined;
  const componentApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/components/${component}.json`;

  return (
    <div>
      <div className="component-header">
        <h1>{component}</h1>
        {maturity && <MaturityBadge level={maturity} />}
      </div>

      {data.$id ? <p className="schema-id"><code>{String(data.$id)}</code></p> : null}
      {data.description ? <p>{String(data.description)}</p> : null}

      <div className="api-links">
        <span className="api-links-label">API:</span>
        <a href={componentApiUrl} target="_blank" rel="noopener noreferrer" className="api-link-pill">
          Component JSON
        </a>
      </div>

      <div className="tab-bar">
        <button
          className={tab === 'properties' ? 'tab active' : 'tab'}
          onClick={() => setTab('properties')}
        >
          Properties
        </button>
        <button
          className={tab === 'json' ? 'tab active' : 'tab'}
          onClick={() => setTab('json')}
        >
          JSON Schema
        </button>
      </div>

      {tab === 'properties' && properties.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Type</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.name}>
                <td><code>{p.name}</code></td>
                <td>
                  {p.refs.length > 0 ? (
                    <span>
                      {p.type === 'oneOf' && 'oneOf: '}
                      {p.type === 'array of ref' && 'array of '}
                      {p.refs.map((ref, i) => (
                        <span key={ref}>
                          {i > 0 && ', '}
                          <RefLink uri={ref} />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <code>{p.type}</code>
                  )}
                </td>
                <td>{p.required ? 'yes' : 'no'}</td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'properties' && properties.length === 0 && (
        <p className="muted">
          This component does not define properties (it may be a type alias or dispatcher).
        </p>
      )}

      {tab === 'json' && <SchemaViewer data={data} />}
    </div>
  );
}
