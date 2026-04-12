import React from 'react';

export function SkeletonLine({ width = '100%', height = 14 }: { width?: string | number; height?: number }): React.JSX.Element {
  return <div className="skeleton-line" style={{ width, height }} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }): React.JSX.Element {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }, (_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <div className="skeleton-line" key={c} style={{ height: 14, flex: c === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard(): React.JSX.Element {
  return (
    <div className="skeleton-card">
      <SkeletonLine width="60%" height={16} />
      <SkeletonLine width="40%" height={24} />
    </div>
  );
}
