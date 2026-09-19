/**
 * SlideCaptcha Node.js SDK (Version 1.0.0)
 * Enterprise-grade Slide Captcha SDK for Node.js backends.
 * Features:
 * - Biometric Trajectory Behavior Analysis
 * - Zero native dependencies (High Availability)
 * - Cryptographic HMAC token signing & replay attack immunity
 * - Secondary verification workflow for high-security transactions
 * - Compatible with Express, Koa, NestJS, and Fastify
 */

import { SlideCaptchaEngine, ChallengeData } from './engine';
import { analyzeTrajectory, TrajectoryPoint, BiometricAnalysisResult } from './biometrics';
import { globalSecurityStore, CaptchaSecurityStore } from './store';

export interface SlideCaptchaOptions {
  secretKey?: string;
  tolerance?: number; // Allowed pixel error margin (default: 4px)
  ttlSeconds?: number; // Challenge validity in seconds (default: 120s)
  securityLevel?: 'strict' | 'balanced' | 'relaxed';
  store?: CaptchaSecurityStore;
}

export interface VerificationRequest {
  token: string;
  sliderX: number;
  trajectory: TrajectoryPoint[];
  clientIp?: string;
}

export interface VerificationResponse {
  success: boolean;
  isHuman: boolean;
  score: number;
  ticket?: string; // One-time ticket for secondary verification
  error?: string;
  reasons: string[];
  metrics?: BiometricAnalysisResult['metrics'];
}

export class SlideCaptchaServer {
  private engine: SlideCaptchaEngine;
  private tolerance: number;
  private store: CaptchaSecurityStore;

  constructor(options: SlideCaptchaOptions = {}) {
    const secret = options.secretKey || process.env.CAPTCHA_SECRET_KEY || 'slide-captcha-enterprise-secret-v1';
    this.tolerance = options.tolerance ?? 4;
    this.engine = new SlideCaptchaEngine(secret, options.ttlSeconds ?? 120);
    this.store = options.store || globalSecurityStore;
  }

  /**
   * Step 1: Generate a new captcha challenge
   * @returns ChallengeData to send to client frontend
   */
  public createChallenge(): ChallengeData {
    const challenge = this.engine.createChallenge();
    this.store.recordChallengeGenerated();
    return challenge;
  }

  /**
   * Step 2: Primary verification of user slide attempt
   * Analyzes puzzle position alignment + human motor biometrics
   */
  public verify(req: VerificationRequest): VerificationResponse {
    const { token, sliderX, trajectory, clientIp } = req;

    // Rate limit check
    if (clientIp) {
      const rate = this.store.checkRateLimit(clientIp);
      if (!rate.allowed) {
        return {
          success: false,
          isHuman: false,
          score: 0,
          error: '请求过于频繁，触发访问频率限制',
          reasons: ['IP 速率限制超限，拒绝验证请求'],
        };
      }
    }

    // Token authenticity and expiration check
    const tokenResult = this.engine.verifyToken(token);
    if (!tokenResult.valid || !tokenResult.data) {
      this.store.recordVerificationResult(false, true, 0, [tokenResult.error || 'Token 无效']);
      return {
        success: false,
        isHuman: false,
        score: 0,
        error: tokenResult.error || 'Token 验证失败',
        reasons: [tokenResult.error || 'Token 签名不合法或已过期'],
      };
    }

    const { id: challengeId, targetX, expireAt } = tokenResult.data;

    // Anti-replay check
    if (this.store.isChallengeBurned(challengeId)) {
      this.store.recordReplayBlocked();
      return {
        success: false,
        isHuman: false,
        score: 0,
        error: '该验证码已被使用或已作废（防重放机制生效）',
        reasons: ['检测到重放攻击：挑战凭据已被消费，禁止复用'],
      };
    }

    // Immediately burn challenge to prevent replay
    this.store.burnChallenge(challengeId, expireAt);

    // Biometric trajectory & accuracy analysis
    const bioResult = analyzeTrajectory(trajectory, targetX, sliderX, this.tolerance);

    if (bioResult.isHuman) {
      // Generate secondary verification ticket
      const ticket = this.engine.generateTicket(challengeId);
      this.store.recordVerificationResult(true, false, bioResult.score, bioResult.reasons);

      return {
        success: true,
        isHuman: true,
        score: bioResult.score,
        ticket,
        reasons: bioResult.reasons,
        metrics: bioResult.metrics,
      };
    } else {
      this.store.recordVerificationResult(false, true, bioResult.score, bioResult.reasons);

      return {
        success: false,
        isHuman: false,
        score: bioResult.score,
        error: bioResult.reasons[0] || '人机行为验证未通过',
        reasons: bioResult.reasons,
        metrics: bioResult.metrics,
      };
    }
  }

  /**
   * Step 3: Secondary Validation (二次验证)
   * The host application's backend calls this method to verify the ticket
   * before executing high-value business actions (Login, Registration, Payment, etc.).
   */
  public validateTicket(ticket: string): { valid: boolean; error?: string } {
    if (!ticket) {
      return { valid: false, error: '缺少二次验证凭证 (ticket)' };
    }

    const ticketResult = this.engine.validateTicket(ticket);
    if (!ticketResult.valid) {
      return { valid: false, error: ticketResult.error };
    }

    // Consume ticket (must be one-time-use)
    const consumed = this.store.consumeTicket(ticket);
    if (!consumed) {
      return { valid: false, error: '该凭证已被使用，不可重复消费' };
    }

    return { valid: true };
  }

  /**
   * Express middleware generator for seamless backend route protection
   */
  public expressMiddleware(options: { ticketField?: string } = {}) {
    const fieldName = options.ticketField || 'captcha_ticket';
    return (req: any, res: any, next: any) => {
      const ticket = req.body?.[fieldName] || req.headers['x-captcha-ticket'];
      if (!ticket) {
        return res.status(403).json({
          code: 403,
          message: `缺少滑动验证码二次凭证字段: ${fieldName}`,
        });
      }

      const result = this.validateTicket(ticket);
      if (!result.valid) {
        return res.status(403).json({
          code: 403,
          message: `验证码二次校验失败: ${result.error}`,
        });
      }

      // Validation passed
      next();
    };
  }
}
