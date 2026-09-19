import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, BarChart3, RefreshCw, Zap, Lock, AlertTriangle, Fingerprint } from 'lucide-react';
import { SecurityMetrics } from '../types/captcha';

export const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/captcha/metrics');
      const data = await res.json();
      if (data.success && data.data) {
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalAttempts = metrics ? metrics.totalVerificationsAttempted : 0;
  const passRate = totalAttempts > 0 ? Math.round((metrics!.successfulVerifications / totalAttempts) * 100) : 100;
  const blockRate = totalAttempts > 0 ? 100 - passRate : 0;

  return (
    <div id="security-dashboard-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="font-semibold text-slate-100 text-base flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>风控遥测与系统可用性大盘 (Security Metrics & Telemetry)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            实时汇总验证码下发量、人机行为判别拦截量、重放攻击阻断数与各维度风控诊断指标。
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs flex items-center space-x-1 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新大盘</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>总下发挑战数</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {metrics?.totalChallengesGenerated ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">SVG 纯矢量引擎动态生成</div>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>人类通过率</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {passRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            成功通过: {metrics?.successfulVerifications ?? 0} 次
          </div>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>自动化脚本拦截</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {metrics?.botDetections ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            重放攻击阻断: {metrics?.replayAttemptsBlocked ?? 0} 次
          </div>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
            <span>平均生理可信分</span>
            <Fingerprint className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400">
            {metrics?.averageScore ?? 85} / 100
          </div>
          <div className="text-[10px] text-slate-400 mt-1">二次核销完成: {metrics?.secondaryTicketsValidated ?? 0}</div>
        </div>
      </div>

      {/* Bot Reasons Breakdown */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-6">
        <h4 className="text-xs font-semibold text-slate-200 mb-3 flex items-center space-x-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>黑产作弊特征分布统计 (Top Blocked Vectors)</span>
        </h4>
        {metrics && Object.keys(metrics.botReasonsBreakdown).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(metrics.botReasonsBreakdown).map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between text-xs p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-rose-300 font-mono text-[11px] truncate max-w-[80%]">{reason}</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold font-mono">
                  {count} 次
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-3 text-center">
            暂无拦截记录。可前往“自动化攻击实验室”点击执行模拟脚本生成对抗数据。
          </div>
        )}
      </div>

      {/* Security Principles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <div className="font-semibold text-slate-300 mb-1 flex items-center space-x-1">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>坐标绝不出域</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            targetX 目标坐标仅存在于服务端内存及密文中，网络响应绝不暴露真实缺口 X 坐标，黑产无法抓包获取。
          </p>
        </div>

        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <div className="font-semibold text-slate-300 mb-1 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>用后即焚防重放</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            所有 Challenge Token 和 Ticket 具备一次性单次消费特性（Burn on verify），相同请求无法重放复用。
          </p>
        </div>

        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
          <div className="font-semibold text-slate-300 mb-1 flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>容器免依赖高可用</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            纯 Node.js 标准库实现，无需 Python、C++ 构建工具链，无环境水土不服，微秒级生成，适合微服务水平拓展。
          </p>
        </div>
      </div>
    </div>
  );
};
