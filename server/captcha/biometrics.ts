/**
 * Biometric trajectory analyzer for human vs bot detection.
 * Evaluates mouse/touch gestures based on human motor control principles:
 * - Fitts's Law (acceleration, deceleration near target, hesitation)
 * - Micro-tremors and biological noise (entropy, vertical jitter)
 * - Temporal consistency and monotonic timestamps
 * - Velocity curve and jerk (derivative of acceleration)
 */

export interface TrajectoryPoint {
  x: number;
  y: number;
  t: number; // timestamp relative to start (ms)
}

export interface BiometricAnalysisResult {
  isHuman: boolean;
  score: number; // 0 - 100
  reasons: string[];
  metrics: {
    durationMs: number;
    pointCount: number;
    avgSpeed: number; // px/ms
    maxSpeed: number;
    yStdDev: number;
    yMaxDeviation: number;
    accelerationVariability: number;
    reversalCount: number;
    tremorEntropy: number;
    fittsDecelerationScore: number;
  };
}

export function analyzeTrajectory(
  points: TrajectoryPoint[],
  targetX: number,
  finalX: number,
  tolerance: number = 5
): BiometricAnalysisResult {
  const reasons: string[] = [];
  let penalty = 0;

  // 1. Basic point validation
  if (!points || points.length < 5) {
    return {
      isHuman: false,
      score: 10,
      reasons: ['轨迹采样点过少（少于5个点，判定为脚本瞬移或自动化工具触发）'],
      metrics: {
        durationMs: 0,
        pointCount: points ? points.length : 0,
        avgSpeed: 0,
        maxSpeed: 0,
        yStdDev: 0,
        yMaxDeviation: 0,
        accelerationVariability: 0,
        reversalCount: 0,
        tremorEntropy: 0,
        fittsDecelerationScore: 0,
      },
    };
  }

  const durationMs = points[points.length - 1].t - points[0].t;
  const pointCount = points.length;

  // 2. Duration check
  if (durationMs < 180) {
    penalty += 60;
    reasons.push(`滑动总耗时过短 (${durationMs}ms)，超出人类生理反应极限 (<180ms)`);
  } else if (durationMs > 10000) {
    penalty += 30;
    reasons.push(`滑动耗时过长 (${Math.round(durationMs / 1000)}s)，存在超时或脚本挂起嫌疑`);
  }

  // 3. Monotonic timestamp check & teleportation
  let hasTimestampAnomaly = false;
  let maxSpeed = 0;
  const speeds: number[] = [];
  const accelerations: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;

    if (dt <= 0) {
      hasTimestampAnomaly = true;
    }

    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = dt > 0 ? dist / dt : 999;
    speeds.push(speed);
    if (speed > maxSpeed) maxSpeed = speed;

    if (i > 1 && dt > 0) {
      const prevDt = points[i - 1].t - points[i - 2].t;
      const prevSpeed = speeds[speeds.length - 2];
      const accel = (speed - prevSpeed) / dt;
      accelerations.push(accel);
    }
  }

  if (hasTimestampAnomaly) {
    penalty += 50;
    reasons.push('检测到时间戳非递增异常（重放攻击或模拟注入）');
  }

  if (maxSpeed > 6.0) {
    penalty += 45;
    reasons.push(`瞬时速度过高 (${maxSpeed.toFixed(2)} px/ms)，超出人类拖拽速率`);
  }

  // 4. Vertical (Y-axis) deviation and jitter
  // Humans cannot keep Y completely unchanged across a 100px+ drag.
  const yValues = points.map((p) => p.y);
  const startY = yValues[0];
  const yDeviations = yValues.map((y) => y - startY);
  const yMaxDeviation = Math.max(...yDeviations.map(Math.abs));

  const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
  const yVariance =
    yValues.reduce((acc, y) => acc + Math.pow(y - yMean, 2), 0) / yValues.length;
  const yStdDev = Math.sqrt(yVariance);

  if (yMaxDeviation === 0 && points[points.length - 1].x - points[0].x > 40) {
    penalty += 65;
    reasons.push('Y轴位移完全为0（机械水平移动，典型自动化脚本特征）');
  } else if (yStdDev < 0.25 && points[points.length - 1].x - points[0].x > 50) {
    penalty += 40;
    reasons.push('Y轴生理抖动微乎其微（标准差 < 0.25px，疑似程序插值模拟）');
  }

  // 5. Velocity uniformity check (Linear bot detection)
  // Constant speed bots have very low standard deviation of speeds
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / (speeds.length || 1);
  const speedVariance =
    speeds.reduce((acc, s) => acc + Math.pow(s - avgSpeed, 2), 0) / (speeds.length || 1);
  const speedStdDev = Math.sqrt(speedVariance);
  const speedCoeffVariation = avgSpeed > 0 ? speedStdDev / avgSpeed : 0;

  if (speedCoeffVariation < 0.15 && pointCount > 10) {
    penalty += 50;
    reasons.push('速度极度均匀恒定（变异系数 < 0.15，判定为匀速线性移动脚本）');
  }

  // 6. Acceleration variability & Jerk
  const accelMean =
    accelerations.length > 0
      ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
      : 0;
  const accelVariance =
    accelerations.length > 0
      ? accelerations.reduce((acc, a) => acc + Math.pow(a - accelMean, 2), 0) /
        accelerations.length
      : 0;
  const accelerationVariability = Math.sqrt(accelVariance);

  // 7. Micro-adjustments and reversals near target (Fitts's Law)
  // Humans approaching a target usually overshoot or decelerate significantly in the final 20%
  let reversalCount = 0;
  for (let i = 2; i < points.length; i++) {
    const prevDelta = points[i - 1].x - points[i - 2].x;
    const currDelta = points[i].x - points[i - 1].x;
    if (prevDelta * currDelta < 0) {
      reversalCount++;
    }
  }

  // Check deceleration in final quarter of duration
  const lastQuarterStartIndex = Math.floor(points.length * 0.75);
  const firstQuarterEndIndex = Math.floor(points.length * 0.25);
  const firstHalfSpeeds = speeds.slice(0, firstQuarterEndIndex);
  const lastQuarterSpeeds = speeds.slice(lastQuarterStartIndex);

  const avgFirstSpeed =
    firstHalfSpeeds.length > 0
      ? firstHalfSpeeds.reduce((a, b) => a + b, 0) / firstHalfSpeeds.length
      : avgSpeed;
  const avgLastSpeed =
    lastQuarterSpeeds.length > 0
      ? lastQuarterSpeeds.reduce((a, b) => a + b, 0) / lastQuarterSpeeds.length
      : avgSpeed;

  let fittsDecelerationScore = 1;
  if (avgLastSpeed > avgFirstSpeed * 1.6 && points[points.length - 1].x > 50) {
    // Reached target at peak acceleration without stopping
    penalty += 25;
    reasons.push('接近终点时无减速与对齐观察期（违背菲茨定律肌肉控制模型）');
    fittsDecelerationScore = 0.3;
  } else if (avgLastSpeed < avgFirstSpeed * 0.7) {
    // Normal deceleration
    fittsDecelerationScore = 1.0;
  }

  // 8. Tremor entropy (Shannon-like entropy on dx direction changes and small vibrations)
  let tremorEntropy = 0;
  const tremorBuckets: Record<string, number> = {};
  for (let i = 1; i < points.length; i++) {
    const key = `${Math.round(points[i].x - points[i - 1].x)}_${Math.round(
      points[i].y - points[i - 1].y
    )}`;
    tremorBuckets[key] = (tremorBuckets[key] || 0) + 1;
  }
  const totalTransitions = points.length - 1;
  for (const count of Object.values(tremorBuckets)) {
    const p = count / totalTransitions;
    if (p > 0) tremorEntropy -= p * Math.log2(p);
  }

  if (tremorEntropy < 1.2 && pointCount > 15) {
    penalty += 35;
    reasons.push('位移模式熵过低（轨迹过于单一重复，疑似简单函数生成）');
  }

  // 9. Accuracy check (Does final position match targetX?)
  const offsetDiff = Math.abs(finalX - targetX);
  if (offsetDiff > tolerance) {
    penalty += 80;
    reasons.push(
      `拼图对齐偏差过大（误差 ${offsetDiff.toFixed(1)}px，允许公差 ±${tolerance}px）`
    );
  }

  // Final score calculation
  const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const isHuman = calculatedScore >= 60 && offsetDiff <= tolerance;

  if (isHuman && reasons.length === 0) {
    reasons.push('轨迹符合人类生理运动特征：自然颤抖、加减速分布合理、对齐精准');
  }

  return {
    isHuman,
    score: calculatedScore,
    reasons,
    metrics: {
      durationMs,
      pointCount,
      avgSpeed: Number(avgSpeed.toFixed(3)),
      maxSpeed: Number(maxSpeed.toFixed(3)),
      yStdDev: Number(yStdDev.toFixed(2)),
      yMaxDeviation: Number(yMaxDeviation.toFixed(2)),
      accelerationVariability: Number(accelerationVariability.toFixed(4)),
      reversalCount,
      tremorEntropy: Number(tremorEntropy.toFixed(2)),
      fittsDecelerationScore,
    },
  };
}
