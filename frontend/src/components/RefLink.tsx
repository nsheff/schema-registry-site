import { Link } from 'react-router-dom';

const REF_PATTERN = /^\/ga4gh\/schema\/([a-z-]+)\/([^/]+)\/json\/(.+)$/;

export function RefLink({ uri }: { uri: string }) {
  const match = uri.match(REF_PATTERN);
  if (!match) {
    return <code className="ref-text">{uri}</code>;
  }

  const [, schema, version, component] = match;
  const to = `/ga4gh/${schema}/${version}/${component}`;

  return (
    <Link to={to} className="ref-link">
      {component}
    </Link>
  );
}
