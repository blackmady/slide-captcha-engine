import React, { useState } from 'react';
import { Bot, Play, ShieldAlert, Cpu, CheckCircle2, RotateCcw, Crosshair } from 'lucide-react';
import { TrajectoryPoint, VerifySuccessData, VerifyFailureData } from '../types/captcha';

interface BotSimulatorProps {
  onSimulateRun: (
    trajectory: TrajectoryPoint[],
    sliderX: number,
    botName: string
  ) => Promise<void>;
  isLoading: boolean;
}

export const BotSimulator: React.FC<BotSimulatorProps> = ({ onSimulateRun, isLoading }) => {
  const [selectedBot, setSelectedBot] = useState<string>('teleport');
  const [simulationLog, setSimulationLog] = useState<string | null>(null);

  const botProfiles = [
    {
      id: 'teleport',
      name: '极速瞬移脚本 (Teleport Bot)',
      desc: '直接从起点跳跃至目标位置，耗时 < 30ms，仅采样 2-3 个点',
      targetSimX: 160,
      attackVector: '利用 Selenium/Puppeteer 直接修改 style.left 或注入瞬移坐标',
      generateTrajectory: (targetX: number): TrajectoryPoint[] => {
        return [
          { x: 0, y: 0, t: 0 },
          { x: Math.round(targetX / 2), y: 0, t: 10 },
          { x: targetX, y: 0, t: 25 },
        ];
      },
    },
    {
      id: 'uniform',
      name: '恒定匀速直线脚本 (Linear Uniform Bot)',
      desc: '绝对匀速移动，Y轴完全无微颤 (dy ≡ 0)，无生理肌肉减速',
      targetSimX: 160,
      attackVector: '简单脚本循环步进 (setInterval x += 5)，机械平滑无随机性',
      generateTrajectory: (targetX: number): TrajectoryPoint[] => {
        const points: TrajectoryPoint[] = [];
        const step = 4;
        const totalSteps = Math.floor(targetX / step);
        const dt = 16; // 60fps
        for (let i = 0; i <= totalSteps; i++) {
          points.push({
            x: i * step,
            y: 0, // Zero Y deviation
            t: i * dt,
          });
        }
        return points;
      },
    },
    {
      id: 'bezier',
      name: '数学贝塞尔曲线脚本 (Bezier Function Bot)',
      desc: '使用平滑数学函数插值，但缺乏人类肌电信号特征 (熵值过低)',
      targetSimX: 160,
      attackVector: '高级黑产工具使用三阶贝塞尔曲线合成轨迹，试图绕过基础风控',
      generateTrajectory: (targetX: number): TrajectoryPoint[] => {
        const points: TrajectoryPoint[] = [];
        const totalPoints = 35;
        const totalTime = 650;
        for (let i = 0; i <= totalPoints; i++) {
          const t = i / totalPoints;
          // Cubic ease-out
          const easeOut = 1 - Math.pow(1 - t, 3);
          const x = easeOut * targetX;
          // Mathematical smooth sine without organic jitter
          const y = Math.sin(t * Math.PI) * 1.5;
          points.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            t: Math.round(t * totalTime),
          });
        }
        return points;
      },
    },
    {
      id: 'mismatch',
      name: '暴力盲猜/错位脚本 (Blind Guess Bot)',
      desc: '无法通过图形图像分割定位缺口，胡乱拖动至错误位置',
      targetSimX: 60, // Wrong distance
      attackVector: '无视觉识别能力的低成本脚本，碰撞式批量发送',
      generateTrajectory: (_targetX: number): TrajectoryPoint[] => {
        const points: TrajectoryPoint[] = [];
        for (let i = 0; i <= 20; i++) {
          points.push({
            x: i * 3,
            y: (Math.random() - 0.5) * 2,
            t: i * 25,
          });
        }
        return points;
      },
    },
  ];

  const currentProfile = botProfiles.find((b) => b.id === selectedBot) || botProfiles[0];

  const handleRunBot = async () => {
    setSimulationLog(`正在启动【${currentProfile.name}】模拟攻击...`);
    const trajectory = currentProfile.generateTrajectory(currentProfile.targetSimX);
    const finalX = trajectory[trajectory.length - 1].x;
    await onSimulateRun(trajectory, finalX, currentProfile.name);
    setSimulationLog(`模拟攻击完成，已向服务端提交验证`);
  };

  return (
    <div id="bot-simulator-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-slate-100 text-sm">自动化攻击与反作弊实验室 (Bot Penetration Sandbox)</h3>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center space-x-1">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>对抗测试环境</span>
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        黑产常用的自动化拖拽脚本（如 Selenium、Playwright、按键精灵）在移动特征上具有明显的数学或机械痕迹。
        点击下方预设的机器人模型，直接向服务端注入模拟轨迹，测试反爬虫生物行为识别引擎的防御拦截能力。
      </p>

      {/* Bot Preset Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {botProfiles.map((bot) => (
          <button
            key={bot.id}
            type="button"
            onClick={() => setSelectedBot(bot.id)}
            className={`p-3 rounded-xl text-left border transition-all ${
              selectedBot === bot.id
                ? 'bg-purple-950/30 border-purple-500/60 shadow-md shadow-purple-950/20'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-slate-200 flex items-center space-x-1.5">
                <Cpu className={`w-3.5 h-3.5 ${selectedBot === bot.id ? 'text-purple-400' : 'text-slate-400'}`} />
                <span>{bot.name}</span>
              </span>
              {selectedBot === bot.id && (
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">{bot.desc}</p>
            <div className="text-[10px] font-mono text-purple-300/80 bg-purple-950/40 p-1.5 rounded border border-purple-900/40">
              向量: {bot.attackVector}
            </div>
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
        <div className="text-xs text-slate-400">
          目标模拟落点: <span className="font-mono text-emerald-400 font-semibold">{currentProfile.targetSimX}px</span>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={handleRunBot}
          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-medium text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>正在注入对抗样本...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>执行此脚本攻击模拟</span>
            </>
          )}
        </button>
      </div>

      {simulationLog && (
        <div className="mt-3 text-[11px] text-slate-400 font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
          <span>{simulationLog}</span>
          <span className="text-emerald-400">STATUS: SENT</span>
        </div>
      )}
    </div>
  );
};
