import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getComponents, getSchema, getLinkMLInfo, getLinkMLClasses, getLinkMLEnums,
  API_BASE,
  type ComponentRecord, type LinkMLInfo, type LinkMLClassSummary, type LinkMLEnumSummary,
} from '../api';
import { SchemaViewer } from '../components/SchemaViewer';
import { ApiUrlBox } from '../components/ApiUrlBox';

type TabId = 'classes' | 'components' | 'bundle';

export function Version() {
  const { namespace, schema, version } = useParams<{
    namespace: string;
    schema: string;
    version: string;
  }>();
  const [components, setComponents] = useState<ComponentRecord[]>([]);
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<TabId>('components');

  // LinkML state
  const [linkmlInfo, setLinkmlInfo] = useState<LinkMLInfo | null>(null);
  const [classes, setClasses] = useState<LinkMLClassSummary[]>([]);
  const [enums, setEnums] = useState<LinkMLEnumSummary[]>([]);

  useEffect(() => {
    if (!namespace || !schema || !version) return;
    getComponents(namespace, schema, version).then((r) => setComponents(r.results));
    getSchema(namespace, schema, version).then(setBundle);

    // Try to load LinkML metadata (will 404 for non-LinkML schemas, that's fine)
    getLinkMLInfo(namespace, schema, version)
      .then((info) => {
        setLinkmlInfo(info);
        if (info.has_linkml) {
          setTab('classes'); // Default to classes tab for LinkML schemas
          getLinkMLClasses(namespace, schema, version).then(setClasses);
          getLinkMLEnums(namespace, schema, version).then(setEnums);
        }
      })
      .catch(() => setLinkmlInfo(null));
  }, [namespace, schema, version]);

  const hasLinkML = linkmlInfo?.has_linkml;

  const filteredComponents = components.filter(
    (c) =>
      c.component_name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredEnums = enums.filter(
    (e) =>
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      e.description.toLowerCase().includes(filter.toLowerCase())
  );

  const bundleApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}`;
  const componentsApiUrl = `${API_BASE}/schemas/${namespace}/${schema}/versions/${version}/components`;
  const basePath = `/${namespace}/${schema}/${version}`;

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
        {hasLinkML && (
          <button
            className={tab === 'classes' ? 'tab active' : 'tab'}
            onClick={() => setTab('classes')}
          >
            Classes ({classes.length})
          </button>
        )}
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

      {tab === 'classes' && hasLinkML && (
        <div>
          <input
            type="text"
            className="search-input"
            placeholder="Filter classes and enums..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          <div className="card-grid">
            {filteredClasses.map((cls) => (
              <Link to={`${basePath}/class/${cls.name}`} key={cls.name} className="card">
                <div className="card-header">
                  <h2>{cls.name}</h2>
                  <span className="badge" style={{ backgroundColor: '#2563eb' }}>{cls.property_count} props</span>
                </div>
                {cls.description && <p className="muted">{cls.description}</p>}
                {cls.is_a && <p className="muted" style={{ fontSize: '0.8rem' }}>extends {cls.is_a}</p>}
              </Link>
            ))}
          </div>

          {filteredEnums.length > 0 && (
            <>
              <h2 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Enums</h2>
              <div className="card-grid">
                {filteredEnums.map((en) => (
                  <Link to={`${basePath}/enum/${en.name}`} key={en.name} className="card">
                    <div className="card-header">
                      <h2>{en.name}</h2>
                      <span className="badge" style={{ backgroundColor: '#7c3aed' }}>{en.value_count} values</span>
                    </div>
                    {en.description && <p className="muted">{en.description}</p>}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

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
              {filteredComponents.map((c) => (
                <tr key={c.component_name}>
                  <td className="component-table-name">
                    <Link to={`${basePath}/${c.component_name}`}>
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
