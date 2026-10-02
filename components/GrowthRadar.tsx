import type { CSSProperties } from "react";
import type { RadarDimension } from "@/lib/growth";

function polarPoint(index: number, total: number, radius: number, center: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius
  };
}

function pointsFor(dimensions: RadarDimension[], radius: number, center: number) {
  return dimensions
    .map((dimension, index) => {
      const point = polarPoint(index, dimensions.length, radius * Math.min(100, dimension.percent) / 100, center);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function GrowthRadar({ dimensions, compact = false }: { dimensions: RadarDimension[]; compact?: boolean }) {
  const center = 150;
  const maxRadius = 102;
  const hasData = dimensions.length >= 3;

  if (!hasData) {
    return (
      <div className="radar-empty">
        <strong>暂无成长画像</strong>
        <span>完成评分后，系统会根据六维评价自动生成雷达图。</span>
      </div>
    );
  }

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className={`growth-radar ${compact ? "compact" : ""}`}>
      <svg viewBox="0 0 300 300" role="img" aria-label="成长雷达图">
        {rings.map((ring) => (
          <polygon
            className="radar-ring"
            key={ring}
            points={dimensions.map((_, index) => {
              const point = polarPoint(index, dimensions.length, maxRadius * ring, center);
              return `${point.x},${point.y}`;
            }).join(" ")}
          />
        ))}
        {dimensions.map((dimension, index) => {
          const edge = polarPoint(index, dimensions.length, maxRadius, center);
          const label = polarPoint(index, dimensions.length, maxRadius + 24, center);
          return (
            <g key={dimension.name}>
              <line className="radar-axis" x1={center} y1={center} x2={edge.x} y2={edge.y} />
              <text className="radar-label" x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                {dimension.shortName}
              </text>
            </g>
          );
        })}
        <polygon className="radar-area" points={pointsFor(dimensions, maxRadius, center)} />
        <polyline className="radar-line" points={`${pointsFor(dimensions, maxRadius, center)} ${pointsFor(dimensions, maxRadius, center).split(" ")[0]}`} />
        {dimensions.map((dimension, index) => {
          const point = polarPoint(index, dimensions.length, maxRadius * Math.min(100, dimension.percent) / 100, center);
          return <circle className="radar-point" key={dimension.name} cx={point.x} cy={point.y} r="4" />;
        })}
      </svg>
      <div className="radar-progress-list">
        {dimensions.map((dimension, index) => (
          <div
            className="radar-progress-item"
            key={dimension.name}
            style={{ "--score": `${dimension.percent}%`, "--delay": `${index * 90}ms` } as CSSProperties}
          >
            <div className="radar-progress-head">
              <span>{dimension.shortName}</span>
              <strong>{dimension.percent}%</strong>
            </div>
            <div className="radar-progress-track" aria-label={`${dimension.shortName}${dimension.percent}%`}>
              <span />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
