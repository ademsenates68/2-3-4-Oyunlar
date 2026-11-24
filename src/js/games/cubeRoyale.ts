/**
 * 1. OYUN: Cube Royale (Kule Savunma & Saldırı)
 * - 2, 3 veya 4 köşede oyuncu kuleleri bulunur.
 * - Zamanla dolan enerji barı (0..10) ve 4 farklı birlik çıkarma butonu:
 *   1. Kılıçlı (2 Enerji): Dengeli can, hız ve yakın dövüş hasarı.
 *   2. Okçu (3 Enerji): Uzaktan ateş eder; canı ve kalkanı azdır, yakın dövüşte zayıftır.
 *   3. Atlı (5 Enerji): Hızlı hareket eder; kalkanı ve saldırı gücü kılıçlıdan fazladır.
 *   4. Tank (6 Enerji): Yavaştır, birliklere karşı zayıftır ama rakip kuleye çok yüksek hasar verir.
 * - Birlikler otomatik olarak en yakın rakip birliğe veya kuleye ilerler. Kulesi yıkılan elenir.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import {
  checkEliminationWinner,
  CubeUnitType,
  getCubeRoyaleUnitStats,
  PLAYERS_CONFIG
} from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface Tower {
  playerId: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  alive: boolean;
  shootCooldown: number;
  aiTimer: number;
  kills: number;
}

interface Unit {
  id: number;
  ownerId: number;
  type: CubeUnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  speed: number;
  range: number;
  unitDamage: number;
  towerDamage: number;
  attackCooldown: number;
  cooldownTimer: number;
  size: number;
  angle: number;
  hitFlash: number;
}

interface ArrowProjectile {
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  life: number;
}

export class CubeRoyaleGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private towers: Tower[] = [];
  private units: Unit[] = [];
  private arrows: ArrowProjectile[] = [];
  private nextUnitId = 1;
  private effects = new EffectsManager();
  private timeRemaining = 120;
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.towers = [];
    this.units = [];
    this.arrows = [];
    this.nextUnitId = 1;
    this.effects.reset();
    this.timeRemaining = 120;
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    const positions = this.getTowerPositions(width, height, playerCount);
    for (let i = 0; i < playerCount; i++) {
      this.towers.push({
        playerId: i,
        x: positions[i].x,
        y: positions[i].y,
        hp: 650,
        maxHp: 650,
        energy: 4.5,
        maxEnergy: 10,
        alive: true,
        shootCooldown: 0,
        aiTimer: 1.1 + i * 0.35,
        kills: 0
      });
    }
  }

  private getTowerPositions(w: number, h: number, count: number): Array<{ x: number; y: number }> {
    if (count === 2) {
      const padY = Math.max(95, Math.min(135, h * 0.18));
      return [
        { x: w * 0.5, y: h - padY },
        { x: w * 0.5, y: padY }
      ];
    }
    const padX = Math.max(145, Math.min(230, w * 0.24));
    const padY = Math.max(145, Math.min(185, h * 0.24));
    return [
      { x: padX, y: h - padY }, // P1: Sol Alt
      { x: w - padX, y: padY }, // P2: Sağ Üst
      { x: padX, y: padY }, // P3: Sol Üst
      { x: w - padX, y: h - padY } // P4: Sağ Alt
    ];
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const positions = this.getTowerPositions(width, height, this.playerCount);
    this.towers.forEach((t, idx) => {
      if (positions[idx]) {
        t.x = positions[idx].x;
        t.y = positions[idx].y;
      }
    });
  }

  private spawnUnit(playerId: number, type: CubeUnitType): boolean {
    const tower = this.towers[playerId];
    if (!tower || !tower.alive) return false;

    const stats = getCubeRoyaleUnitStats(type);
    if (tower.energy < stats.cost) return false;

    tower.energy -= stats.cost;
    const centerAngle = Math.atan2(this.height * 0.5 - tower.y, this.width * 0.5 - tower.x);
    const spread = (Math.random() - 0.5) * 0.7;
    const spawnDist = 38;

    this.units.push({
      id: this.nextUnitId++,
      ownerId: playerId,
      type,
      x: tower.x + Math.cos(centerAngle + spread) * spawnDist,
      y: tower.y + Math.sin(centerAngle + spread) * spawnDist,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: stats.shield,
      speed: stats.speed,
      range: stats.range,
      unitDamage: stats.unitDamage,
      towerDamage: stats.towerDamage,
      attackCooldown: stats.attackCooldown,
      cooldownTimer: 0,
      size: stats.size,
      angle: centerAngle,
      hitFlash: 0
    });

    soundEngine.playSpawn();
    this.effects.spawnBurst(
      tower.x + Math.cos(centerAngle + spread) * spawnDist,
      tower.y + Math.sin(centerAngle + spread) * spawnDist,
      PLAYERS_CONFIG[playerId].color,
      8,
      80,
      4,
      'ring'
    );
    return true;
  }

  public update(dt: number, inputs: PlayerInputState[], botAssist: boolean): void {
    const pausedByHitstop = this.effects.update(dt);
    if (pausedByHitstop || this.isGameOver) return;

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const now = performance.now();

    // Kule enerji dolumu, girdi kontrolü ve savunma atışı
    for (let i = 0; i < this.playerCount; i++) {
      const tower = this.towers[i];
      if (!tower.alive) continue;

      // Saniyede 1.35 enerji dolumu
      tower.energy = Math.min(tower.maxEnergy, tower.energy + dt * 1.35);

      const inp = inputs[i];
      if (inp && inp.spawnQueue.length > 0) {
        while (inp.spawnQueue.length > 0) {
          const nextType = inp.spawnQueue.shift()!;
          this.spawnUnit(i, nextType);
        }
      }

      // Bot Desteği: Oyuncu son 3.5 saniyede dokunmadıysa otomatik stratejik birlik çıkarır
      const isHumanActive = inp && now - inp.lastHumanInputAt < 3500;
      if (botAssist && !isHumanActive) {
        tower.aiTimer -= dt;
        if (tower.aiTimer <= 0) {
          const pool: CubeUnitType[] = ['swordsman', 'archer', 'cavalry', 'tank'];
          const pick = pool[Math.floor(Math.random() * pool.length)];
          const stats = getCubeRoyaleUnitStats(pick);
          if (tower.energy >= stats.cost) {
            this.spawnUnit(i, pick);
            tower.aiTimer = 1.2 + Math.random() * 1.2;
          }
        }
      }

      // Kule yakın savunma lazeri
      tower.shootCooldown = Math.max(0, tower.shootCooldown - dt);
      if (tower.shootCooldown <= 0) {
        let nearestEnemy: Unit | null = null;
        let minDist = 135;
        for (const u of this.units) {
          if (u.ownerId === tower.playerId || u.hp <= 0) continue;
          const d = Math.hypot(u.x - tower.x, u.y - tower.y);
          if (d < minDist) {
            minDist = d;
            nearestEnemy = u;
          }
        }
        if (nearestEnemy) {
          tower.shootCooldown = 1.05;
          const angle = Math.atan2(nearestEnemy.y - tower.y, nearestEnemy.x - tower.x);
          this.arrows.push({
            ownerId: tower.playerId,
            x: tower.x,
            y: tower.y,
            vx: Math.cos(angle) * 280,
            vy: Math.sin(angle) * 280,
            damage: 20,
            color: PLAYERS_CONFIG[tower.playerId].color,
            life: 0.7
          });
        }
      }
    }

    // Birlik hareket ve saldırı döngüsü
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      u.cooldownTimer = Math.max(0, u.cooldownTimer - dt);
      u.hitFlash = Math.max(0, u.hitFlash - dt);

      // Tank öncelikle rakip kuleyi hedefler, diğer birlikler en yakın rakip birliği veya kuleyi hedefler
      let targetUnit: Unit | null = null;
      let targetTower: Tower | null = null;
      let bestDist = Infinity;

      if (u.type !== 'tank') {
        for (const other of this.units) {
          if (other.ownerId === u.ownerId || other.hp <= 0) continue;
          const d = Math.hypot(other.x - u.x, other.y - u.y);
          if (d < bestDist) {
            bestDist = d;
            targetUnit = other;
          }
        }
      }

      // Eğer yakınlarda birlik yoksa (veya Tank ise) en yakın rakip kuleye odaklan
      let towerDist = Infinity;
      for (const t of this.towers) {
        if (t.playerId === u.ownerId || !t.alive) continue;
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        if (d < towerDist) {
          towerDist = d;
          targetTower = t;
        }
      }

      // Tank sadece çok yakında önüne kesen birlik varsa ona vurur, yoksa kuleye yürür
      const focusTower =
        u.type === 'tank' || !targetUnit || towerDist < bestDist * 0.85;

      const tx = focusTower && targetTower ? targetTower.x : targetUnit ? targetUnit.x : this.width * 0.5;
      const ty = focusTower && targetTower ? targetTower.y : targetUnit ? targetUnit.y : this.height * 0.5;
      const targetRadius = focusTower && targetTower ? 30 : targetUnit ? targetUnit.size : 10;

      const dx = tx - u.x;
      const dy = ty - u.y;
      const dist = Math.hypot(dx, dy);
      u.angle = Math.atan2(dy, dx);

      if (dist <= u.range + targetRadius) {
        // Menzilde: Saldır!
        if (u.cooldownTimer <= 0) {
          u.cooldownTimer = u.attackCooldown;
          if (u.type === 'archer') {
            this.arrows.push({
              ownerId: u.ownerId,
              x: u.x,
              y: u.y,
              vx: Math.cos(u.angle) * 290,
              vy: Math.sin(u.angle) * 290,
              damage: focusTower ? u.towerDamage : u.unitDamage,
              color: PLAYERS_CONFIG[u.ownerId].color,
              life: 0.75
            });
            soundEngine.playShoot();
          } else if (focusTower && targetTower) {
            targetTower.hp -= u.towerDamage;
            soundEngine.playHit();
            this.effects.spawnBurst(
              targetTower.x - Math.cos(u.angle) * 22,
              targetTower.y - Math.sin(u.angle) * 22,
              PLAYERS_CONFIG[u.ownerId].color,
              9,
              110,
              5
            );
            if (u.type === 'tank') {
              this.effects.addShake(0.35);
              this.effects.spawnText(targetTower.x, targetTower.y - 34, `-${u.towerDamage} TANK!`, '#FEE440');
            }
            this.checkTowerDestroyed(targetTower, u.ownerId);
          } else if (targetUnit) {
            const effectiveDmg = Math.max(3, Math.round(u.unitDamage * (1 - targetUnit.shield)));
            targetUnit.hp -= effectiveDmg;
            targetUnit.hitFlash = 0.1;
            soundEngine.playHit();
            this.effects.spawnBurst(targetUnit.x, targetUnit.y, PLAYERS_CONFIG[u.ownerId].color, 6, 85, 4);
            if (targetUnit.hp <= 0) {
              this.towers[u.ownerId].kills++;
              this.effects.spawnBurst(
                targetUnit.x,
                targetUnit.y,
                PLAYERS_CONFIG[targetUnit.ownerId].color,
                14,
                130,
                6
              );
            }
          }
        }
      } else if (dist > 1) {
        u.x += (dx / dist) * u.speed * dt;
        u.y += (dy / dist) * u.speed * dt;
      }
    }

    // Birlikler arası yumuşak itişme (üst üste binmeyi önler)
    for (let i = 0; i < this.units.length; i++) {
      const a = this.units[i];
      if (a.hp <= 0) continue;
      for (let j = i + 1; j < this.units.length; j++) {
        const b = this.units[j];
        if (b.hp <= 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = a.size + b.size;
        if (d > 0.1 && d < minD) {
          const push = (minD - d) * 0.35;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // Ok / Mermi güncelleme
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arr = this.arrows[i];
      arr.life -= dt;
      arr.x += arr.vx * dt;
      arr.y += arr.vy * dt;
      if (arr.life <= 0) {
        this.arrows.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const u of this.units) {
        if (u.ownerId === arr.ownerId || u.hp <= 0) continue;
        if (Math.hypot(u.x - arr.x, u.y - arr.y) <= u.size + 4) {
          const dmg = Math.max(2, Math.round(arr.damage * (1 - u.shield)));
          u.hp -= dmg;
          u.hitFlash = 0.1;
          this.effects.spawnBurst(arr.x, arr.y, arr.color, 5, 70, 3);
          if (u.hp <= 0) {
            this.towers[arr.ownerId].kills++;
            this.effects.spawnBurst(u.x, u.y, PLAYERS_CONFIG[u.ownerId].color, 12, 120, 5);
          }
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const t of this.towers) {
          if (t.playerId === arr.ownerId || !t.alive) continue;
          if (Math.hypot(t.x - arr.x, t.y - arr.y) <= 28) {
            t.hp -= arr.damage;
            this.effects.spawnBurst(arr.x, arr.y, arr.color, 6, 80, 4);
            this.checkTowerDestroyed(t, arr.ownerId);
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        this.arrows.splice(i, 1);
      }
    }

    // Ölü birlikleri temizle
    this.units = this.units.filter((u) => u.hp > 0);

    // Kazanma kontrolü
    const check = checkEliminationWinner(
      this.towers.map((t) => ({ id: t.playerId, alive: t.alive, score: t.hp }))
    );
    if (check.finished) {
      this.isGameOver = true;
      this.winnerId = check.winnerId;
      this.winReason = 'Son ayakta kalan kule!';
      soundEngine.playWin();
    } else if (this.timeRemaining <= 0) {
      this.isGameOver = true;
      const sorted = [...this.towers]
        .filter((t) => t.alive)
        .sort((a, b) => b.hp - a.hp);
      this.winnerId = sorted[0]?.playerId ?? 0;
      this.winReason = 'Süre doldu — En sağlam kule!';
      soundEngine.playWin();
    }
  }

  private checkTowerDestroyed(tower: Tower, attackerId: number): void {
    if (tower.hp <= 0 && tower.alive) {
      tower.hp = 0;
      tower.alive = false;
      this.towers[attackerId].kills += 5;
      soundEngine.playExplosion();
      this.effects.triggerHitstop(0.06);
      this.effects.addShake(0.65);
      this.effects.spawnBurst(
        tower.x,
        tower.y,
        PLAYERS_CONFIG[tower.playerId].color,
        28,
        210,
        9
      );
      this.effects.spawnText(tower.x, tower.y - 20, 'KULE YIKILDI!', '#FF2A85');
      // Elenen oyuncunun sahadaki birlikleri de dağılır
      for (const u of this.units) {
        if (u.ownerId === tower.playerId) u.hp = 0;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 44);

    // Kuleler arası bağlantı hatları
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    for (let i = 0; i < this.towers.length; i++) {
      for (let j = i + 1; j < this.towers.length; j++) {
        ctx.moveTo(this.towers[i].x, this.towers[i].y);
        ctx.lineTo(this.towers[j].x, this.towers[j].y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Kuleleri çiz
    for (const t of this.towers) {
      const cfg = PLAYERS_CONFIG[t.playerId];
      ctx.save();
      ctx.translate(t.x, t.y);

      if (!t.alive) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -22, 44, 44);
        ctx.restore();
        continue;
      }

      // Kule tabanı (keskin geometrik kale)
      ctx.fillStyle = cfg.darkColor;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3;
      ctx.fillRect(-26, -26, 52, 52);
      ctx.strokeRect(-26, -26, 52, 52);

      // İç çekirdek
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-12, -12, 24, 24);

      // Can Barı
      const hpRatio = Math.max(0, t.hp / t.maxHp);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(-30, -42, 60, 8);
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-29, -41, 58 * hpRatio, 6);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(t.hp)} HP`, 0, -46);

      // Enerji Göstergesi
      ctx.fillStyle = '#FEE440';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(`⚡${Math.floor(t.energy)}/10`, 0, 42);

      ctx.restore();
    }

    // Birlikleri çiz
    for (const u of this.units) {
      const cfg = PLAYERS_CONFIG[u.ownerId];
      ctx.save();
      ctx.translate(u.x, u.y);

      ctx.save();
      ctx.rotate(u.angle);
      ctx.fillStyle = u.hitFlash > 0 ? '#FFFFFF' : cfg.color;
      ctx.strokeStyle = '#0B0F19';
      ctx.lineWidth = 2;

      if (u.type === 'swordsman') {
        // Kılıçlı: Küp gövde + önde keskin kılıç çıkıntısı
        const s = u.size;
        ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
        ctx.strokeRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(s * 0.5, -2, s * 0.8, 4);
      } else if (u.type === 'archer') {
        // Okçu: Elmas / Üçgenimsi keskin geometrik form
        const s = u.size;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.8, -s * 0.8);
        ctx.lineTo(-s * 0.4, 0);
        ctx.lineTo(-s * 0.8, s * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (u.type === 'cavalry') {
        // Atlı: Kalkanlı hızlı paralelkenar / zırhlı şövalye küpü
        const s = u.size;
        ctx.fillRect(-s * 0.9, -s * 0.65, s * 1.8, s * 1.3);
        ctx.strokeRect(-s * 0.9, -s * 0.65, s * 1.8, s * 1.3);
        // Ön kalkan çizgisi
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s * 0.9, -s * 0.7);
        ctx.lineTo(s * 0.9, s * 0.7);
        ctx.stroke();
      } else if (u.type === 'tank') {
        // Tank: Ağır çift katmanlı dev zırhlı küp
        const s = u.size;
        ctx.fillStyle = cfg.darkColor;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 3;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.fillStyle = u.hitFlash > 0 ? '#FFFFFF' : cfg.color;
        ctx.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1);
        // Koçbaşı namlusu
        ctx.fillStyle = '#FEE440';
        ctx.fillRect(s * 0.5, -4, s * 0.7, 8);
      }
      ctx.restore();

      // Birlik üstü mini can barı
      const hpPct = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
      ctx.fillRect(-12, -u.size - 10, 24, 4);
      ctx.fillStyle = cfg.color;
      ctx.fillRect(-12, -u.size - 10, 24 * hpPct, 4);

      ctx.restore();
    }

    // Okları çiz
    for (const arr of this.arrows) {
      ctx.save();
      ctx.translate(arr.x, arr.y);
      ctx.rotate(Math.atan2(arr.vy, arr.vx));
      ctx.fillStyle = arr.color;
      ctx.fillRect(-6, -2, 12, 4);
      ctx.restore();
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: Math.ceil(this.timeRemaining),
      statusMessage: 'Birlik çıkar ve rakip kuleleri yık!',
      players: this.towers.map((t) => ({
        id: t.playerId,
        alive: t.alive,
        score: Math.ceil(t.hp),
        metricText: t.alive ? `${Math.ceil(t.hp)} HP · ⚡${Math.floor(t.energy)}` : 'ELENDİ',
        energy: t.energy,
        maxEnergy: t.maxEnergy,
        kills: t.kills
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
