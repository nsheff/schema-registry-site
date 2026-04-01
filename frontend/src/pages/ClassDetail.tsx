import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLinkMLClass, getLinkMLClasses, type LinkMLClassRecord, type LinkMLClassSummary } from '../api';
import { TypeLink } from '../components/TypeLink';

export function ClassDetail() {
  const { namespace, schema, version, className } = useParams<{
    namespace: string;
    schema: string;
    version: string;
    className: string;
  }>();
  const [cls, setCls] = useState<LinkMLClassRecord | null>(null);
  const [allClasses, setAllClasses] = useState<LinkMLClassSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!namespace || !schema || !version || !className) return;
    setCls(null);
    setError('');
    getLinkMLClass(namespace, schema, version, className)
      .then(setCls)
      .catch(() => setError(`Class "${className}" not found`));
    getLinkMLClasses(namespace, schema, version).then(setAllClasses);
  }, [namespace, schema, version, className]);

  if (error) return <div className="muted">{error}</div>;
  if (!cls) return <div>Loading...</div>;

  const basePath = `/${namespace}/${schema}/${version}`;
  const required = cls.properties.filter((p) => p.required);
  const optional = cls.properties.filter((p) => !p.required);
  const subclasses = allClasses.filter((c) => c.is_a === className);

  return (
    <div>
      <div className="component-header">
        <h1>{cls.name}</h1>
        <span className="badge" style={{ backgroundColor: '#2563eb' }}>Class</span>
      </div>

      {cls.description && <p className="subtitle">{cls.description}</p>}

      <div className="linkml-meta">
        <span>Source: <code>{cls.source_file}.yaml</code></span>
        {cls.is_a && (
          <span>
            Extends: <Link to={`${basePath}/class/${cls.is_a}`} className="linkml-type linkml-type-class">{cls.is_a}</Link>
          </span>
        )}
        {cls.mixins && cls.mixins.length > 0 && (
          <span>
            Mixins: {cls.mixins.map((m, i) => (
              <span key={m}>
                {i > 0 && ', '}
                <Link to={`${basePath}/class/${m}`} className="linkml-type linkml-type-class">{m}</Link>
              </span>
            ))}
          </span>
        )}
      </div>

      {subclasses.length > 0 && (
        <div className="linkml-section">
          <h3>Subclasses</h3>
          <div className="linkml-chip-list">
            {subclasses.map((sc) => (
              <Link to={`${basePath}/class/${sc.name}`} key={sc.name} className="linkml-chip linkml-chip-class">
                {sc.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {cls.references.length > 0 && (
        <div className="linkml-section">
          <h3>References (outgoing)</h3>
          <div className="linkml-chip-list">
            {cls.references.map((ref) => {
              const isClass = allClasses.some((c) => c.name === ref);
              return (
                <Link
                  to={`${basePath}/${isClass ? 'class' : 'enum'}/${ref}`}
                  key={ref}
                  className={`linkml-chip ${isClass ? 'linkml-chip-class' : 'linkml-chip-enum'}`}
                >
                  {ref}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {cls.referenced_by && cls.referenced_by.length > 0 && (
        <div className="linkml-section">
          <h3>Referenced by (incoming)</h3>
          <div className="linkml-chip-list">
            {cls.referenced_by.map((ref) => (
              <Link to={`${basePath}/class/${ref}`} key={ref} className="linkml-chip linkml-chip-class">
                {ref}
              </Link>
            ))}
          </div>
        </div>
      )}

      {required.length > 0 && (
        <div className="linkml-section">
          <h3>Required Properties ({required.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {required.map((prop) => (
                <tr key={prop.name}>
                  <td>
                    <code>{prop.name}</code>
                    {prop.identifier && <span className="badge" style={{ backgroundColor: '#d97706', marginLeft: 6, fontSize: '0.65rem' }}>ID</span>}
                  </td>
                  <td>
                    <TypeLink name={prop.range} rangeType={prop.range_type} multivalued={prop.multivalued} basePath={basePath} />
                  </td>
                  <td className="muted">{prop.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {optional.length > 0 && (
        <div className="linkml-section">
          <h3>Optional Properties ({optional.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {optional.map((prop) => (
                <tr key={prop.name}>
                  <td>
                    <code>{prop.name}</code>
                    {prop.identifier && <span className="badge" style={{ backgroundColor: '#d97706', marginLeft: 6, fontSize: '0.65rem' }}>ID</span>}
                  </td>
                  <td>
                    <TypeLink name={prop.range} rangeType={prop.range_type} multivalued={prop.multivalued} basePath={basePath} />
                  </td>
                  <td className="muted">{prop.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cls.rules && cls.rules.length > 0 && (
        <div className="linkml-section">
          <h3>Validation Rules</h3>
          <pre className="schema-viewer"><code>{JSON.stringify(cls.rules, null, 2)}</code></pre>
        </div>
      )}
    </div>
  );
}
