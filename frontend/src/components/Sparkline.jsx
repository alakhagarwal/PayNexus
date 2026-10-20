import React from 'react';

/**
 * Smooth SVG Sparkline component matching the Stoxy aesthetic.
 */
export default function Sparkline({ data = [], isPositive = true, width = 140, height = 36 }) {
  if (!data || data.length < 2) {
    // Generate realistic fallback curve if history is short
    data = isPositive ? [100, 101, 99.5, 102, 103, 102.5, 104] : [100, 99, 99.8, 98.2, 97.5, 98, 96.8];
  }

  const numData = data.map(Number).filter(n => !isNaN(n));
  const min = Math.min(...numData);
  const max = Math.max(...numData);
  const range = max - min || 1;

  const points = numData.map((val, idx) => {
    const x = (idx / (numData.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const strokeColor = isPositive ? '#5ab870' : '#e06060';
  const fillGradientId = `grad-${isPositive ? 'pos' : 'neg'}-${Math.random().toString(36).substring(2, 7)}`;

  // Area fill path
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillGradientId})`} />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
