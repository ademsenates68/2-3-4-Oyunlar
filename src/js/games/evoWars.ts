/**
 * 3. OYUN: EvoWars.io (Evrim Arenası)
 * - Oyuncular küp karakterlerle yerden çıkan XP noktalarını toplar.
 * - Seviye atladıkça karakter büyür ve kılıç/silah menzili uzar.
 * - Saldırı butonu ile tek darbede rakibi yok edebilirler (1 vuruş = ölüm).
 * - Bir rakibi öldüren oyuncu, ölen rakibin toplam XP'sinin %40'ını anında kazanır.
 * - Süre bitiminde en yüksek skora ulaşan veya son kalan kazanır.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import {
  calculateEvoKillReward,
  calculateEvoLevel,
  checkEliminationWinner,
  PLAYERS_CONFIG
} from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface XpGem {
  x: number;
  y: number;
  value: number;
  color: string;
  size: number;
}

interface EvoWarrior {
  id: number;
  x: number;
  y: number;
  angle: number;
  xp: number;
  level: number;
  bodyRadius: number;
  swordLength: number;
  alive: boolean;
  swingTimer: number; // > 0 ise kılıç savurma aktif
  swingCooldown: number;
  swingStartAngle: number;
  kills: number;
}

export class EvoWarsGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private warriors: EvoWarrior[] = [];
  private gems: XpGem[] = [];
  private effects = new EffectsManager();
  private timeRemaining = 75;
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.warriors = [];
    this.gems = [];
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
      const stats = calculateEvoLevel(25);
      this.warriors.push({
        id: i,
        x: spawns[i].x,
        y: spawns[i].y,
        angle: Math.atan2(height * 0.5 - spawns[i].y, width * 0.5 - spawns[i].x),
        xp: 25,
        level: stats.level,
        bodyRadius: stats.bodyRadius,
        swordLength: stats.swordLength,
        alive: true,
        swingTimer: 0,
        swingCooldown: 0,
        swingStartAngle: 0,
        kills: 0
      });
    }

    for (let i = 0; i < 36; i++) {
      this.spawnGem();
    }
  }

  private spawnGem(): void {
    const colors = ['#00F5D4', '#FEE440', '#FF2A85', '#9B5DE5', '#38BDF8'];
    const isBig = Math.random() < 0.18;
    this.gems.push({
      x: 50 + Math.random() * (this.width - 100),
      y: 50 + Math.random() * (this.height - 100),
      value: isBig ? 28 : 12,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: isBig ? 8 : 5
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
    while (this.gems.length < 34) {
      this.spawnGem();
    }

    const now = performance.now();

    for (let i = 0; i < this.playerCount; i++) {
      const w = this.warriors[i];
      if (!w.alive) continue;

      const stats = calculateEvoLevel(w.xp);
      if (stats.level > w.level) {
        this.effects.spawnText(w.x, w.y - w.bodyRadius - 12, `EVRİM SV.${stats.level}!`, '#FEE440');
        this.effects.spawnBurst(w.x, w.y, PLAYERS_CONFIG[w.id].color, 12, 110, 5, 'ring');
      }
      w.level = stats.level;
      w.bodyRadius = stats.bodyRadius;
      w.swordLength = stats.swordLength;

      w.swingTimer = Math.max(0, w.swingTimer - dt);
      w.swingCooldown = Math.max(0, w.swingCooldown - dt);

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let moveX = inp ? inp.moveX : 0;
      let moveY = inp ? inp.moveY : 0;
      let wantSwing = inp ? inp.actionJustPressed : false;

      if (botAssist && !isHuman) {
        // En yakın rakip veya XP küpüne yönel
        let nearestEnemy: EvoWarrior | null = null;
        let enemyDist = Infinity;
        for (const other of this.warriors) {
          if (other.id === w.id || !other.alive) continue;
          const d = Math.hypot(other.x - w.x, other.y - w.y);
          if (d < enemyDist) {
            enemyDist = d;
            nearestEnemy = other;
          }
        }

        if (nearestEnemy && enemyDist <= w.bodyRadius + w.swordLength + nearestEnemy.bodyRadius + 18) {
          w.angle = Math.atan2(nearestEnemy.y - w.y, nearestEnemy.x - w.x);
          moveX = Math.cos(w.angle);
          moveY = Math.sin(w.angle);
          if (w.swingCooldown <= 0) wantSwing = true;
        } else {
          // En yakın XP küpünü topla
          let bestGem: XpGem | null = null;
          let gemDist = Infinity;
          for (const g of this.gems) {
            const d = Math.hypot(g.x - w.x, g.y - w.y);
            if (d < gemDist) {
              gemDist = d;
              bestGem = g;
            }
          }
          if (bestGem) {
            const a = Math.atan2(bestGem.y - w.y, bestGem.x - w.x);
            w.angle = a;
            moveX = Math.cos(a) * 0.85;
            moveY = Math.sin(a) * 0.85;
          }
        }
      } else if (inp && inp.magnitude > 0.1) {
        w.angle = inp.angle;
      }

      const speed = Math.max(92, 148 - (w.level - 1) * 4);
      w.x += moveX * speed * dt;
      w.y += moveY * speed * dt;

      const pad = w.bodyRadius + 16;
      w.x = Math.max(pad, Math.min(this.width - pad, w.x));
      w.y = Math.max(pad, Math.min(this.height - pad, w.y));

      // XP küplerini toplama
      for (let g = this.gems.length - 1; g >= 0; g--) {
        const gem = this.gems[g];
        if (Math.hypot(gem.x - w.x, gem.y - w.y) <= w.bodyRadius + gem.size + 4) {
          w.xp += gem.value;
          soundEngine.playPickup();
          this.gems.splice(g, 1);
        }
      }

      // Kılıç savurma başlatma
      if (wantSwing && w.swingCooldown <= 0) {
        w.swingTimer = 0.22;
        w.swingCooldown = 0.52;
        w.swingStartAngle = w.angle - 1.1;
        soundEngine.playSwing();
      }

      // Aktif kılıç darbesi (1 Vuruş = Ölüm ve %40 XP Ödülü!)
      if (w.swingTimer > 0) {
        const progress = 1 - w.swingTimer / 0.22;
        const bladeAngle = w.swingStartAngle + progress * 2.2;
        const reach = w.bodyRadius + w.swordLength;

        for (const victim of this.warriors) {
          if (victim.id === w.id || !victim.alive) continue;
          // Kılıç boyunca 3 kontrol noktası
          for (const tFactor of [0.45, 0.75, 1.0]) {
            const bx = w.x + Math.cos(bladeAngle) * (w.bodyRadius + w.swordLength * tFactor);
            const by = w.y + Math.sin(bladeAngle) * (w.bodyRadius + w.swordLength * tFactor);
            if (Math.hypot(victim.x - bx, victim.y - by) <= victim.bodyRadius + 10) {
              // 1 vuruşta ölüm!
              victim.alive = false;
              w.kills++;
              const rewardXp = calculateEvoKillReward(victim.xp);
              w.xp += rewardXp;

              soundEngine.playExplosion();
              this.effects.triggerHitstop(0.06);
              this.effects.addShake(0.6);
              this.effects.spawnBurst(
                victim.x,
                victim.y,
                PLAYERS_CONFIG[victim.id].color,
                26,
                200,
                8
              );
              this.effects.spawnText(
                w.x,
                w.y - reach * 0.5,
                `+${rewardXp} XP (%40)!`,
                '#FEE440'
              );
              break;
            }
          }
        }
      }
    }

    const check = checkEliminationWinner(
      this.warriors.map((w) => ({ id: w.id, alive: w.alive, score: w.xp }))
    );
    if (check.finished) {
      this.isGameOver = true;
      this.winnerId = check.winnerId;
      this.winReason = 'Evrim arenasında son kalan savaşçı!';
      soundEngine.playWin();
    } else if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      const sorted = [...this.warriors]
        .filter((w) => w.alive)
        .sort((a, b) => b.xp - a.xp);
      this.winnerId = sorted[0]?.id ?? 0;
      this.winReason = 'Süre doldu — En yüksek Evrim XP skoru!';
      soundEngine.playWin();
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 44);

    // XP Küpleri
    for (const g of this.gems) {
      ctx.fillStyle = g.color;
      ctx.fillRect(g.x - g.size * 0.5, g.y - g.size * 0.5, g.size, g.size);
    }

    // Savaşçıları ve dev kılıçlarını çiz
    for (const w of this.warriors) {
      if (!w.alive) continue;
      const cfg = PLAYERS_CONFIG[w.id];

      ctx.save();
      ctx.translate(w.x, w.y);

      const isSwinging = w.swingTimer > 0;
      const progress = isSwinging ? 1 - w.swingTimer / 0.22 : 0;
      const currentBladeAngle = isSwinging
        ? w.swingStartAngle + progress * 2.2
        : w.angle + 0.35;

      // Kılıç savurma izi (arc)
      if (isSwinging) {
        ctx.strokeStyle = cfg.glowColor;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          w.bodyRadius + w.swordLength * 0.7,
          w.swingStartAngle,
          currentBladeAngle
        );
        ctx.stroke();
      }

      // Kılıç çizimi
      ctx.save();
      ctx.rotate(currentBladeAngle);
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2.5;
      const bladeW = 7 + w.level * 0.8;
      ctx.fillRect(w.bodyRadius - 2, -bladeW * 0.5, w.swordLength, bladeW);
      ctx.strokeRect(w.bodyRadius - 2, -bladeW * 0.5, w.swordLength, bladeW);
      ctx.restore();

      // Küp Gövde
      ctx.save();
      ctx.rotate(w.angle);
      const r = w.bodyRadius;
      ctx.fillStyle = cfg.darkColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeRect(-r, -r, r * 2, r * 2);

      // Seviye çekirdeği
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
      ctx.restore();

      // Seviye ve XP metni
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`SV.${w.level} · ${w.xp} XP`, 0, -w.bodyRadius - 10);

      ctx.restore();
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      statusMessage: 'XP topla, kılıcını uzat, tek darbede rakibin %40 XP’sini kap!',
      players: this.warriors.map((w) => ({
        id: w.id,
        alive: w.alive,
        score: w.xp,
        kills: w.kills,
        metricText: w.alive ? `SV.${w.level} · ${w.xp} XP` : 'ELENDİ'
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
