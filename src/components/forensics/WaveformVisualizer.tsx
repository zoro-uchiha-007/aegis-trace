'use client';

import React, { useState, useEffect, useRef } from 'react';

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
  const [activeTab, setActiveTab] = useState<'pitch' | 'waveform'>('pitch');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTonePlaying, setIsTonePlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Web Audio Context for pitch tone synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // 30 Frequency bars for waveform view
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

  // Pitch Contour Points (Fundamental Frequency F0 in Hz over 16 time buckets)
  // Note: Synthetic voices show flat, robotic steps, while human shows micro-tremors and natural inflection
  const pitchContourData = [
    { time: '0s', sampleF0: 128, humanF0: 135, robotic: false },
    { time: '2s', sampleF0: 129, humanF0: 142, robotic: false },
    { time: '4s', sampleF0: 128, humanF0: 125, robotic: false },
    { time: '6s', sampleF0: 127, humanF0: 138, robotic: false },
    { time: '8s', sampleF0: 128, humanF0: 152, robotic: false },
    { time: '10s', sampleF0: 129, humanF0: 146, robotic: false },
    { time: '12s', sampleF0: 128, humanF0: 130, robotic: false },
    { time: '14s', sampleF0: 128, humanF0: 122, robotic: false },
    { time: '16s', sampleF0: 128, humanF0: 139, robotic: false },
    { time: '18s', sampleF0: 127, humanF0: 145, robotic: false },
    // Glitch anomaly window (unnatural flat plateau & robotic phase snap)
    { time: '20s', sampleF0: 126, humanF0: 158, robotic: true },
    { time: '22s', sampleF0: 126, humanF0: 150, robotic: true },
    { time: '24s', sampleF0: 126, humanF0: 134, robotic: true },
    { time: '26s', sampleF0: 128, humanF0: 128, robotic: false },
    { time: '28s', sampleF0: 129, humanF0: 136, robotic: false },
    { time: '30s', sampleF0: 127, humanF0: 120, robotic: false },
  ];

  useEffect(() => {
    let interval: any;
    if (isPlaying || isTonePlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            stopAllAudio();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isTonePlaying, duration]);

  const stopAllAudio = () => {
    setIsPlaying(false);
    setIsTonePlaying(false);
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch {}
      oscillatorRef.current = null;
    }
  };

  const toggleVoicePlay = () => {
    if (isTonePlaying) stopAllAudio();
    setIsPlaying(!isPlaying);
  };

  const togglePitchTone = () => {
    if (isPlaying) stopAllAudio();

    if (isTonePlaying) {
      stopAllAudio();
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = audioCtxRef.current || new AudioCtx();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth'; // rich vocal tract harmonic tone
      osc.frequency.setValueAtTime(128, ctx.currentTime); // Fundamental pitch F0: 128 Hz

      // Slight frequency modulation to mimic the robotic monotonic tone
      osc.frequency.linearRampToValueAtTime(129, ctx.currentTime + 8);
      osc.frequency.linearRampToValueAtTime(126, ctx.currentTime + 20); // unnatural flat step
      osc.frequency.linearRampToValueAtTime(126, ctx.currentTime + 24);
      osc.frequency.linearRampToValueAtTime(128, ctx.currentTime + 30);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      setIsTonePlaying(true);
    } catch (e) {
      console.warn('Web Audio error:', e);
      setIsTonePlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      stopAllAudio();
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md relative overflow-hidden flex flex-col gap-space-sm border border-outline-variant/20 shadow-sm">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/15 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/20">
            <button
              onClick={() => setActiveTab('pitch')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'pitch'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xs">graphic_eq</span>
              <span>AI Voice Detection via Pitch (F0)</span>
            </button>
            <button
              onClick={() => setActiveTab('waveform')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'waveform'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xs">waves</span>
              <span>Raw Acoustic Waveform</span>
            </button>
          </div>
        </div>

        {/* Audio Player Controls */}
        <div className="flex items-center gap-2 font-code-sm text-xs">
          <button
            onClick={toggleVoicePlay}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all shadow-sm ${
              isPlaying
                ? 'bg-error text-on-error'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Pause Voice' : 'Play Voice Recording'}</span>
          </button>

          <button
            onClick={togglePitchTone}
            title="Synthesize and play the extracted fundamental pitch tone (128Hz) to hear unnatural robotic monotonicity"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all border ${
              isTonePlaying
                ? 'bg-secondary text-on-secondary border-secondary animate-pulse'
                : 'bg-surface-container-low text-secondary border-secondary/30 hover:bg-secondary/10'
            }`}
          >
            <span className="material-symbols-outlined text-sm">volume_up</span>
            <span>{isTonePlaying ? 'Stop Pitch Tone' : 'Play Isolated F0 Pitch Tone'}</span>
          </button>

          <span className="font-mono text-primary font-bold ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {activeTab === 'pitch' ? (
        /* ── PITCH CONTOUR & ACOUSTIC HARMONICS FORENSIC CANVAS ── */
        <div className="flex flex-col gap-3">
          {/* Pitch Anomaly Alert Banner */}
          <div className="p-2.5 rounded-lg bg-error-container/20 border border-error/30 flex items-center justify-between text-xs font-code-sm">
            <div className="flex items-center gap-2 text-error font-bold">
              <span className="material-symbols-outlined text-base animate-pulse">record_voice_over</span>
              <span>PITCH ANOMALY: Abnormal Pitch Flatness (Monotonicity σ = 5.4 Hz) &amp; Vocoder Artifacts</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-error text-on-error font-mono text-[10px] font-bold">
              HiFi-GAN V2 Match (96.8%)
            </span>
          </div>

          {/* Dynamic Pitch Contour Graph (SVG Canvas) */}
          <div className="relative w-full h-44 bg-surface-container/40 rounded-lg p-3 border border-outline-variant/15 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-code-sm text-on-surface-variant z-10">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-error rounded-full" />
                  <strong className="text-error">Sample Voice Pitch (F0)</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-tertiary/70 rounded-full border-dashed" />
                  <span className="text-on-surface-variant">Natural Human Vocal Baseline</span>
                </span>
              </div>
              <span className="text-outline font-mono">100 Hz - 180 Hz Pitch Range</span>
            </div>

            {/* SVG Pitch Chart */}
            <svg className="w-full h-28" viewBox="0 0 600 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pitchAnomalyGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffb4ab" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffb4ab" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines */}
              <line x1="0" y1="20" x2="600" y2="20" stroke="#48484a" strokeDasharray="3 3" opacity="0.3" />
              <line x1="0" y1="50" x2="600" y2="50" stroke="#48484a" strokeDasharray="3 3" opacity="0.3" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="#48484a" strokeDasharray="3 3" opacity="0.3" />

              {/* Shaded Anomaly Window (00:20 - 00:24) */}
              <rect x="370" y="0" width="80" height="100" fill="url(#pitchAnomalyGlow)" opacity="0.8" />
              <text x="375" y="15" fill="#ffb4ab" fontSize="8" fontFamily="monospace" fontWeight="bold">
                GLITCH [00:20-00:24]
              </text>

              {/* Human Natural Baseline Curve (Dynamic pitch variations) */}
              <path
                d="M 0 60 Q 50 30, 100 55 T 200 40 T 300 65 T 370 25 T 450 70 T 550 50 T 600 75"
                fill="none"
                stroke="#66bb6a"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.6"
              />

              {/* Analyzed Sample Pitch Contour (Unnatural monotonic flat line with sudden step) */}
              <path
                d="M 0 52 L 80 50 L 160 52 L 240 51 L 320 52 L 370 55 L 450 55 L 500 51 L 560 50 L 600 52"
                fill="none"
                stroke="#ffb4ab"
                strokeWidth="2.5"
              />

              {/* Pitch Data Points */}
              {[
                { cx: 80, cy: 50 },
                { cx: 200, cy: 51 },
                { cx: 370, cy: 55, alert: true },
                { cx: 410, cy: 55, alert: true },
                { cx: 450, cy: 55, alert: true },
                { cx: 560, cy: 50 },
              ].map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.cx}
                  cy={pt.cy}
                  r={pt.alert ? 4 : 2.5}
                  fill={pt.alert ? '#ff5449' : '#ffb4ab'}
                  stroke="#1c1b1f"
                  strokeWidth="1"
                />
              ))}

              {/* Audio Playhead Scrubber */}
              <line
                x1={`${(currentTime / duration) * 600}`}
                y1="0"
                x2={`${(currentTime / duration) * 600}`}
                y2="100"
                stroke="#4cd7f6"
                strokeWidth="2"
              />
            </svg>

            {/* Bottom Timeline Axis */}
            <div className="flex items-center justify-between text-[10px] font-mono text-outline pt-1 border-t border-outline-variant/10">
              <span>00:00 (Start)</span>
              <span>00:08</span>
              <span className="text-error font-bold">00:20 (Vocoder Glitch)</span>
              <span>00:26</span>
              <span>00:32 (End)</span>
            </div>
          </div>

          {/* 4 Forensic Pitch Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-surface-container flex flex-col justify-between border border-outline-variant/15">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant font-code-sm">
                Fundamental Pitch (F0)
              </span>
              <div className="text-base font-bold font-mono text-on-surface mt-1">
                128.4 Hz
              </div>
              <span className="text-[10px] text-secondary font-mono">Male Vocal Pitch Band</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container flex flex-col justify-between border border-error/30 bg-error/5">
              <span className="text-[10px] uppercase font-bold text-error font-code-sm">
                Pitch Variance (σ)
              </span>
              <div className="text-base font-bold font-mono text-error mt-1">
                5.4 Hz
              </div>
              <span className="text-[10px] text-error font-bold font-mono">Abnormally Low (Monotonic)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container flex flex-col justify-between border border-error/30 bg-error/5">
              <span className="text-[10px] uppercase font-bold text-error font-code-sm">
                Pitch Jitter (Perturbation)
              </span>
              <div className="text-base font-bold font-mono text-error mt-1">
                0.14%
              </div>
              <span className="text-[10px] text-error font-mono">AI Threshold: &lt; 0.35% (Pass)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container flex flex-col justify-between border border-outline-variant/15">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant font-code-sm">
                Pitch Shimmer (dB)
              </span>
              <div className="text-base font-bold font-mono text-secondary mt-1">
                0.19 dB
              </div>
              <span className="text-[10px] text-secondary font-mono">Synthetic Vocal Envelope</span>
            </div>
          </div>

          {/* Formant Frequencies & Harmonics Detail */}
          <div className="p-2 rounded-lg bg-surface-container-high/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-code-sm border border-outline-variant/15">
            <span className="text-on-surface-variant">
              Formant Harmonics: <strong className="text-primary font-mono">F1=520Hz · F2=1480Hz · F3=2650Hz</strong>
            </span>
            <span className="text-on-surface-variant">
              Harmonics-to-Noise Ratio (HNR): <strong className="text-tertiary font-mono">29.4 dB (Neural Clean)</strong>
            </span>
            <span className="text-secondary font-bold">
              Similarity to Executive Voice: {similarity}%
            </span>
          </div>
        </div>
      ) : (
        /* ── RAW ACOUSTIC WAVEFORM VIEW ── */
        <div className="flex flex-col gap-2">
          {anomalyDetected && (
            <div className="flex items-center gap-space-xs px-2 py-1 rounded bg-error-container text-on-error-container font-label-sm uppercase font-bold tracking-wider text-xs">
              <span className="material-symbols-outlined text-xs animate-pulse">error</span>
              <span>Audio Glitch: Synthetic Pattern Detected (00:20-00:24)</span>
            </div>
          )}

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

          <div className="flex items-center justify-between text-[11px] font-code-sm text-on-surface-variant pt-1 border-t border-outline-variant/10">
            <span>Model: HiFi-GAN Vocoder (Inference rate 44.1kHz)</span>
            <span className="text-secondary font-semibold">Similarity: {similarity}% (Executive Match)</span>
          </div>
        </div>
      )}
    </div>
  );
};
