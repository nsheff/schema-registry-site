const MATURITY_COLORS: Record<string, string> = {
  normative: '#059669',
  trial_use: '#2563eb',
  'trial use': '#2563eb',
  draft: '#d97706',
  deprecated: '#dc2626',
};

const STATUS_COLORS: Record<string, string> = {
  current: '#059669',
  deprecated: '#dc2626',
  latest: '#2563eb',
};

export function MaturityBadge({ level }: { level: string }) {
  const color = MATURITY_COLORS[level] || '#6b7280';
  const label = level.replace(/_/g, ' ');
  return (
    <span className="badge" style={{ backgroundColor: color }}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <span className="badge" style={{ backgroundColor: color }}>
      {status}
    </span>
  );
}
