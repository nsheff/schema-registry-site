import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getComponents, getSchema, type ComponentRecord } from '../api';
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

  return (
    <div>
      <h1>
        {schema} <span className="version-tag">{version}</span>
      </h1>

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
              <Link
                to={`/${namespace}/${schema}/${version}/${c.component_name}`}
                key={c.component_name}
                className="component-row"
              >
                <strong>{c.component_name}</strong>
                <span className="muted">{c.description}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === 'bundle' && bundle && <SchemaViewer data={bundle} />}
    </div>
  );
}
