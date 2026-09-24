'use client';

import React, { useEffect, useState } from 'react';

interface RiskGaugeProps {
  score: number; // 0 - 100
  size?: number;
  label?: string;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score = 91,
  size = 176,
  label = 'HIGH THREAT',
}) => {
  const [currentScore, setCurrentScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScore(score);
    }, 150);
    return () => clearTimeout(timer);
  }, [score]);

  // Circumference calculation for radius = 68
  const radius = 68;
  const circumference = 2 * Math.PI * radius; // ~427.26
  const strokeDashoffset = circumference - (currentScore / 100) * circumference;

  let strokeColor = '#ffb4ab'; // error red default
  let badgeBg = 'bg-error-container text-on-error-container';
  if (score < 40) {
    strokeColor = '#4edea3';
    badgeBg = 'bg-tertiary-container text-on-tertiary-container';
  } else if (score < 75) {
    strokeColor = '#d0bcff';
    badgeBg = 'bg-secondary-container text-on-secondary-container';
  }

  return (
    <div className="flex flex-col items-center justify-center py-space-sm relative select-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          {/* Background circle */}
          <circle
            className="text-surface-container-high fill-none"
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
          />
          {/* Animated active score circle */}
          <circle
            className="fill-none transition-all duration-1000 ease-out"
            cx="80"
            cy="80"
            r={radius}
            stroke={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            strokeWidth="12"
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className="font-display-lg text-display-lg font-extrabold tracking-tight leading-none"
            style={{ color: strokeColor }}
          >
            {currentScore}
          </span>
          <span className="font-code-sm text-code-sm text-outline uppercase tracking-wider font-semibold mt-1">
            OUT OF 100
          </span>
          <span className={`mt-1 px-space-xs py-0.5 rounded ${badgeBg} font-label-sm text-[10px] font-bold tracking-wider uppercase`}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};
