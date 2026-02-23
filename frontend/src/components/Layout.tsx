import { Link, Outlet, useMatches } from 'react-router-dom';

interface CrumbHandle {
  crumb: (params: Record<string, string>) => { label: string; to: string };
}

export function Layout() {
  const matches = useMatches();

  const crumbs = matches
    .filter((m) => (m.handle as CrumbHandle)?.crumb)
    .map((m) => {
      const handle = m.handle as CrumbHandle;
      return handle.crumb(m.params as Record<string, string>);
    });

  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <Link to="/" className="nav-title">
            GA4GH Schema Registry
          </Link>
          <a
            href="https://ga4gh.github.io/schema-registry/"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
          >
            Spec
          </a>
        </nav>
      </header>

      {crumbs.length > 0 && (
        <nav className="breadcrumbs">
          <Link to="/">Home</Link>
          {crumbs.map((c, i) => (
            <span key={i}>
              <span className="breadcrumb-sep"> / </span>
              {i === crumbs.length - 1 ? (
                <span className="breadcrumb-current">{c.label}</span>
              ) : (
                <Link to={c.to}>{c.label}</Link>
              )}
            </span>
          ))}
        </nav>
      )}

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <a
          href="https://github.com/ga4gh/schema-registry-site"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span> | </span>
        <a
          href="https://ga4gh.github.io/schema-registry/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Schema Registry Spec
        </a>
      </footer>
    </div>
  );
}
