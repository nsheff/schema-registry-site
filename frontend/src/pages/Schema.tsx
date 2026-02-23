import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getVersions, type SchemaVersion } from '../api';
import { StatusBadge } from '../components/Badge';

export function Schema() {
  const { namespace, schema } = useParams<{ namespace: string; schema: string }>();
  const [versions, setVersions] = useState<SchemaVersion[]>([]);

  useEffect(() => {
    if (namespace && schema) {
      getVersions(namespace, schema).then((r) => setVersions(r.results));
    }
  }, [namespace, schema]);

  return (
    <div>
      <h1>{schema}</h1>
      <p className="subtitle">Available versions.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Contributors</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version}>
              <td>
                <Link to={`/${namespace}/${schema}/${v.version}`}>
                  {v.version}
                </Link>
              </td>
              <td><StatusBadge status={v.status} /></td>
              <td>{v.contributors.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
