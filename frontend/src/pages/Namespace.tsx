import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSchemas, API_BASE, type SchemaRecord } from '../api';
import { MaturityBadge } from '../components/Badge';
import { ApiUrlBox } from '../components/ApiUrlBox';

export function Namespace() {
  const { namespace } = useParams<{ namespace: string }>();
  const [schemas, setSchemas] = useState<SchemaRecord[]>([]);

  useEffect(() => {
    if (namespace) {
      getSchemas(namespace).then((r) => setSchemas(r.results));
    }
  }, [namespace]);

  const schemasApiUrl = `${API_BASE}/schemas/${namespace}/index.json`;

  return (
    <div>
      <h1>{namespace}</h1>
      <p className="subtitle">Schemas in this namespace.</p>

      <ApiUrlBox rows={[{ label: 'Schemas', url: schemasApiUrl }]} />

      <div className="card-grid">
        {schemas.map((s) => (
          <Link
            to={`/${namespace}/${s.schema_name}`}
            key={s.schema_name}
            className="card"
          >
            <div className="card-header">
              <h2>{s.schema_name}</h2>
              <MaturityBadge level={s.maturity_level} />
            </div>
            <p>Latest: <strong>{s.latest_released_version}</strong></p>
            <p className="muted">{s.maintainers.join(', ')}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
