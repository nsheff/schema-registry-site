import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getComponents, getSchema, API_BASE, type ComponentRecord } from '../api';
import { SchemaViewer } from '../components/SchemaViewer';
import { ApiUrlBox } from '../components/ApiUrlBox';

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

  const bundleApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}`;
  const componentsApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/components`;

  return (
    <div>
      <h1>
        {schema} <span className="version-tag">{version}</span>
      </h1>

      <ApiUrlBox rows={[
        { label: 'Bundle', url: bundleApiUrl },
        { label: 'Components', url: componentsApiUrl },
      ]} />

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
          <table className="component-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.component_name}>
                  <td className="component-table-name">
                    <Link to={`/${namespace}/${schema}/${version}/${c.component_name}`}>
                      {c.component_name}
                    </Link>
                  </td>
                  <td className="component-table-desc">{c.description}</td>
                  <td>
                    <a
                      href={`${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/components/${c.component_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="api-link-small"
                      title="View raw JSON via API"
                    >
                      JSON
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bundle' && bundle && <SchemaViewer data={bundle} />}
    </div>
  );
}
