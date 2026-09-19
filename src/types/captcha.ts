export interface TrajectoryPoint {
  x: number;
  y: number;
  t: number;
}

export interface ChallengeData {
  id: string;
  token: string;
  backgroundImage: string;
  puzzlePieceImage: string;
  targetY: number;
  canvasWidth: number;
  canvasHeight: number;
  pieceWidth: number;
  pieceHeight: number;
  expireAt: number;
}

export interface BiometricMetrics {
  durationMs: number;
  pointCount: number;
  avgSpeed: number;
  maxSpeed: number;
  yStdDev: number;
  yMaxDeviation: number;
  accelerationVariability: number;
  reversalCount: number;
  tremorEntropy: number;
  fittsDecelerationScore: number;
}

export interface VerifySuccessData {
  success: boolean;
  isHuman: boolean;
  score: number;
  ticket?: string;
  reasons: string[];
  metrics?: BiometricMetrics;
}

export interface VerifyFailureData {
  success: boolean;
  isHuman: boolean;
  score: number;
  error?: string;
  reasons: string[];
  metrics?: BiometricMetrics;
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
