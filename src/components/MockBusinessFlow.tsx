import React, { useState } from 'react';
import { Lock, User, KeyRound, CheckCircle2, ShieldCheck, ArrowRight, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import { SlideCaptchaWidget } from './SlideCaptchaWidget';
import { VerifySuccessData } from '../types/captcha';

export const MockBusinessFlow: React.FC = () => {
  const [username, setUsername] = useState('admin_demo');
  const [password, setPassword] = useState('••••••••••••');
  const [ticket, setTicket] = useState<string | null>(null);
  const [isCaptchaOpen, setIsCaptchaOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResult, setLoginResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const handleCaptchaSuccess = (newTicket: string, _data: VerifySuccessData) => {
    setTicket(newTicket);
    setIsCaptchaOpen(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticket) {
      setIsCaptchaOpen(true);
      return;
    }

    setLoginLoading(true);
    setLoginResult(null);

    try {
      // Send business request with secondary validation ticket to host backend
      const res = await fetch('/api/v1/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          captcha_ticket: ticket,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setLoginResult({
          success: true,
          message: data.message,
          details: data.user,
        });
        // Clear ticket after single consumption
        setTicket(null);
      } else {
        setLoginResult({
          success: false,
          message: data.message || '登录鉴权失败',
        });
        setTicket(null);
      }
    } catch (err: any) {
      setLoginResult({
        success: false,
        message: err.message || '网络连接异常',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  // Demonstrate attempt to bypass or replay ticket
  const handleTestBypassAttack = async () => {
    setLoginLoading(true);
    setLoginResult(null);
    try {
      const res = await fetch('/api/v1/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'hacker_bot',
          password: 'bad_password',
          captcha_ticket: 'ticket_fake_forged_payload_99999',
        }),
      });
      const data = await res.json();
      setLoginResult({
        success: res.ok && data.success,
        message: data.message || `服务端安全中间件拦截成功 (HTTP ${res.status})`,
      });
    } catch (err: any) {
      setLoginResult({
        success: false,
        message: '连接失败: ' + err.message,
      });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div id="mock-business-flow" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h3 className="font-semibold text-slate-100 text-base flex items-center space-x-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <span>业务系统接入实战演练 (端到端双重鉴权)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            模拟真实企业登录/发短信场景：前端滑块完成人机验证获得 Ticket，后端调用 validateTicket 执行二次核销。
          </p>
        </div>
        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          2-Step Verification
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Login Form */}
        <div className="lg:col-span-6 bg-slate-950/80 rounded-xl p-5 border border-slate-800/80">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-1.5">
            <User className="w-4 h-4 text-blue-400" />
            <span>宿主系统登录表单</span>
          </h4>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">账号 / 手机号</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="请输入账号"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">登录密码</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            {/* Captcha Status in Form */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className={`w-4 h-4 ${ticket ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-xs text-slate-300">滑动安全验证:</span>
              </div>
              {ticket ? (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>已完成验证 (Ticket 已就绪)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCaptchaOpen(true)}
                  className="px-3 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                >
                  点击启动滑动验证
                </button>
              )}
            </div>

            {ticket && (
              <div className="text-[10px] font-mono text-slate-400 truncate bg-slate-950 p-2 rounded border border-slate-800">
                Ticket: <span className="text-emerald-400">{ticket}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loginLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                <span>{loginLoading ? '鉴权核验中...' : '提交登录并二次核销'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleTestBypassAttack}
                disabled={loginLoading}
                title="模拟未通过验证直接攻击后端接口"
                className="px-3 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 text-xs transition-all flex items-center space-x-1"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>绕过测试</span>
              </button>
            </div>
          </form>

          {/* Response Message */}
          {loginResult && (
            <div
              className={`mt-4 p-3.5 rounded-xl text-xs border ${
                loginResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <div className="font-semibold flex items-center space-x-1.5 mb-1">
                {loginResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>{loginResult.success ? '业务接口鉴权通过' : '业务接口拦截'}</span>
              </div>
              <p className="text-slate-300">{loginResult.message}</p>
              {loginResult.details && (
                <div className="mt-2 pt-2 border-t border-emerald-800/40 text-[11px] font-mono text-emerald-300/80">
                  用户角色: {loginResult.details.username} · 鉴权时间: {loginResult.details.loginTime}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Captcha Modal / Inline Trigger */}
        <div className="lg:col-span-6 flex flex-col justify-center items-center bg-slate-950/40 rounded-xl p-5 border border-slate-800/80">
          <div className="w-full">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
              <span className="font-medium text-slate-200">滑动验证码组件挂载区:</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {ticket ? '状态: 已核发凭据' : isCaptchaOpen ? '状态: 交互中' : '状态: 就绪'}
              </span>
            </div>

            <div className="flex justify-center">
              <SlideCaptchaWidget
                onSuccess={handleCaptchaSuccess}
                onFail={(err) => console.log('Captcha failed:', err)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
