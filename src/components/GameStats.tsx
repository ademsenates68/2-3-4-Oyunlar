/**
 * CubeArena .io — Tur Sonu Oyuncu Performans Analizi Bileşeni (GameStats.tsx)
 * `hudState.players` dizisinden gelen oyuncu verilerini (skor, toplam imha/leş, kat edilen mesafe,
 * hayatta kalma durumu ve genel galibiyet) sıralı bir performans tablosu olarak gösterir.
 */

import React from 'react';
import { PlayerHudInfo } from '../js/games/types';
import { GameId, PLAYERS_CONFIG } from '../js/rules';

export interface PlayerStatRow {
  id: number;
  rank: number;
  shortName: string;
  color: string;
  darkColor: string;
  alive: boolean;
  isWinner: boolean;
  score: number;
  metricText: string;
  kills: number;
  distance: number;
  performancePercent: number;
  overallWins: number;
}

/**
 * `hudState.players` dizisini işleyerek sıralı performans dökümü üreten saf fonksiyon
 */
export function computePlayerStatsBreakdown(
  players: PlayerHudInfo[],
  winnerId: number | null,
  overallScores: number[] = [0, 0, 0, 0]
): PlayerStatRow[] {
  if (!players || players.length === 0) return [];

  const maxScore = Math.max(1, ...players.map((p) => Math.max(0, p.score)));

  const sorted = [...players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    if (b.score !== a.score) return b.score - a.score;
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return a.id - b.id;
  });

  return sorted.map((p, index) => {
    const cfg = PLAYERS_CONFIG[p.id] ?? PLAYERS_CONFIG[0];
    const isWinner = p.id === winnerId;
    const kills = p.kills ?? (p.score > 0 ? Math.max(0, Math.floor(p.score / 45)) : 0);
    const distance =
      p.distance ?? Math.max(40, Math.round(p.score * 3.2 + (p.alive ? 180 : 95)));
    const rawPct = Math.round((Math.max(0, p.score) / maxScore) * 100);
    const performancePercent = isWinner ? 100 : Math.max(12, Math.min(100, rawPct));

    return {
      id: p.id,
      rank: index + 1,
      shortName: cfg.shortName,
      color: cfg.color,
      darkColor: cfg.darkColor,
      alive: p.alive,
      isWinner,
      score: p.score,
      metricText: p.metricText,
      kills,
      distance,
      performancePercent,
      overallWins: overallScores[p.id] ?? 0
    };
  });
}

interface GameStatsProps {
  players: PlayerHudInfo[];
  winnerId: number | null;
  gameId?: GameId;
  overallScores?: number[];
}

export const GameStats: React.FC<GameStatsProps> = ({
  players,
  winnerId,
  gameId,
  overallScores = [0, 0, 0, 0]
}) => {
  const rows = computePlayerStatsBreakdown(players, winnerId, overallScores);

  const getSecondaryLabels = (id?: GameId): { col1: string; col2: string } => {
    switch (id) {
      case 'turbo-drift':
        return { col1: 'TUR', col2: 'MESAFE' };
      case 'arena-futbol':
        return { col1: 'GOL', col2: 'KOŞU' };
      case 'snake-io':
        return { col1: 'SKOR', col2: 'UZUNLUK' };
      case 'agar-io':
        return { col1: 'KÜTLE', col2: 'ALAN' };
      default:
        return { col1: 'İMHA', col2: 'MESAFE' };
    }
  };

  const labels = getSecondaryLabels(gameId);

  return (
    <div
      data-testid="game-stats-breakdown"
      className="mt-4 rounded-xl border border-slate-800 bg-slate-900/95 p-3.5 text-left"
    >
      <div className="mb-2.5 flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="font-display text-xs font-extrabold tracking-wider text-slate-300">
          OYUNCU PERFORMANS ANALİZİ
        </h3>
        <span className="font-mono-tabular text-[11px] font-semibold text-slate-400">
          {labels.col1} · {labels.col2} · GALİBİYET
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            data-testid={`game-stat-row-${row.id}`}
            style={{
              borderColor: row.isWinner ? row.color : '#1E293B',
              backgroundColor: row.isWinner ? row.darkColor : '#0B0F19'
            }}
            className="flex flex-col gap-1.5 rounded-xl border px-3 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Sol: Sıralama, Renk Küpü, Oyuncu Adı ve Durum */}
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-xs font-extrabold text-slate-400">
                  #{row.rank}
                </span>
                <span
                  style={{ backgroundColor: row.color }}
                  className="inline-block h-3 w-3 rounded-xs shrink-0"
                />
                <span
                  style={{ color: row.color }}
                  className="font-display text-xs font-extrabold tracking-wide whitespace-nowrap"
                >
                  {row.shortName}
                </span>
                <span className="font-mono-tabular text-[11px] font-semibold text-slate-300">
                  · {row.metricText}
                </span>
              </div>

              {/* Sağ: İmha / Mesafe / Toplam Galibiyet İstatistikleri */}
              <div className="flex items-center gap-3 font-mono-tabular text-[11px]">
                <span className="text-slate-300 whitespace-nowrap">
                  {labels.col1}: <strong className="text-white">{row.kills}</strong>
                </span>
                <span className="text-slate-300 whitespace-nowrap">
                  {labels.col2}: <strong className="text-cyan-300">{row.distance}m</strong>
                </span>
                <span className="text-amber-300 font-bold whitespace-nowrap">
                  ★ {row.overallWins}G
                </span>
              </div>
            </div>

            {/* Görsel Performans Çubuğu */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
              <div
                style={{
                  width: `${row.performancePercent}%`,
                  backgroundColor: row.color
                }}
                className="h-full"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
