export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {detail ? <span className="muted">{detail}</span> : null}
    </div>
  );
}
