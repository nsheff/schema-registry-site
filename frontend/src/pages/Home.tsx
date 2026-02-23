import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNamespaces, getSchemas, type Namespace } from '../api';

export function Home() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [schemaCounts, setSchemaCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getNamespaces().then((r) => {
      setNamespaces(r.results);
      r.results.forEach((ns) => {
        getSchemas(ns.namespace_name).then((s) => {
          setSchemaCounts((prev) => ({ ...prev, [ns.namespace_name]: s.pagination.total }));
        });
      });
    });
  }, []);

  return (
    <div>
      <h1>Namespaces</h1>
      <p className="subtitle">Browse schema namespaces in this registry.</p>
      <div className="card-grid">
        {namespaces.map((ns) => (
          <Link to={`/${ns.namespace_name}`} key={ns.namespace_name} className="card">
            <h2>{ns.namespace_name}</h2>
            <p>{schemaCounts[ns.namespace_name] ?? '...'} schemas</p>
            <p className="muted">{ns.server}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
