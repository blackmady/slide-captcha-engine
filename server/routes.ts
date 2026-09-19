import express, { Request, Response } from 'express';
import { SlideCaptchaServer } from './captcha/sdk';
import { globalSecurityStore } from './captcha/store';

const router = express.Router();
const captchaServer = new SlideCaptchaServer({
  secretKey: process.env.CAPTCHA_SECRET_KEY || 'enterprise-slide-captcha-master-key',
  tolerance: 4,
  ttlSeconds: 120,
});

/**
 * Endpoint 1: Generate a new Slide Captcha challenge
 * GET /api/v1/captcha/generate
 */
router.get('/captcha/generate', (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const rate = globalSecurityStore.checkRateLimit(clientIp);
    if (!rate.allowed) {
      return res.status(429).json({
        code: 429,
        success: false,
        message: '请求过于频繁，请稍后再试',
      });
    }

    const challenge = captchaServer.createChallenge();
    return res.json({
      code: 200,
      success: true,
      data: challenge,
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '生成验证码失败: ' + (err.message || '内部错误'),
    });
  }
});

/**
 * Endpoint 2: Primary verification of sliding gesture
 * POST /api/v1/captcha/verify
 */
router.post('/captcha/verify', (req: Request, res: Response) => {
  try {
    const { token, sliderX, trajectory } = req.body;
    if (!token || sliderX === undefined || !trajectory) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少必要参数: token, sliderX, 或 trajectory',
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';
    const result = captchaServer.verify({
      token,
      sliderX: Number(sliderX),
      trajectory,
      clientIp,
    });

    if (result.success) {
      return res.json({
        code: 200,
        success: true,
        data: result,
      });
    } else {
      return res.status(200).json({
        code: 400,
        success: false,
        data: result,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '人机验证服务异常: ' + (err.message || '内部错误'),
    });
  }
});

/**
 * Endpoint 3: Secondary Validation (Server-to-Server)
 * POST /api/v1/captcha/validate-ticket
 */
router.post('/captcha/validate-ticket', (req: Request, res: Response) => {
  try {
    const { ticket } = req.body;
    if (!ticket) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少二次校验凭证 (ticket)',
      });
    }

    const result = captchaServer.validateTicket(ticket);
    if (result.valid) {
      return res.json({
        code: 200,
        success: true,
        message: '二次验证凭证有效且已成功核销',
      });
    } else {
      return res.status(400).json({
        code: 400,
        success: false,
        error: result.error,
        message: '二次验证凭证核销失败: ' + result.error,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '核销异常: ' + (err.message || '内部错误'),
    });
  }
});

/**
 * Endpoint 4: Telemetry and Security Metrics
 * GET /api/v1/captcha/metrics
 */
router.get('/captcha/metrics', (_req: Request, res: Response) => {
  const metrics = globalSecurityStore.getMetrics();
  return res.json({
    code: 200,
    success: true,
    data: metrics,
  });
});

/**
 * Endpoint 5: Mock business protected login endpoint
 * POST /api/v1/demo/login
 * Protected via captchaServer.expressMiddleware()
 */
router.post(
  '/demo/login',
  captchaServer.expressMiddleware({ ticketField: 'captcha_ticket' }),
  (req: Request, res: Response) => {
    const { username } = req.body;
    return res.json({
      code: 200,
      success: true,
      message: `用户【${username || '访客'}】登录成功！已通过人机滑动验证码二次鉴权。`,
      user: {
        username: username || 'demo_user',
        loginTime: new Date().toISOString(),
        authLevel: 'CAPTCHA_VERIFIED_LEVEL_A',
      },
    });
  }
);

export default router;
