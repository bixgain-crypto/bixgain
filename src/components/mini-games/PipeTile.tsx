import { useState, useEffect, useRef } from 'react';
import type { PipeCell } from '@/lib/pipeGame/pipeTypes';

interface Props {
  cell: { pipe: PipeCell | null };
  filled: boolean;
  highlighted?: boolean;
  onClick: () => void;
  size: number;
}

export default function PipeTile({ cell, filled, highlighted, onClick, size }: Props) {
  const [displayRotation, setDisplayRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const prevRotRef = useRef(0);
  const totalRotRef = useRef(0);

  useEffect(() => {
    if (!cell.pipe) return;
    const target = cell.pipe.rotation * 90;
    const prev = prevRotRef.current % 360;
    const diff = ((target - prev) + 360) % 360;
    totalRotRef.current = totalRotRef.current + diff;
    prevRotRef.current = target;
    setDisplayRotation(totalRotRef.current);
    setIsSpinning(true);
    const t = setTimeout(() => setIsSpinning(false), 250);
    return () => clearTimeout(t);
  }, [cell.pipe?.rotation]);

  if (!cell.pipe) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-lg bg-slate-900/60"
      />
    );
  }

  const { pipe } = cell;
  const isFixed = pipe.isSource || pipe.isSink;
  const glowColor = filled ? '#22d3ee' : undefined;

  return (
    <div
      onClick={isFixed ? undefined : onClick}
      style={{
        width: size,
        height: size,
        cursor: isFixed ? 'default' : 'pointer',
        boxShadow: filled ? `0 0 12px 2px ${glowColor}44` : highlighted ? '0 0 8px 2px #a855f766' : undefined,
        transition: 'box-shadow 0.3s ease',
      }}
      className={`rounded-lg select-none relative overflow-hidden
        ${highlighted ? 'ring-2 ring-purple-400/60' : ''}
        ${filled ? 'ring-1 ring-cyan-400/50' : ''}
        ${!isFixed ? 'active:scale-90 transition-transform duration-100' : ''}
      `}
    >
      <PipeSVG
        type={pipe.type}
        rotation={displayRotation}
        filled={filled}
        isSource={pipe.isSource}
        isSink={pipe.isSink}
        isSpinning={isSpinning}
        size={size}
      />
    </div>
  );
}

function PipeSVG({ type, rotation, filled, isSource, isSink, isSpinning, size }: {
  type: string; rotation: number; filled: boolean;
  isSource?: boolean; isSink?: boolean; isSpinning?: boolean; size: number;
}) {
  const half = size / 2;
  const pipeW = Math.max(8, size * 0.22);
  const r = size;

  const waterColor = filled ? '#22d3ee' : '#1e293b';
  const borderColor = filled ? '#0891b2' : isSource ? '#8b5cf6' : isSink ? '#3b82f6' : '#475569';
  const bgGrad = isSource
    ? 'from-purple-900/90 to-violet-800/80'
    : isSink
    ? 'from-blue-900/90 to-sky-800/80'
    : filled
    ? 'from-cyan-950/90 to-slate-800/80'
    : 'from-slate-800/90 to-slate-700/80';

  return (
    <div
      className={`w-full h-full rounded-lg bg-gradient-to-br ${bgGrad} flex items-center justify-center border border-slate-600/40`}
      style={{ position: 'relative' }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning ? 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {type === 'straight' && (
          <>
            <rect x={half - pipeW / 2} y={0} width={pipeW} height={size} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2 + 2} y={0} width={pipeW - 4} height={size} rx={(pipeW - 4) / 2} fill={waterColor} />
          </>
        )}
        {type === 'elbow' && (
          <>
            <rect x={half - pipeW / 2} y={0} width={pipeW} height={half + pipeW / 2} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2} y={half - pipeW / 2} width={size - half + pipeW / 2} height={pipeW} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2 + 2} y={0} width={pipeW - 4} height={half + pipeW / 2} rx={(pipeW - 4) / 2} fill={waterColor} />
            <rect x={half - pipeW / 2} y={half - pipeW / 2 + 2} width={size - half + pipeW / 2} height={pipeW - 4} rx={(pipeW - 4) / 2} fill={waterColor} />
          </>
        )}
        {type === 'tee' && (
          <>
            <rect x={half - pipeW / 2} y={0} width={pipeW} height={size} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2} y={half - pipeW / 2} width={size - half + pipeW / 2} height={pipeW} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2 + 2} y={0} width={pipeW - 4} height={size} rx={(pipeW - 4) / 2} fill={waterColor} />
            <rect x={half - pipeW / 2} y={half - pipeW / 2 + 2} width={size - half + pipeW / 2} height={pipeW - 4} rx={(pipeW - 4) / 2} fill={waterColor} />
          </>
        )}
        {type === 'cross' && (
          <>
            <rect x={half - pipeW / 2} y={0} width={pipeW} height={size} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={0} y={half - pipeW / 2} width={size} height={pipeW} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2 + 2} y={0} width={pipeW - 4} height={size} rx={(pipeW - 4) / 2} fill={waterColor} />
            <rect x={0} y={half - pipeW / 2 + 2} width={size} height={pipeW - 4} rx={(pipeW - 4) / 2} fill={waterColor} />
          </>
        )}
        {type === 'dead-end' && (
          <>
            <rect x={half - pipeW / 2} y={0} width={pipeW} height={half + 2} rx={pipeW / 2} fill={borderColor} opacity={0.6} />
            <rect x={half - pipeW / 2 + 2} y={0} width={pipeW - 4} height={half + 2} rx={(pipeW - 4) / 2} fill={waterColor} />
            <circle cx={half} cy={half} r={pipeW / 2 - 1} fill={borderColor} opacity={0.8} />
          </>
        )}
        {(type === 'source' || type === 'sink') && (
          <>
            {type === 'source' && (
              <rect x={half - pipeW / 2 + 2} y={half - 2} width={pipeW - 4} height={half + 2} rx={(pipeW - 4) / 2} fill={waterColor} />
            )}
            {type === 'sink' && (
              <rect x={half - pipeW / 2 + 2} y={0} width={pipeW - 4} height={half + 2} rx={(pipeW - 4) / 2} fill={waterColor} />
            )}
          </>
        )}
      </svg>

      {type === 'source' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className={`rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold border-2 ${filled ? 'bg-cyan-500 border-cyan-300 text-slate-900' : 'bg-purple-700 border-purple-400 text-white'}`}>
            💧
          </div>
        </div>
      )}
      {type === 'sink' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className={`rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold border-2 ${filled ? 'bg-cyan-500 border-cyan-300 text-slate-900' : 'bg-blue-700 border-blue-400 text-white'}`}>
            🏁
          </div>
        </div>
      )}

      {filled && type !== 'source' && type !== 'sink' && (
        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)',
        }} />
      )}
    </div>
  );
}
