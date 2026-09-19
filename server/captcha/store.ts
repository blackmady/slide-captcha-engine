/**
 * In-memory Store for Replay Prevention, Token Burning, Rate Limiting, and Telemetry Metrics.
 * In a distributed cluster, this can be swapped with Redis by implementing the same interface.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface SecurityMetrics {
  totalChallengesGenerated: number;
  totalVerificationsAttempted: number;
  successfulVerifications: number;
  rejectedVerifications: number;
  botDetections: number;
  replayAttemptsBlocked: number;
  rateLimitHits: number;
  secondaryTicketsValidated: number;
  averageScore: number;
  botReasonsBreakdown: Record<string, number>;
}

export class CaptchaSecurityStore {
  // challengeId -> consumed (boolean)
  private burnedChallenges: Map<string, { consumedAt: number; expireAt: number }> = new Map();
  // ticket -> used (boolean)
  private usedTickets: Set<string> = new Set();
  // ip -> rate record
  private rateLimits: Map<string, RateLimitRecord> = new Map();

  private metrics: SecurityMetrics = {
    totalChallengesGenerated: 0,
    totalVerificationsAttempted: 0,
    successfulVerifications: 0,
    rejectedVerifications: 0,
    botDetections: 0,
    replayAttemptsBlocked: 0,
    rateLimitHits: 0,
    secondaryTicketsValidated: 0,
    averageScore: 85,
    botReasonsBreakdown: {},
  };

  private totalScoresSum: number = 0;
  private totalScoredCount: number = 0;
  private lastCleanupAt: number = 0;

  constructor() {
    // Cloudflare Workers / Serverless environments disallow setInterval() in the global scope.
    // Cleanup is performed passively on requests when lastCleanupAt > 60s.
  }

  /**
   * Passive cleanup helper to remove expired records without timers
   */
  private passiveCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanupAt < 60000) return;
    this.lastCleanupAt = now;
    this.cleanup();
  }

  /**
   * Records a newly generated challenge
   */
  public recordChallengeGenerated(): void {
    this.passiveCleanup();
    this.metrics.totalChallengesGenerated++;
  }

  /**
   * Check if challenge has already been verified/burned (Anti-Replay Attack)
   */
  public isChallengeBurned(challengeId: string): boolean {
    return this.burnedChallenges.has(challengeId);
  }

  /**
   * Burns a challenge token so it cannot be used again
   */
  public burnChallenge(challengeId: string, expireAt: number): void {
    this.burnedChallenges.set(challengeId, {
      consumedAt: Date.now(),
      expireAt: expireAt || Date.now() + 120000,
    });
  }

  /**
   * Checks and consumes a secondary verification ticket (One-Time-Use)
   */
  public consumeTicket(ticket: string): boolean {
    if (this.usedTickets.has(ticket)) {
      return false; // Already consumed
    }
    this.usedTickets.add(ticket);
    this.metrics.secondaryTicketsValidated++;
    return true;
  }

  /**
   * Sliding window IP Rate Limiter
   * Allows up to maxRequests per windowMs
   */
  public checkRateLimit(ip: string, maxRequests: number = 60, windowMs: number = 60000): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let record = this.rateLimits.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      this.rateLimits.set(ip, record);
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (record.count >= maxRequests) {
      this.metrics.rateLimitHits++;
      return { allowed: false, remaining: 0 };
    }

    record.count++;
    return { allowed: true, remaining: maxRequests - record.count };
  }

  /**
   * Records verification results into telemetry metrics
   */
  public recordVerificationResult(isSuccess: boolean, isBot: boolean, score: number, reasons: string[]): void {
    this.metrics.totalVerificationsAttempted++;
    if (isSuccess) {
      this.metrics.successfulVerifications++;
    } else {
      this.metrics.rejectedVerifications++;
    }

    if (isBot) {
      this.metrics.botDetections++;
      for (const reason of reasons) {
        this.metrics.botReasonsBreakdown[reason] = (this.metrics.botReasonsBreakdown[reason] || 0) + 1;
      }
    }

    this.totalScoresSum += score;
    this.totalScoredCount++;
    this.metrics.averageScore = Math.round(this.totalScoresSum / this.totalScoredCount);
  }

  public recordReplayBlocked(): void {
    this.metrics.replayAttemptsBlocked++;
  }

  /**
   * Returns security metrics snapshot
   */
  public getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Removes expired tokens to prevent memory leak
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, item] of this.burnedChallenges.entries()) {
      if (now > item.expireAt) {
        this.burnedChallenges.delete(id);
      }
    }
    for (const [ip, rec] of this.rateLimits.entries()) {
      if (now > rec.resetAt) {
        this.rateLimits.delete(ip);
      }
    }
  }
}

export const globalSecurityStore = new CaptchaSecurityStore();
