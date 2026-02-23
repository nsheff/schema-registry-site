interface ApiUrlRow {
  label: string;
  url: string;
}

export function ApiUrlBox({ rows }: { rows: ApiUrlRow[] }) {
  return (
    <div className="api-url-box">
      {rows.map((row) => (
        <div className="api-url-row" key={row.label}>
          <a href={row.url} target="_blank" rel="noopener noreferrer" className="api-url-jump" title="Open in new tab">&#8599;</a>
          <span className="api-url-label">{row.label}</span>
          <code className="api-url-value">{row.url}</code>
        </div>
      ))}
    </div>
  );
}
