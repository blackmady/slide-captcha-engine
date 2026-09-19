# SlideCaptcha 行为验证码系统 (Enterprise Slide Captcha)

<div align="center">

![SlideCaptcha Hero Banner](/public/images/hero-banner.svg)

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-339933.svg?logo=nodedotjs)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Zero Native Canvas](https://img.shields.io/badge/Dependencies-Zero%20C%2B%2B%20Canvas-10b981.svg)](https://github.com/)
[![Security Standard](https://img.shields.io/badge/Security-HMAC--SHA256%20%7C%20Two--Stage-emerald.svg)](https://github.com/)

**高可用滑动拼图人机行为验证码 · 生物动力学轨迹识别 · 服务端二次核销 · 零 C++ 依赖开箱即用**

[在线交互体验与风控大盘](captcha) • [快速开始](#-快速上手) • [API 文档](#-api-规范与多语言-sdk) • [安全防御原理](#-核心安全机制)

</div>

---

## 📌 效果展示 (Visual Showcase)

### 1. 前端滑动验证组件与实时生物动力学遥测

组件采用直接操纵模型（Direct Manipulation），滑块与拼图块 **1:1 绝对线性位移**，同时支持按住滑轨或直接拖动拼图碎片：

![SlideCaptcha Widget Preview](/public/images/widget-preview.svg)

### 2. 人机生物轨迹判别与对抗特征分析

风控引擎基于人体神经运动控制模型（菲茨定律 Fitts's Law），精确识别真实人手微颤与自动化脚本特征：

![Biometrics Analysis](/public/images/biometrics-analysis.svg)

---

## 🌟 核心特性 (Key Features)

- 🛡️ **极验级人机行为判别**：
  采集 `[x, y, t]` 轨迹三元组，评估手部微颤熵（Tremor Entropy）、纵向微小抖动极差、瞬时速度钟形曲线与终端逼近减速微调期，彻底拦截瞬移脚本、直线机械脚本与数学贝塞尔插值脚本。
- ⚡ **零 C++ 原生编译依赖（高可用）**：
  基于纯矢量 SVG 算法动态生成背景和拼图碎片切片，**无需安装 `node-canvas`、`node-gyp`、`cairo` 等任何系统级 C++ 编译套件**，任何 Linux / Docker / Serverless 容器环境均可开箱即用，微秒级极速渲染。
- 🔒 **目标坐标绝不出域（防网络爬虫）**：
  目标缺口绝对坐标 `targetX` 仅加密保存在服务端 HMAC-SHA256 签名中，网络下发的 JSON 与切片数据中**绝不包含缺口实际 X 坐标**，黑产无法通过逆向接口或抓包解析坐标。
- 🎫 **双重鉴权与用后即焚（Two-Stage Verification）**：
  一次验证成功后核发短时有效（默认 120 秒）的 `ticket` 凭证，业务后端接口（如登录、转账、短信）在接收到请求后调用核销方法单次消费凭证，彻底杜绝跳过前端验证的直接脚本撞库。
- 🚀 **通用性与多语言支持**：
  提供标准 RESTful 协议与 Node.js 原生 SDK，无缝兼容 Python (FastAPI/Django)、Go (Gin)、Java (Spring Boot) 以及 PHP 接入。

---

## 📐 系统架构与双重鉴权流程

![Architecture Flow](/public/images/architecture-flow.svg)

### 两阶段验证工作流（Two-Stage Verification）

1. **第一阶段（前端滑动与行为分析）**：
   - 前端调用 `GET /api/v1/captcha/generate` 获取混淆挑战；
   - 用户拖动滑块完成拼图，前端收集滑动轨迹 `[{x, y, t}]` 并调用 `POST /api/v1/captcha/verify`；
   - 验证码安全引擎核算位移精度与生理微颤特征，通过后签发单次消费凭证 `ticket`。
2. **第二阶段（宿主业务二次核销）**：
   - 用户提交业务表单（登录/注册/修改密码），携带 `captcha_ticket` 字段；
   - 宿主后端在执行业务逻辑前，调用 `SlideCaptchaServer.validateTicket(ticket)`；
   - 验证通过并立即将 Ticket 标记为已消费（Burn on verify），阻断重放攻击。

---

## 🚀 快速上手

### 1. 安装服务端 SDK

```bash
npm install slide-captcha-engine
# 或在本项目中直接引用 server/captcha/sdk.ts
```

### 2. Node.js 服务端集成 (Express 示例)

```typescript
import express from 'express';
import { SlideCaptchaServer } from './server/captcha/sdk';

const app = express();
app.use(express.json());

// 1. 初始化验证码服务实例
const captchaServer = new SlideCaptchaServer({
  secretKey: process.env.CAPTCHA_SECRET || 'your-production-secret-key-32-bytes',
  tolerance: 4,          // 缺口允许公差 (±4px)
  ticketTtlSec: 120,      // Ticket 有效期 120 秒
  strictBiometrics: true // 启用生理动力学与微颤反作弊
});

// 2. 挂载验证码基础路由 (生成挑战 / 行为验证 / 状态监控)
app.use('/api/v1/captcha', captchaServer.expressMiddleware());

// 3. 宿主业务接口防刷保护 (二次核销)
app.post('/api/login', async (req, res) => {
  const { username, password, captcha_ticket } = req.body;

  // 调用服务端 SDK 二次核销凭证
  const verification = captchaServer.validateTicket(captcha_ticket);
  if (!verification.valid) {
    return res.status(403).json({
      success: false,
      message: `安全验证失败: ${verification.reason}`
    });
  }

  // 验证通过，继续执行业务数据库查询与密码校验
  return res.json({ success: true, message: '登录成功' });
});

app.listen(3000, () => console.log('服务已启动: http://localhost:3000'));
```

### 3. 前端 React 组件接入

```tsx
import React, { useState } from 'react';
import { SlideCaptchaWidget } from './components/SlideCaptchaWidget';

export function LoginForm() {
  const [ticket, setTicket] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) {
      alert('请先完成滑动验证码');
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'password123',
        captcha_ticket: ticket // 提交一次验证换取的凭证
      })
    });
    const data = await res.json();
    alert(data.message);
  };

  return (
    <form onSubmit={handleLogin}>
      {/* 嵌入滑动验证码组件 */}
      <SlideCaptchaWidget
        onSuccess={(ticket, data) => {
          console.log('行为验证通过，可信分:', data.score);
          setTicket(ticket);
        }}
        onFail={(error, data) => {
          console.warn('验证未通过:', error, data.reasons);
        }}
      />

      <button type="submit" disabled={!ticket}>
        提交登录
      </button>
    </form>
  );
}
```

---

## 📡 API 规范与多语言 SDK

验证码系统完全遵循 RESTful 架构设计，方便任何后端系统跨语言接入：

### 接口清单

| 接口端点 | 方法 | 说明 |
| :--- | :--- | :--- |
| `/api/v1/captcha/generate` | `GET` | 生成混淆拼图切片背景与加密 Token |
| `/api/v1/captcha/verify` | `POST` | 提交滑动位移与 `[x,y,t]` 轨迹，校验换取 Ticket |
| `/api/v1/captcha/validate-ticket`| `POST` | 服务端二次核销接口（用后即焚） |
| `/api/v1/captcha/metrics` | `GET` | 实时风控大盘指标与黑产拦截特征统计 |

### 多语言二次核销示例

#### Python (FastAPI / Flask)
```python
import requests

def verify_captcha_ticket(ticket: str) -> bool:
    resp = requests.post(
        "http://captcha-service:3000/api/v1/captcha/validate-ticket",
        json={"ticket": ticket},
        timeout=2.0
    )
    data = resp.json()
    return data.get("valid", False)
```

#### Go (Gin)
```go
type CaptchaReq struct {
    Ticket string `json:"ticket"`
}

func VerifyCaptcha(ticket string) bool {
    payload, _ := json.Marshal(map[string]string{"ticket": ticket})
    resp, err := http.Post("http://captcha-service:3000/api/v1/captcha/validate-ticket", "application/json", bytes.NewBuffer(payload))
    if err != nil {
        return false
    }
    defer resp.Body.Close()
    
    var res map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&res)
    return res["valid"] == true
}
```

#### Java (Spring Boot)
```java
@Service
public class CaptchaService {
    @Autowired
    private RestTemplate restTemplate;

    public boolean validateTicket(String ticket) {
        Map<String, String> request = Map.of("ticket", ticket);
        Map response = restTemplate.postForObject(
            "http://captcha-service:3000/api/v1/captcha/validate-ticket", 
            request, 
            Map.class
        );
        return Boolean.TRUE.equals(response.get("valid"));
    }
}
```

---

## 🛡️ 核心安全机制与防破解策略

| 攻击向量 | 攻击手法 | SlideCaptcha 防御手段 |
| :--- | :--- | :--- |
| **网络抓包取坐标** | 嗅探网络请求获取目标缺口位置 | 绝对坐标绝不下发前端，全链路 HMAC 密文防伪封装 |
| **脚本极速瞬移** | Headless 浏览器调用 JS 瞬移滑块 | 严格校验神经生理反应耗时（&lt;180ms 即刻封杀拦截） |
| **机械匀速注入** | 脚本以恒定步长向右循环累加 | 检测纵向 $dy \equiv 0$ 且加速度方差归零直接判定作弊 |
| **重放攻击 (Replay)**| 抓取合法通过的报文反复发包 | Token 与 Ticket 均具备单次消费特性（Burn on verify） |
| **数学曲线伪造** | 纯三次贝塞尔或正弦函数插值 | 检验自然手部肌肉颤动信息熵（Entropy）与菲茨定律终端观察期 |
| **直接绕过前端** | 爬虫直接请求业务后端 API 碰撞 | 业务后端二次核验凭证，无有效单次消费 Ticket 拒绝放行 |

---

## 📊 风控指标与运行监控

系统内置实时风控监控大盘，支持实时获取以下指标：

- **挑战总下发量与通过率**：动态监控正常业务与流量突增。
- **作弊拦截特征分布统计**：实时统计当前黑产脚本的攻击手段（如瞬移、匀速直线、采样过稀等）。
- **重放攻击阻断计数**：防范报文嗅探嗅探重放攻击。
- **平均生理置信分**：基于统计学监控人机行为评估模型的健康度。

---

## ☁️ Cloudflare Pages / Workers 一键部署指南

本项目已完全支持 Cloudflare 边缘计算无服务器环境（零 C++ 依赖、原生 `node:crypto` 兼容）：

### 快速部署步骤：
1. **推送代码至 GitHub**；
2. 登录 **Cloudflare Dashboard** -> **Workers & Pages** -> **Create application** -> **Pages** -> 选择本仓库；
3. **构建设置 (Build Settings)**：
   - **Framework preset**：`Vite`
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
4. 项目根目录下已提供 `wrangler.toml` 与 `functions/api/[[catchall]].ts`，Cloudflare 会全自动识别并部署为全球边缘函数（无需额外部署独立后端服务器）。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议发布，商业友好，可无限制集成至企业自建系统、移动端 H5 及各类管理控制台。
