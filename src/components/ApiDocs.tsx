import React, { useState } from 'react';
import {
  Code2,
  FileText,
  Copy,
  Check,
  Send,
  Terminal,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

export const ApiDocs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'nodejs-sdk' | 'rest-api' | 'frontend' | 'multilang'>('overview');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Interactive API tester states
  const [apiEndpoint, setApiEndpoint] = useState<string>('generate');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTestApi = async (endpoint: string) => {
    setApiLoading(true);
    setApiResponse(null);
    try {
      if (endpoint === 'generate') {
        const res = await fetch('/api/v1/captcha/generate');
        const data = await res.json();
        setApiResponse(JSON.stringify(data, null, 2));
      } else if (endpoint === 'metrics') {
        const res = await fetch('/api/v1/captcha/metrics');
        const data = await res.json();
        setApiResponse(JSON.stringify(data, null, 2));
      } else if (endpoint === 'validate-ticket') {
        const res = await fetch('/api/v1/captcha/validate-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket: 'ticket_demo_test_sample' }),
        });
        const data = await res.json();
        setApiResponse(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setApiResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div id="api-docs-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">
              SlideCaptcha 开发者接入指南与 API 规范 (v1.0.0)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            高可用、免编译的原生 Node.js 服务端 SDK、前端通用 Widget 及标准 RESTful 协议文档。
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'overview' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            架构与时序
          </button>
          <button
            onClick={() => setActiveTab('nodejs-sdk')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'nodejs-sdk' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Node.js SDK
          </button>
          <button
            onClick={() => setActiveTab('rest-api')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'rest-api' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RESTful API 规范
          </button>
          <button
            onClick={() => setActiveTab('frontend')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'frontend' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            前端集成 (React/JS)
          </button>
          <button
            onClick={() => setActiveTab('multilang')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'multilang' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            多语言后端 (Python/Go/Java)
          </button>
        </div>
      </div>

      {/* Tab 1: Architecture & Sequence */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>标准双重核销架构 (Two-Stage Verification Workflow)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              为了保证绝对安全性，防止黑产直接绕过前端调用后端业务 API，本系统采用类似极验的经典双重验证模型：
            </p>

            {/* Sequence Diagram Visual */}
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs font-mono space-y-3">
              <div className="flex items-center text-slate-300">
                <span className="w-28 text-emerald-400 font-bold">1. 前端客户端</span>
                <span className="text-slate-400">──── GET /captcha/generate ────►</span>
                <span className="w-28 text-blue-400 font-bold ml-2">验证码服务</span>
                <span className="text-slate-400 text-[11px] ml-2">(生成拼图底图 + 缺口切片 + HMAC 加密Token)</span>
              </div>
              <div className="flex items-center text-slate-300">
                <span className="w-28 text-emerald-400 font-bold">2. 用户滑动拖拽</span>
                <span className="text-slate-400">──── 高精度采集 [x, y, t] 生物轨迹 ──►</span>
                <span className="text-slate-400 text-[11px] ml-2">(记录时间戳、加速度、微颤熵值)</span>
              </div>
              <div className="flex items-center text-slate-300">
                <span className="w-28 text-emerald-400 font-bold">3. 提交一次验证</span>
                <span className="text-slate-400">──── POST /captcha/verify ───►</span>
                <span className="w-28 text-blue-400 font-bold ml-2">验证码服务</span>
                <span className="text-slate-400 text-[11px] ml-2">(校验缺口位移 + 人机行为判定 ➔ 核发 Ticket)</span>
              </div>
              <div className="flex items-center text-slate-300">
                <span className="w-28 text-emerald-400 font-bold">4. 提交业务表单</span>
                <span className="text-slate-400">──── POST /api/login {`{ticket}`} ──►</span>
                <span className="w-28 text-purple-400 font-bold ml-2">业务宿主后端</span>
                <span className="text-slate-400 text-[11px] ml-2">(携带 Ticket 提交正式业务请求)</span>
              </div>
              <div className="flex items-center text-slate-300">
                <span className="w-28 text-purple-400 font-bold">5. 二次核销鉴权</span>
                <span className="text-slate-400">──── POST /captcha/validate-ticket ──►</span>
                <span className="w-28 text-blue-400 font-bold ml-2">验证码服务</span>
                <span className="text-slate-400 text-[11px] ml-2">(验证 Ticket 签名、单次消费防重放)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-xs text-slate-200 mb-1 flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>零二进制 C++ 编译依赖</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                采用自研纯矢量 SVG 拼图与蒙版引擎，无需 node-gyp 或 node-canvas 本地库编译，容器冷启动在 20ms 内，杜绝因环境缺失导致的宕机。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-xs text-slate-200 mb-1 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span>生物动力学模型拦截</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                基于菲茨定律 (Fitts's Law)、Y轴生理抖动熵、匀速变异系数、重放时间戳单调性等多维指标，精准拦截自动化注入脚本。
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="font-semibold text-xs text-slate-200 mb-1 flex items-center space-x-1.5">
                <Code2 className="w-4 h-4 text-purple-400" />
                <span>防破解与防重放设计</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                缺口实际坐标永不传输给前端，使用 HMAC-SHA256 签名包裹；挑战与 Ticket 一经消费即刻烧毁 (Burn on Use)，抵御任何抓包重放。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Node.js SDK */}
      {activeTab === 'nodejs-sdk' && (
        <div className="space-y-4">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 font-mono">1. 服务端 SDK 初始化 (Express / Node.js)</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `import { SlideCaptchaServer } from './server/captcha/sdk';

const captcha = new SlideCaptchaServer({
  secretKey: process.env.CAPTCHA_SECRET_KEY, // 主私钥
  tolerance: 4,     // 允许像素误差 (默认 ±4px)
  ttlSeconds: 120,  // 挑战超时时间 (默认 120秒)
});`,
                    'sdk-init'
                  )
                }
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                {copiedId === 'sdk-init' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'sdk-init' ? '已复制' : '复制代码'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`import { SlideCaptchaServer } from './server/captcha/sdk';

// 实例化验证码服务端引擎
const captcha = new SlideCaptchaServer({
  secretKey: process.env.CAPTCHA_SECRET_KEY, // 服务端密钥 (用于 HMAC 签名)
  tolerance: 4,     // 拼图对齐允许公差 (默认 ±4px)
  ttlSeconds: 120,  // 挑战有效期 (默认 120 秒)
});`}
            </pre>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 font-mono">2. Express 中间件极简保护业务路由</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `// 保护登录接口，自动拦截并二次核销 captcha_ticket
app.post('/api/login', captcha.expressMiddleware(), (req, res) => {
  // 中间件校验通过后方可执行真实登录业务
  res.json({ success: true, message: '登录成功' });
});`,
                    'sdk-middleware'
                  )
                }
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                {copiedId === 'sdk-middleware' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'sdk-middleware' ? '已复制' : '复制代码'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`// 优雅的一行中间件拦截：
// 自动从 req.body.captcha_ticket 或 req.headers['x-captcha-ticket'] 提取并二次核销
app.post('/api/login', captcha.expressMiddleware(), (req, res) => {
  const { username, password } = req.body;
  // 此时凭据已校验合法且已单次核销，安全执行数据库查询
  res.json({ success: true, user: username });
});`}
            </pre>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 font-mono">3. 手动调用二次核验 (NestJS / Koa / Fastify)</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `const { ticket } = req.body;
const verifyResult = captcha.validateTicket(ticket);
if (!verifyResult.valid) {
  return res.status(403).json({ error: verifyResult.error });
}`,
                    'sdk-manual'
                  )
                }
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                {copiedId === 'sdk-manual' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'sdk-manual' ? '已复制' : '复制代码'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`// NestJS Guard 或普通函数中手动验证
const { captcha_ticket } = req.body;
const result = captcha.validateTicket(captcha_ticket);

if (!result.valid) {
  throw new UnauthorizedException(result.error || '验证码二次鉴权失效');
}
// 鉴权通过，继续向下处理...`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: RESTful API Spec & Interactive Tester */}
      {activeTab === 'rest-api' && (
        <div className="space-y-5">
          {/* Interactive Tester Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-emerald-300 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>在线 API 联调沙箱 (Live API Console)</span>
              </span>
              <div className="flex items-center space-x-2">
                <select
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none"
                >
                  <option value="generate">GET /api/v1/captcha/generate (获取挑战)</option>
                  <option value="metrics">GET /api/v1/captcha/metrics (安全指标)</option>
                  <option value="validate-ticket">POST /api/v1/captcha/validate-ticket (二次核销)</option>
                </select>
                <button
                  type="button"
                  disabled={apiLoading}
                  onClick={() => handleTestApi(apiEndpoint)}
                  className="px-3 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold flex items-center space-x-1 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>{apiLoading ? '请求中...' : '发送测试'}</span>
                </button>
              </div>
            </div>

            {apiResponse && (
              <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300 max-h-60 overflow-y-auto border border-slate-800">
                {apiResponse}
              </pre>
            )}
          </div>

          {/* Endpoint 1 */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs mb-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">GET</span>
              <span className="font-mono text-slate-200">/api/v1/captcha/generate</span>
              <span className="text-slate-400">· 生成滑块挑战</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              返回经过裁剪的背景画布 (带有阴影缺口)、滑块切片、targetY 纵向对齐高度以及加密防篡改的 Challenge Token。
            </p>
            <div className="bg-slate-900 p-2.5 rounded text-[11px] font-mono text-slate-300">
              {`// 返回数据结构 Response:
{
  "code": 200,
  "success": true,
  "data": {
    "id": "chk_9f82...",
    "token": "ZXlKaGJHY2lP...", // HMAC-SHA256 签名，保密存储 targetX
    "backgroundImage": "data:image/svg+xml;base64,...",
    "puzzlePieceImage": "data:image/svg+xml;base64,...",
    "targetY": 45,
    "canvasWidth": 320,
    "canvasHeight": 180,
    "pieceWidth": 44,
    "pieceHeight": 44,
    "expireAt": 1726756800000
  }
}`}
            </div>
          </div>

          {/* Endpoint 2 */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs mb-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">POST</span>
              <span className="font-mono text-slate-200">/api/v1/captcha/verify</span>
              <span className="text-slate-400">· 一次验证 (提交滑块与生物轨迹)</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              客户端滑块松开后提交，服务端校验位移、菲茨减速定律、Y轴抖动熵，通过后立即核发 ticket 并烧毁原始 token。
            </p>
            <div className="bg-slate-900 p-2.5 rounded text-[11px] font-mono text-slate-300">
              {`// 请求载荷 Request:
{
  "token": "ZXlKaGJHY2lP...",
  "sliderX": 164,
  "trajectory": [
    { "x": 0, "y": 0, "t": 0 },
    { "x": 15, "y": 1.2, "t": 45 },
    ...
    { "x": 164, "y": 2.1, "t": 680 }
  ]
}

// 成功返回 Response (HTTP 200):
{
  "code": 200,
  "success": true,
  "data": {
    "isHuman": true,
    "score": 96,
    "ticket": "ticket_c4b2...", // 用于业务后端的二次核验凭据
    "reasons": ["自然生理颤抖分布合理", "符合菲茨定律"],
    "metrics": { "durationMs": 680, "yStdDev": 1.45, "tremorEntropy": 2.1 }
  }
}`}
            </div>
          </div>

          {/* Endpoint 3 */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs mb-2">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">POST</span>
              <span className="font-mono text-slate-200">/api/v1/captcha/validate-ticket</span>
              <span className="text-slate-400">· 二次验证 (宿主系统核销)</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded text-[11px] font-mono text-slate-300">
              {`// 请求载荷 Request:
{ "ticket": "ticket_c4b2..." }

// 返回 Response:
{ "code": 200, "success": true, "message": "二次验证凭证有效且已成功核销" }`}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Frontend SDK & Components */}
      {activeTab === 'frontend' && (
        <div className="space-y-4">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 font-mono">React 开箱即用组件</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `import { SlideCaptchaWidget } from './components/SlideCaptchaWidget';

export function LoginForm() {
  const handleSuccess = (ticket) => {
    console.log('Got ticket:', ticket);
    // 携带 ticket 发起真实登录
  };

  return <SlideCaptchaWidget onSuccess={handleSuccess} />;
}`,
                    'react-code'
                  )
                }
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                {copiedId === 'react-code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'react-code' ? '已复制' : '复制代码'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`import { SlideCaptchaWidget } from './components/SlideCaptchaWidget';

export function MyLoginPage() {
  const [ticket, setTicket] = useState('');

  const onCaptchaPass = (verifiedTicket, details) => {
    setTicket(verifiedTicket);
    console.log('人机得分:', details.score);
  };

  return (
    <div>
      <SlideCaptchaWidget
        onSuccess={onCaptchaPass}
        onFail={(err) => console.error('验证拦截:', err)}
      />
    </div>
  );
}`}
            </pre>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-400 font-mono">原生 Vanilla JavaScript 接入</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `const client = new SlideCaptchaClient({ baseUrl: '/api/v1/captcha' });
const challenge = await client.getChallenge();
// 拖动完成后:
const result = await client.verify({
  token: challenge.token,
  sliderX: currentX,
  trajectory: recordedPoints,
});`,
                    'vanilla-code'
                  )
                }
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
              >
                {copiedId === 'vanilla-code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'vanilla-code' ? '已复制' : '复制代码'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
{`import { SlideCaptchaClient } from './src/sdk/client-sdk';

const client = new SlideCaptchaClient({
  baseUrl: '/api/v1/captcha',
  onSuccess: (ticket, data) => {
    document.getElementById('ticket_input').value = ticket;
    document.getElementById('login_form').submit();
  }
});`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 5: Multi-Language Backends */}
      {activeTab === 'multilang' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            虽然第一版核心服务基于 Node.js 研发，但由于遵循通用 HTTP RESTful 协议，其它语言后端（Python、Go、Java 等）均可直接接入二次核销验证：
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Python */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-blue-400 mb-2 font-mono">Python (FastAPI / Flask)</div>
              <pre className="p-2.5 bg-slate-900 rounded text-[10px] font-mono text-slate-300 overflow-x-auto">
{`import requests

def verify_ticket(ticket: str) -> bool:
    res = requests.post(
        "http://captcha-svc/api/v1/captcha/validate-ticket",
        json={"ticket": ticket},
        timeout=3.0
    )
    return res.status_code == 200 and res.json().get("success", False)`}
              </pre>
            </div>

            {/* Go */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-cyan-400 mb-2 font-mono">Go (Gin / net/http)</div>
              <pre className="p-2.5 bg-slate-900 rounded text-[10px] font-mono text-slate-300 overflow-x-auto">
{`func ValidateCaptchaTicket(ticket string) bool {
    payload, _ := json.Marshal(map[string]string{"ticket": ticket})
    resp, err := http.Post(
        "http://captcha-svc/api/v1/captcha/validate-ticket",
        "application/json",
        bytes.NewBuffer(payload),
    )
    if err != nil || resp.StatusCode != 200 {
        return false
    }
    return true
}`}
              </pre>
            </div>

            {/* Java */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-amber-400 mb-2 font-mono">Java (Spring Boot)</div>
              <pre className="p-2.5 bg-slate-900 rounded text-[10px] font-mono text-slate-300 overflow-x-auto">
{`@Autowired
private RestTemplate restTemplate;

public boolean validateTicket(String ticket) {
    Map<String, String> body = Map.of("ticket", ticket);
    ResponseEntity<Map> resp = restTemplate.postForEntity(
        "http://captcha-svc/api/v1/captcha/validate-ticket",
        body, Map.class
    );
    return resp.getStatusCode().is2xxSuccessful();
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
