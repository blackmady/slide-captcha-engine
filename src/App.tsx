import React, { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  Bot,
  FileCode2,
  Lock,
  BarChart3,
  Fingerprint,
  Layers,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { SlideCaptchaWidget } from './components/SlideCaptchaWidget';
import { TrajectoryVisualizer } from './components/TrajectoryVisualizer';
import { BotSimulator } from './components/BotSimulator';
import { MockBusinessFlow } from './components/MockBusinessFlow';
import { ApiDocs } from './components/ApiDocs';
import { SecurityDashboard } from './components/SecurityDashboard';
import { TrajectoryPoint, VerifySuccessData, VerifyFailureData } from './types/captcha';

export default function App() {
  const [activeTab, setActiveTab] = useState<'demo' | 'bot' | 'business' | 'docs' | 'metrics'>('demo');
  const [currentTrajectory, setCurrentTrajectory] = useState<TrajectoryPoint[]>([]);
  const [currentX, setCurrentX] = useState<number>(0);
  const [lastResult, setLastResult] = useState<VerifySuccessData | VerifyFailureData | null>(null);
  const [botLoading, setBotLoading] = useState<boolean>(false);

  const handleTrajectoryChange = React.useCallback(
    (points: TrajectoryPoint[], x: number, result?: VerifySuccessData | VerifyFailureData | null) => {
      setCurrentTrajectory(points);
      setCurrentX(x);
      if (result !== undefined) {
        setLastResult(result);
      }
    },
    []
  );

  const handleSuccess = React.useCallback((_ticket: string, data: VerifySuccessData) => {
    setLastResult(data);
  }, []);

  const handleFail = React.useCallback((_err: string, data: VerifyFailureData) => {
    setLastResult(data);
  }, []);

  // Handle bot simulation submission
  const handleRunBotSimulation = async (
    simulatedPoints: TrajectoryPoint[],
    simulatedSliderX: number,
    botName: string
  ) => {
    setBotLoading(true);
    setCurrentTrajectory(simulatedPoints);
    setCurrentX(simulatedSliderX);

    try {
      // First get a fresh challenge token to test against
      const challengeRes = await fetch('/api/v1/captcha/generate');
      const challengeJson = await challengeRes.json();
      if (!challengeJson.success || !challengeJson.data) {
        throw new Error('获取挑战失败');
      }

      const token = challengeJson.data.token;

      // Submit bot trajectory to verification engine
      const verifyRes = await fetch('/api/v1/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          sliderX: simulatedSliderX,
          trajectory: simulatedPoints,
        }),
      });

      const verifyJson = await verifyRes.json();
      setLastResult(verifyJson.data);
    } catch (err: any) {
      console.error('Bot simulation error:', err);
    } finally {
      setBotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Fingerprint className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-slate-100">
                  SlideCaptcha 行为验证码引擎
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Node.js SDK v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                极验级滑动拼图 · 生物轨迹动力学识别 · 服务端二次核销 · 零编译高可用
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center space-x-1 overflow-x-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'demo'
                  ? 'bg-emerald-600 text-white font-medium shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>实时体验与遥测</span>
            </button>

            <button
              onClick={() => setActiveTab('bot')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'bot'
                  ? 'bg-emerald-600 text-white font-medium shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>黑客与脚本实验室</span>
            </button>

            <button
              onClick={() => setActiveTab('business')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'business'
                  ? 'bg-emerald-600 text-white font-medium shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>业务接入实战</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'docs'
                  ? 'bg-emerald-600 text-white font-medium shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>API 文档与 SDK</span>
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'metrics'
                  ? 'bg-emerald-600 text-white font-medium shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>风控大盘</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tab 1: Live Demo & Telemetry */}
        {activeTab === 'demo' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Captcha Widget Container */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="w-full mb-3 flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-semibold text-slate-300">交互组件预览区</span>
                  <span className="text-[11px] font-mono text-emerald-400">TOUCH & MOUSE READY</span>
                </div>
                <SlideCaptchaWidget
                  onTrajectoryChange={handleTrajectoryChange}
                  onSuccess={handleSuccess}
                  onFail={handleFail}
                />

                <div className="mt-4 p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-400 w-full max-w-[352px]">
                  <div className="font-semibold text-slate-300 mb-1 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>真机手势生物特征评定规则:</span>
                  </div>
                  <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-400">
                    <li><strong className="text-slate-300">位移准确度：</strong>最终停靠需落在缺口允许公差 (±4px) 范围内。</li>
                    <li><strong className="text-slate-300">自然生理抖动：</strong>人类手部肌肉在拖拽中必然存在微小 Y 轴极差及颤动熵。</li>
                    <li><strong className="text-slate-300">菲茨减速律：</strong>接近缺口时人类会减速观察微调，匀速或突然刹停会被判定为脚本。</li>
                  </ul>
                </div>
              </div>

              {/* Real-time Trajectory Telemetry */}
              <div className="lg:col-span-7">
                <TrajectoryVisualizer
                  trajectory={currentTrajectory}
                  currentX={currentX}
                  result={lastResult}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Bot Penetration & Script Defense Lab */}
        {activeTab === 'bot' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <BotSimulator
                  onSimulateRun={handleRunBotSimulation}
                  isLoading={botLoading}
                />
              </div>

              <div className="lg:col-span-5">
                <div className="mb-3 text-xs text-slate-400 font-semibold">
                  对抗样本回放与判定结果:
                </div>
                <TrajectoryVisualizer
                  trajectory={currentTrajectory}
                  currentX={currentX}
                  result={lastResult}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Mock Business Flow */}
        {activeTab === 'business' && <MockBusinessFlow />}

        {/* Tab 4: API Docs & SDK */}
        {activeTab === 'docs' && <ApiDocs />}

        {/* Tab 5: Security Metrics & Telemetry */}
        {activeTab === 'metrics' && <SecurityDashboard />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SlideCaptcha Security System · 企业级滑动拼图人机行为验证解决方案</span>
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px] text-slate-400">
            <span>Node.js v20+</span>
            <span>·</span>
            <span>RESTful Protocol</span>
            <span>·</span>
            <span>Zero Native C++ Deps</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
