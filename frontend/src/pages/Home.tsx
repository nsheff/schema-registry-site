import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNamespaces, getSchemas, API_BASE, type Namespace } from '../api';

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

  const apiRoot = window.location.origin + API_BASE;

  return (
    <div>
      <h1>Namespaces</h1>
      <p className="subtitle">Browse schema namespaces in this registry.</p>

      <div className="api-callout">
        <p>
          This site is a browsable frontend for a{' '}
          <a href="https://ga4gh.github.io/schema-registry/" target="_blank" rel="noopener noreferrer">
            GA4GH Schema Registry
          </a>{' '}
          API. The API ingests JSON Schemas from GKS GitHub repositories
          (vrs, gks-core, cat-vrs, va-spec), bundles them into compound
          schema documents, and serves them as static JSON matching the
          Schema Registry specification. Everything you see here is
          rendered from that API.
        </p>
        <p className="api-callout-url">
          <strong>API endpoint:</strong>{' '}
          <a href={`${API_BASE}/namespaces/index.json`} target="_blank" rel="noopener noreferrer">
            <code>{apiRoot}/</code>
          </a>
        </p>
      </div>

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
