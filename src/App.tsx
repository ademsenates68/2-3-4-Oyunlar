/**
 * CubeArena .io — 2, 3, 4 Kişilik .io Mini Oyunlar Koleksiyonu
 * Tek ekranda HTML5 Canvas 2D, Web Audio API ve Çoklu Dokunmatik (Multi-Touch) ile çalışan ana kabuk.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AchievementsModal, AchievementToast } from './components/AchievementToast';
import { GameStats } from './components/GameStats';
import { LegalModals, ModalType } from './components/LegalModals';
import { PlayerTouchControls } from './components/PlayerTouchControls';
import {
  AchievementDefinition,
  AchievementDelta,
  ACHIEVEMENTS_LIST,
  ACHIEVEMENTS_STORAGE_KEY,
  AchievementState,
  clearAchievementState,
  loadAchievementState,
  recordAchievementProgress
} from './js/achievements';
import { hapticService, soundEngine } from './js/audio';
import { multiTouchController } from './js/controls';
import { createMiniGame } from './js/games';
import { GameHudSnapshot, MiniGameEngine } from './js/games/types';
import { drawArenaGrid } from './js/particles';
import {
  clearOverallScores,
  GameId,
  GameMetadata,
  GAMES_LIST,
  loadOverallScores,
  OVERALL_SCORES_STORAGE_KEY,
  PLAYERS_CONFIG,
  saveOverallScores
} from './js/rules';

type ScreenView = 'menu' | 'select' | 'playing';

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('menu');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [selectedGameId, setSelectedGameId] = useState<GameId>('cube-royale');
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [botAssist, setBotAssist] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Kalıcı Genel Skor Tablosu (P1, P2, P3, P4 galibiyet sayıları - localStorage destekli)
  const [overallScores, setOverallScores] = useState<number[]>(() => loadOverallScores());

  // Kalıcı Başarım (Achievements) Durumu ve Bildirim (Toast) Kuyruğu
  const [achievementState, setAchievementState] = useState<AchievementState>(() =>
    loadAchievementState()
  );
  const [toastQueue, setToastQueue] = useState<AchievementDefinition[]>([]);
  const [achievementsModalOpen, setAchievementsModalOpen] = useState(false);

  // Oyun içi HUD durumu (React render döngüsünü yormamak için 12Hz'de veya durum değişiminde güncellenir)
  const [hudState, setHudState] = useState<GameHudSnapshot>({
    timeRemaining: null,
    statusMessage: '',
    players: [],
    isGameOver: false,
    winnerId: null,
    winReason: ''
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameEngineRef = useRef<MiniGameEngine | null>(null);
  const botAssistRef = useRef<boolean>(botAssist);
  const isPausedRef = useRef<boolean>(isPaused);
  const scoreRecordedRef = useRef<boolean>(false);
  const matchTrackedStatsRef = useRef<{ kills: number; distance: number }>({
    kills: 0,
    distance: 0
  });

  const applyAchievementDelta = useCallback((delta: AchievementDelta) => {
    const { state, newlyUnlocked } = recordAchievementProgress(delta);
    setAchievementState(state);
    if (newlyUnlocked.length > 0) {
      soundEngine.playGoal();
      setToastQueue((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const uniqueNew = newlyUnlocked.filter((a) => !existingIds.has(a.id));
        return [...prev, ...uniqueNew];
      });
    }
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToastQueue((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Açılan başarım bildirimlerini (toast) 4.2 saniye sonra otomatik kapat
  useEffect(() => {
    if (toastQueue.length === 0) return;
    const timer = window.setTimeout(() => {
      setToastQueue((prev) => prev.slice(1));
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [toastQueue]);

  useEffect(() => {
    botAssistRef.current = botAssist;
  }, [botAssist]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Genel skorlar her güncellendiğinde localStorage'a kaydet ve sekmeler arası senkronize et
  useEffect(() => {
    saveOverallScores(overallScores);
  }, [overallScores]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === OVERALL_SCORES_STORAGE_KEY) {
        setOverallScores(loadOverallScores());
      } else if (e.key === ACHIEVEMENTS_STORAGE_KEY) {
        setAchievementState(loadAchievementState());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const activeGameMeta: GameMetadata =
    GAMES_LIST.find((g) => g.id === selectedGameId) ?? GAMES_LIST[0];

  /**
   * document.body.dataset.state senkronizasyonu ('title' | 'playing' | 'paused' | 'gameover')
   */
  useEffect(() => {
    if (screen !== 'playing') {
      document.body.dataset.state = 'title';
    } else if (hudState.isGameOver) {
      document.body.dataset.state = 'gameover';
    } else if (isPaused) {
      document.body.dataset.state = 'paused';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [screen, isPaused, hudState.isGameOver]);

  /**
   * Seçilen oyunu başlat veya yeniden başlat
   */
  const startMatch = useCallback(
    (gameId: GameId, count: 2 | 3 | 4) => {
      soundEngine.playClick();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      multiTouchController.resetAll();
      scoreRecordedRef.current = false;
      matchTrackedStatsRef.current = { kills: 0, distance: 0 };
      setSelectedGameId(gameId);
      setPlayerCount(count);
      setIsPaused(false);
      setScreen('playing');
      document.body.dataset.state = 'playing';

      const engine = createMiniGame(gameId);
      const w = window.innerWidth;
      const h = window.innerHeight;
      engine.init(w, h, count);
      gameEngineRef.current = engine;
      setHudState(engine.getHudState());
    },
    []
  );

  /**
   * ?autostart=1 parametresi desteği ve pencere odak kaybı temizliği
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startMatch('cube-royale', 2);
    }

    const handleBlur = () => {
      multiTouchController.resetAll();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [startMatch]);

  /**
   * Klavye kısayolları (WASD, Yön Tuşları, IJKL, TFGH, Enter/Space Başlat, Esc/P Duraklat)
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeModal) {
        if (e.code === 'Escape') setActiveModal(null);
        return;
      }

      if (screen === 'menu') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          soundEngine.playClick();
          setPlayerCount(2);
          setScreen('select');
        }
        return;
      }

      if (screen === 'select') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startMatch(selectedGameId, playerCount);
        } else if (e.code === 'Escape') {
          setScreen('menu');
        }
        return;
      }

      if (screen === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          if (!hudState.isGameOver) {
            setIsPaused((prev) => !prev);
          }
          return;
        }
        if (hudState.isGameOver && (e.code === 'Enter' || e.code === 'Space')) {
          e.preventDefault();
          startMatch(selectedGameId, playerCount);
          return;
        }
        multiTouchController.handleKeyDown(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      multiTouchController.handleKeyUp(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [screen, activeModal, selectedGameId, playerCount, hudState.isGameOver, startMatch]);

  /**
   * Ana Menü & Seçim Ekranı Arka Plan Canlı Geometrik Küp Animasyonu
   */
  useEffect(() => {
    if (screen === 'playing') return;
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const floatingCubes = Array.from({ length: 18 }, (_, idx) => ({
      x: (idx * 97) % window.innerWidth,
      y: (idx * 73) % window.innerHeight,
      vx: ((idx % 2 === 0 ? 1 : -1) * (18 + (idx % 5) * 6)),
      vy: ((idx % 3 === 0 ? 1 : -1) * (14 + (idx % 4) * 5)),
      size: 16 + (idx % 4) * 10,
      rot: idx * 0.5,
      vRot: (idx % 2 === 0 ? 1 : -1) * 0.4,
      color: PLAYERS_CONFIG[idx % 4].color
    }));

    let lastTime = performance.now();
    const renderBg = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      drawArenaGrid(ctx, canvas.width, canvas.height, 48);

      for (const c of floatingCubes) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vRot * dt;

        if (c.x < -40) c.x = canvas.width + 40;
        if (c.x > canvas.width + 40) c.x = -40;
        if (c.y < -40) c.y = canvas.height + 40;
        if (c.y > canvas.height + 40) c.y = -40;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-c.size * 0.5, -c.size * 0.5, c.size, c.size);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.05;
        ctx.fillRect(-c.size * 0.5, -c.size * 0.5, c.size, c.size);
        ctx.restore();
      }

      timerId = window.setTimeout(() => {
        animId = requestAnimationFrame(renderBg);
      }, 16);
    };

    let timerId = 0;
    animId = requestAnimationFrame(renderBg);
    return () => {
      cancelAnimationFrame(animId);
      window.clearTimeout(timerId);
      window.removeEventListener('resize', updateSize);
    };
  }, [screen]);

  /**
   * Aktif Oyun 60 FPS Canvas2D Döngüsü (React state'inden ayrıştırılmış)
   */
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gameEngineRef.current?.resize(canvas.width, canvas.height);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let animId = 0;
    let timerId = 0;
    let lastTime = performance.now();
    let hudSyncAccumulator = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));
      lastTime = now;

      const engine = gameEngineRef.current;
      if (engine) {
        if (!isPausedRef.current) {
          multiTouchController.pollFrameInputs();
          engine.update(dt, multiTouchController.states, botAssistRef.current);
          multiTouchController.endFrame();
        }

        engine.render(ctx);

        hudSyncAccumulator += dt;
        const latestHud = engine.getHudState();
        if (hudSyncAccumulator >= 0.15 || latestHud.isGameOver) {
          hudSyncAccumulator = 0;
          setHudState(latestHud);

          // Oyun içi anlık imha (kills) ve mesafe (distance) artışlarını hesapla
          const currentKills = latestHud.players.reduce(
            (sum, p) => sum + Math.max(0, Math.floor(p.kills ?? 0)),
            0
          );
          const currentDist = latestHud.players.reduce(
            (sum, p) => sum + Math.max(0, Math.floor(p.distance ?? 0)),
            0
          );
          const killDelta = Math.max(0, currentKills - matchTrackedStatsRef.current.kills);
          const distDelta = Math.max(0, currentDist - matchTrackedStatsRef.current.distance);

          // Tur bittiğinde kazananın genel skorunu +1 artır, localStorage'a kaydet ve başarımları değerlendir
          if (latestHud.isGameOver && !scoreRecordedRef.current && latestHud.winnerId !== null) {
            scoreRecordedRef.current = true;
            matchTrackedStatsRef.current = { kills: currentKills, distance: currentDist };
            hapticService.matchWin();
            const winIdx = latestHud.winnerId;
            setOverallScores((prev) => {
              const next = [...prev];
              next[winIdx] = (next[winIdx] ?? 0) + 1;
              saveOverallScores(next);
              return next;
            });
            applyAchievementDelta({
              gamesPlayed: 1,
              wins: 1,
              kills: killDelta,
              distance: distDelta
            });
          } else if (killDelta > 0 || distDelta >= 50) {
            matchTrackedStatsRef.current = {
              kills: currentKills,
              distance: distDelta >= 50 ? currentDist : matchTrackedStatsRef.current.distance
            };
            applyAchievementDelta({
              kills: killDelta,
              distance: distDelta >= 50 ? distDelta : 0
            });
          }
        }
      }

      timerId = window.setTimeout(() => {
        animId = requestAnimationFrame(loop);
      }, 16);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.clearTimeout(timerId);
      window.removeEventListener('resize', handleResize);
    };
  }, [screen, applyAchievementDelta]);

  const handleToggleSound = () => {
    const next = soundEngine.toggleSound();
    setSoundEnabled(next);
  };

  const handleToggleHaptics = () => {
    const next = hapticService.toggle();
    setHapticsEnabled(next);
  };

  /**
   * Her mini oyun kartı için özel kod-çizimi SVG geometrik ikon
   */
  const renderGameCardIcon = (gameId: GameId, color: string) => {
    switch (gameId) {
      case 'cube-royale':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <rect x="6" y="6" width="36" height="36" rx="6" fill="#0B0F19" stroke={color} strokeWidth="3" />
            <rect x="16" y="16" width="16" height="16" fill={color} />
            <path d="M24 6V2M24 46V42M6 24H2M46 24H42" stroke="#FEE440" strokeWidth="3" />
          </svg>
        );
      case 'tank-io':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <rect x="8" y="12" width="24" height="24" rx="4" fill="#0B0F19" stroke={color} strokeWidth="3" />
            <rect x="22" y="21" width="20" height="6" rx="2" fill={color} />
            <circle cx="20" cy="24" r="6" fill={color} />
          </svg>
        );
      case 'evowars-io':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <rect x="8" y="18" width="18" height="18" rx="3" fill="#0B0F19" stroke={color} strokeWidth="3" />
            <path d="M24 24L42 8L44 14L28 28Z" fill="#F8FAFC" stroke={color} strokeWidth="2" />
          </svg>
        );
      case 'minigiants-io':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <rect x="10" y="16" width="22" height="22" rx="4" fill="#0B0F19" stroke={color} strokeWidth="3" />
            <rect x="8" y="7" width="26" height="5" rx="2" fill={color} />
            <rect x="34" y="14" width="8" height="24" rx="2" fill="#F8FAFC" />
          </svg>
        );
      case 'agar-io':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <circle cx="22" cy="24" r="15" fill="#0B0F19" stroke={color} strokeWidth="3" />
            <circle cx="22" cy="24" r="7" fill={color} />
            <circle cx="39" cy="14" r="4" fill="#FEE440" />
          </svg>
        );
      case 'snake-io':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <rect x="6" y="28" width="10" height="10" rx="2" fill={color} opacity="0.45" />
            <rect x="18" y="20" width="11" height="11" rx="2" fill={color} opacity="0.75" />
            <rect x="30" y="10" width="13" height="13" rx="3" fill={color} stroke="#FFFFFF" strokeWidth="2" />
          </svg>
        );
      case 'turbo-drift':
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <rect x="8" y="14" width="32" height="20" rx="5" fill={color} stroke="#FFFFFF" strokeWidth="2" />
            <rect x="22" y="17" width="11" height="14" rx="2" fill="#0B0F19" />
            <path d="M2 20L7 24L2 28" stroke="#FEE440" strokeWidth="3" fill="none" />
          </svg>
        );
      case 'arena-futbol':
      default:
        return (
          <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0">
            <circle cx="24" cy="24" r="16" fill="#F8FAFC" stroke={color} strokeWidth="3.5" />
            <rect x="19" y="19" width="10" height="10" fill="#0B0F19" />
          </svg>
        );
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0B0F19] text-slate-100 select-none">
      {/* Başarım Kilidi Açıldı Bildirimi (Toast) */}
      <AchievementToast queue={toastQueue} onDismiss={handleDismissToast} />

      {/* Başarımlar ve Kilometre Taşları Modalı */}
      <AchievementsModal
        isOpen={achievementsModalOpen}
        state={achievementState}
        onClose={() => setAchievementsModalOpen(false)}
        onReset={() => {
          hapticService.buttonPress();
          soundEngine.playClick();
          setAchievementState(clearAchievementState());
          setToastQueue([]);
        }}
      />

      {/* Yasal & Play Store Rehber Modalları */}
      <LegalModals activeModal={activeModal} onClose={() => setActiveModal(null)} />

      {/* Arka Plan Canlı Geometrik Tuval (Menü ve Oyun Seçiminde) */}
      {screen !== 'playing' && (
        <canvas
          ref={bgCanvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 h-full w-full"
        />
      )}

      {/* ===================================================================== */}
      {/* 1. EKRAN: ANA MENÜ (2, 3, 4 KİŞİLİK SEÇİM & ÜST AYARLAR)              */}
      {/* ===================================================================== */}
      {screen === 'menu' && (
        <div className="relative z-10 flex h-full w-full flex-col justify-between px-4 py-4 sm:px-8 sm:py-6">
          {/* Üst Ayarlar Çubuğu (Ses Aç/Kapa, Gizlilik Politikası, Kullanım Koşulları) */}
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 font-display text-xs font-bold tracking-wide text-slate-200 transition-transform active:scale-95 hover:border-cyan-400 whitespace-nowrap"
              >
                <span>{soundEnabled ? '🔊 SES: AÇIK' : '🔇 SES: KAPALI'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleHaptics}
                aria-label={hapticsEnabled ? 'Titreşimi Kapat' : 'Titreşimi Aç'}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 font-display text-xs font-bold tracking-wide text-slate-200 transition-transform active:scale-95 hover:border-cyan-400 whitespace-nowrap"
              >
                <span>{hapticsEnabled ? '📳 TİTREŞİM: AÇIK' : '📴 TİTREŞİM: KAPALI'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticService.buttonPress();
                  soundEngine.playClick();
                  setBotAssist((b) => !b);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 font-display text-xs font-bold text-slate-200 transition-transform active:scale-95 hover:border-cyan-400 whitespace-nowrap"
              >
                <span>🤖 BOŞ KÖŞELER: {botAssist ? 'BOT AKTİF' : 'MANUEL'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticService.buttonPress();
                  soundEngine.playClick();
                  setAchievementsModalOpen(true);
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-950/40 px-3.5 py-2 font-display text-xs font-bold text-amber-300 transition-transform active:scale-95 hover:border-amber-300 whitespace-nowrap"
              >
                <span>
                  🏆 BAŞARIMLAR ({achievementState.unlockedIds.length}/{ACHIEVEMENTS_LIST.length})
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveModal('privacy');
                }}
                className="min-h-[44px] rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white whitespace-nowrap"
              >
                Gizlilik Politikası
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveModal('terms');
                }}
                className="min-h-[44px] rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white whitespace-nowrap"
              >
                Kullanım Koşulları
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveModal('aab-guide');
                }}
                className="min-h-[44px] rounded-xl border border-cyan-500/40 bg-cyan-950/50 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/60 whitespace-nowrap"
              >
                Play Store (.AAB)
              </button>
            </div>
          </div>

          {/* Orta Sahne: Özel SVG Geometrik Amblem ve 2 / 3 / 4 Kişilik Seçim Butonları */}
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center my-auto py-2">
            {/* Özel Tasarım Geometrik Küp SVG Amblemi */}
            <svg
              viewBox="0 0 120 120"
              aria-hidden="true"
              className="mb-3 h-20 w-20 sm:h-24 sm:w-24"
            >
              <rect
                x="14"
                y="14"
                width="40"
                height="40"
                rx="8"
                fill="#043B35"
                stroke="#00F5D4"
                strokeWidth="4"
              />
              <rect
                x="66"
                y="14"
                width="40"
                height="40"
                rx="8"
                fill="#4A0826"
                stroke="#FF2A85"
                strokeWidth="4"
              />
              <rect
                x="14"
                y="66"
                width="40"
                height="40"
                rx="8"
                fill="#473E05"
                stroke="#FEE440"
                strokeWidth="4"
              />
              <rect
                x="66"
                y="66"
                width="40"
                height="40"
                rx="8"
                fill="#291247"
                stroke="#9B5DE5"
                strokeWidth="4"
              />
              <rect x="46" y="46" width="28" height="28" rx="6" fill="#F8FAFC" />
            </svg>

            <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              CUBEARENA <span className="text-cyan-400">.IO</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
              Tek ekranda aynı anda 2, 3 veya 4 kişilik çoklu dokunmatik geometrik arcade arenası.
              Oyuncu sayısını seç ve 8 farklı .io oyunundan birine başla!
            </p>

            {/* Büyük 2 KİŞİLİK, 3 KİŞİLİK, 4 KİŞİLİK Seçim Butonları */}
            <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-3.5 sm:grid-cols-3">
              {/* 2 KİŞİLİK */}
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  soundEngine.playClick();
                  setPlayerCount(2);
                  setScreen('select');
                }}
                className="group relative flex min-h-[104px] flex-col items-center justify-center rounded-2xl border-2 border-[#00F5D4] bg-[#043B35]/80 p-4 text-center shadow-lg transition-transform active:scale-95 hover:bg-[#043B35]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#00F5D4]" />
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#FF2A85]" />
                </div>
                <span className="font-display text-2xl font-extrabold tracking-tight text-white">
                  2 KİŞİLİK
                </span>
                <span className="mt-0.5 text-xs font-medium text-cyan-200">
                  Karşılıklı Düello (Alt &amp; Üst)
                </span>
              </button>

              {/* 3 KİŞİLİK */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setPlayerCount(3);
                  setScreen('select');
                }}
                className="group relative flex min-h-[104px] flex-col items-center justify-center rounded-2xl border-2 border-[#FEE440] bg-[#473E05]/80 p-4 text-center shadow-lg transition-transform active:scale-95 hover:bg-[#473E05]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#00F5D4]" />
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#FF2A85]" />
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#FEE440]" />
                </div>
                <span className="font-display text-2xl font-extrabold tracking-tight text-white">
                  3 KİŞİLİK
                </span>
                <span className="mt-0.5 text-xs font-medium text-amber-200">
                  Üçlü Köşe Arenası
                </span>
              </button>

              {/* 4 KİŞİLİK */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setPlayerCount(4);
                  setScreen('select');
                }}
                className="group relative flex min-h-[104px] flex-col items-center justify-center rounded-2xl border-2 border-[#9B5DE5] bg-[#291247]/80 p-4 text-center shadow-lg transition-transform active:scale-95 hover:bg-[#291247]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#00F5D4]" />
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#FF2A85]" />
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#FEE440]" />
                  <span className="h-3.5 w-3.5 rounded-sm bg-[#9B5DE5]" />
                </div>
                <span className="font-display text-2xl font-extrabold tracking-tight text-white">
                  4 KİŞİLİK
                </span>
                <span className="mt-0.5 text-xs font-medium text-purple-200">
                  4 Köşe Tam Ekran Kaos
                </span>
              </button>
            </div>

            {/* Genel Skor Tablosu Özeti */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/80 px-5 py-3">
              <span className="font-display text-xs font-bold tracking-wider text-slate-400">
                GENEL SKOR TABLOSU:
              </span>
              {PLAYERS_CONFIG.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span
                    style={{ backgroundColor: p.color }}
                    className="inline-block h-3 w-3 rounded-xs"
                  />
                  <span className="font-display text-xs font-bold text-slate-200">
                    {p.shortName}:
                  </span>
                  <span className="font-mono-tabular text-sm font-extrabold text-white">
                    {overallScores[idx]}
                  </span>
                </div>
              ))}
              {overallScores.some((s) => s > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    hapticService.buttonPress();
                    soundEngine.playClick();
                    setOverallScores(clearOverallScores());
                  }}
                  className="ml-2 text-xs font-semibold text-rose-400 underline hover:text-rose-300"
                >
                  Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Alt Düz Kontrol İpucu Satırı */}
          <div className="text-center text-xs text-slate-400">
            Çoklu Dokunmatik (4 Parmak Bağımsız) · Klavye: P1 WASD+Boşluk · P2 Yön+Enter · P3
            IJKL+O · P4 TFGH+Y
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. EKRAN: 8 ADET .IO MİNİ OYUN SEÇİM EKRANI                           */}
      {/* ===================================================================== */}
      {screen === 'select' && (
        <div className="relative z-10 flex h-full w-full flex-col px-4 py-4 sm:px-8 sm:py-6">
          {/* Üst Gezinme & Oyuncu Sayısı Değiştirici */}
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setScreen('menu');
                }}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-display text-xs font-bold text-slate-200 transition-transform active:scale-95 hover:border-slate-500 whitespace-nowrap"
              >
                ← Ana Menü
              </button>
              <div>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  OYUN SEÇİMİ ({playerCount} KİŞİLİK)
                </h2>
              </div>
            </div>

            {/* Hızlı Oyuncu Sayısı Seçici Sekmeler */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
              {([2, 3, 4] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setPlayerCount(cnt);
                  }}
                  className={`min-h-[38px] rounded-lg px-3.5 py-1.5 font-display text-xs font-extrabold transition-colors whitespace-nowrap ${
                    playerCount === cnt
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cnt} KİŞİLİK
                </button>
              ))}
            </div>
          </div>

          {/* 8 Oyun Kartı Izgarası */}
          <div className="custom-scroll mx-auto mt-4 flex-1 w-full max-w-6xl overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 pb-6">
              {GAMES_LIST.map((g) => (
                <div
                  key={g.id}
                  style={{ borderColor: `${g.accentColor}55` }}
                  className="flex flex-col justify-between rounded-2xl border bg-slate-900/90 p-4 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span
                          style={{ color: g.accentColor }}
                          className="font-mono-tabular text-xs font-bold"
                        >
                          {g.number}. MİNİ OYUN
                        </span>
                        <h3 className="font-display text-xl font-extrabold text-white">
                          {g.title}
                        </h3>
                        <p className="text-xs font-medium text-slate-400">{g.subtitle}</p>
                      </div>
                      {renderGameCardIcon(g.id, g.accentColor)}
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-300">
                      {g.description}
                    </p>

                    <ul className="mt-3 space-y-1 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                      {g.rulesSummary.map((rule, rIdx) => (
                        <li key={rIdx} className="leading-snug">
                          • {rule}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    data-start="true"
                    onClick={() => startMatch(g.id, playerCount)}
                    style={{ backgroundColor: g.accentColor }}
                    className="mt-4 flex min-h-[46px] w-full items-center justify-center rounded-xl font-display text-sm font-extrabold text-slate-950 shadow-md transition-transform active:scale-95"
                  >
                    {g.title.toUpperCase()} OYNA ▶
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. EKRAN: OYUN İÇİ ARENA & ÇOKLU DOKUNMATİK KONTROLLER                */}
      {/* ===================================================================== */}
      {screen === 'playing' && (
        <div className="relative h-full w-full overflow-hidden">
          {/* Tam Ekran HTML5 Canvas 2D Arena */}
          <canvas
            ref={canvasRef}
            data-testid="game-canvas"
            className="touch-arena block h-full w-full"
          />

          {/* Üst Orta Kompakt HUD & Kontrol Çubuğu */}
          <div className="pointer-events-none fixed top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-950/90 px-3.5 py-1.5 shadow-lg">
              <span
                style={{ color: activeGameMeta.accentColor }}
                className="font-display text-xs font-extrabold tracking-wide whitespace-nowrap"
              >
                {activeGameMeta.title}
              </span>

              {hudState.timeRemaining !== null && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="font-mono-tabular text-xs font-extrabold text-amber-300 whitespace-nowrap">
                    ⏱ {hudState.timeRemaining}sn
                  </span>
                </>
              )}

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  soundEngine.playClick();
                  setBotAssist((b) => !b);
                }}
                aria-label="Bot Desteğini Değiştir"
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 font-display text-[11px] font-bold text-cyan-300 active:scale-95 whitespace-nowrap"
              >
                {botAssist ? '🤖 Bot: Açık' : '👤 Bot: Kapalı'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleSound();
                }}
                aria-label={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xs active:scale-95"
              >
                {soundEnabled ? '🔊' : '🔇'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleHaptics();
                }}
                aria-label={hapticsEnabled ? 'Titreşimi Kapat' : 'Titreşimi Aç'}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xs active:scale-95"
              >
                {hapticsEnabled ? '📳' : '📴'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  hapticService.buttonPress();
                  soundEngine.playClick();
                  setIsPaused(true);
                }}
                aria-label="Oyunu Duraklat"
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 font-display text-[11px] font-bold text-white active:scale-95 whitespace-nowrap"
              >
                ⏸ Menü
              </button>
            </div>
          </div>

          {/* 2, 3 veya 4 Kişilik Çoklu Dokunmatik Sanal Joystick / Birlik / Direksiyon Kontrolleri */}
          <PlayerTouchControls
            playerCount={playerCount}
            game={activeGameMeta}
            hudPlayers={hudState.players}
          />

          {/* DURAKLATMA (PAUSE) MODALI */}
          {isPaused && !hudState.isGameOver && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Oyun Duraklatıldı"
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
            >
              <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0F172A] p-6 text-center shadow-2xl">
                <h2 className="font-display text-2xl font-extrabold text-white">
                  OYUN DURAKLATILDI
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {activeGameMeta.title} · {playerCount} Kişilik Mod
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setIsPaused(false);
                    }}
                    className="min-h-[48px] w-full rounded-xl bg-cyan-400 font-display text-sm font-extrabold text-slate-950 active:scale-95"
                  >
                    ▶ DEVAM ET
                  </button>
                  <button
                    type="button"
                    onClick={() => startMatch(selectedGameId, playerCount)}
                    className="min-h-[46px] w-full rounded-xl border border-slate-700 bg-slate-800 font-display text-sm font-bold text-white active:scale-95"
                  >
                    ↻ YENİDEN BAŞLAT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setIsPaused(false);
                      setScreen('select');
                    }}
                    className="min-h-[46px] w-full rounded-xl border border-slate-700 bg-slate-800 font-display text-sm font-bold text-slate-200 active:scale-95"
                  >
                    🎮 OYUN DEĞİŞTİR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setIsPaused(false);
                      setScreen('menu');
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-900 font-display text-xs font-bold text-slate-400 active:scale-95"
                  >
                    🏠 ANA MENÜ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TUR SONU / KAZANAN SONUÇ EKRANI (GAMEOVER MODAL) */}
          {hudState.isGameOver && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Tur Sonucu"
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4"
            >
              <div className="w-full max-w-lg rounded-2xl border-2 border-slate-700 bg-[#0F172A] p-6 text-center shadow-2xl">
                {hudState.winnerId !== null && (
                  <>
                    <div
                      style={{
                        backgroundColor: PLAYERS_CONFIG[hudState.winnerId].darkColor,
                        borderColor: PLAYERS_CONFIG[hudState.winnerId].color
                      }}
                      className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border-4 shadow-lg"
                    >
                      <span
                        style={{ backgroundColor: PLAYERS_CONFIG[hudState.winnerId].color }}
                        className="h-7 w-7 rounded-sm"
                      />
                    </div>

                    <span className="font-mono-tabular text-xs font-bold tracking-widest text-amber-300">
                      ★ TUR TAMAMLANDI ★
                    </span>
                    <h2
                      style={{ color: PLAYERS_CONFIG[hudState.winnerId].color }}
                      className="mt-1 font-display text-3xl font-extrabold tracking-tight"
                    >
                      {PLAYERS_CONFIG[hudState.winnerId].name.toUpperCase()} KAZANDI!
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-300">
                      {hudState.winReason}
                    </p>
                  </>
                )}

                {/* Genel Skor Tablosu (Kümülatif Galibiyetler - localStorage Kalıcı Kayıt) */}
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <h3 className="font-display text-xs font-bold tracking-wider text-slate-400">
                      GENEL SKOR TABLOSU (KALICI GALİBİYET)
                    </h3>
                    {overallScores.some((s) => s > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          hapticService.buttonPress();
                          soundEngine.playClick();
                          setOverallScores(clearOverallScores());
                        }}
                        className="text-[11px] font-semibold text-rose-400 underline hover:text-rose-300"
                      >
                        Skorları Sıfırla
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Array.from({ length: playerCount }, (_, idx) => {
                      const p = PLAYERS_CONFIG[idx];
                      const isWinner = hudState.winnerId === idx;
                      return (
                        <div
                          key={p.id}
                          style={{
                            borderColor: isWinner ? p.color : '#1E293B',
                            backgroundColor: isWinner ? p.darkColor : '#0B0F19'
                          }}
                          className="flex flex-col items-center rounded-xl border-2 p-2.5"
                        >
                          <span
                            style={{ color: p.color }}
                            className="font-display text-xs font-extrabold"
                          >
                            {p.shortName}
                          </span>
                          <span className="mt-1 font-mono-tabular text-2xl font-extrabold text-white">
                            {overallScores[idx]}
                          </span>
                          <span className="mt-0.5 font-mono-tabular text-[10px] text-slate-400">
                            {hudState.players[idx]?.metricText ?? ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Oyuncu Performans Analizi (GameStats Bileşeni - hudState.players verisiyle) */}
                <GameStats
                  players={hudState.players}
                  winnerId={hudState.winnerId}
                  gameId={selectedGameId}
                  overallScores={overallScores}
                />

                {/* Tekrar Oyna / Oyun Değiştir Butonları */}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => startMatch(selectedGameId, playerCount)}
                    className="min-h-[48px] w-full rounded-xl bg-cyan-400 font-display text-sm font-extrabold text-slate-950 shadow-lg transition-transform active:scale-95"
                  >
                    ↻ TEKRAR OYNA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setScreen('select');
                    }}
                    className="min-h-[48px] w-full rounded-xl border border-slate-600 bg-slate-800 font-display text-sm font-extrabold text-white transition-transform active:scale-95 hover:bg-slate-700"
                  >
                    🎮 OYUN DEĞİŞTİR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
