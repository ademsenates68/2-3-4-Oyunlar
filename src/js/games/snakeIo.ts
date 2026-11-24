/**
 * 6. OYUN: Snake.io (Yılan Arenası)
 * - Sürekli hareket eden yılanlar, yerdeki noktaları yedikçe uzar.
 * - Bir yılanın kafası başka bir yılanın gövdesine (veya arena duvarına) çarparsa yok olur.
 * - Yok olan yılanın XP'si doğrudan rakibe gitmez; bunun yerine yılanın tüm gövde izi boyunca
 *   yüksek puanlı parlak noktalar oluşur ve diğer oyuncular bunları toplayabilir.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import { checkEliminationWinner, PLAYERS_CONFIG } from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface SnakeSegment {
  x: number;
  y: number;
}

interface SnakePlayer {
  id: number;
  headX: number;
  headY: number;
  angle: number;
  segments: SnakeSegment[];
  targetLength: number;
  score: number;
  alive: boolean;
  boosting: boolean;
}

interface FoodOrb {
  x: number;
  y: number;
  value: number;
  radius: number;
  color: string;
  glowing: boolean;
}

export class SnakeIoGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private snakes: SnakePlayer[] = [];
  private foods: FoodOrb[] = [];
  private effects = new EffectsManager();
  private timeRemaining = 80;
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.snakes = [];
    this.foods = [];
    this.effects.reset();
    this.timeRemaining = 80;
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    const padX = Math.min(130, width * 0.19);
    const padY = Math.min(130, height * 0.2);
    const spawns =
      playerCount === 2
        ? [
            { x: width * 0.35, y: height - padY },
            { x: width * 0.65, y: padY }
          ]
        : [
            { x: padX, y: height - padY },
            { x: width - padX, y: padY },
            { x: padX, y: padY },
            { x: width - padX, y: height - padY }
          ];

    for (let i = 0; i < playerCount; i++) {
      const angle = Math.atan2(height * 0.5 - spawns[i].y, width * 0.5 - spawns[i].x);
      const segs: SnakeSegment[] = [];
      for (let s = 0; s < 12; s++) {
        segs.push({
          x: spawns[i].x - Math.cos(angle) * s * 8,
          y: spawns[i].y - Math.sin(angle) * s * 8
        });
      }
      this.snakes.push({
        id: i,
        headX: spawns[i].x,
        headY: spawns[i].y,
        angle,
        segments: segs,
        targetLength: 12,
        score: 120,
        alive: true,
        boosting: false
      });
    }

    for (let i = 0; i < 40; i++) {
      this.spawnFood();
    }
  }

  private spawnFood(x?: number, y?: number, value = 10, color?: string, glowing = false): void {
    const palette = ['#00F5D4', '#FF2A85', '#FEE440', '#9B5DE5', '#00F59B'];
    this.foods.push({
      x: x ?? 45 + Math.random() * (this.width - 90),
      y: y ?? 45 + Math.random() * (this.height - 90),
      value,
      radius: glowing ? 8 : 4.5,
      color: color ?? palette[Math.floor(Math.random() * palette.length)],
      glowing
    });
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public update(dt: number, inputs: PlayerInputState[], botAssist: boolean): void {
    const pausedByHitstop = this.effects.update(dt);
    if (pausedByHitstop || this.isGameOver) return;

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    while (this.foods.length < 38) {
      this.spawnFood();
    }

    const now = performance.now();
    const wallMargin = 20;

    for (let i = 0; i < this.playerCount; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let desiredAngle = s.angle;
      s.boosting = inp ? inp.actionHeld : false;

      if (botAssist && !isHuman) {
        // Duvarlardan uzak dur ve en yakın parlak noktaya yönel
        const lookAheadX = s.headX + Math.cos(s.angle) * 65;
        const lookAheadY = s.headY + Math.sin(s.angle) * 65;
        if (
          lookAheadX < wallMargin + 40 ||
          lookAheadX > this.width - wallMargin - 40 ||
          lookAheadY < wallMargin + 40 ||
          lookAheadY > this.height - wallMargin - 40
        ) {
          desiredAngle = Math.atan2(this.height * 0.5 - s.headY, this.width * 0.5 - s.headX);
        } else {
          let bestFood: FoodOrb | null = null;
          let bestScore = -Infinity;
          for (const f of this.foods) {
            const d = Math.hypot(f.x - s.headX, f.y - s.headY);
            const weight = (f.glowing ? 350 : 100) - d;
            if (weight > bestScore) {
              bestScore = weight;
              bestFood = f;
            }
          }
          if (bestFood) {
            desiredAngle = Math.atan2(bestFood.y - s.headY, bestFood.x - s.headX);
          }
        }
      } else if (inp && inp.magnitude > 0.12) {
        desiredAngle = inp.angle;
      }

      // Yumuşak açı dönüşü
      let diff = desiredAngle - s.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnRate = 5.4;
      s.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));

      const speed = s.boosting ? 185 : 128;
      s.headX += Math.cos(s.angle) * speed * dt;
      s.headY += Math.sin(s.angle) * speed * dt;

      // Gövde izini takip ettir (8px aralıklarla)
      const firstSeg = s.segments[0];
      if (Math.hypot(s.headX - firstSeg.x, s.headY - firstSeg.y) >= 8) {
        s.segments.unshift({ x: s.headX, y: s.headY });
        while (s.segments.length > s.targetLength) {
          s.segments.pop();
        }
      } else {
        firstSeg.x = s.headX;
        firstSeg.y = s.headY;
      }

      // Noktaları yeme
      for (let k = this.foods.length - 1; k >= 0; k--) {
        const f = this.foods[k];
        if (Math.hypot(f.x - s.headX, f.y - s.headY) <= 15 + f.radius) {
          s.score += f.value;
          s.targetLength = Math.min(85, 12 + Math.floor((s.score - 120) / 14));
          soundEngine.playPickup(f.glowing);
          this.foods.splice(k, 1);
        }
      }
    }

    // Duvara veya başka bir yılanın gövdesine çarpma kontrolü
    for (const s of this.snakes) {
      if (!s.alive) continue;

      let crashed = false;
      // 1. Arena dış duvarına çarpma
      if (
        s.headX < wallMargin + 10 ||
        s.headX > this.width - wallMargin - 10 ||
        s.headY < wallMargin + 10 ||
        s.headY > this.height - wallMargin - 10
      ) {
        crashed = true;
      }

      // 2. Başka bir yılanın gövdesine çarpma
      if (!crashed) {
        for (const other of this.snakes) {
          if (!other.alive || other.id === s.id) continue;
          for (let segIdx = 0; segIdx < other.segments.length; segIdx++) {
            const seg = other.segments[segIdx];
            if (Math.hypot(s.headX - seg.x, s.headY - seg.y) <= 16) {
              crashed = true;
              break;
            }
          }
          if (crashed) break;
        }
      }

      if (crashed) {
        this.destroySnakeIntoTrail(s);
      }
    }

    const check = checkEliminationWinner(
      this.snakes.map((s) => ({ id: s.id, alive: s.alive, score: s.score }))
    );
    if (check.finished) {
      this.isGameOver = true;
      this.winnerId = check.winnerId;
      this.winReason = 'Arenada hayatta kalan son yılan!';
      soundEngine.playWin();
    } else if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      const sorted = [...this.snakes]
        .filter((s) => s.alive)
        .sort((a, b) => b.score - a.score);
      this.winnerId = sorted[0]?.id ?? 0;
      this.winReason = 'Süre doldu — En uzun neon yılan!';
      soundEngine.playWin();
    }
  }

  /**
   * Yok olan yılanın XP'si doğrudan rakibe gitmez; tüm gövde izi boyunca yüksek puanlı parlak noktalar oluşur!
   */
  private destroySnakeIntoTrail(snake: SnakePlayer): void {
    snake.alive = false;
    const cfg = PLAYERS_CONFIG[snake.id];
    soundEngine.playExplosion();
    this.effects.triggerHitstop(0.055);
    this.effects.addShake(0.6);
    this.effects.spawnBurst(snake.headX, snake.headY, cfg.color, 24, 180, 7);
    this.effects.spawnText(snake.headX, snake.headY - 18, 'GÖVDE İZİ SAÇILDI!', cfg.color);

    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      this.spawnFood(
        seg.x + (Math.random() - 0.5) * 6,
        seg.y + (Math.random() - 0.5) * 6,
        35,
        cfg.color,
        true
      );
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 40);

    // Ölümcül kırmızı/neon dış sınır duvarı
    ctx.strokeStyle = '#FF2A85';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, this.width - 40, this.height - 40);

    // Yerdeki noktalar ve yok olan yılanların parlak iz küreleri
    for (const f of this.foods) {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.glowing) {
        ctx.fillStyle = f.color;
        ctx.fillRect(-f.radius, -f.radius, f.radius * 2, f.radius * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(-f.radius, -f.radius, f.radius * 2, f.radius * 2);
      } else {
        ctx.fillStyle = f.color;
        ctx.fillRect(-f.radius, -f.radius, f.radius * 2, f.radius * 2);
      }
      ctx.restore();
    }

    // Yılanları çiz
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const cfg = PLAYERS_CONFIG[s.id];

      // Kuyruktan kafaya doğru geometrik küp halkalar
      for (let i = s.segments.length - 1; i >= 1; i--) {
        const seg = s.segments[i];
        const ratio = 1 - (i / s.segments.length) * 0.4;
        const size = 16 * ratio;
        ctx.fillStyle = i % 2 === 0 ? cfg.color : cfg.darkColor;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(seg.x - size * 0.5, seg.y - size * 0.5, size, size);
        ctx.strokeRect(seg.x - size * 0.5, seg.y - size * 0.5, size, size);
      }

      // Yılan Kafası
      ctx.save();
      ctx.translate(s.headX, s.headY);
      ctx.rotate(s.angle);
      ctx.fillStyle = cfg.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);

      // Gözler
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(3, -6, 4, 4);
      ctx.fillRect(3, 2, 4, 4);
      ctx.restore();

      // Uzunluk / Skor Etiketi
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.score} XP`, s.headX, s.headY - 16);
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      statusMessage: 'Rakip yılanların önüne kır, saçılan parlak gövde izini topla!',
      players: this.snakes.map((s) => ({
        id: s.id,
        alive: s.alive,
        score: s.score,
        distance: s.segments.length * 8,
        metricText: s.alive ? `BOYU: ${s.segments.length} · ${s.score}` : 'ÇARPTI'
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
