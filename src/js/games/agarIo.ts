/**
 * 5. OYUN: Agar.io (Kütle Yutma)
 * - Oyuncular dairesel/küresel formlardır.
 * - Haritadaki küçük renkli noktaları topladıkça büyürler (büyüdükçe hareket hızı hafifçe azalır).
 * - Bir oyuncu kendisinden küçük bir rakibi tamamen içine aldığında (merkezini kapsadığında) onu yok eder
 *   ve rakibin tüm kütlesi/puanı ona geçer.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import {
  calculateAgarRadius,
  calculateAgarSpeed,
  canAgarSwallow,
  checkEliminationWinner,
  PLAYERS_CONFIG
} from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface AgarCell {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  mass: number;
  radius: number;
  alive: boolean;
  dashCooldown: number;
  dashBoost: number;
}

interface Pellet {
  x: number;
  y: number;
  mass: number;
  radius: number;
  color: string;
}

export class AgarIoGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private cells: AgarCell[] = [];
  private pellets: Pellet[] = [];
  private effects = new EffectsManager();
  private timeRemaining = 75;
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.cells = [];
    this.pellets = [];
    this.effects.reset();
    this.timeRemaining = 75;
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    const padX = Math.min(120, width * 0.17);
    const padY = Math.min(120, height * 0.18);
    const spawns =
      playerCount === 2
        ? [
            { x: width * 0.5, y: height - padY },
            { x: width * 0.5, y: padY }
          ]
        : [
            { x: padX, y: height - padY },
            { x: width - padX, y: padY },
            { x: padX, y: padY },
            { x: width - padX, y: height - padY }
          ];

    for (let i = 0; i < playerCount; i++) {
      const startMass = 35;
      this.cells.push({
        id: i,
        x: spawns[i].x,
        y: spawns[i].y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(height * 0.5 - spawns[i].y, width * 0.5 - spawns[i].x),
        mass: startMass,
        radius: calculateAgarRadius(startMass),
        alive: true,
        dashCooldown: 0,
        dashBoost: 0
      });
    }

    for (let i = 0; i < 55; i++) {
      this.spawnPellet();
    }
  }

  private spawnPellet(): void {
    const colors = ['#00F5D4', '#FF2A85', '#FEE440', '#9B5DE5', '#38BDF8', '#00F59B'];
    const isRich = Math.random() < 0.15;
    this.pellets.push({
      x: 40 + Math.random() * (this.width - 80),
      y: 40 + Math.random() * (this.height - 80),
      mass: isRich ? 9 : 4,
      radius: isRich ? 6 : 4,
      color: colors[Math.floor(Math.random() * colors.length)]
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
    while (this.pellets.length < 55) {
      this.spawnPellet();
    }

    const now = performance.now();

    for (let i = 0; i < this.playerCount; i++) {
      const c = this.cells[i];
      if (!c.alive) continue;

      c.radius = calculateAgarRadius(c.mass);
      c.dashCooldown = Math.max(0, c.dashCooldown - dt);
      c.dashBoost = Math.max(0, c.dashBoost - dt * 2.5);

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let moveX = inp ? inp.moveX : 0;
      let moveY = inp ? inp.moveY : 0;
      let wantDash = inp ? inp.actionJustPressed : false;

      if (botAssist && !isHuman) {
        // Kendinden büyük tehditten kaç, kendinden küçüğü veya en yakın noktayı kovala
        let threat: AgarCell | null = null;
        let prey: AgarCell | null = null;
        let minThreatDist = 160;
        let minPreyDist = 210;

        for (const other of this.cells) {
          if (other.id === c.id || !other.alive) continue;
          const d = Math.hypot(other.x - c.x, other.y - c.y);
          if (other.mass > c.mass * 1.12 && d < minThreatDist) {
            minThreatDist = d;
            threat = other;
          } else if (c.mass > other.mass * 1.12 && d < minPreyDist) {
            minPreyDist = d;
            prey = other;
          }
        }

        if (threat) {
          const fleeAngle = Math.atan2(c.y - threat.y, c.x - threat.x);
          c.angle = fleeAngle;
          moveX = Math.cos(fleeAngle);
          moveY = Math.sin(fleeAngle);
        } else if (prey) {
          const chaseAngle = Math.atan2(prey.y - c.y, prey.x - c.x);
          c.angle = chaseAngle;
          moveX = Math.cos(chaseAngle);
          moveY = Math.sin(chaseAngle);
          if (minPreyDist < c.radius * 1.6 && c.dashCooldown <= 0) wantDash = true;
        } else {
          let bestPellet: Pellet | null = null;
          let bestDist = Infinity;
          for (const p of this.pellets) {
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (d < bestDist) {
              bestDist = d;
              bestPellet = p;
            }
          }
          if (bestPellet) {
            const a = Math.atan2(bestPellet.y - c.y, bestPellet.x - c.x);
            c.angle = a;
            moveX = Math.cos(a) * 0.9;
            moveY = Math.sin(a) * 0.9;
          }
        }
      } else if (inp && inp.magnitude > 0.1) {
        c.angle = inp.angle;
      }

      // Kısa atılma (Dash) hamlesi
      if (wantDash && c.dashCooldown <= 0 && c.mass > 28) {
        c.dashCooldown = 1.6;
        c.dashBoost = 1.0;
        soundEngine.playSwing();
        this.effects.spawnBurst(c.x, c.y, PLAYERS_CONFIG[c.id].color, 8, 90, 4, 'ring');
      }

      const speed = calculateAgarSpeed(c.mass) * (1 + c.dashBoost * 0.75);
      c.x += moveX * speed * dt;
      c.y += moveY * speed * dt;

      const pad = Math.min(c.radius, 35) + 12;
      c.x = Math.max(pad, Math.min(this.width - pad, c.x));
      c.y = Math.max(pad, Math.min(this.height - pad, c.y));

      // Küçük noktaları toplama
      for (let k = this.pellets.length - 1; k >= 0; k--) {
        const p = this.pellets[k];
        if (Math.hypot(p.x - c.x, p.y - c.y) <= c.radius) {
          c.mass += p.mass;
          soundEngine.playPickup();
          this.pellets.splice(k, 1);
        }
      }
    }

    // Kütle Yutma Kontrolü: Büyük hücre küçüğün merkezini kapsadığında onu tamamen yutar
    for (let i = 0; i < this.cells.length; i++) {
      const attacker = this.cells[i];
      if (!attacker.alive) continue;
      for (let j = 0; j < this.cells.length; j++) {
        if (i === j) continue;
        const victim = this.cells[j];
        if (!victim.alive) continue;

        const dist = Math.hypot(victim.x - attacker.x, victim.y - attacker.y);
        if (canAgarSwallow(attacker.mass, victim.mass, dist)) {
          victim.alive = false;
          const gained = Math.round(victim.mass);
          attacker.mass += gained;
          attacker.radius = calculateAgarRadius(attacker.mass);

          soundEngine.playExplosion();
          this.effects.triggerHitstop(0.06);
          this.effects.addShake(0.55);
          this.effects.spawnBurst(
            victim.x,
            victim.y,
            PLAYERS_CONFIG[victim.id].color,
            26,
            180,
            7,
            'ring'
          );
          this.effects.spawnText(
            attacker.x,
            attacker.y - attacker.radius - 10,
            `YUTTU! +${gained} KÜTLE`,
            '#00F5D4'
          );
        }
      }
    }

    const check = checkEliminationWinner(
      this.cells.map((c) => ({ id: c.id, alive: c.alive, score: c.mass }))
    );
    if (check.finished) {
      this.isGameOver = true;
      this.winnerId = check.winnerId;
      this.winReason = 'Tüm rakipleri yutan en büyük hücre!';
      soundEngine.playWin();
    } else if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      const sorted = [...this.cells]
        .filter((c) => c.alive)
        .sort((a, b) => b.mass - a.mass);
      this.winnerId = sorted[0]?.id ?? 0;
      this.winReason = 'Süre doldu — En yüksek kütle!';
      soundEngine.playWin();
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 38);

    // Enerji noktaları
    for (const p of this.pellets) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Küçükten büyüğe sırala ki büyük hücre küçüğün üstüne çizilsin
    const sortedCells = [...this.cells].sort((a, b) => a.mass - b.mass);

    for (const c of sortedCells) {
      if (!c.alive) continue;
      const cfg = PLAYERS_CONFIG[c.id];

      ctx.save();
      ctx.translate(c.x, c.y);

      // Dış parıltı çemberi
      ctx.fillStyle = cfg.darkColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // İç geometrik halkalar
      ctx.strokeStyle = cfg.glowColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      // Merkez çekirdek
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(5, c.radius * 0.25), 0, Math.PI * 2);
      ctx.fill();

      // Kütle değeri
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(c.mass)}`, 0, 0);

      ctx.restore();
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      statusMessage: 'Noktaları topla, kendinden küçük rakiplerin merkezini kapsayıp yut!',
      players: this.cells.map((c) => ({
        id: c.id,
        alive: c.alive,
        score: Math.round(c.mass),
        metricText: c.alive ? `${Math.round(c.mass)} KÜTLE` : 'YUTULDU'
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
