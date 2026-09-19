import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ShieldCheck, AlertCircle, CheckCircle2, Lock, Sparkles, Fingerprint } from 'lucide-react';
import { ChallengeData, TrajectoryPoint, VerifySuccessData, VerifyFailureData } from '../types/captcha';
import { SlideCaptchaClient } from '../sdk/client-sdk';

interface SlideCaptchaWidgetProps {
  onSuccess?: (ticket: string, data: VerifySuccessData) => void;
  onFail?: (error: string, data: VerifyFailureData) => void;
  onTrajectoryChange?: (points: TrajectoryPoint[], currentX: number, result?: VerifySuccessData | VerifyFailureData | null) => void;
  autoRefreshOnFail?: boolean;
  disabled?: boolean;
  className?: string;
  theme?: 'default' | 'compact';
}

export const SlideCaptchaWidget: React.FC<SlideCaptchaWidgetProps> = ({
  onSuccess,
  onFail,
  onTrajectoryChange,
  autoRefreshOnFail = true,
  disabled = false,
  className = '',
}) => {
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dragging states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [sliderX, setSliderX] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'dragging' | 'verifying' | 'success' | 'failed'>('idle');
  const [verifyResult, setVerifyResult] = useState<VerifySuccessData | VerifyFailureData | null>(null);

  // Stabilize external callbacks via refs to prevent infinite re-renders or accidental challenge resets
  const onTrajectoryChangeRef = useRef(onTrajectoryChange);
  onTrajectoryChangeRef.current = onTrajectoryChange;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  // Trajectory tracking
  const trajectoryRef = useRef<TrajectoryPoint[]>([]);
  const dragStartTimeRef = useRef<number>(0);
  const dragStartXRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const sliderXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const challengeRef = useRef<ChallengeData | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<SlideCaptchaClient>(new SlideCaptchaClient());
  const rafIdRef = useRef<number | null>(null);

  challengeRef.current = challenge;
  isDraggingRef.current = isDragging;
  sliderXRef.current = sliderX;

  const maxSlideDistance = challenge ? challenge.canvasWidth - challenge.pieceWidth : 260;

  // Load a new challenge (stable, only depends on component lifecycle, NEVER on drag/trajectory callbacks)
  const loadChallenge = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setStatus('idle');
      setSliderX(0);
      sliderXRef.current = 0;
      setVerifyResult(null);
      trajectoryRef.current = [];

      const newChallenge = await clientRef.current.getChallenge();
      setChallenge(newChallenge);
      challengeRef.current = newChallenge;
      onTrajectoryChangeRef.current?.([], 0, null);
    } catch (err: any) {
      setErrorMsg(err.message || '加载验证码失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenge();
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [loadChallenge]);

  // Handle Drag Start
  const handleStart = (clientX: number, clientY: number) => {
    if (status === 'verifying' || status === 'success' || disabled || !challenge) return;

    setIsDragging(true);
    isDraggingRef.current = true;
    setStatus('dragging');
    setErrorMsg(null);
    setVerifyResult(null);

    const now = performance.now();
    dragStartTimeRef.current = now;
    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;

    // Start trajectory recording with initial point
    trajectoryRef.current = [{ x: 0, y: 0, t: 0 }];
    onTrajectoryChangeRef.current?.(trajectoryRef.current, 0, null);
  };

  // Handle Drag Move (Direct 1:1 linear direct tracking, RAF synced)
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !challengeRef.current) return;

    const deltaX = clientX - dragStartXRef.current;
    const deltaY = clientY - dragStartYRef.current;

    const maxDist = challengeRef.current.canvasWidth - challengeRef.current.pieceWidth;
    // Clamped slide X - perfectly linear 1:1 with mouse/finger cursor
    const clampedX = Math.max(0, Math.min(maxDist, deltaX));
    sliderXRef.current = clampedX;

    // Record high-precision biometric trajectory point with zero loss
    const currentT = Math.round(performance.now() - dragStartTimeRef.current);
    trajectoryRef.current.push({
      x: Math.round(clampedX * 10) / 10,
      y: Math.round(deltaY * 10) / 10,
      t: currentT,
    });

    // Schedule RAF for 60/120/144Hz direct frame synchronization without thread stutter
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setSliderX(sliderXRef.current);
        onTrajectoryChangeRef.current?.(trajectoryRef.current, sliderXRef.current, null);
      });
    }
  }, []);

  // Handle Drag End & Verification (Stable reference, reads from refs)
  const handleEnd = useCallback(async () => {
    if (!isDraggingRef.current || !challengeRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;

    // Flush any pending RAF update
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const currentX = sliderXRef.current;
    setSliderX(currentX);
    const currentChallenge = challengeRef.current;

    if (currentX < 10) {
      // User barely moved, reset smoothly without triggering re-fetch
      setStatus('idle');
      setSliderX(0);
      sliderXRef.current = 0;
      trajectoryRef.current = [];
      return;
    }

    setStatus('verifying');

    try {
      const result = await clientRef.current.verify({
        token: currentChallenge.token,
        sliderX: Math.round(currentX),
        trajectory: trajectoryRef.current,
      });

      setStatus('success');
      setVerifyResult(result);
      onTrajectoryChangeRef.current?.(trajectoryRef.current, currentX, result);
      onSuccessRef.current?.(result.ticket!, result);
    } catch (err: any) {
      setStatus('failed');
      const failData = err as VerifyFailureData;
      setVerifyResult(failData);
      setErrorMsg(failData.error || '验证未通过');
      onTrajectoryChangeRef.current?.(trajectoryRef.current, currentX, failData);
      onFailRef.current?.(failData.error || '验证失败', failData);

      if (autoRefreshOnFail) {
        setTimeout(() => {
          loadChallenge();
        }, 1600);
      }
    }
  }, [autoRefreshOnFail, loadChallenge]);

  // Global mouse event listeners during drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  // Global touch event listeners
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEnd = () => {
      handleEnd();
    };

    if (isDragging) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div
      id="slide-captcha-container"
      className={`select-none bg-slate-900 border border-slate-700/70 rounded-2xl p-4 shadow-xl text-slate-100 max-w-[352px] mx-auto relative overflow-hidden transition-all duration-300 ${
        status === 'failed' ? 'border-rose-500/80 shadow-rose-950/40' : status === 'success' ? 'border-emerald-500/80 shadow-emerald-950/40' : ''
      } ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 text-xs border-b border-slate-800">
        <div className="flex items-center space-x-1.5 font-medium text-slate-300">
          <Fingerprint className="w-4 h-4 text-emerald-400" />
          <span>安全滑动验证</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            生物行为识别
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            id="captcha-refresh-btn"
            type="button"
            onClick={loadChallenge}
            disabled={loading || status === 'verifying'}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="换一张验证码"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Image Canvas Stage */}
      <div className="relative mt-3 w-[320px] h-[180px] rounded-xl overflow-hidden bg-slate-950 shadow-inner border border-slate-800 mx-auto">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-slate-950/90 backdrop-blur-sm z-20">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400">正在生成安全拼图画布...</span>
          </div>
        ) : errorMsg && !challenge ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950 z-20">
            <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
            <span className="text-xs text-rose-300 mb-3">{errorMsg}</span>
            <button
              onClick={loadChallenge}
              className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              重新加载
            </button>
          </div>
        ) : challenge ? (
          <>
            {/* Background Image with Slot Cutout */}
            <img
              src={challenge.backgroundImage}
              alt="Captcha Background"
              className="w-full h-full object-cover pointer-events-none"
              referrerPolicy="no-referrer"
            />

            {/* Draggable Puzzle Piece (Direct 1:1 linear tracking with zero CSS lag) */}
            <div
              id="captcha-puzzle-piece"
              onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  handleStart(e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
              className={`absolute top-0 left-0 cursor-grab active:cursor-grabbing will-change-transform select-none ${
                isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'
              }`}
              style={{
                transform: `translateX(${sliderX}px)`,
                width: `${challenge.canvasWidth}px`,
                height: `${challenge.canvasHeight}px`,
                filter: status === 'failed' ? 'drop-shadow(0 0 6px rgba(244,63,94,0.9))' : status === 'success' ? 'drop-shadow(0 0 8px rgba(16,185,129,0.9))' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.7))',
                touchAction: 'none',
              }}
            >
              <img
                src={challenge.puzzlePieceImage}
                alt="Puzzle Piece"
                className="w-full h-full pointer-events-none select-none"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Live Verification Overlay Feedback */}
            {status === 'verifying' && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center space-x-2 z-10 animate-fade-in">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-xs font-medium text-emerald-200">正在分析肌肉微颤与加速度...</span>
              </div>
            )}

            {status === 'success' && (
              <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-emerald-200 z-10 animate-in fade-in zoom-in-95">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
                <span className="text-xs font-bold tracking-wide">人机行为验证通过</span>
                <span className="text-[11px] text-emerald-300/80">
                  可信得分: {verifyResult?.score ?? 96} 分 · 耗时 {(trajectoryRef.current[trajectoryRef.current.length - 1]?.t || 600)}ms
                </span>
              </div>
            )}

            {status === 'failed' && (
              <div className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-rose-200 p-3 text-center z-10 animate-in fade-in">
                <AlertCircle className="w-7 h-7 text-rose-400 mb-1" />
                <span className="text-xs font-semibold">{errorMsg || '验证未通过'}</span>
                <span className="text-[10px] text-rose-300/70 mt-1">即将自动重置，请平稳拖拽拼图</span>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Slider Track & Grabber Handle */}
      <div className="mt-3 relative">
        <div
          ref={sliderTrackRef}
          id="captcha-slider-track"
          className={`h-11 rounded-xl relative flex items-center px-1 overflow-hidden transition-colors border ${
            status === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40'
              : status === 'failed'
              ? 'bg-rose-950/40 border-rose-500/40'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          {/* Active Highlight Bar (Instant linear response without transition lag) */}
          <div
            className={`absolute left-0 top-0 bottom-0 ${
              isDragging ? 'transition-none' : 'transition-all duration-300 ease-out'
            } ${
              status === 'success'
                ? 'bg-emerald-500/20'
                : status === 'failed'
                ? 'bg-rose-500/20'
                : 'bg-emerald-500/15'
            }`}
            style={{ width: `${sliderX + 20}px` }}
          />

          {/* Guide Placeholder Text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 font-medium select-none">
            {status === 'idle' && (
              <span className="flex items-center space-x-1.5 opacity-80">
                <span>按住滑块，拖动完成拼图</span>
                <span className="text-slate-600">»»</span>
              </span>
            )}
            {status === 'dragging' && (
              <span className="text-[11px] text-emerald-400 font-mono">
                X: {Math.round(sliderX)}px · 采样: {trajectoryRef.current.length} 点
              </span>
            )}
            {status === 'verifying' && <span className="text-emerald-400 animate-pulse">验证凭证生成中...</span>}
            {status === 'success' && <span className="text-emerald-400 font-medium">验证成功</span>}
            {status === 'failed' && <span className="text-rose-400 font-medium">{errorMsg || '验证失败'}</span>}
          </div>

          {/* Draggable Button Handle (1:1 direct tracking, zero CSS lag) */}
          <div
            id="captcha-slider-handle"
            role="slider"
            aria-valuenow={sliderX}
            aria-valuemin={0}
            aria-valuemax={maxSlideDistance}
            tabIndex={0}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.touches.length > 0) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            className={`w-10 h-9 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md z-10 will-change-transform select-none ${
              isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'
            } ${
              status === 'success'
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40'
                : status === 'failed'
                ? 'bg-rose-500 text-white shadow-rose-500/40'
                : isDragging
                ? 'bg-emerald-400 text-slate-950 shadow-emerald-500/50'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
            }`}
            style={{
              transform: `translateX(${sliderX}px)`,
              touchAction: 'none',
            }}
          >
            {status === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : status === 'failed' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <div className="flex space-x-0.5">
                <span className="w-0.5 h-3.5 bg-current rounded-full opacity-60"></span>
                <span className="w-0.5 h-3.5 bg-current rounded-full opacity-90"></span>
                <span className="w-0.5 h-3.5 bg-current rounded-full opacity-60"></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span className="flex items-center space-x-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
          <span>服务端高防伪 HMAC 签名</span>
        </span>
        <span className="font-mono text-slate-400">
          公差: ±4px
        </span>
      </div>
    </div>
  );
};
