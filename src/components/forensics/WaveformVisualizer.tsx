'use client';

import React, { useState, useEffect } from 'react';

interface WaveformVisualizerProps {
  duration?: number;
  similarity?: number;
  anomalyDetected?: boolean;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  duration = 32,
  similarity = 94.1,
  anomalyDetected = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Bars distribution: 30 bars representing frequency energy
  const bars = [
    { height: 48, type: 'normal' },
    { height: 64, type: 'normal' },
    { height: 80, type: 'primary' },
    { height: 96, type: 'primary' },
    { height: 112, type: 'primary' },
    { height: 96, type: 'primary' },
    { height: 64, type: 'primary' },
    { height: 40, type: 'normal' },
    { height: 48, type: 'normal' },
    { height: 80, type: 'primary' },
    { height: 112, type: 'primary' },
    { height: 128, type: 'primary' },
    { height: 96, type: 'primary' },
    { height: 48, type: 'normal' },
    { height: 72, type: 'secondary' },
    { height: 96, type: 'secondary' },
    { height: 112, type: 'secondary' },
    { height: 96, type: 'secondary' },
    { height: 80, type: 'secondary' },
    { height: 56, type: 'anomaly' },
    { height: 128, type: 'anomaly' },
    { height: 128, type: 'anomaly' },
    { height: 88, type: 'anomaly' },
    { height: 32, type: 'anomaly' },
    { height: 48, type: 'normal' },
    { height: 64, type: 'primary' },
    { height: 96, type: 'primary' },
    { height: 72, type: 'primary' },
    { height: 48, type: 'normal' },
    { height: 32, type: 'normal' },
  ];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-surface-container-lowest rounded-lg p-space-md relative overflow-hidden flex flex-col gap-space-sm border border-outline-variant/20">
      {/* Top Bar with Audio Metadata & Anomaly Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2 font-code-sm text-code-sm text-on-surface-variant">
        <div className="flex items-center gap-space-md">
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Pause' : 'Play Sample'}</span>
          </button>
          <span className="flex items-center gap-1 text-primary">
            <span className="material-symbols-outlined text-sm">graphic_eq</span>
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </span>
        </div>

        {anomalyDetected && (
          <div className="flex items-center gap-space-xs px-space-xs py-0.5 rounded bg-error-container text-on-error-container font-label-sm uppercase font-bold tracking-wider">
            <span className="material-symbols-outlined text-xs animate-pulse">error</span>
            <span>Audio Glitch: Synthetic Pattern Detected (00:20-00:24)</span>
          </div>
        )}
      </div>

      {/* Waveform Bars Container */}
      <div className="relative w-full h-32 flex items-end justify-between gap-0.5 select-none py-2 px-1 bg-surface-container/30 rounded">
        {bars.map((bar, idx) => {
          const isCurrent = (currentTime / duration) * bars.length >= idx;
          let colorClass = 'bg-surface-container-high';

          if (bar.type === 'primary') {
            colorClass = isCurrent ? 'bg-primary' : 'bg-primary/50';
          } else if (bar.type === 'secondary') {
            colorClass = isCurrent ? 'bg-secondary' : 'bg-secondary/60';
          } else if (bar.type === 'anomaly') {
            colorClass = 'bg-error animate-pulse';
          }

          return (
            <div
              key={idx}
              className={`w-1.5 rounded-t-sm transition-all duration-200 ${colorClass}`}
              style={{ height: `${(bar.height / 128) * 100}%` }}
              title={`Frequency Bucket ${idx + 1}`}
            />
          );
        })}

        {/* Audio Scrubber Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg transition-all duration-300 pointer-events-none"
          style={{
            left: `${(currentTime / duration) * 100}%`,
          }}
        />
      </div>

      {/* Sub-label Spectrogram Details */}
      <div className="flex items-center justify-between text-[11px] font-code-sm text-on-surface-variant pt-1 border-t border-outline-variant/10">
        <span>Model: HiFi-GAN Vocoder (Inference rate 44.1kHz)</span>
        <span className="text-secondary font-semibold">Similarity: {similarity}% (Executive Match)</span>
      </div>
    </div>
  );
};
