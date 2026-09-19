/**
 * Cloudflare Pages Functions Adapter
 * Handles all /api/* requests natively on Cloudflare Edge without Node.js server.
 */
import { SlideCaptchaServer } from '../../server/captcha/sdk';
import { globalSecurityStore } from '../../server/captcha/store';

interface Env {
  CAPTCHA_SECRET_KEY?: string;
}

let serverInstance: SlideCaptchaServer | null = null;

function getServer(env: Env): SlideCaptchaServer {
  if (!serverInstance) {
    serverInstance = new SlideCaptchaServer({
      secretKey: env.CAPTCHA_SECRET_KEY || 'enterprise-slide-captcha-master-key',
      tolerance: 4,
      ttlSeconds: 120,
    });
  }
  return serverInstance;
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const server = getServer(env);
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

  // 1. Health check
  if (path === '/api/health') {
    return jsonResponse({ status: 'ok', runtime: 'cloudflare-pages-functions', timestamp: Date.now() });
  }

  // 2. GET /api/v1/captcha/generate
  if (method === 'GET' && path === '/api/v1/captcha/generate') {
    const rate = globalSecurityStore.checkRateLimit(clientIp);
    if (!rate.allowed) {
      return jsonResponse({ code: 429, success: false, message: '请求过于频繁，请稍后再试' }, 429);
    }
    const challenge = server.createChallenge();
    return jsonResponse({ code: 200, success: true, data: challenge });
  }

  // 3. POST /api/v1/captcha/verify
  if (method === 'POST' && path === '/api/v1/captcha/verify') {
    try {
      const body = (await request.json()) as any;
      const { token, sliderX, trajectory } = body;
      if (!token || sliderX === undefined || !trajectory) {
        return jsonResponse({ code: 400, success: false, message: '缺少必要参数: token, sliderX, 或 trajectory' }, 400);
      }
      const result = server.verify({
        token,
        sliderX: Number(sliderX),
        trajectory,
        clientIp,
      });
      return jsonResponse({
        code: result.success ? 200 : 400,
        success: result.success,
        data: result,
      }, result.success ? 200 : 200);
    } catch (err: any) {
      return jsonResponse({ code: 500, success: false, message: '人机验证服务异常: ' + (err.message || '内部错误') }, 500);
    }
  }

  // 4. POST /api/v1/captcha/validate-ticket
  if (method === 'POST' && path === '/api/v1/captcha/validate-ticket') {
    try {
      const body = (await request.json()) as any;
      const { ticket } = body;
      if (!ticket) {
        return jsonResponse({ code: 400, success: false, message: '缺少二次校验凭证 (ticket)' }, 400);
      }
      const result = server.validateTicket(ticket);
      if (result.valid) {
        return jsonResponse({ code: 200, success: true, message: '二次验证凭证有效且已成功核销' });
      } else {
        return jsonResponse({ code: 400, success: false, error: result.error, message: '二次验证凭证核销失败: ' + result.error }, 400);
      }
    } catch (err: any) {
      return jsonResponse({ code: 500, success: false, message: '核销异常: ' + (err.message || '内部错误') }, 500);
    }
  }

  // 5. GET /api/v1/captcha/metrics
  if (method === 'GET' && path === '/api/v1/captcha/metrics') {
    const metrics = globalSecurityStore.getMetrics();
    return jsonResponse({ code: 200, success: true, data: metrics });
  }

  // 6. POST /api/v1/demo/login
  if (method === 'POST' && path === '/api/v1/demo/login') {
    try {
      const body = (await request.json()) as any;
      const ticket = body.captcha_ticket || request.headers.get('x-captcha-ticket');
      if (!ticket) {
        return jsonResponse({ code: 403, success: false, message: '安全验证失败: 缺少验证码凭证' }, 403);
      }
      const validation = server.validateTicket(ticket);
      if (!validation.valid) {
        return jsonResponse({ code: 403, success: false, message: `安全验证失败: ${validation.error || '凭证无效'}` }, 403);
      }
      return jsonResponse({
        code: 200,
        success: true,
        message: `用户【${body.username || '访客'}】登录成功！已通过人机滑动验证码二次鉴权。`,
        user: {
          username: body.username || 'demo_user',
          loginTime: new Date().toISOString(),
          authLevel: 'CAPTCHA_VERIFIED_LEVEL_A',
        },
      });
    } catch (err: any) {
      return jsonResponse({ code: 500, success: false, message: '登录业务异常: ' + (err.message || '内部错误') }, 500);
    }
  }

  return jsonResponse({ code: 404, success: false, message: 'Not Found' }, 404);
}
