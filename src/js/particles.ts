/**
 * CubeArena .io — Zero-GC Parçacık Havuzu (Ring Buffer), Kamera Sarsıntısı ve Hitstop Motoru
 * requestAnimationFrame içinde yeni nesne üretmeden (Zero-GC) yüksek performanslı küp efektleri çizer.
 */

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  color: string;
  life: number;
  maxLife: number;
  shape: 'cube' | 'ring' | 'spark';
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 200;
const MAX_TEXTS = 32;

export class EffectsManager {
  private particles: Particle[] = [];
  private particleCursor = 0;
  private texts: FloatingText[] = [];
  private textCursor = 0;

  public trauma = 0;
  public hitstopTimer = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        rotation: 0,
        vRot: 0,
        color: '#00F5D4',
        life: 0,
        maxLife: 0.5,
        shape: 'cube'
      });
    }
    for (let i = 0; i < MAX_TEXTS; i++) {
      this.texts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -30,
        text: '',
        color: '#FFFFFF',
        life: 0,
        maxLife: 0.8
      });
    }
  }

  public reset(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i].active = false;
    }
    for (let i = 0; i < MAX_TEXTS; i++) {
      this.texts[i].active = false;
    }
    this.trauma = 0;
    this.hitstopTimer = 0;
  }

  public addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  public triggerHitstop(duration = 0.045): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  public spawnBurst(
    x: number,
    y: number,
    color: string,
    count = 14,
    speed = 140,
    size = 6,
    shape: 'cube' | 'ring' | 'spark' = 'cube'
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.45 + Math.random() * 0.75);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 10;
      p.color = color;
      p.maxLife = 0.28 + Math.random() * 0.25;
      p.life = p.maxLife;
      p.shape = shape;
    }
  }

  public spawnText(x: number, y: number, text: string, color = '#FFFFFF'): void {
    const t = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % MAX_TEXTS;
    t.active = true;
    t.x = x;
    t.y = y;
    t.vy = -42;
    t.text = text;
    t.color = color;
    t.maxLife = 0.85;
    t.life = t.maxLife;
  }

  public update(dt: number): boolean {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.6);
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.rotation += p.vRot * dt;
    }

    for (let i = 0; i < MAX_TEXTS; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return true; // Hitstop aktif, fizik simülasyonu bu karede bekler
    }
    return false;
  }

  public applyCameraShake(ctx: CanvasRenderingContext2D): void {
    if (this.trauma > 0.01) {
      const shake = this.trauma * this.trauma * 10;
      const dx = (Math.random() * 2 - 1) * shake;
      const dy = (Math.random() * 2 - 1) * shake;
      ctx.translate(dx, dy);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      if (p.shape === 'cube') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        const s = p.size * alpha;
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
        ctx.restore();
      } else if (p.shape === 'ring') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.8 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5 * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < MAX_TEXTS; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      const alpha = Math.max(0, Math.min(1, (t.life / t.maxLife) * 1.4));
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0B0F19';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}

/**
 * Minimalist Geometrik Neon Izgara (Grid) Arka Plan Çizici
 */
export function drawArenaGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize = 42,
  accentColor = 'rgba(148, 163, 184, 0.07)'
): void {
  ctx.fillStyle = '#0B0F19';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = gridSize; x < width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = gridSize; y < height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}
