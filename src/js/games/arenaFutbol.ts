/**
 * 8. OYUN: Arena Futbol (Mini Futbol)
 * - Oyuncu sayısına göre 2, 3 veya 4 kaleli üstten görünümlü fizik tabanlı futbol arenası.
 * - Oyuncular küp karakterleriyle topa yön verir ve şut/depar (dash) butonuyla sert vurabilir.
 * - Kendi kalesini koruyup rakiplere gol atmaya çalışırlar.
 * - 60 saniye sonunda en çok gol atan (veya ilk 5 gole ulaşan) kazanır.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import { PLAYERS_CONFIG } from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface SoccerPlayer {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  goals: number;
  dashTimer: number;
  dashCooldown: number;
}

interface GoalPost {
  ownerId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'bottom' | 'top' | 'left' | 'right';
}

export class ArenaFutbolGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private players: SoccerPlayer[] = [];
  private goals: GoalPost[] = [];
  private ball = {
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    radius: 14,
    lastTouchId: -1
  };
  private effects = new EffectsManager();
  private timeRemaining = 60;
  private targetGoals = 5;
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  // Saha sınırları
  private fieldX = 36;
  private fieldY = 36;
  private fieldW = 728;
  private fieldH = 528;

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.players = [];
    this.effects.reset();
    this.timeRemaining = 60;
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    this.setupPitch(width, height, playerCount);

    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        id: i,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 17,
        goals: 0,
        dashTimer: 0,
        dashCooldown: 0
      });
    }

    this.resetKickoff();
  }

  private setupPitch(w: number, h: number, count: number): void {
    const padX = Math.min(54, w * 0.07);
    const padY = Math.min(54, h * 0.08);
    this.fieldX = padX;
    this.fieldY = padY;
    this.fieldW = w - padX * 2;
    this.fieldH = h - padY * 2;

    const cx = w * 0.5;
    const cy = h * 0.5;
    const goalSpan = Math.min(130, Math.min(this.fieldW, this.fieldH) * 0.34);
    const goalDepth = 18;

    // Oyuncu sayısına göre 2, 3 veya 4 kale yerleştir:
    // P1 (0): Alt Kale, P2 (1): Üst Kale, P3 (2): Sol Kale, P4 (3): Sağ Kale
    this.goals = [];
    if (count >= 1) {
      this.goals.push({
        ownerId: 0,
        x: cx - goalSpan * 0.5,
        y: this.fieldY + this.fieldH - 4,
        w: goalSpan,
        h: goalDepth,
        side: 'bottom'
      });
    }
    if (count >= 2) {
      this.goals.push({
        ownerId: 1,
        x: cx - goalSpan * 0.5,
        y: this.fieldY - goalDepth + 4,
        w: goalSpan,
        h: goalDepth,
        side: 'top'
      });
    }
    if (count >= 3) {
      this.goals.push({
        ownerId: 2,
        x: this.fieldX - goalDepth + 4,
        y: cy - goalSpan * 0.5,
        w: goalDepth,
        h: goalSpan,
        side: 'left'
      });
    }
    if (count >= 4) {
      this.goals.push({
        ownerId: 3,
        x: this.fieldX + this.fieldW - 4,
        y: cy - goalSpan * 0.5,
        w: goalDepth,
        h: goalSpan,
        side: 'right'
      });
    }
  }

  private resetKickoff(): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    this.ball.x = cx;
    this.ball.y = cy;
    this.ball.vx = (Math.random() - 0.5) * 40;
    this.ball.vy = (Math.random() - 0.5) * 40;
    this.ball.lastTouchId = -1;

    // Her oyuncuyu kendi kalesinin önüne yerleştir
    const spawns = [
      { x: cx, y: this.fieldY + this.fieldH - 58 }, // P1 Alt
      { x: cx, y: this.fieldY + 58 }, // P2 Üst
      { x: this.fieldX + 58, y: cy }, // P3 Sol
      { x: this.fieldX + this.fieldW - 58, y: cy } // P4 Sağ
    ];

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.x = spawns[i].x;
      p.y = spawns[i].y;
      p.vx = 0;
      p.vy = 0;
      p.angle = Math.atan2(cy - p.y, cx - p.x);
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.setupPitch(width, height, this.playerCount);
  }

  public update(dt: number, inputs: PlayerInputState[], botAssist: boolean): void {
    const pausedByHitstop = this.effects.update(dt);
    if (pausedByHitstop || this.isGameOver) return;

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const now = performance.now();

    for (let i = 0; i < this.playerCount; i++) {
      const p = this.players[i];
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let moveX = inp ? inp.moveX : 0;
      let moveY = inp ? inp.moveY : 0;
      let wantShoot = inp ? inp.actionJustPressed : false;

      if (botAssist && !isHuman) {
        // Topa doğru koş ve topa yaklaşınca rakip kaleye şut çek
        const dx = this.ball.x - p.x;
        const dy = this.ball.y - p.y;
        const dist = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        p.angle = a;
        moveX = Math.cos(a) * 0.92;
        moveY = Math.sin(a) * 0.92;
        if (dist < p.radius + this.ball.radius + 24 && p.dashCooldown <= 0) {
          wantShoot = true;
        }
      } else if (inp && inp.magnitude > 0.1) {
        p.angle = inp.angle;
      }

      // Şut / Depar (Dash) Butonu
      if (wantShoot && p.dashCooldown <= 0) {
        p.dashTimer = 0.22;
        p.dashCooldown = 0.75;
        p.vx = Math.cos(p.angle) * 320;
        p.vy = Math.sin(p.angle) * 320;
        soundEngine.playSwing();
        this.effects.spawnBurst(p.x, p.y, PLAYERS_CONFIG[p.id].color, 7, 90, 4);

        // Top yakındaysa sert şut vur!
        const ballDist = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
        if (ballDist <= p.radius + this.ball.radius + 26) {
          const shotAngle = Math.atan2(this.ball.y - p.y, this.ball.x - p.x);
          this.ball.vx = Math.cos(shotAngle) * 460;
          this.ball.vy = Math.sin(shotAngle) * 460;
          this.ball.lastTouchId = p.id;
          soundEngine.playHit();
          this.effects.addShake(0.25);
          this.effects.spawnBurst(this.ball.x, this.ball.y, '#FEE440', 12, 140, 5);
        }
      }

      const baseSpeed = p.dashTimer > 0 ? 260 : 152;
      p.vx = moveX * baseSpeed + p.vx * 0.75;
      p.vy = moveY * baseSpeed + p.vy * 0.75;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Saha içi sınırlar
      p.x = Math.max(this.fieldX + p.radius, Math.min(this.fieldX + this.fieldW - p.radius, p.x));
      p.y = Math.max(this.fieldY + p.radius, Math.min(this.fieldY + this.fieldH - p.radius, p.y));

      // Oyuncu - Top Çarpışması (Top Sürme & Şut)
      const bDx = this.ball.x - p.x;
      const bDy = this.ball.y - p.y;
      const bDist = Math.hypot(bDx, bDy);
      const minDist = p.radius + this.ball.radius;
      if (bDist > 0.01 && bDist < minDist) {
        const nx = bDx / bDist;
        const ny = bDy / bDist;
        const overlap = minDist - bDist;
        this.ball.x += nx * overlap;
        this.ball.y += ny * overlap;

        const kickPower = p.dashTimer > 0 ? 390 : 230;
        this.ball.vx = nx * kickPower + p.vx * 0.4;
        this.ball.vy = ny * kickPower + p.vy * 0.4;
        this.ball.lastTouchId = p.id;
        soundEngine.playHit();
      }
    }

    // Oyuncular arası omuz omuza çarpışma
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i];
        const b = this.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = a.radius + b.radius;
        if (d > 0.1 && d < minD) {
          const push = (minD - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // Top Hareketi ve Sürtünme
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.vx *= Math.pow(0.985, dt * 60);
    this.ball.vy *= Math.pow(0.985, dt * 60);

    // Gol Kontrolü (2, 3 veya 4 aktif kale)
    for (const g of this.goals) {
      if (
        this.ball.x >= g.x &&
        this.ball.x <= g.x + g.w &&
        this.ball.y >= g.y &&
        this.ball.y <= g.y + g.h
      ) {
        this.handleGoalScored(g.ownerId);
        return;
      }
    }

    // Saha yan duvarlarından sekme
    if (this.ball.x - this.ball.radius < this.fieldX) {
      this.ball.x = this.fieldX + this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx) * 0.85;
      soundEngine.playHit();
    } else if (this.ball.x + this.ball.radius > this.fieldX + this.fieldW) {
      this.ball.x = this.fieldX + this.fieldW - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx) * 0.85;
      soundEngine.playHit();
    }

    if (this.ball.y - this.ball.radius < this.fieldY) {
      this.ball.y = this.fieldY + this.ball.radius;
      this.ball.vy = Math.abs(this.ball.vy) * 0.85;
      soundEngine.playHit();
    } else if (this.ball.y + this.ball.radius > this.fieldY + this.fieldH) {
      this.ball.y = this.fieldY + this.fieldH - this.ball.radius;
      this.ball.vy = -Math.abs(this.ball.vy) * 0.85;
      soundEngine.playHit();
    }

    // Süre Bitişi Kontrolü
    if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      const sorted = [...this.players].sort((a, b) => b.goals - a.goals);
      this.winnerId = sorted[0]?.id ?? 0;
      this.winReason = '60 saniye doldu — En çok gol atan şampiyon!';
      soundEngine.playWin();
    }
  }

  private handleGoalScored(concededByPlayerId: number): void {
    // Golü atan kişi: Son dokunan rakip oyuncu. Kendi kalesine attıysa diğer rakiplere +1 gol yazılır.
    let scorerId = this.ball.lastTouchId;
    if (scorerId >= 0 && scorerId !== concededByPlayerId) {
      this.players[scorerId].goals++;
    } else {
      // Kendi kalesine gol: diğer tüm oyunculara +1 gol
      for (const p of this.players) {
        if (p.id !== concededByPlayerId) {
          p.goals++;
          scorerId = p.id;
        }
      }
    }

    const validScorer = Math.max(0, scorerId);
    soundEngine.playGoal();
    this.effects.triggerHitstop(0.06);
    this.effects.addShake(0.65);
    this.effects.spawnBurst(
      this.ball.x,
      this.ball.y,
      PLAYERS_CONFIG[validScorer].color,
      28,
      220,
      8
    );
    this.effects.spawnText(
      this.width * 0.5,
      this.height * 0.5,
      `GOL! ${PLAYERS_CONFIG[validScorer].shortName}`,
      PLAYERS_CONFIG[validScorer].color
    );

    // 5 gole ilk ulaşan kazanır
    for (const p of this.players) {
      if (p.goals >= this.targetGoals) {
        this.isGameOver = true;
        this.winnerId = p.id;
        this.winReason = '5 gole ilk ulaşan Arena Futbol şampiyonu!';
        soundEngine.playWin();
        return;
      }
    }

    this.resetKickoff();
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 42);

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;

    // Saha çizgileri
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.fieldX, this.fieldY, this.fieldW, this.fieldH);

    // Orta yuvarlak ve santra çizgisi
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Kaleleri Çiz (2, 3 veya 4 Kale)
    for (const g of this.goals) {
      const cfg = PLAYERS_CONFIG[g.ownerId];
      ctx.fillStyle = cfg.glowColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeRect(g.x, g.y, g.w, g.h);
    }

    // Oyuncuları Çiz
    for (const p of this.players) {
      const cfg = PLAYERS_CONFIG[p.id];
      ctx.save();
      ctx.translate(p.x, p.y);

      if (p.dashTimer > 0) {
        ctx.strokeStyle = '#FEE440';
        ctx.lineWidth = 2;
        ctx.strokeRect(-p.radius - 5, -p.radius - 5, (p.radius + 5) * 2, (p.radius + 5) * 2);
      }

      ctx.save();
      ctx.rotate(p.angle);
      const r = p.radius;
      ctx.fillStyle = cfg.darkColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeRect(-r, -r, r * 2, r * 2);

      // Ön şut tamponu
      ctx.fillStyle = cfg.color;
      ctx.fillRect(r * 0.35, -r * 0.6, r * 0.55, r * 1.2);
      ctx.restore();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.goals} GOL`, 0, -p.radius - 8);
      ctx.restore();
    }

    // Futbol Topu (Geometrik Neon Küre)
    ctx.save();
    ctx.translate(this.ball.x, this.ball.y);
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle =
      this.ball.lastTouchId >= 0 ? PLAYERS_CONFIG[this.ball.lastTouchId].color : '#38BDF8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Top içi beşgen/küp motif
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      statusMessage: 'Kendi kaleni koru, Şut/Depar ile rakip kalelere gol at! (60sn / 5 Gol)',
      players: this.players.map((p) => ({
        id: p.id,
        alive: true,
        score: p.goals,
        metricText: `${p.goals} / ${this.targetGoals} GOL`
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
