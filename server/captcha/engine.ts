/**
 * Slide Captcha Engine
 * Handles procedural puzzle image generation (SVG-based for zero native dependencies),
 * cryptographic challenge tokens, and target coordinates obfuscation.
 */
import crypto from 'crypto';

export interface ChallengeData {
  id: string;
  token: string;
  backgroundImage: string; // Base64 Data URI (image/svg+xml)
  puzzlePieceImage: string; // Base64 Data URI (image/svg+xml)
  targetY: number; // Disclosed to client for vertical positioning
  canvasWidth: number;
  canvasHeight: number;
  pieceWidth: number;
  pieceHeight: number;
  expireAt: number;
}

export interface InternalChallengeState {
  id: string;
  token: string;
  targetX: number;
  targetY: number;
  createdAt: number;
  expireAt: number;
  verified: boolean;
  consumed: boolean;
}

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 180;
const PIECE_SIZE = 44;
const TAB_RADIUS = 7;

export class SlideCaptchaEngine {
  private secretKey: string;
  private ttlMs: number;

  constructor(secretKey: string = 'slide-captcha-default-super-secret-key', ttlSeconds: number = 120) {
    this.secretKey = secretKey;
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Generates a jigsaw puzzle SVG path.
   * Standard 44x44 piece with tabs on Top & Right, sockets on Bottom & Left.
   */
  private getPuzzlePath(offsetX: number = 0, offsetY: number = 0): string {
    const s = PIECE_SIZE;
    const r = TAB_RADIUS;
    const mid = s / 2;

    // Relative path commands from top-left (0,0)
    // Top: Tab pointing UP (-Y)
    // Right: Tab pointing RIGHT (+X)
    // Bottom: Socket indenting UP (-Y)
    // Left: Socket indenting RIGHT (+X)
    return `
      M ${offsetX} ${offsetY}
      H ${offsetX + mid - r}
      C ${offsetX + mid - r} ${offsetY - r}, ${offsetX + mid + r} ${offsetY - r}, ${offsetX + mid + r} ${offsetY}
      H ${offsetX + s}
      V ${offsetY + mid - r}
      C ${offsetX + s + r} ${offsetY + mid - r}, ${offsetX + s + r} ${offsetY + mid + r}, ${offsetX + s} ${offsetY + mid + r}
      V ${offsetY + s}
      H ${offsetX + mid + r}
      C ${offsetX + mid + r} ${offsetY + s - r}, ${offsetX + mid - r} ${offsetY + s - r}, ${offsetX + mid - r} ${offsetY + s}
      H ${offsetX}
      V ${offsetY + mid + r}
      C ${offsetX + r} ${offsetY + mid + r}, ${offsetX + r} ${offsetY + mid - r}, ${offsetX} ${offsetY + mid - r}
      Z
    `.replace(/\s+/g, ' ').trim();
  }

  /**
   * Generates one of 6 rich, colorful visual scenes with SVG vectors, gradients, and noise.
   */
  private generateSceneSVG(themeIndex: number): string {
    const themes = [
      // Theme 0: Sunset Mountain Vista
      {
        defs: `
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="45%" stop-color="#701a75"/>
            <stop offset="75%" stop-color="#f43f5e"/>
            <stop offset="100%" stop-color="#fb923c"/>
          </linearGradient>
          <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fffbeb" stop-opacity="1"/>
            <stop offset="60%" stop-color="#fde047" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#fb923c" stop-opacity="0"/>
          </radialGradient>
        `,
        content: `
          <rect width="320" height="180" fill="url(#skyGrad)"/>
          <circle cx="210" cy="95" r="42" fill="url(#sunGrad)"/>
          <path d="M0,180 L40,110 L110,180 Z" fill="#4c0519" opacity="0.8"/>
          <path d="M70,180 L150,90 L230,180 Z" fill="#31103f" opacity="0.9"/>
          <path d="M180,180 L260,115 L320,180 Z" fill="#2e1065" opacity="0.85"/>
          <path d="M0,180 Q80,140 180,165 T320,150 L320,180 Z" fill="#18181b"/>
          <g fill="#fef08a" opacity="0.5">
            <circle cx="45" cy="30" r="1.5"/><circle cx="120" cy="20" r="1"/><circle cx="290" cy="40" r="1.2"/>
            <circle cx="270" cy="20" r="1.5"/><circle cx="180" cy="15" r="1"/>
          </g>
        `,
      },
      // Theme 1: Cyberpunk Neon Grid
      {
        defs: `
          <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#090d16"/>
            <stop offset="100%" stop-color="#022c22"/>
          </linearGradient>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#10b981" stroke-width="0.5" stroke-opacity="0.25"/>
          </pattern>
        `,
        content: `
          <rect width="320" height="180" fill="url(#cyberBg)"/>
          <rect width="320" height="180" fill="url(#grid)"/>
          <circle cx="160" cy="90" r="65" fill="none" stroke="#06b6d4" stroke-width="2" opacity="0.6"/>
          <circle cx="160" cy="90" r="45" fill="none" stroke="#ec4899" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.7"/>
          <polygon points="160,35 210,120 110,120" fill="none" stroke="#f59e0b" stroke-width="2" opacity="0.5"/>
          <line x1="0" y1="140" x2="320" y2="140" stroke="#3b82f6" stroke-width="2" opacity="0.8"/>
          <line x1="0" y1="155" x2="320" y2="155" stroke="#ec4899" stroke-width="1.5" opacity="0.6"/>
          <text x="25" y="45" font-family="monospace" font-size="14" font-weight="bold" fill="#34d399" opacity="0.7">CYBER_SYS.VERIFIED</text>
        `,
      },
      // Theme 2: Deep Ocean Bioluminescence
      {
        defs: `
          <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#030712"/>
            <stop offset="60%" stop-color="#082f49"/>
            <stop offset="100%" stop-color="#0c4a6e"/>
          </linearGradient>
          <radialGradient id="bioGlow" cx="30%" cy="60%" r="50%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
            <stop offset="50%" stop-color="#0284c7" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#0369a1" stop-opacity="0"/>
          </radialGradient>
        `,
        content: `
          <rect width="320" height="180" fill="url(#oceanGrad)"/>
          <circle cx="95" cy="110" r="70" fill="url(#bioGlow)"/>
          <path d="M-20,180 Q60,110 140,160 T300,120 T360,180 Z" fill="#0f172a" opacity="0.9"/>
          <path d="M0,180 Q100,140 200,170 T340,130 L340,180 Z" fill="#020617"/>
          <circle cx="80" cy="100" r="16" fill="#38bdf8" opacity="0.4"/>
          <circle cx="240" cy="65" r="22" fill="#2dd4bf" opacity="0.3"/>
          <circle cx="165" cy="40" r="12" fill="#a78bfa" opacity="0.35"/>
          <g fill="#e0f2fe" opacity="0.6">
            <circle cx="85" cy="70" r="3"/><circle cx="95" cy="50" r="2"/><circle cx="102" cy="30" r="1.5"/>
            <circle cx="230" cy="85" r="3.5"/><circle cx="245" cy="115" r="2"/>
          </g>
        `,
      },
      // Theme 3: Aurora Borealis & Nordic Forest
      {
        defs: `
          <linearGradient id="auroraSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#051923"/>
            <stop offset="50%" stop-color="#003554"/>
            <stop offset="100%" stop-color="#006466"/>
          </linearGradient>
          <linearGradient id="auroraWave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#5eead4" stop-opacity="0.1"/>
            <stop offset="30%" stop-color="#4ade80" stop-opacity="0.7"/>
            <stop offset="70%" stop-color="#38bdf8" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.2"/>
          </linearGradient>
        `,
        content: `
          <rect width="320" height="180" fill="url(#auroraSky)"/>
          <path d="M 0,30 Q 80,90 160,40 T 320,80 L 320,120 Q 240,70 160,110 T 0,60 Z" fill="url(#auroraWave)" filter="blur(6px)"/>
          <path d="M 0,15 Q 110,60 220,20 T 320,45 L 320,85 Q 210,40 100,75 T 0,35 Z" fill="url(#auroraWave)" opacity="0.6" filter="blur(4px)"/>
          <!-- Pine trees silhouettes -->
          <path d="M20,180 L25,140 L30,180 M28,180 L35,130 L42,180 M50,180 L58,125 L66,180 M80,180 L90,135 L100,180 M130,180 L140,145 L150,180 M200,180 L210,130 L220,180 M250,180 L260,140 L270,180 M290,180 L300,130 L310,180" stroke="#06121e" stroke-width="12" stroke-linecap="round"/>
        `,
      },
      // Theme 4: Architectural Bauhaus / Modernist Geometry
      {
        defs: `
          <linearGradient id="bauhausBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#e2e8f0"/>
          </linearGradient>
        `,
        content: `
          <rect width="320" height="180" fill="url(#bauhausBg)"/>
          <circle cx="100" cy="90" r="55" fill="#f43f5e" opacity="0.85"/>
          <rect x="140" y="35" width="70" height="110" fill="#0284c7" opacity="0.8"/>
          <polygon points="210,150 280,40 310,150" fill="#eab308" opacity="0.85"/>
          <line x1="20" y1="150" x2="300" y2="150" stroke="#0f172a" stroke-width="4"/>
          <line x1="40" y1="40" x2="160" y2="160" stroke="#475569" stroke-width="2" stroke-dasharray="5,5"/>
          <circle cx="250" cy="65" r="18" fill="#10b981" opacity="0.9"/>
        `,
      },
      // Theme 5: Cosmic Nebula / Starlight
      {
        defs: `
          <radialGradient id="nebulaCore" cx="60%" cy="40%" r="55%">
            <stop offset="0%" stop-color="#f472b6" stop-opacity="0.9"/>
            <stop offset="40%" stop-color="#8b5cf6" stop-opacity="0.6"/>
            <stop offset="80%" stop-color="#3b82f6" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#030712" stop-opacity="0"/>
          </radialGradient>
        `,
        content: `
          <rect width="320" height="180" fill="#030712"/>
          <rect width="320" height="180" fill="url(#nebulaCore)"/>
          <ellipse cx="190" cy="75" rx="80" ry="45" fill="#ec4899" opacity="0.25" transform="rotate(-20 190 75)" filter="blur(8px)"/>
          <circle cx="80" cy="130" r="4" fill="#67e8f9"/>
          <circle cx="140" cy="50" r="3" fill="#fdf2f8"/>
          <circle cx="270" cy="110" r="3.5" fill="#fde047"/>
          <path d="M 0,160 Q 90,145 180,165 T 320,155 L 320,180 L 0,180 Z" fill="#0b0f19"/>
        `,
      },
    ];

    const sel = themes[themeIndex % themes.length];
    return `
      <defs>
        ${sel.defs}
      </defs>
      ${sel.content}
    `;
  }

  /**
   * Generates a complete challenge:
   * - Background SVG with a cutout hole slot at (targetX, targetY)
   * - Slider Piece SVG representing the extracted jigsaw piece
   * - Signed challenge token
   */
  public createChallenge(): ChallengeData {
    const id = 'chk_' + crypto.randomBytes(12).toString('hex');
    const themeIndex = Math.floor(Math.random() * 6);

    // Ensure targetX has safe margins (65px to 255px)
    const targetX = Math.floor(65 + Math.random() * 190);
    // Ensure targetY has safe margins (25px to 110px)
    const targetY = Math.floor(25 + Math.random() * 85);

    const puzzlePathAtTarget = this.getPuzzlePath(targetX, targetY);
    // Initial piece position starts at X=0 (left edge), same Y as target
    const puzzlePathAtOrigin = this.getPuzzlePath(0, targetY);

    const sceneElements = this.generateSceneSVG(themeIndex);

    // 1. Background image SVG
    // Contains the scene, plus a semi-transparent dark cutout hole with shadow
    const backgroundSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
        <defs>
          <filter id="holeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="1" dy="2" result="offsetblur"/>
            <feFlood flood-color="#000000" flood-opacity="0.8"/>
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Background Scene -->
        <g id="scene">
          ${sceneElements}
        </g>
        <!-- Puzzle Slot Hole (Cutout Silhouette) -->
        <path d="${puzzlePathAtTarget}" fill="#000000" fill-opacity="0.65" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.75" filter="url(#holeShadow)"/>
      </svg>
    `.replace(/\s+/g, ' ').trim();

    // 2. Slider piece SVG
    // Clips the scene slice at (targetX, targetY), but renders the piece at X=0 so it starts at the left edge
    const puzzlePieceSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
        <defs>
          <clipPath id="pieceClip">
            <path d="${puzzlePathAtOrigin}"/>
          </clipPath>
          <filter id="pieceShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.7"/>
          </filter>
        </defs>
        <g filter="url(#pieceShadow)">
          <!-- Clipped scene slice (shifted by -targetX so it matches the cutout at targetX) -->
          <g clip-path="url(#pieceClip)">
            <g transform="translate(${-targetX}, 0)">
              ${sceneElements}
            </g>
          </g>
          <!-- Border highlight at left starting position -->
          <path d="${puzzlePathAtOrigin}" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.95"/>
        </g>
      </svg>
    `.replace(/\s+/g, ' ').trim();

    // Base64 Data URIs
    const bgBase64 = `data:image/svg+xml;base64,${Buffer.from(backgroundSVG).toString('base64')}`;
    const pieceBase64 = `data:image/svg+xml;base64,${Buffer.from(puzzlePieceSVG).toString('base64')}`;

    const now = Date.now();
    const expireAt = now + this.ttlMs;

    // Cryptographic Token (HMAC signed)
    const tokenPayload = `${id}|${targetX}|${targetY}|${now}|${expireAt}`;
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(tokenPayload)
      .digest('hex');
    const token = Buffer.from(`${tokenPayload}|${signature}`).toString('base64url');

    return {
      id,
      token,
      backgroundImage: bgBase64,
      puzzlePieceImage: pieceBase64,
      targetY,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      pieceWidth: PIECE_SIZE,
      pieceHeight: PIECE_SIZE,
      expireAt,
    };
  }

  /**
   * Verifies the cryptographic token and extracts server state.
   */
  public verifyToken(token: string): { valid: boolean; data?: { id: string; targetX: number; targetY: number; createdAt: number; expireAt: number }; error?: string } {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split('|');
      if (parts.length !== 6) {
        return { valid: false, error: 'Token 格式损坏或无效' };
      }

      const [id, targetXStr, targetYStr, createdAtStr, expireAtStr, signature] = parts;
      const expectedPayload = `${id}|${targetXStr}|${targetYStr}|${createdAtStr}|${expireAtStr}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(expectedPayload)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return { valid: false, error: 'Token 签名校验失败（疑似伪造或篡改）' };
      }

      const expireAt = parseInt(expireAtStr, 10);
      if (Date.now() > expireAt) {
        return { valid: false, error: '验证码已超时（超过有效期，请刷新重新验证）' };
      }

      return {
        valid: true,
        data: {
          id,
          targetX: parseInt(targetXStr, 10),
          targetY: parseInt(targetYStr, 10),
          createdAt: parseInt(createdAtStr, 10),
          expireAt,
        },
      };
    } catch (err: any) {
      return { valid: false, error: 'Token 解析异常: ' + (err.message || '未知错误') };
    }
  }

  /**
   * Generates a secondary validation ticket for host applications.
   */
  public generateTicket(challengeId: string): string {
    const timestamp = Date.now();
    const expireAt = timestamp + 300 * 1000; // 5 minutes validity
    const raw = `${challengeId}|${timestamp}|${expireAt}`;
    const sign = crypto.createHmac('sha256', this.secretKey).update(raw).digest('hex');
    return 'ticket_' + Buffer.from(`${raw}|${sign}`).toString('base64url');
  }

  /**
   * Validates a secondary validation ticket.
   */
  public validateTicket(ticket: string): { valid: boolean; challengeId?: string; error?: string } {
    try {
      if (!ticket.startsWith('ticket_')) {
        return { valid: false, error: '无效凭证前缀' };
      }
      const rawToken = ticket.slice(7);
      const decoded = Buffer.from(rawToken, 'base64url').toString('utf8');
      const [challengeId, timestampStr, expireAtStr, sign] = decoded.split('|');

      const expectedRaw = `${challengeId}|${timestampStr}|${expireAtStr}`;
      const expectedSign = crypto.createHmac('sha256', this.secretKey).update(expectedRaw).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(sign), Buffer.from(expectedSign))) {
        return { valid: false, error: '二次验证凭证签名非法' };
      }

      if (Date.now() > parseInt(expireAtStr, 10)) {
        return { valid: false, error: '二次验证凭证已过期' };
      }

      return { valid: true, challengeId };
    } catch (err: any) {
      return { valid: false, error: '二次验证凭证解析失败: ' + err.message };
    }
  }
}
