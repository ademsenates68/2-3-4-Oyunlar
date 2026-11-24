/**
 * 2. OYUN: Tank.io (Arena Savaşı)
 * - Duvar engellerinin olduğu üstten görünümlü arena.
 * - Her tankın 2 mermi kapasitesi vardır; 2 mermi atıldığında kısa bekleme (cooldown) ardından tekrar dolar.
 * - Tek mermi isabet eden tank anında patlar ve elenir (Kalkan Küresi yoksa).
 * - Rastgele güçlendirme küreleri: Hız Küresi (Mavi), Küçülme Küresi (Sarı), Kalkan Küresi (Mor - 1 mermi engeller).
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import {
  checkEliminationWinner,
  PLAYERS_CONFIG,
  resolveCircleRectCollision
} from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

type PowerUpType = 'speed' | 'shrink' | 'shield';

interface PowerUpOrb {
  x: number;
  y: number;
  type: PowerUpType;
  radius: number;
  pulse: number;
}

interface TankPlayer {
  id: number;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  ammo: number;
  maxAmmo: number;
  reloadTimer: number;
  fireGapTimer: number;
  speedTimer: number;
  shrinkTimer: number;
  hasShield: boolean;
  kills: number;
}

interface Bullet {
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
}

interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class TankIoGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private tanks: TankPlayer[] = [];
  private bullets: Bullet[] = [];
  private walls: WallRect[] = [];
  private orbs: PowerUpOrb[] = [];
  private orbSpawnTimer = 3.0;
  private effects = new EffectsManager();
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.tanks = [];
    this.bullets = [];
    this.orbs = [];
    this.orbSpawnTimer = 2.2;
    this.effects.reset();
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    this.buildWalls(width, height);
    const spawns = this.getSpawns(width, height, playerCount);

    for (let i = 0; i < playerCount; i++) {
      const cx = width * 0.5;
      const cy = height * 0.5;
      this.tanks.push({
        id: i,
        x: spawns[i].x,
        y: spawns[i].y,
        angle: Math.atan2(cy - spawns[i].y, cx - spawns[i].x),
        alive: true,
        ammo: 2,
        maxAmmo: 2,
        reloadTimer: 0,
        fireGapTimer: 0,
        speedTimer: 0,
        shrinkTimer: 0,
        hasShield: false,
        kills: 0
      });
    }

    // Başlangıçta 2 güçlendirme küresi çıkar
    this.spawnPowerUp();
    this.spawnPowerUp();
  }

  private buildWalls(w: number, h: number): void {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const bw = Math.max(24, Math.min(44, w * 0.045));
    const bh = Math.max(70, Math.min(130, h * 0.18));

    this.walls = [
      // Merkez artı / siper blokları
      { x: cx - bw * 0.5, y: cy - bh * 0.45, w: bw, h: bh * 0.9 },
      // Sol ve sağ taktiksel siperler
      { x: w * 0.27 - bw * 0.5, y: cy - bh * 0.6, w: bw, h: bh * 1.2 },
      { x: w * 0.73 - bw * 0.5, y: cy - bh * 0.6, w: bw, h: bh * 1.2 },
      // Üst ve alt yatay bloklar
      { x: cx - bh * 0.7, y: h * 0.24 - bw * 0.5, w: bh * 1.4, h: bw },
      { x: cx - bh * 0.7, y: h * 0.76 - bw * 0.5, w: bh * 1.4, h: bw }
    ];
  }

  private getSpawns(w: number, h: number, count: number): Array<{ x: number; y: number }> {
    const padX = Math.min(110, w * 0.15);
    const padY = Math.min(110, h * 0.16);
    if (count === 2) {
      return [
        { x: w * 0.5, y: h - padY },
        { x: w * 0.5, y: padY }
      ];
    }
    return [
      { x: padX, y: h - padY },
      { x: w - padX, y: padY },
      { x: padX, y: padY },
      { x: w - padX, y: h - padY }
    ];
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.buildWalls(width, height);
  }

  private spawnPowerUp(): void {
    if (this.orbs.length >= 4) return;
    const types: PowerUpType[] = ['speed', 'shrink', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    for (let attempt = 0; attempt < 15; attempt++) {
      const x = 90 + Math.random() * (this.width - 180);
      const y = 90 + Math.random() * (this.height - 180);
      let insideWall = false;
      for (const w of this.walls) {
        if (x > w.x - 24 && x < w.x + w.w + 24 && y > w.y - 24 && y < w.y + w.h + 24) {
          insideWall = true;
          break;
        }
      }
      if (!insideWall) {
        this.orbs.push({ x, y, type, radius: 13, pulse: 0 });
        break;
      }
    }
  }

  public update(dt: number, inputs: PlayerInputState[], botAssist: boolean): void {
    const pausedByHitstop = this.effects.update(dt);
    if (pausedByHitstop || this.isGameOver) return;

    this.orbSpawnTimer -= dt;
    if (this.orbSpawnTimer <= 0) {
      this.spawnPowerUp();
      this.orbSpawnTimer = 4.5;
    }

    for (const orb of this.orbs) {
      orb.pulse += dt * 4;
    }

    const now = performance.now();

    for (let i = 0; i < this.playerCount; i++) {
      const t = this.tanks[i];
      if (!t.alive) continue;

      t.speedTimer = Math.max(0, t.speedTimer - dt);
      t.shrinkTimer = Math.max(0, t.shrinkTimer - dt);
      t.fireGapTimer = Math.max(0, t.fireGapTimer - dt);

      // 2 mermi bittiğinde kısa bekleme (cooldown) ardından 2 mermi tekrar dolar
      if (t.ammo < t.maxAmmo) {
        t.reloadTimer -= dt;
        if (t.reloadTimer <= 0) {
          t.ammo = t.maxAmmo;
          this.effects.spawnText(t.x, t.y - 24, '2/2 MERMİ', PLAYERS_CONFIG[t.id].color);
        }
      }

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let moveX = inp ? inp.moveX : 0;
      let moveY = inp ? inp.moveY : 0;
      let wantFire = inp ? inp.actionJustPressed : false;

      // Bot Desteği
      if (botAssist && !isHuman) {
        let nearestEnemy: TankPlayer | null = null;
        let minDist = Infinity;
        for (const other of this.tanks) {
          if (other.id === t.id || !other.alive) continue;
          const d = Math.hypot(other.x - t.x, other.y - t.y);
          if (d < minDist) {
            minDist = d;
            nearestEnemy = other;
          }
        }
        if (nearestEnemy) {
          const dx = nearestEnemy.x - t.x;
          const dy = nearestEnemy.y - t.y;
          const targetAngle = Math.atan2(dy, dx);
          t.angle = targetAngle;
          if (minDist > 155) {
            moveX = Math.cos(targetAngle) * 0.8;
            moveY = Math.sin(targetAngle) * 0.8;
          } else {
            // Yana doğru manevra
            moveX = Math.cos(targetAngle + Math.PI * 0.5) * 0.7;
            moveY = Math.sin(targetAngle + Math.PI * 0.5) * 0.7;
          }
          if (t.ammo > 0 && t.fireGapTimer <= 0 && Math.random() < dt * 2.2) {
            wantFire = true;
          }
        }
      } else if (inp && inp.magnitude > 0.1) {
        t.angle = inp.angle;
      }

      const baseRadius = t.shrinkTimer > 0 ? 11 : 18;
      const moveSpeed = t.speedTimer > 0 ? 205 : 135;

      t.x += moveX * moveSpeed * dt;
      t.y += moveY * moveSpeed * dt;

      // Arena sınırları
      const pad = baseRadius + 16;
      t.x = Math.max(pad, Math.min(this.width - pad, t.x));
      t.y = Math.max(pad, Math.min(this.height - pad, t.y));

      // Duvar çarpışması
      for (const w of this.walls) {
        const res = resolveCircleRectCollision(t.x, t.y, baseRadius, w.x, w.y, w.w, w.h);
        if (res.collided) {
          t.x = res.x;
          t.y = res.y;
        }
      }

      // Güçlendirme küresi toplama
      for (let k = this.orbs.length - 1; k >= 0; k--) {
        const orb = this.orbs[k];
        if (Math.hypot(orb.x - t.x, orb.y - t.y) <= baseRadius + orb.radius) {
          soundEngine.playPickup(true);
          if (orb.type === 'speed') {
            t.speedTimer = 6.0;
            this.effects.spawnText(t.x, t.y - 24, 'HIZ KÜRESİ!', '#00F5D4');
          } else if (orb.type === 'shrink') {
            t.shrinkTimer = 6.5;
            this.effects.spawnText(t.x, t.y - 24, 'KÜÇÜLDÜ!', '#FEE440');
          } else if (orb.type === 'shield') {
            t.hasShield = true;
            this.effects.spawnText(t.x, t.y - 24, 'KALKAN AKTİF!', '#9B5DE5');
          }
          this.effects.spawnBurst(orb.x, orb.y, '#FFFFFF', 10, 100, 5, 'ring');
          this.orbs.splice(k, 1);
        }
      }

      // Ateş etme (2 mermi kapasitesi)
      if (wantFire && t.ammo > 0 && t.fireGapTimer <= 0) {
        t.ammo--;
        t.fireGapTimer = 0.18;
        if (t.ammo === 0) {
          t.reloadTimer = 1.65; // 2 mermi atıldıktan sonra dolum bekleme süresi
        } else if (t.reloadTimer <= 0) {
          t.reloadTimer = 1.65;
        }

        const muzzleX = t.x + Math.cos(t.angle) * (baseRadius + 10);
        const muzzleY = t.y + Math.sin(t.angle) * (baseRadius + 10);
        this.bullets.push({
          ownerId: t.id,
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(t.angle) * 390,
          vy: Math.sin(t.angle) * 390,
          radius: 5,
          color: PLAYERS_CONFIG[t.id].color,
          life: 1.8
        });
        soundEngine.playShoot();
        this.effects.spawnBurst(muzzleX, muzzleY, PLAYERS_CONFIG[t.id].color, 5, 80, 3);
      }
    }

    // Mermi hareketi ve tek vuruşta patlama kontrolü
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (
        b.life <= 0 ||
        b.x < 12 ||
        b.x > this.width - 12 ||
        b.y < 12 ||
        b.y > this.height - 12
      ) {
        this.effects.spawnBurst(b.x, b.y, b.color, 5, 70, 3);
        this.bullets.splice(i, 1);
        continue;
      }

      // Duvara çarpma
      let hitWall = false;
      for (const w of this.walls) {
        if (b.x + b.radius > w.x && b.x - b.radius < w.x + w.w && b.y + b.radius > w.y && b.y - b.radius < w.y + w.h) {
          hitWall = true;
          break;
        }
      }
      if (hitWall) {
        soundEngine.playHit();
        this.effects.spawnBurst(b.x, b.y, b.color, 7, 90, 4);
        this.bullets.splice(i, 1);
        continue;
      }

      // Tanka isabet
      for (const t of this.tanks) {
        if (!t.alive || t.id === b.ownerId) continue;
        const tRadius = t.shrinkTimer > 0 ? 11 : 18;
        if (Math.hypot(t.x - b.x, t.y - b.y) <= tRadius + b.radius) {
          this.bullets.splice(i, 1);

          if (t.hasShield) {
            // Kalkan Küresi 1 mermiyi engeller
            t.hasShield = false;
            soundEngine.playHit();
            this.effects.addShake(0.25);
            this.effects.spawnBurst(t.x, t.y, '#9B5DE5', 16, 150, 6, 'ring');
            this.effects.spawnText(t.x, t.y - 24, 'KALKAN KORUDU!', '#9B5DE5');
          } else {
            // Tek mermi isabetinde anında patlar ve elenir!
            t.alive = false;
            this.tanks[b.ownerId].kills++;
            soundEngine.playExplosion();
            this.effects.triggerHitstop(0.06);
            this.effects.addShake(0.65);
            this.effects.spawnBurst(t.x, t.y, PLAYERS_CONFIG[t.id].color, 28, 220, 8);
            this.effects.spawnText(t.x, t.y - 20, 'PATLADI!', '#FF2A85');
          }
          break;
        }
      }
    }

    const check = checkEliminationWinner(
      this.tanks.map((t) => ({ id: t.id, alive: t.alive, score: t.kills }))
    );
    if (check.finished) {
      this.isGameOver = true;
      this.winnerId = check.winnerId;
      this.winReason = 'Arenada hayatta kalan son tank!';
      soundEngine.playWin();
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 40);

    // Arena dış duvar çerçevesi
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, this.width - 24, this.height - 24);

    // İç engel duvarları
    for (const w of this.walls) {
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    }

    // Güçlendirme küreleri
    for (const orb of this.orbs) {
      ctx.save();
      ctx.translate(orb.x, orb.y);
      const scale = 1 + Math.sin(orb.pulse) * 0.12;
      ctx.scale(scale, scale);

      const color =
        orb.type === 'speed' ? '#00F5D4' : orb.type === 'shrink' ? '#FEE440' : '#9B5DE5';
      const label = orb.type === 'speed' ? 'HIZ' : orb.type === 'shrink' ? 'MİNİ' : 'KALKAN';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, -orb.radius - 6);
      ctx.restore();
    }

    // Tankları çiz
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const cfg = PLAYERS_CONFIG[t.id];
      const r = t.shrinkTimer > 0 ? 11 : 18;

      ctx.save();
      ctx.translate(t.x, t.y);

      // Kalkan halkası
      if (t.hasShield) {
        ctx.strokeStyle = '#9B5DE5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hız izi
      if (t.speedTimer > 0) {
        ctx.strokeStyle = '#00F5D4';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r - 4, -r - 4, (r + 4) * 2, (r + 4) * 2);
      }

      ctx.save();
      ctx.rotate(t.angle);
      // Paletler
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-r, -r - 3, r * 2, 5);
      ctx.fillRect(-r, r - 2, r * 2, 5);

      // Küp gövde
      ctx.fillStyle = cfg.darkColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2.5;
      ctx.fillRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
      ctx.strokeRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);

      // Taret ve Namlu
      ctx.fillStyle = cfg.color;
      ctx.fillRect(0, -3.5, r + 10, 7);
      ctx.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
      ctx.restore();

      // 2 Mermi Kapasite Pips + Cooldown Barı
      for (let m = 0; m < t.maxAmmo; m++) {
        ctx.fillStyle = m < t.ammo ? cfg.color : 'rgba(148, 163, 184, 0.25)';
        ctx.fillRect(-11 + m * 12, -r - 14, 9, 5);
      }
      if (t.ammo < t.maxAmmo && t.reloadTimer > 0) {
        const pct = 1 - t.reloadTimer / 1.65;
        ctx.fillStyle = '#FEE440';
        ctx.fillRect(-11, -r - 7, 21 * Math.max(0, Math.min(1, pct)), 2);
      }

      ctx.restore();
    }

    // Mermileri çiz
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: null,
      statusMessage: 'Tek vuruşta patlat! 2 mermi + güçlendirme küreleri',
      players: this.tanks.map((t) => ({
        id: t.id,
        alive: t.alive,
        score: t.kills,
        kills: t.kills,
        metricText: t.alive
          ? `${t.ammo}/2 MERMİ${t.hasShield ? ' · KALKAN' : ''}`
          : 'PATLADI'
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
