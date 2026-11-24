/**
 * CubeArena .io — Çoklu Dokunmatik (Multi-Touch) Oyuncu Kontrol Yerleşimi
 * - 2 Kişilik: Ekranın alt ve üst kenarlarına karşılıklı (üstteki 180 derece dönük) kontroller.
 * - 3 veya 4 Kişilik: Ekranın 4 köşesine, her oyuncunun kendi oturduğu açıya dönük kompakt
 *   sanal joystick, aksiyon butonları, sağ/sol direksiyon veya 4'lü birlik çıkarma butonları.
 */

import React, { useState } from 'react';
import { hapticService, soundEngine } from '../js/audio';
import { multiTouchController } from '../js/controls';
import { PlayerHudInfo } from '../js/games/types';
import {
  CUBE_UNIT_STATS,
  CubeUnitType,
  GameMetadata,
  PLAYERS_CONFIG
} from '../js/rules';

interface PlayerTouchControlsProps {
  playerCount: 2 | 3 | 4;
  game: GameMetadata;
  hudPlayers: PlayerHudInfo[];
}

export const PlayerTouchControls: React.FC<PlayerTouchControlsProps> = ({
  playerCount,
  game,
  hudPlayers
}) => {
  const [, setTick] = useState(0);
  const refreshControls = () => setTick((t) => (t + 1) % 1000);

  /**
   * Oyuncu sayısına göre her oyuncunun kontrol panelinin konumu ve dönüş açısı
   */
  const getPodPositionAndRotation = (playerId: number): {
    containerClass: string;
    rotationStyle: string;
  } => {
    if (playerCount === 2) {
      if (playerId === 0) {
        // Oyuncu 1: Alt Kenar (Sol) - Merkez kuleyi ve kaleyi kapatmaz
        return {
          containerClass: 'bottom-3 left-3',
          rotationStyle: 'rotate(0deg)'
        };
      }
      // Oyuncu 2: Üst Kenar (Sağ) - Karşıdan bakan oyuncu için kendi merkezi etrafında 180 derece dönük
      return {
        containerClass: 'top-14 right-3',
        rotationStyle: 'rotate(180deg)'
      };
    }

    // 3 veya 4 Kişilik: 4 Köşe Yerleşimi (Her oyuncunun köşe açısına dönük, kendi merkezi etrafında)
    switch (playerId) {
      case 0: // P1 Mavi: Sol Alt Köşe
        return {
          containerClass: 'bottom-3 left-3',
          rotationStyle: 'rotate(12deg)'
        };
      case 1: // P2 Pembe: Sağ Üst Köşe
        return {
          containerClass: 'top-14 right-3',
          rotationStyle: 'rotate(-168deg)'
        };
      case 2: // P3 Sarı: Sol Üst Köşe
        return {
          containerClass: 'top-14 left-3',
          rotationStyle: 'rotate(168deg)'
        };
      case 3: // P4 Mor: Sağ Alt Köşe
      default:
        return {
          containerClass: 'bottom-3 right-3',
          rotationStyle: 'rotate(-12deg)'
        };
    }
  };

  const activeIndices = Array.from({ length: playerCount }, (_, i) => i);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none">
      {activeIndices.map((playerId) => {
        const cfg = PLAYERS_CONFIG[playerId];
        const hud = hudPlayers.find((p) => p.id === playerId);
        const isAlive = hud ? hud.alive : true;
        const { containerClass, rotationStyle } = getPodPositionAndRotation(playerId);
        const inputState = multiTouchController.states[playerId];

        return (
          <div
            key={playerId}
            style={{ transform: rotationStyle }}
            className={`pointer-events-auto absolute ${containerClass} flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-2 ${
              isAlive ? 'opacity-95' : 'opacity-35'
            }`}
            data-testid={`player-control-pod-${playerId}`}
          >
            {/* Arka Plan ve Oyuncu Başlığı */}
            <div
              style={{
                borderColor: cfg.color,
                backgroundColor: 'rgba(11, 15, 25, 0.86)'
              }}
              className="absolute inset-0 -z-10 rounded-2xl border-2 shadow-lg"
            />

            <div className="flex w-full items-center justify-between gap-3 px-1">
              <span
                style={{ color: cfg.color }}
                className="font-display text-xs font-extrabold tracking-wider whitespace-nowrap"
              >
                {cfg.shortName}
              </span>
              <span className="font-mono-tabular text-[11px] font-bold text-slate-200 whitespace-nowrap">
                {hud ? hud.metricText : ''}
              </span>
            </div>

            {/* MOD 1: CUBE ROYALE 4 BİRLİK ÇIKARMA BUTONU + ENERJİ BARI */}
            {game.controlMode === 'unit-buttons' && (
              <div className="flex flex-col gap-1.5">
                {/* Canlı Enerji Barı */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    style={{
                      width: `${Math.min(100, ((hud?.energy ?? 0) / (hud?.maxEnergy ?? 10)) * 100)}%`,
                      backgroundColor: '#FEE440'
                    }}
                    className="h-full"
                  />
                </div>

                {/* 4 Birlik Butonu: Kılıçlı (2), Okçu (3), Atlı (5), Tank (6) */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(['swordsman', 'archer', 'cavalry', 'tank'] as CubeUnitType[]).map((uType) => {
                    const st = CUBE_UNIT_STATS[uType];
                    const canAfford = isAlive && (hud?.energy ?? 0) >= st.cost;
                    return (
                      <button
                        key={uType}
                        type="button"
                        disabled={!isAlive}
                        aria-label={`${cfg.shortName} ${st.label} Çıkar (${st.cost} Enerji)`}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          multiTouchController.triggerUnitSpawn(playerId, uType);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          multiTouchController.triggerUnitSpawn(playerId, uType);
                        }}
                        style={{
                          borderColor: canAfford ? cfg.color : '#334155',
                          backgroundColor: canAfford ? cfg.darkColor : 'rgba(15, 23, 42, 0.7)'
                        }}
                        className={`flex min-h-[48px] min-w-[52px] flex-col items-center justify-center rounded-xl border px-1.5 py-1 transition-transform active:scale-95 ${
                          canAfford ? 'text-white' : 'text-slate-500'
                        }`}
                      >
                        <span className="font-display text-[10px] font-bold tracking-tight whitespace-nowrap">
                          {st.shortLabel}
                        </span>
                        <span className="font-mono-tabular text-[11px] font-extrabold text-amber-300">
                          ⚡{st.cost}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MOD 2: TURBO DRIFT SAĞ / SOL DİREKSİYON BUTONLARI */}
            {game.controlMode === 'steer-lr' && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label={`${cfg.shortName} Sola Dön`}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.startSteerTouch(
                        e.changedTouches[i].identifier,
                        playerId,
                        -1
                      );
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    multiTouchController.startSteerTouch(900 + playerId * 2, playerId, -1);
                  }}
                  onMouseUp={() => multiTouchController.endTouch(900 + playerId * 2)}
                  onMouseLeave={() => multiTouchController.endTouch(900 + playerId * 2)}
                  style={{ borderColor: cfg.color, backgroundColor: cfg.darkColor }}
                  className="flex h-14 w-20 items-center justify-center rounded-xl border-2 font-display text-sm font-extrabold text-white active:scale-95"
                >
                  ◀ SOL
                </button>

                <button
                  type="button"
                  aria-label={`${cfg.shortName} Sağa Dön`}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.startSteerTouch(
                        e.changedTouches[i].identifier,
                        playerId,
                        1
                      );
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    multiTouchController.startSteerTouch(901 + playerId * 2, playerId, 1);
                  }}
                  onMouseUp={() => multiTouchController.endTouch(901 + playerId * 2)}
                  onMouseLeave={() => multiTouchController.endTouch(901 + playerId * 2)}
                  style={{ borderColor: cfg.color, backgroundColor: cfg.darkColor }}
                  className="flex h-14 w-20 items-center justify-center rounded-xl border-2 font-display text-sm font-extrabold text-white active:scale-95"
                >
                  SAĞ ▶
                </button>
              </div>
            )}

            {/* MOD 3: SANAL JOYSTICK + AKSİYON BUTONU (Tank, EvoWars, MiniGiants, Agar, Snake, Futbol) */}
            {game.controlMode === 'joystick-action' && (
              <div className="flex items-center gap-3">
                {/* Çoklu Dokunmatik Sanal Joystick Alanı */}
                <div
                  role="application"
                  aria-label={`${cfg.shortName} Sanal Joystick`}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hapticService.buttonPress(10);
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      const t = e.changedTouches[i];
                      multiTouchController.startJoystickTouch(
                        t.identifier,
                        playerId,
                        t.clientX,
                        t.clientY
                      );
                    }
                    refreshControls();
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      const t = e.changedTouches[i];
                      multiTouchController.moveTouch(t.identifier, t.clientX, t.clientY);
                    }
                    refreshControls();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                    refreshControls();
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                    refreshControls();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const cx = rect.left + rect.width * 0.5;
                    const cy = rect.top + rect.height * 0.5;
                    multiTouchController.startJoystickTouch(800 + playerId, playerId, cx, cy);
                    multiTouchController.moveTouch(800 + playerId, e.clientX, e.clientY);
                    refreshControls();
                  }}
                  onMouseMove={(e) => {
                    if (inputState.joystickActive) {
                      multiTouchController.moveTouch(800 + playerId, e.clientX, e.clientY);
                      refreshControls();
                    }
                  }}
                  onMouseUp={() => {
                    multiTouchController.endTouch(800 + playerId);
                    refreshControls();
                  }}
                  onMouseLeave={() => {
                    multiTouchController.endTouch(800 + playerId);
                    refreshControls();
                  }}
                  style={{ borderColor: cfg.color }}
                  className="touch-arena relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-slate-900/90"
                >
                  {/* İç Artı Nişangahı */}
                  <div className="pointer-events-none absolute h-full w-px bg-slate-700/50" />
                  <div className="pointer-events-none absolute h-px w-full bg-slate-700/50" />

                  {/* Hareketli Joystick Topuzu */}
                  <div
                    style={{
                      backgroundColor: cfg.color,
                      transform: `translate(${inputState.moveX * 18}px, ${inputState.moveY * 18}px)`
                    }}
                    className="pointer-events-none h-7 w-7 rounded-lg border-2 border-white shadow-md"
                  />
                </div>

                {/* Aksiyon Butonu (Ateş / Kılıç / Saldır / Şut / Hızlan) */}
                <button
                  type="button"
                  disabled={!isAlive}
                  aria-label={`${cfg.shortName} ${game.actionLabel}`}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    soundEngine.playClick();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.startActionTouch(
                        e.changedTouches[i].identifier,
                        playerId
                      );
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    for (let i = 0; i < e.changedTouches.length; i++) {
                      multiTouchController.endTouch(e.changedTouches[i].identifier);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    multiTouchController.startActionTouch(850 + playerId, playerId);
                  }}
                  onMouseUp={() => multiTouchController.endTouch(850 + playerId)}
                  onMouseLeave={() => multiTouchController.endTouch(850 + playerId)}
                  style={{
                    borderColor: cfg.color,
                    backgroundColor: inputState.actionHeld ? cfg.color : cfg.darkColor,
                    color: inputState.actionHeld ? '#0B0F19' : '#FFFFFF'
                  }}
                  className="touch-arena flex h-16 w-16 items-center justify-center rounded-2xl border-2 font-display text-xs font-extrabold tracking-tight shadow-md transition-transform active:scale-95"
                >
                  {game.actionLabel}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
