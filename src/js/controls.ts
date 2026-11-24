/**
 * CubeArena .io — Çoklu Dokunmatik (Multi-Touch) ve Klavye Kontrol Sistemi (controls.ts)
 * Aynı ekranda 2, 3 veya 4 oyuncunun parmaklarını `touch.identifier` ile bağımsız takip eder.
 */

import { computeJoystickVector, CubeUnitType } from './rules';

export interface PlayerInputState {
  playerId: number;
  // Normalize hareket vektörü (-1..1)
  moveX: number;
  moveY: number;
  magnitude: number;
  angle: number;
  // Aksiyon butonu (basılı tutuluyor mu & bu karede yeni mi basıldı)
  actionHeld: boolean;
  actionJustPressed: boolean;
  // Turbo Drift için sağ/sol yönlendirme (-1: Sol, 0: Düz, 1: Sağ)
  steerDir: number;
  // Cube Royale için bu karede basılan birlik çıkarma kuyruğu
  spawnQueue: CubeUnitType[];
  // Son insan dokunuşu zaman damgası (Bot desteği veya aktiflik göstergesi için)
  lastHumanInputAt: number;
  // Aktif sanal joystick görsel koordinatları (Canvas içi veya HUD üstü geri bildirim için)
  joystickActive: boolean;
  joyStartX: number;
  joyStartY: number;
  joyCurrX: number;
  joyCurrY: number;
}

interface TouchBinding {
  identifier: number;
  playerId: number;
  role: 'joystick' | 'action' | 'steer-left' | 'steer-right' | 'unit';
  startX: number;
  startY: number;
  currX: number;
  currY: number;
  unitType?: CubeUnitType;
}

export class MultiTouchController {
  public states: PlayerInputState[] = [];
  private activeTouches: Map<number, TouchBinding> = new Map();
  private keysPressed: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();

  constructor() {
    for (let i = 0; i < 4; i++) {
      this.states.push({
        playerId: i,
        moveX: 0,
        moveY: 0,
        magnitude: 0,
        angle: i === 0 ? -Math.PI / 4 : i === 1 ? (3 * Math.PI) / 4 : i === 2 ? Math.PI / 4 : (-3 * Math.PI) / 4,
        actionHeld: false,
        actionJustPressed: false,
        steerDir: 0,
        spawnQueue: [],
        lastHumanInputAt: 0,
        joystickActive: false,
        joyStartX: 0,
        joyStartY: 0,
        joyCurrX: 0,
        joyCurrY: 0
      });
    }
  }

  public resetAll(): void {
    this.activeTouches.clear();
    this.keysPressed.clear();
    this.justPressedKeys.clear();
    const now = performance.now();
    for (let i = 0; i < 4; i++) {
      const s = this.states[i];
      s.moveX = 0;
      s.moveY = 0;
      s.magnitude = 0;
      s.actionHeld = false;
      s.actionJustPressed = false;
      s.steerDir = 0;
      s.spawnQueue = [];
      s.joystickActive = false;
      // Oyuncu 1 başlangıçta insan kontrolünde kabul edilsin
      s.lastHumanInputAt = i === 0 ? now : 0;
    }
  }

  /**
   * Sanal Joystick alanına dokunma başlatma (Touch veya Mouse)
   */
  public startJoystickTouch(
    identifier: number,
    playerId: number,
    clientX: number,
    clientY: number
  ): void {
    const s = this.states[playerId];
    if (!s) return;
    this.activeTouches.set(identifier, {
      identifier,
      playerId,
      role: 'joystick',
      startX: clientX,
      startY: clientY,
      currX: clientX,
      currY: clientY
    });
    s.joystickActive = true;
    s.joyStartX = clientX;
    s.joyStartY = clientY;
    s.joyCurrX = clientX;
    s.joyCurrY = clientY;
    s.lastHumanInputAt = performance.now();
  }

  /**
   * Sanal Joystick hareket güncelleme (`touchmove` - `touch.identifier` ile bağımsız)
   */
  public moveTouch(identifier: number, clientX: number, clientY: number): void {
    const binding = this.activeTouches.get(identifier);
    if (!binding) return;

    binding.currX = clientX;
    binding.currY = clientY;

    if (binding.role === 'joystick') {
      const s = this.states[binding.playerId];
      if (!s) return;
      s.joyCurrX = clientX;
      s.joyCurrY = clientY;
      s.lastHumanInputAt = performance.now();
      const vec = computeJoystickVector(binding.startX, binding.startY, clientX, clientY, 44);
      s.moveX = vec.vx;
      s.moveY = vec.vy;
      s.magnitude = vec.magnitude;
      if (vec.magnitude > 0.12) {
        s.angle = vec.angle;
      }
    }
  }

  /**
   * Aksiyon butonuna dokunma (`touchstart` / `mousedown`)
   */
  public startActionTouch(identifier: number, playerId: number): void {
    const s = this.states[playerId];
    if (!s) return;
    this.activeTouches.set(identifier, {
      identifier,
      playerId,
      role: 'action',
      startX: 0,
      startY: 0,
      currX: 0,
      currY: 0
    });
    s.actionHeld = true;
    s.actionJustPressed = true;
    s.lastHumanInputAt = performance.now();
  }

  /**
   * Turbo Drift Sağ/Sol direksiyon butonuna dokunma
   */
  public startSteerTouch(identifier: number, playerId: number, dir: -1 | 1): void {
    const s = this.states[playerId];
    if (!s) return;
    this.activeTouches.set(identifier, {
      identifier,
      playerId,
      role: dir === -1 ? 'steer-left' : 'steer-right',
      startX: 0,
      startY: 0,
      currX: 0,
      currY: 0
    });
    s.lastHumanInputAt = performance.now();
    this.recomputeSteer(playerId);
  }

  /**
   * Cube Royale Birlik Çıkarma Butonu Tetikleme
   */
  public triggerUnitSpawn(playerId: number, unitType: CubeUnitType): void {
    const s = this.states[playerId];
    if (!s) return;
    s.spawnQueue.push(unitType);
    s.lastHumanInputAt = performance.now();
  }

  /**
   * Dokunma bitişi (`touchend` / `touchcancel` / `mouseup`)
   */
  public endTouch(identifier: number): void {
    const binding = this.activeTouches.get(identifier);
    if (!binding) return;
    this.activeTouches.delete(identifier);

    const s = this.states[binding.playerId];
    if (!s) return;

    if (binding.role === 'joystick') {
      s.joystickActive = false;
      s.moveX = 0;
      s.moveY = 0;
      s.magnitude = 0;
    } else if (binding.role === 'action') {
      // Aynı oyuncunun başka bir aksiyon dokunuşu var mı kontrol et
      let stillHeld = false;
      this.activeTouches.forEach((b) => {
        if (b.playerId === binding.playerId && b.role === 'action') {
          stillHeld = true;
        }
      });
      s.actionHeld = stillHeld;
    } else if (binding.role === 'steer-left' || binding.role === 'steer-right') {
      this.recomputeSteer(binding.playerId);
    }
  }

  private recomputeSteer(playerId: number): void {
    const s = this.states[playerId];
    if (!s) return;
    let dir = 0;
    this.activeTouches.forEach((b) => {
      if (b.playerId === playerId) {
        if (b.role === 'steer-left') dir -= 1;
        if (b.role === 'steer-right') dir += 1;
      }
    });
    s.steerDir = Math.max(-1, Math.min(1, dir));
  }

  /**
   * Klavye Desteği (Masaüstünde 4 kişiye kadar aynı anda test ve oyun imkanı)
   */
  public handleKeyDown(code: string): void {
    if (!this.keysPressed.has(code)) {
      this.justPressedKeys.add(code);
    }
    this.keysPressed.add(code);

    const now = performance.now();
    // P1: WASD + Space + Digit1..4
    if (
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(
        code
      )
    ) {
      this.states[0].lastHumanInputAt = now;
      if (code === 'Digit1') this.states[0].spawnQueue.push('swordsman');
      if (code === 'Digit2') this.states[0].spawnQueue.push('archer');
      if (code === 'Digit3') this.states[0].spawnQueue.push('cavalry');
      if (code === 'Digit4') this.states[0].spawnQueue.push('tank');
    }
    // P2: Arrow Keys + Enter + Numpad1..4 / Digit7..0
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'ShiftRight',
        'Digit7',
        'Digit8',
        'Digit9',
        'Digit0'
      ].includes(code)
    ) {
      this.states[1].lastHumanInputAt = now;
      if (code === 'Digit7') this.states[1].spawnQueue.push('swordsman');
      if (code === 'Digit8') this.states[1].spawnQueue.push('archer');
      if (code === 'Digit9') this.states[1].spawnQueue.push('cavalry');
      if (code === 'Digit0') this.states[1].spawnQueue.push('tank');
    }
    // P3: IJKL + KeyO
    if (['KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyO', 'KeyU'].includes(code)) {
      this.states[2].lastHumanInputAt = now;
    }
    // P4: TFGH + KeyY
    if (['KeyT', 'KeyF', 'KeyG', 'KeyH', 'KeyY', 'KeyR'].includes(code)) {
      this.states[3].lastHumanInputAt = now;
    }
  }

  public handleKeyUp(code: string): void {
    this.keysPressed.delete(code);
  }

  /**
   * Her oyun karesinin (frame) başında klavye ve dokunmatik girdilerini birleştirir.
   */
  public pollFrameInputs(): void {
    const keyConfigs = [
      { id: 0, up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'Space' },
      { id: 1, up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Enter' },
      { id: 2, up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', act: 'KeyO' },
      { id: 3, up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH', act: 'KeyY' }
    ];

    for (const cfg of keyConfigs) {
      const s = this.states[cfg.id];
      if (!s.joystickActive) {
        let kx = 0;
        let ky = 0;
        if (this.keysPressed.has(cfg.left)) kx -= 1;
        if (this.keysPressed.has(cfg.right)) kx += 1;
        if (this.keysPressed.has(cfg.up)) ky -= 1;
        if (this.keysPressed.has(cfg.down)) ky += 1;

        if (kx !== 0 || ky !== 0) {
          const len = Math.hypot(kx, ky);
          s.moveX = kx / len;
          s.moveY = ky / len;
          s.magnitude = 1;
          s.angle = Math.atan2(s.moveY, s.moveX);
        } else {
          s.moveX = 0;
          s.moveY = 0;
          s.magnitude = 0;
        }
      }

      // Turbo Drift için klavye sol/sağ
      let touchSteerActive = false;
      this.activeTouches.forEach((b) => {
        if (b.playerId === cfg.id && (b.role === 'steer-left' || b.role === 'steer-right')) {
          touchSteerActive = true;
        }
      });
      if (!touchSteerActive) {
        let kSteer = 0;
        if (this.keysPressed.has(cfg.left)) kSteer -= 1;
        if (this.keysPressed.has(cfg.right)) kSteer += 1;
        if (s.joystickActive && Math.abs(s.moveX) > 0.2) {
          kSteer = s.moveX > 0 ? 1 : -1;
        }
        s.steerDir = kSteer;
      }

      // Klavye aksiyon tuşu kontrolü
      if (this.justPressedKeys.has(cfg.act)) {
        s.actionJustPressed = true;
      }
      if (this.keysPressed.has(cfg.act)) {
        s.actionHeld = true;
      } else {
        // Dokunmatik aksiyon basılı değilse bırak
        let touchAct = false;
        this.activeTouches.forEach((b) => {
          if (b.playerId === cfg.id && b.role === 'action') touchAct = true;
        });
        if (!touchAct) s.actionHeld = false;
      }
    }

    this.justPressedKeys.clear();
  }

  /**
   * Kare sonunda tek seferlik (edge-triggered) bayrakları temizler
   */
  public endFrame(): void {
    for (let i = 0; i < 4; i++) {
      this.states[i].actionJustPressed = false;
    }
  }
}

export const multiTouchController = new MultiTouchController();
