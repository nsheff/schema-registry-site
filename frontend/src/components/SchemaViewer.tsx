import { type ReactNode } from 'react';
import { RefLink } from './RefLink';

function renderValue(value: unknown, depth: number): ReactNode {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === 'boolean') return <span className="json-bool">{String(value)}</span>;
  if (typeof value === 'number') return <span className="json-num">{value}</span>;

  if (typeof value === 'string') {
    // Render $ref-like values as links
    if (value.startsWith('/ga4gh/schema/')) {
      return (
        <span>
          "<RefLink uri={value} />"
        </span>
      );
    }
    return <span className="json-str">"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>;
    return (
      <span>
        {'[\n'}
        {value.map((item, i) => (
          <span key={i}>
            {'  '.repeat(depth + 1)}
            {renderValue(item, depth + 1)}
            {i < value.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {'  '.repeat(depth)}]
      </span>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <span>
        {'{\n'}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {'  '.repeat(depth + 1)}
            <span className="json-key">"{k}"</span>: {renderValue(v, depth + 1)}
            {i < entries.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {'  '.repeat(depth)}{'}'}
      </span>
    );
  }

  return <span>{String(value)}</span>;
}

export function SchemaViewer({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="schema-viewer">
      <code>{renderValue(data, 0)}</code>
    </pre>
  );
}
