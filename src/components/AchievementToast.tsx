/**
 * CubeArena .io — Başarım Bildirimi (Achievement Notification Toast) ve Başarımlar Modalı
 * Oyuncu yeni bir kilometre taşına (örn. '10 Games Played', '100 Kills') ulaştığında
 * ekranda kompakt neon-geometrik bir bildirim (toast) gösterir.
 */

import React from 'react';
import {
  AchievementDefinition,
  ACHIEVEMENTS_LIST,
  AchievementState
} from '../js/achievements';

interface AchievementToastProps {
  queue: AchievementDefinition[];
  onDismiss: (id: string) => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ queue, onDismiss }) => {
  if (queue.length === 0) return null;

  const current = queue[0];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="achievement-toast"
      className="pointer-events-none fixed top-14 right-4 z-50 flex max-w-sm flex-col gap-2 sm:top-5 sm:right-5"
    >
      <div
        style={{
          borderColor: current.accentColor,
          boxShadow: `0 0 24px ${current.accentColor}33`
        }}
        className="pointer-events-auto flex items-start gap-3 rounded-xl border-2 bg-[#0F172A]/95 px-4 py-3 text-left backdrop-blur-md transition-all"
      >
        <div
          style={{
            backgroundColor: `${current.accentColor}22`,
            borderColor: current.accentColor
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg"
        >
          <span>{current.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              style={{ color: current.accentColor }}
              className="font-mono-tabular text-[10px] font-extrabold tracking-widest uppercase"
            >
              ★ BAŞARIM AÇILDI · {current.englishBadge}
            </span>
          </div>
          <h4 className="truncate font-display text-sm font-extrabold text-white">
            {current.title}
          </h4>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
            {current.description}
          </p>
          {queue.length > 1 && (
            <span className="mt-1 inline-block font-mono-tabular text-[10px] font-bold text-cyan-300">
              +{queue.length - 1} başarım daha sırada
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(current.id)}
          aria-label="Bildirimi Kapat"
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800/90 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

interface AchievementsModalProps {
  isOpen: boolean;
  state: AchievementState;
  onClose: () => void;
  onReset: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  state,
  onClose,
  onReset
}) => {
  if (!isOpen) return null;

  const unlockedSet = new Set(state.unlockedIds);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Başarımlar ve Kilometre Taşları"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border-2 border-slate-700 bg-[#0F172A] p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div>
            <span className="font-mono-tabular text-xs font-bold tracking-widest text-cyan-400">
              KİLOMETRE TAŞLARI (LOCALSTORAGE)
            </span>
            <h2 className="font-display text-2xl font-extrabold text-white">
              BAŞARIMLAR ({state.unlockedIds.length}/{ACHIEVEMENTS_LIST.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 font-display text-xs font-bold text-slate-200 hover:border-slate-500 hover:text-white"
          >
            ✕ Kapat
          </button>
        </div>

        {/* Genel İstatistik Özeti */}
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
            <span className="block font-display text-[10px] font-bold text-slate-400">
              OYNANAN OYUN
            </span>
            <span className="font-mono-tabular text-lg font-extrabold text-cyan-300">
              {state.stats.gamesPlayed}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
            <span className="block font-display text-[10px] font-bold text-slate-400">
              TOPLAM İMHA
            </span>
            <span className="font-mono-tabular text-lg font-extrabold text-rose-400">
              {state.stats.totalKills}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
            <span className="block font-display text-[10px] font-bold text-slate-400">
              TOPLAM MESAFE
            </span>
            <span className="font-mono-tabular text-lg font-extrabold text-emerald-400">
              {state.stats.totalDistance}m
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
            <span className="block font-display text-[10px] font-bold text-slate-400">
              TOPLAM GALİBİYET
            </span>
            <span className="font-mono-tabular text-lg font-extrabold text-amber-300">
              {state.stats.totalWins}
            </span>
          </div>
        </div>

        {/* Başarım Kartları Listesi */}
        <div className="custom-scroll mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {ACHIEVEMENTS_LIST.map((ach) => {
            const isUnlocked = unlockedSet.has(ach.id);
            const currentVal = state.stats[ach.metric];
            const ratio = Math.min(100, Math.round((currentVal / ach.target) * 100));

            return (
              <div
                key={ach.id}
                style={{
                  borderColor: isUnlocked ? ach.accentColor : '#1E293B',
                  backgroundColor: isUnlocked ? '#0B1325' : '#0B0F19'
                }}
                className="flex flex-col gap-2 rounded-xl border p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        borderColor: isUnlocked ? ach.accentColor : '#334155',
                        backgroundColor: isUnlocked ? `${ach.accentColor}22` : '#1E293B'
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg"
                    >
                      <span>{ach.icon}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-extrabold text-white">
                          {ach.title}
                        </h3>
                        <span
                          style={{
                            color: isUnlocked ? ach.accentColor : '#94A3B8',
                            borderColor: isUnlocked ? `${ach.accentColor}66` : '#334155'
                          }}
                          className="rounded border px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold"
                        >
                          {ach.englishBadge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{ach.description}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      style={{ color: isUnlocked ? ach.accentColor : '#64748B' }}
                      className="font-mono-tabular text-xs font-extrabold"
                    >
                      {isUnlocked ? '✓ AÇILDI' : `${Math.min(currentVal, ach.target)} / ${ach.target}`}
                    </span>
                  </div>
                </div>

                {/* İlerleme Çubuğu */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    style={{
                      width: `${ratio}%`,
                      backgroundColor: isUnlocked ? ach.accentColor : '#475569'
                    }}
                    className="h-full transition-all duration-300"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Alt Sıfırlama & Kapatma Satırı */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-rose-400 underline hover:text-rose-300"
          >
            Başarımları Sıfırla
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl bg-cyan-400 px-5 py-2 font-display text-xs font-extrabold text-slate-950 active:scale-95"
          >
            TAMAM
          </button>
        </div>
      </div>
    </div>
  );
};
