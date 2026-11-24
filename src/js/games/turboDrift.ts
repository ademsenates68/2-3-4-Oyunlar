/**
 * 7. OYUN: Turbo Drift (Üstten Görünümlü Araba Yarışı)
 * - Minimalist bir yarış pistinde 3 turluk yarış.
 * - Oyuncular sağ/sol yönlendirme ile araçlarını sürer (otomatik gaz).
 * - Pistte hızlanma şeritleri (boost pad) ve rakipleri yavaşlatan/itiştiren çarpışma fiziği bulunur.
 * - 3 turu ilk bitiren kazanır.
 */

import { soundEngine } from '../audio';
import { PlayerInputState } from '../controls';
import { drawArenaGrid, EffectsManager } from '../particles';
import { PLAYERS_CONFIG } from '../rules';
import { GameHudSnapshot, MiniGameEngine } from './types';

interface RaceCar {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  boostTimer: number;
  laps: number;
  nextCheckpoint: number; // 0: Sağ, 1: Üst, 2: Sol, 3: Alt (Bitiş Çizgisi)
  skidMarks: Array<{ x: number; y: number; alpha: number }>;
}

interface BoostPad {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export class TurboDriftGame implements MiniGameEngine {
  private width = 800;
  private height = 600;
  private playerCount = 2;
  private cars: RaceCar[] = [];
  private boostPads: BoostPad[] = [];
  private effects = new EffectsManager();
  private isGameOver = false;
  private winnerId: number | null = null;
  private winReason = '';
  private targetLaps = 3;

  // Oval pist parametreleri
  private cx = 400;
  private cy = 300;
  private outerRx = 310;
  private outerRy = 210;
  private innerRx = 140;
  private innerRy = 85;

  public init(width: number, height: number, playerCount: number): void {
    this.width = width;
    this.height = height;
    this.playerCount = playerCount;
    this.cars = [];
    this.effects.reset();
    this.isGameOver = false;
    this.winnerId = null;
    this.winReason = '';

    this.computeTrackGeometry(width, height);

    // Başlangıç düzlüğü: Alt orta (Sağa doğru saat yönünün tersine yarış)
    const trackMidY = this.cy + (this.innerRy + this.outerRy) * 0.5;
    const laneSpan = (this.outerRy - this.innerRy) * 0.65;

    for (let i = 0; i < playerCount; i++) {
      const offsetRatio = playerCount > 1 ? i / (playerCount - 1) - 0.5 : 0;
      this.cars.push({
        id: i,
        x: this.cx - 18 - (i % 2) * 20,
        y: trackMidY + offsetRatio * laneSpan,
        vx: 0,
        vy: 0,
        angle: 0, // Sağa doğru (saat yönünün tersi tur)
        speed: 145,
        boostTimer: 0,
        laps: 0,
        nextCheckpoint: 0,
        skidMarks: []
      });
    }
  }

  private computeTrackGeometry(w: number, h: number): void {
    this.cx = w * 0.5;
    this.cy = h * 0.5;
    this.outerRx = Math.max(155, w * 0.42);
    this.outerRy = Math.max(135, h * 0.39);
    this.innerRx = this.outerRx * 0.44;
    this.innerRy = this.outerRy * 0.42;

    const midRx = (this.outerRx + this.innerRx) * 0.5;
    const midRy = (this.outerRy + this.innerRy) * 0.5;

    this.boostPads = [
      { x: this.cx + midRx * 0.85, y: this.cy + midRy * 0.45, angle: -Math.PI * 0.35, radius: 22 },
      { x: this.cx + midRx * 0.2, y: this.cy - midRy, angle: Math.PI, radius: 22 },
      { x: this.cx - midRx * 0.85, y: this.cy - midRy * 0.45, angle: Math.PI * 0.65, radius: 22 },
      { x: this.cx + midRx * 0.25, y: this.cy + midRy, angle: 0, radius: 22 }
    ];
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.computeTrackGeometry(width, height);
  }

  public update(dt: number, inputs: PlayerInputState[], botAssist: boolean): void {
    const pausedByHitstop = this.effects.update(dt);
    if (pausedByHitstop || this.isGameOver) return;

    const now = performance.now();
    const midRx = (this.outerRx + this.innerRx) * 0.5;
    const midRy = (this.outerRy + this.innerRy) * 0.5;

    for (let i = 0; i < this.playerCount; i++) {
      const car = this.cars[i];
      car.boostTimer = Math.max(0, car.boostTimer - dt);

      const inp = inputs[i];
      const isHuman = inp && now - inp.lastHumanInputAt < 3500;
      let steer = inp ? inp.steerDir : 0;

      if (botAssist && !isHuman) {
        // Pistin saat yönünün tersi (counter-clockwise) teğet açısını takip et
        const relX = (car.x - this.cx) / midRx;
        const relY = (car.y - this.cy) / midRy;
        const theta = Math.atan2(relY, relX);
        const lookTheta = theta - 0.42;
        const targetX = this.cx + Math.cos(lookTheta) * midRx;
        const targetY = this.cy + Math.sin(lookTheta) * midRy;
        const desiredAngle = Math.atan2(targetY - car.y, targetX - car.x);
        let diff = desiredAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        steer = Math.max(-1, Math.min(1, diff * 2.5));
      }

      // Sağ / Sol Yönlendirme ve Drift Fiziği
      const turnSpeed = 3.15;
      car.angle += steer * turnSpeed * dt;

      const targetSpeed = car.boostTimer > 0 ? 255 : 168;
      car.speed += (targetSpeed - car.speed) * dt * 4;

      // Drift kayma efekti (Hız vektörü aracın baktığı yöne yumuşakça oturur)
      const forwardX = Math.cos(car.angle) * car.speed;
      const forwardY = Math.sin(car.angle) * car.speed;
      car.vx += (forwardX - car.vx) * Math.min(1, dt * 6.5);
      car.vy += (forwardY - car.vy) * Math.min(1, dt * 6.5);

      car.x += car.vx * dt;
      car.y += car.vy * dt;

      // Drift izi kaydet
      if (Math.abs(steer) > 0.3 || car.boostTimer > 0) {
        car.skidMarks.push({ x: car.x, y: car.y, alpha: 0.55 });
        if (car.skidMarks.length > 26) car.skidMarks.shift();
      }
      for (const m of car.skidMarks) {
        m.alpha = Math.max(0, m.alpha - dt * 0.45);
      }

      // Hızlanma Şeritleri (Boost Pad) Kontrolü
      for (const pad of this.boostPads) {
        if (Math.hypot(car.x - pad.x, car.y - pad.y) <= pad.radius + 14) {
          if (car.boostTimer <= 0.1) {
            soundEngine.playPickup(true);
            this.effects.spawnBurst(car.x, car.y, '#00F5D4', 10, 120, 4);
            this.effects.spawnText(car.x, car.y - 18, 'TURBO!', '#00F5D4');
          }
          car.boostTimer = 1.15;
        }
      }

      // İç ve Dış Pist Duvarı Çarpışma Sınırları (Elips denklemi)
      const dx = car.x - this.cx;
      const dy = car.y - this.cy;
      const normOuter = Math.hypot(dx / (this.outerRx - 14), dy / (this.outerRy - 14));
      if (normOuter > 1) {
        car.x = this.cx + (dx / normOuter);
        car.y = this.cy + (dy / normOuter);
        car.speed *= 0.82; // Duvara sürtünme yavaşlatır
      }

      const normInner = Math.hypot(dx / (this.innerRx + 14), dy / (this.innerRy + 14));
      if (normInner < 1 && normInner > 0.01) {
        car.x = this.cx + (dx / normInner);
        car.y = this.cy + (dy / normInner);
        car.speed *= 0.82;
      }

      // 4 Köşe Kontrol Noktası (Checkpoint) ve Tur Sayacı
      // Saat yönünün tersi: Alt -> Sağ (CP 0) -> Üst (CP 1) -> Sol (CP 2) -> Alt Bitiş (CP 3)
      if (car.nextCheckpoint === 0 && car.x > this.cx + this.innerRx * 0.7) {
        car.nextCheckpoint = 1;
      } else if (car.nextCheckpoint === 1 && car.y < this.cy - this.innerRy * 0.6) {
        car.nextCheckpoint = 2;
      } else if (car.nextCheckpoint === 2 && car.x < this.cx - this.innerRx * 0.7) {
        car.nextCheckpoint = 3;
      } else if (
        car.nextCheckpoint === 3 &&
        car.y > this.cy + this.innerRy * 0.5 &&
        car.x >= this.cx - 25
      ) {
        car.laps++;
        car.nextCheckpoint = 0;
        soundEngine.playGoal();
        this.effects.spawnBurst(car.x, car.y, PLAYERS_CONFIG[car.id].color, 18, 150, 6);
        this.effects.spawnText(
          car.x,
          car.y - 22,
          `TUR ${car.laps}/${this.targetLaps}!`,
          PLAYERS_CONFIG[car.id].color
        );

        if (car.laps >= this.targetLaps) {
          this.isGameOver = true;
          this.winnerId = car.id;
          this.winReason = '3 turu ilk tamamlayan şampiyon pilot!';
          soundEngine.playWin();
          return;
        }
      }
    }

    // Araçlar arası çarpışma ve birbirini itme fiziği
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 26;
        if (dist > 0.1 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // İtişme darbesi
          const impulse = 95;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
          soundEngine.playHit();
          this.effects.spawnBurst((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#FEE440', 6, 90, 4);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.effects.applyCameraShake(ctx);
    drawArenaGrid(ctx, this.width, this.height, 44);

    // Pist Asfalt Yüzeyi
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(this.cx, this.cy, this.outerRx, this.outerRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Orta Şerit Kesikli Çizgi
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 14]);
    ctx.beginPath();
    ctx.ellipse(
      this.cx,
      this.cy,
      (this.outerRx + this.innerRx) * 0.5,
      (this.outerRy + this.innerRy) * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    ctx.setLineDash([]);

    // İç Ada
    ctx.fillStyle = '#0B0F19';
    ctx.strokeStyle = '#00F5D4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(this.cx, this.cy, this.innerRx, this.innerRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Başlangıç / Bitiş Damalı Çizgisi (Alt Orta)
    const finishY1 = this.cy + this.innerRy;
    const finishY2 = this.cy + this.outerRy;
    const steps = 8;
    const stepH = (finishY2 - finishY1) / steps;
    for (let s = 0; s < steps; s++) {
      ctx.fillStyle = s % 2 === 0 ? '#F8FAFC' : '#0B0F19';
      ctx.fillRect(this.cx - 6, finishY1 + s * stepH, 6, stepH);
      ctx.fillStyle = s % 2 === 1 ? '#F8FAFC' : '#0B0F19';
      ctx.fillRect(this.cx, finishY1 + s * stepH, 6, stepH);
    }

    // Hızlanma Şeritleri (Boost Pads)
    for (const pad of this.boostPads) {
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.22)';
      ctx.strokeStyle = '#00F5D4';
      ctx.lineWidth = 2;
      ctx.fillRect(-16, -12, 32, 24);
      ctx.strokeRect(-16, -12, 32, 24);

      // Çift chevron ok (`>>`)
      ctx.strokeStyle = '#FEE440';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(2, 0);
      ctx.lineTo(-6, 6);
      ctx.moveTo(2, -6);
      ctx.lineTo(10, 0);
      ctx.lineTo(2, 6);
      ctx.stroke();
      ctx.restore();
    }

    // Drift Lastik İzleri
    for (const car of this.cars) {
      const cfg = PLAYERS_CONFIG[car.id];
      for (const mark of car.skidMarks) {
        if (mark.alpha <= 0.02) continue;
        ctx.fillStyle = cfg.glowColor;
        ctx.fillRect(mark.x - 3, mark.y - 3, 6, 6);
      }
    }

    // Yarış Araçlarını Çiz
    for (const car of this.cars) {
      const cfg = PLAYERS_CONFIG[car.id];
      ctx.save();
      ctx.translate(car.x, car.y);

      ctx.save();
      ctx.rotate(car.angle);

      // Tekerlekler
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-11, -11, 7, 3);
      ctx.fillRect(4, -11, 7, 3);
      ctx.fillRect(-11, 8, 7, 3);
      ctx.fillRect(4, 8, 7, 3);

      // Araç Şasisi
      ctx.fillStyle = cfg.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-14, -8, 28, 16);
      ctx.strokeRect(-14, -8, 28, 16);

      // Ön Cam / Kokpit
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(-2, -6, 9, 12);

      // Turbo Egzoz Alevi
      if (car.boostTimer > 0) {
        ctx.fillStyle = '#FEE440';
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.lineTo(-26 - Math.random() * 6, 0);
        ctx.lineTo(-14, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Tur Göstergesi
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`TUR ${car.laps}/${this.targetLaps}`, 0, -16);
      ctx.restore();
    }

    this.effects.render(ctx);
    ctx.restore();
  }

  public getHudState(): GameHudSnapshot {
    return {
      timeRemaining: null,
      statusMessage: 'Sağ / Sol ile drift yap, hız şeritlerini kullan, 3 turu ilk tamamla!',
      players: this.cars.map((c) => ({
        id: c.id,
        alive: true,
        score: c.laps,
        distance: Math.round((c.laps * 4 + c.nextCheckpoint) * 185),
        metricText: `TUR ${c.laps}/${this.targetLaps}`
      })),
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      winReason: this.winReason
    };
  }
}
