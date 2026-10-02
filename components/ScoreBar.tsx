export function ScoreBar({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="spread">
        <strong>{label}</strong>
        <span className="muted">
          {score}/{maxScore}
        </span>
      </div>
      <div className="score-bar">
        <span style={{ width: `${Math.round((score / maxScore) * 100)}%` }} />
      </div>
    </div>
  );
}
