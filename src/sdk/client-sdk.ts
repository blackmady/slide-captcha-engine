/**
 * SlideCaptcha Universal Frontend Client SDK
 * Lightweight, zero-dependency client SDK for web applications.
 * Compatible with Vanilla JS, React, Vue, Angular, or embedded script tags.
 */
import { ChallengeData, TrajectoryPoint, VerifySuccessData, VerifyFailureData } from '../types/captcha';

export interface SlideCaptchaClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  onSuccess?: (ticket: string, data: VerifySuccessData) => void;
  onFail?: (error: string, data: VerifyFailureData) => void;
  onRefresh?: () => void;
}

export class SlideCaptchaClient {
  private baseUrl: string;
  private timeoutMs: number;
  private config: SlideCaptchaClientConfig;

  constructor(config: SlideCaptchaClientConfig = {}) {
    this.config = config;
    this.baseUrl = config.baseUrl || '/api/v1/captcha';
    this.timeoutMs = config.timeoutMs || 8000;
  }

  /**
   * Request a new puzzle challenge from server
   */
  public async getChallenge(): Promise<ChallengeData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/generate`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`网络响应错误: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || '获取验证码失败');
      }

      return json.data as ChallengeData;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(err.message || '获取验证码失败');
    }
  }

  /**
   * Submit sliding position and trajectory data for server-side behavioral verification
   */
  public async verify(payload: {
    token: string;
    sliderX: number;
    trajectory: TrajectoryPoint[];
  }): Promise<VerifySuccessData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const json = await res.json();

      if (json.success && json.data) {
        const successData = json.data as VerifySuccessData;
        if (this.config.onSuccess && successData.ticket) {
          this.config.onSuccess(successData.ticket, successData);
        }
        return successData;
      } else {
        const failureData = (json.data || {
          success: false,
          isHuman: false,
          score: 0,
          error: json.message || '验证未通过',
          reasons: [json.message || '人机行为验证未通过'],
        }) as VerifyFailureData;

        if (this.config.onFail) {
          this.config.onFail(failureData.error || '验证失败', failureData);
        }
        throw failureData;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.isHuman !== undefined) {
        throw err;
      }
      const genericError: VerifyFailureData = {
        success: false,
        isHuman: false,
        score: 0,
        error: err.message || '网络连接异常',
        reasons: [err.message || '网络连接异常'],
      };
      if (this.config.onFail) {
        this.config.onFail(genericError.error!, genericError);
      }
      throw genericError;
    }
  }
}
