/**
 * CubeArena .io — Web Audio API Sentezleyici Ses Motoru (audio.ts)
 * Harici MP3/WAV dosyası kullanmadan kod ile gerçek zamanlı arcade ses efektleri üretir.
 */

export const HAPTIC_PATTERNS = {
  button: 12,
  lightAction: 10,
  collision: 28,
  explosion: [45, 30, 65] as number[],
  goal: [35, 45, 55, 45, 80] as number[],
  win: [40, 50, 40, 50, 110] as number[]
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public hapticsEnabled: boolean = true;

  constructor() {
    // Kullanıcı etkileşimiyle AudioContext ve navigator.vibrate tetiklenir
  }

  private hasUserActivation(): boolean {
    if (typeof navigator !== 'undefined' && 'userActivation' in navigator && navigator.userActivation) {
      return navigator.userActivation.hasBeenActive;
    }
    return true;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || !this.hasUserActivation()) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * navigator.vibrate tabanlı dokunsal geri bildirim (Haptic Feedback) servisi
   */
  public vibrate(pattern: number | number[] = HAPTIC_PATTERNS.button): boolean {
    if (!this.hapticsEnabled || !this.hasUserActivation()) return false;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        return navigator.vibrate(pattern);
      }
    } catch {
      // Desteklenmeyen cihaz veya tarayıcı izin kısıtlamasında sessizce geç
    }
    return false;
  }

  public vibrateButton(duration: number = HAPTIC_PATTERNS.button): boolean {
    return this.vibrate(duration);
  }

  public vibrateCollision(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.collision);
  }

  public vibrateExplosion(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.explosion);
  }

  public vibrateGoal(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.goal);
  }

  public vibrateWin(): boolean {
    return this.vibrate(HAPTIC_PATTERNS.win);
  }

  public toggleHaptics(): boolean {
    this.hapticsEnabled = !this.hapticsEnabled;
    if (this.hapticsEnabled) {
      this.vibrateButton(18);
    } else {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(0);
        }
      } catch {
        // Yoksay
      }
    }
    return this.hapticsEnabled;
  }

  public toggleSound(): boolean {
    this.enabled = !this.enabled;
    this.vibrateButton();
    if (this.enabled) {
      this.playClick();
    }
    return this.enabled;
  }

  /**
   * Hafif perde (pitch) varyasyonu (±8%) ile doğal arcade hissi
   */
  private vary(freq: number, range = 0.08): number {
    return freq * (1 + (Math.random() * 2 - 1) * range);
  }

  /**
   * Menü tıklama sesi + kısa dokunsal titreşim
   */
  public playClick(): void {
    this.vibrateButton();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.vary(520, 0.04), now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.055);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  /**
   * Ateş etme / Ok fırlatma sesi
   */
  public playShoot(): void {
    this.vibrate(HAPTIC_PATTERNS.lightAction);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.vary(680), now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.11);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.125);
  }

  /**
   * Kılıç savurma / Depar (Dash) sesi
   */
  public playSwing(): void {
    this.vibrate(HAPTIC_PATTERNS.lightAction);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.vary(240), now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.14);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.155);
  }

  /**
   * Darbe / Çarpışma sesi + çarpışma titreşimi
   */
  public playHit(): void {
    this.vibrateCollision();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(this.vary(190), now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Patlama / Elenme sesi + güçlü titreşim
   */
  public playExplosion(): void {
    this.vibrateExplosion();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Beyaz gürültü + alçak frekans osilatör
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.24);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  /**
   * XP / Küre / Güçlendirme toplama sesi
   */
  public playPickup(high = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = high ? 660 : 480;
    osc.frequency.setValueAtTime(this.vary(base, 0.05), now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.08);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Birlik çıkarma (Cube Royale) sesi
   */
  public playSpawn(): void {
    this.vibrateButton(15);
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.09);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Gol veya Tur Tamamlama sesi + ritmik gol titreşimi
   */
  public playGoal(): void {
    this.vibrateGoal();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    });
  }

  /**
   * Oyun Sonu / Kazanma Fanfarı + kutlama titreşimi
   */
  public playWin(): void {
    this.vibrateWin();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    });
  }
}

export const soundEngine = new SoundEngine();

export const hapticService = {
  vibrate: (pattern?: number | number[]) => soundEngine.vibrate(pattern),
  buttonPress: (duration?: number) => soundEngine.vibrateButton(duration),
  collision: () => soundEngine.vibrateCollision(),
  explosion: () => soundEngine.vibrateExplosion(),
  goalScored: () => soundEngine.vibrateGoal(),
  matchWin: () => soundEngine.vibrateWin(),
  toggle: () => soundEngine.toggleHaptics(),
  isEnabled: () => soundEngine.hapticsEnabled
};
