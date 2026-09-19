import React, { useMemo } from 'react';
import { TrajectoryPoint, VerifySuccessData, VerifyFailureData } from '../types/captcha';
import { Activity, ShieldAlert, ShieldCheck, Zap, BarChart2, Compass } from 'lucide-react';

interface TrajectoryVisualizerProps {
  trajectory: TrajectoryPoint[];
  currentX: number;
  result?: VerifySuccessData | VerifyFailureData | null;
}

export const TrajectoryVisualizer: React.FC<TrajectoryVisualizerProps> = ({
  trajectory,
  result,
}) => {
  // Compute chart statistics
  const stats = useMemo(() => {
    if (!trajectory || trajectory.length < 2) {
      return {
        duration: 0,
        points: trajectory?.length || 0,
        speeds: [],
        maxSpeed: 0,
        yRange: { min: 0, max: 0 },
        xRange: { min: 0, max: 0 },
      };
    }

    const duration = trajectory[trajectory.length - 1].t - trajectory[0].t;
    const speeds: { t: number; v: number }[] = [];
    let maxSpeed = 0;
    let minY = Infinity, maxY = -Infinity;
    let minX = 0, maxX = 0;

    for (let i = 1; i < trajectory.length; i++) {
      const dt = trajectory[i].t - trajectory[i - 1].t;
      const dx = trajectory[i].x - trajectory[i - 1].x;
      const dy = trajectory[i].y - trajectory[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const v = dt > 0 ? dist / dt : 0;

      speeds.push({ t: trajectory[i].t, v });
      if (v > maxSpeed) maxSpeed = v;

      if (trajectory[i].y < minY) minY = trajectory[i].y;
      if (trajectory[i].y > maxY) maxY = trajectory[i].y;
      if (trajectory[i].x > maxX) maxX = trajectory[i].x;
    }

    return {
      duration,
      points: trajectory.length,
      speeds,
      maxSpeed,
      yRange: { min: Math.min(minY, -5), max: Math.max(maxY, 5) },
      xRange: { min: minX, max: Math.max(maxX, 100) },
    };
  }, [trajectory]);

  const metrics = result?.metrics;

  return (
    <div id="trajectory-visualizer-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm">生物行为轨迹实时遥测 (Biometric Telemetry)</h3>
        </div>
        {result && (
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 ${
                result.isHuman
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
            >
              {result.isHuman ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              <span>{result.isHuman ? '判定为人类' : '拦截可疑机器人/脚本'}</span>
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              评分: <strong className={result.isHuman ? 'text-emerald-400' : 'text-rose-400'}>{result.score}</strong>/100
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trajectory 2D Path Canvas/SVG */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span className="flex items-center space-x-1 font-medium">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>2D 空间位移 (X-Y 微颤轨迹)</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Y轴极差: {(stats.yRange.max - stats.yRange.min).toFixed(1)}px
            </span>
          </div>

          <div className="h-32 w-full bg-slate-900/60 rounded-lg relative overflow-hidden border border-slate-800/50 flex items-center">
            {trajectory.length > 1 ? (
              <svg className="w-full h-full" viewBox="0 -25 300 50" preserveAspectRatio="none">
                {/* Zero baseline */}
                <line x1="0" y1="0" x2="300" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
                {/* Path line */}
                <path
                  d={trajectory
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.min(290, (p.x / 260) * 280 + 10)} ${p.y * 1.5}`)
                    .join(' ')}
                  fill="none"
                  stroke={result?.isHuman === false ? '#f43f5e' : '#10b981'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Points */}
                {trajectory.slice(0, 50).map((p, idx) => (
                  <circle
                    key={idx}
                    cx={Math.min(290, (p.x / 260) * 280 + 10)}
                    cy={p.y * 1.5}
                    r="1.8"
                    fill={idx === 0 ? '#38bdf8' : idx === trajectory.length - 1 ? '#f59e0b' : '#34d399'}
                  />
                ))}
              </svg>
            ) : (
              <div className="w-full text-center text-xs text-slate-400">拖动滑块时将实时绘制运动轨迹</div>
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 font-mono">
            <span>起点 (X:0, Y:0)</span>
            <span>终点 (X:{Math.round(trajectory[trajectory.length - 1]?.x || 0)}px)</span>
          </div>
        </div>

        {/* Velocity Curve Chart */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span className="flex items-center space-x-1 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>速度与加速度曲线 (Fitts's Law 检验)</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              峰值: {stats.maxSpeed.toFixed(2)} px/ms
            </span>
          </div>

          <div className="h-32 w-full bg-slate-900/60 rounded-lg relative overflow-hidden border border-slate-800/50 flex items-center">
            {stats.speeds.length > 2 ? (
              <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="20" x2="300" y2="20" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="40" x2="300" y2="40" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="60" x2="300" y2="60" stroke="#1e293b" strokeWidth="1" />
                {/* Speed curve */}
                <path
                  d={stats.speeds
                    .map((s, idx) => {
                      const x = (idx / (stats.speeds.length - 1)) * 280 + 10;
                      const y = 75 - (stats.maxSpeed > 0 ? (s.v / stats.maxSpeed) * 65 : 0);
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <div className="w-full text-center text-xs text-slate-400">拖动后呈现瞬时速度与加速度钟形分布</div>
            )}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 font-mono">
            <span>开始加速 (0ms)</span>
            <span>减速对齐 ({stats.duration}ms)</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">滑动耗时</div>
          <div className="text-sm font-semibold font-mono text-slate-100">
            {metrics ? `${metrics.durationMs} ms` : `${stats.duration} ms`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">人类正常: 300~5000ms</div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">Y轴微颤标准差</div>
          <div className="text-sm font-semibold font-mono text-emerald-400">
            {metrics ? `${metrics.yStdDev} px` : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">若=0判定为水平脚本</div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">轨迹采样点数</div>
          <div className="text-sm font-semibold font-mono text-blue-400">
            {metrics ? `${metrics.pointCount} 点` : `${stats.points} 点`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">高密度连续生物手势</div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400">抖动信息熵</div>
          <div className="text-sm font-semibold font-mono text-purple-400">
            {metrics ? `${metrics.tremorEntropy}` : '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">随机生物噪点指纹</div>
        </div>
      </div>

      {/* Result Reasons / Risk Flags */}
      {result?.reasons && result.reasons.length > 0 && (
        <div className="mt-3.5 p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs">
          <div className="font-medium text-slate-300 mb-1 flex items-center space-x-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
            <span>服务端风控诊断原因:</span>
          </div>
          <ul className="space-y-1 pl-4 list-disc text-slate-400">
            {result.reasons.map((r, idx) => (
              <li key={idx} className={result.isHuman ? 'text-emerald-300/90' : 'text-rose-300/90'}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
