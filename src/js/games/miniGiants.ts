/**
 * 4. OYUN: MiniGiants.io (Can Barlı Arena)
 * - EvoWars mantığında XP toplayarak büyünür; ancak tek vuruşta ölüm yoktur.
 * - Her karakterin üzerinde can barı bulunur.
 * - Rakipler karşı karşıya geldiğinde hızlı hızlı darbeler savururlar ve can barı vuruş vuruş eksilir.
 * - Canı sıfırlanan elenir, geriye yüksek değerli XP hazinesi bırakır.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import { checkEliminationWinner, PLAYERS_CONFIG } from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface GiantPlayer {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  xp: number;
  level: number;
  hp: number;
  ghostHp: number;
  maxHp: number;
  radius: number;
  damage: number;
  alive: boolean;
  strikeTimer: number;
  strikeCooldown: number;
  hitFlash: number;
}

interface LootCube {
  x: number;
  y: number;
  value: number;
  size: number;
  color: string;
}

export class MiniGiantsGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private giants: GiantPlayer[] = [];
  private loot: LootCube[] = [];
  private effects = new EffectsManager();
  private timeRemaining = 80;
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.giants = [];
    this.loot = [];
    this.effects.reset();
    this.timeRemaining = 80;
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    const padX = Math.min(115, width * 0.16);
    const padY = Math.min(115, height * 0.17);
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
      this.giants.push({
        id: i,
        x: spawns[i].x,
        y: spawns[i].y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(height * 0.5 - spawns[i].y, width * 0.5 - spawns[i].x),
        xp: 0,
        level: 1,
        hp: 160,
        ghostHp: 160,
        maxHp: 160,
        radius: 16,
        damage: 20,
        alive: true,
        strikeTimer: 0,
        strikeCooldown: 0,
        hitFlash: 0
      });
    }

    for (let i = 0; i < 32; i++) {
      this.spawnLoot();
    }
  }

  private spawnLoot(x?: number, y?: number, value = 15, color?: string): void {
    const palette = ['#00F5D4', '#FEE440', '#9B5DE5', '#FF2A85'];
    this.loot.push({
      x: x ?? 50 + Math.random() * (this.width - 100),
      y: y ?? 50 + Math.random() * (this.height - 100),
      value,
      size: value > 20 ? 9 : 6,
      color: color ?? palette[Math.floor(Math.random() * palette.length)]
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
    while (this.loot.length < 30) {
      this.spawnLoot();
    }

    const now = performance.now();

    for (let i = 0; i < this.playerCount; i++) {
      const g = this.giants[i];
      if (!g.alive) continue;

      // Hayalet hasar barı (Trailing ghost HP bar)
      if (g.ghostHp > g.hp) {
        g.ghostHp = Math.max(g.hp, g.ghostHp - dt * 95);
      } else {
        g.ghostHp = g.hp;
      }

      // Seviye artışı
      const newLevel = Math.min(10, 1 + Math.floor(g.xp / 45));
      if (newLevel > g.level) {
        const diff = newLevel - g.level;
        g.level = newLevel;
        g.maxHp += diff * 35;
        g.hp = Math.min(g.maxHp, g.hp + diff * 45);
        g.radius = 16 + (g.level - 1) * 2.2;
        g.damage = 20 + (g.level - 1) * 5;
        this.effects.spawnText(g.x, g.y - g.radius - 16, `DEV SV.${g.level}!`, '#00F5D4');
      }

      g.strikeTimer = Math.max(0, g.strikeTimer - dt);
      g.strikeCooldown = Math.max(0, g.strikeCooldown - dt);
      g.hitFlash = Math.max(0, g.hitFlash - dt);

      // Geri tepme sönümleme
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= 0.85;
      g.vy *= 0.85;

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let moveX = inp ? inp.moveX : 0;
      let moveY = inp ? inp.moveY : 0;
      let wantStrike = inp ? inp.actionHeld || inp.actionJustPressed : false;

      if (botAssist && !isHuman) {
        let nearestEnemy: GiantPlayer | null = null;
        let enemyDist = Infinity;
        for (const other of this.giants) {
          if (other.id === g.id || !other.alive) continue;
          const d = Math.hypot(other.x - g.x, other.y - g.y);
          if (d < enemyDist) {
            enemyDist = d;
            nearestEnemy = other;
          }
        }
        if (nearestEnemy && (enemyDist < 140 || g.level >= nearestEnemy.level)) {
          const a = Math.atan2(nearestEnemy.y - g.y, nearestEnemy.x - g.x);
          g.angle = a;
          moveX = Math.cos(a) * 0.9;
          moveY = Math.sin(a) * 0.9;
          if (enemyDist <= g.radius + nearestEnemy.radius + 34) {
            wantStrike = true;
          }
        } else {
          let bestLoot: LootCube | null = null;
          let lootDist = Infinity;
          for (const l of this.loot) {
            const d = Math.hypot(l.x - g.x, l.y - g.y);
            if (d < lootDist) {
              lootDist = d;
              bestLoot = l;
            }
          }
          if (bestLoot) {
            const a = Math.atan2(bestLoot.y - g.y, bestLoot.x - g.x);
            g.angle = a;
            moveX = Math.cos(a) * 0.85;
            moveY = Math.sin(a) * 0.85;
          }
        }
      } else if (inp && inp.magnitude > 0.1) {
        g.angle = inp.angle;
      }

      // Yakında rakip varsa otomatik hızlı düello vuruşu da tetiklenir
      for (const other of this.giants) {
        if (other.id === g.id || !other.alive) continue;
        if (Math.hypot(other.x - g.x, other.y - g.y) <= g.radius + other.radius + 26) {
          wantStrike = true;
        }
      }

      const speed = 132;
      g.x += moveX * speed * dt;
      g.y += moveY * speed * dt;

      const pad = g.radius + 16;
      g.x = Math.max(pad, Math.min(this.width - pad, g.x));
      g.y = Math.max(pad, Math.min(this.height - pad, g.y));

      // XP toplama ve hafif can yenileme
      for (let k = this.loot.length - 1; k >= 0; k--) {
        const item = this.loot[k];
        if (Math.hypot(item.x - g.x, item.y - g.y) <= g.radius + item.size + 4) {
          g.xp += item.value;
          g.hp = Math.min(g.maxHp, g.hp + 5);
          soundEngine.playPickup();
          this.loot.splice(k, 1);
        }
      }

      // Seri Yakın Dövüş Darbesi
      if (wantStrike && g.strikeCooldown <= 0) {
        g.strikeTimer = 0.14;
        g.strikeCooldown = 0.28; // Hızlı seri darbeler
        soundEngine.playSwing();

        const reach = g.radius + 28;
        const hitX = g.x + Math.cos(g.angle) * (g.radius + 14);
        const hitY = g.y + Math.sin(g.angle) * (g.radius + 14);

        for (const victim of this.giants) {
          if (victim.id === g.id || !victim.alive) continue;
          const dist = Math.hypot(victim.x - hitX, victim.y - hitY);
          if (dist <= victim.radius + 20 || Math.hypot(victim.x - g.x, victim.y - g.y) <= reach + victim.radius) {
            victim.hp -= g.damage;
            victim.hitFlash = 0.1;
            const pushAngle = Math.atan2(victim.y - g.y, victim.x - g.x);
            victim.vx += Math.cos(pushAngle) * 150;
            victim.vy += Math.sin(pushAngle) * 150;

            soundEngine.playHit();
            this.effects.spawnBurst(
              (g.x + victim.x) * 0.5,
              (g.y + victim.y) * 0.5,
              PLAYERS_CONFIG[g.id].color,
              8,
              110,
              5
            );
            this.effects.spawnText(victim.x, victim.y - victim.radius - 14, `-${g.damage}`, '#FF2A85');

            if (victim.hp <= 0) {
              victim.hp = 0;
              victim.alive = false;
              g.xp += 60;
              soundEngine.playExplosion();
              this.effects.triggerHitstop(0.055);
              this.effects.addShake(0.55);
              this.effects.spawnBurst(
                victim.x,
                victim.y,
                PLAYERS_CONFIG[victim.id].color,
                24,
                190,
                8
              );
              // Elenen oyuncu geriye zengin XP hazinesi bırakır!
              for (let drop = 0; drop < 8; drop++) {
                const a = (Math.PI * 2 * drop) / 8;
                this.spawnLoot(
                  victim.x + Math.cos(a) * 26,
                  victim.y + Math.sin(a) * 26,
                  25,
                  PLAYERS_CONFIG[victim.id].color
                );
              }
            }
          }
        }
      }
    }

    const check = checkEliminationWinner(
      this.giants.map((g) => ({ id: g.id, alive: g.alive, score: g.xp }))
    );
    if (check.finished) {
      this.isGameOver = true;
      this.winnerId = check.winnerId;
      this.winReason = 'Arenada ayakta kalan son MiniGiant!';
      soundEngine.playWin();
    } else if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      const sorted = [...this.giants]
        .filter((g) => g.alive)
        .sort((a, b) => b.xp + b.hp - (a.xp + a.hp));
      this.winnerId = sorted[0]?.id ?? 0;
      this.winReason = 'Süre doldu — En güçlü MiniGiant!';
      soundEngine.playWin();
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 42);

    // Yerdeki XP Hazineleri
    for (const item of this.loot) {
      ctx.fillStyle = item.color;
      ctx.fillRect(item.x - item.size * 0.5, item.y - item.size * 0.5, item.size, item.size);
      if (item.value >= 25) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(item.x - item.size * 0.5 - 2, item.y - item.size * 0.5 - 2, item.size + 4, item.size + 4);
      }
    }

    // MiniGiants Karakterleri
    for (const g of this.giants) {
      if (!g.alive) continue;
      const cfg = PLAYERS_CONFIG[g.id];

      ctx.save();
      ctx.translate(g.x, g.y);

      ctx.save();
      ctx.rotate(g.angle);

      // Çift el gürz / balyoz darbe animasyonu
      const extend = g.strikeTimer > 0 ? 16 : 4;
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2;
      ctx.fillRect(g.radius + extend - 4, -12, 12, 24);
      ctx.strokeRect(g.radius + extend - 4, -12, 12, 24);

      // Zırhlı Küp Gövde
      const r = g.radius;
      ctx.fillStyle = g.hitFlash > 0 ? '#FFFFFF' : cfg.darkColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3.5;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeRect(-r, -r, r * 2, r * 2);

      // İç omuz zırhı
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-r * 0.5, -r * 0.5, r, r);
      ctx.restore();

      // Üstte Can Barı + Trailing Ghost Damage Bar
      const barW = Math.max(44, g.radius * 2.4);
      const barH = 7;
      const barY = -g.radius - 18;
      ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
      ctx.fillRect(-barW * 0.5, barY, barW, barH);

      // Hayalet hasar barı
      const ghostPct = Math.max(0, g.ghostHp / g.maxHp);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-barW * 0.5 + 1, barY + 1, (barW - 2) * ghostPct, barH - 2);

      // Gerçek can barı
      const hpPct = Math.max(0, g.hp / g.maxHp);
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-barW * 0.5 + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`SV.${g.level} · ${Math.ceil(g.hp)}/${g.maxHp} HP`, 0, barY - 4);

      ctx.restore();
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      statusMessage: 'XP topla, seri darbelerle rakibin can barını sıfırla!',
      players: this.giants.map((g) => ({
        id: g.id,
        alive: g.alive,
        score: g.xp,
        metricText: g.alive ? `${Math.ceil(g.hp)} HP · SV.${g.level}` : 'ELENDİ'
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
