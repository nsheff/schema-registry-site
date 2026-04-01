import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getLinkMLEnum, type LinkMLEnumRecord } from '../api';

export function EnumDetail() {
  const { namespace, schema, version, enumName } = useParams<{
    namespace: string;
    schema: string;
    version: string;
    enumName: string;
  }>();
  const [enumData, setEnumData] = useState<LinkMLEnumRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!namespace || !schema || !version || !enumName) return;
    setEnumData(null);
    setError('');
    getLinkMLEnum(namespace, schema, version, enumName)
      .then(setEnumData)
      .catch(() => setError(`Enum "${enumName}" not found`));
  }, [namespace, schema, version, enumName]);

  if (error) return <div className="muted">{error}</div>;
  if (!enumData) return <div>Loading...</div>;

  return (
    <div>
      <div className="component-header">
        <h1>{enumData.name}</h1>
        <span className="badge" style={{ backgroundColor: '#7c3aed' }}>Enum</span>
      </div>

      {enumData.description && <p className="subtitle">{enumData.description}</p>}

      <div className="linkml-meta">
        <span>Source: <code>{enumData.source_file}.yaml</code></span>
        <span>{enumData.values.length} values</span>
      </div>

      <div className="linkml-section">
        <h3>Permissible Values</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Description</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {enumData.values.map((v) => (
              <tr key={v.name}>
                <td><code>{v.name}</code></td>
                <td className="muted">{v.description}</td>
                <td>{v.meaning && <code>{v.meaning}</code>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
