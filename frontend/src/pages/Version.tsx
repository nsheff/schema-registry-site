import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getComponents, getSchema, API_BASE, type ComponentRecord } from '../api';
import { SchemaViewer } from '../components/SchemaViewer';

export function Version() {
  const { namespace, schema, version } = useParams<{
    namespace: string;
    schema: string;
    version: string;
  }>();
  const [components, setComponents] = useState<ComponentRecord[]>([]);
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<'components' | 'bundle'>('components');

  useEffect(() => {
    if (namespace && schema && version) {
      getComponents(namespace, schema, version).then((r) => setComponents(r.results));
      getSchema(namespace, schema, version).then(setBundle);
    }
  }, [namespace, schema, version]);

  const filtered = components.filter(
    (c) =>
      c.component_name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase())
  );

  const bundleApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/index.json`;
  const componentsApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/components/index.json`;

  return (
    <div>
      <h1>
        {schema} <span className="version-tag">{version}</span>
      </h1>

      <div className="api-links">
        <span className="api-links-label">API:</span>
        <a href={bundleApiUrl} target="_blank" rel="noopener noreferrer" className="api-link-pill">
          Bundle JSON
        </a>
        <a href={componentsApiUrl} target="_blank" rel="noopener noreferrer" className="api-link-pill">
          Components list
        </a>
      </div>

      <div className="tab-bar">
        <button
          className={tab === 'components' ? 'tab active' : 'tab'}
          onClick={() => setTab('components')}
        >
          Components ({components.length})
        </button>
        <button
          className={tab === 'bundle' ? 'tab active' : 'tab'}
          onClick={() => setTab('bundle')}
        >
          Bundle
        </button>
      </div>

      {tab === 'components' && (
        <div>
          <input
            type="text"
            className="search-input"
            placeholder="Filter components..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="component-list">
            {filtered.map((c) => (
              <div key={c.component_name} className="component-row">
                <Link
                  to={`/${namespace}/${schema}/${version}/${c.component_name}`}
                  className="component-name"
                >
                  <strong>{c.component_name}</strong>
                </Link>
                <span className="muted component-desc">{c.description}</span>
                <a
                  href={`${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/components/${c.component_name}.json`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="api-link-small"
                  title="View raw JSON via API"
                >
                  JSON
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'bundle' && bundle && <SchemaViewer data={bundle} />}
    </div>
  );
}
