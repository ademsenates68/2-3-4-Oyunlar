/**
 * CubeArena .io — Kalıcı Başarım (Achievements) ve Kilometre Taşı (Milestone) Sistemi
 * localStorage üzerinde oynanan oyun sayısı, toplam imha, mesafe ve galibiyet istatistiklerini
 * takip eder ve kilidi yeni açılan başarımları bildirim (toast) için döndürür.
 */

export const ACHIEVEMENTS_STORAGE_KEY = 'cubearena_achievements_v1';

export type AchievementMetric = 'gamesPlayed' | 'totalKills' | 'totalDistance' | 'totalWins';

export interface AchievementDefinition {
  id: string;
  title: string;
  englishBadge: string;
  description: string;
  metric: AchievementMetric;
  target: number;
  accentColor: string;
  icon: string;
}

export interface AchievementStats {
  gamesPlayed: number;
  totalKills: number;
  totalDistance: number;
  totalWins: number;
}

export interface AchievementState {
  stats: AchievementStats;
  unlockedIds: string[];
  unlockedAt: Record<string, string>;
}

export interface AchievementDelta {
  gamesPlayed?: number;
  kills?: number;
  distance?: number;
  wins?: number;
}

export const DEFAULT_ACHIEVEMENT_STATS: AchievementStats = {
  gamesPlayed: 0,
  totalKills: 0,
  totalDistance: 0,
  totalWins: 0
};

export const ACHIEVEMENTS_LIST: AchievementDefinition[] = [
  {
    id: 'first-match',
    title: 'İlk Arena Teması',
    englishBadge: '1 Game Played',
    description: 'Herhangi bir .io mini oyununda ilk maçını tamamla.',
    metric: 'gamesPlayed',
    target: 1,
    accentColor: '#00F5D4',
    icon: '🎮'
  },
  {
    id: '10-games-played',
    title: '10 Oyun Oynandı',
    englishBadge: '10 Games Played',
    description: 'Arenalarda toplam 10 mini oyun maçı oyna.',
    metric: 'gamesPlayed',
    target: 10,
    accentColor: '#38BDF8',
    icon: '🕹️'
  },
  {
    id: '10-kills',
    title: 'Keskin Küp Avcısı',
    englishBadge: '10 Kills',
    description: 'Savaş arenalarında toplam 10 rakip imha et.',
    metric: 'totalKills',
    target: 10,
    accentColor: '#FEE440',
    icon: '⚔️'
  },
  {
    id: '100-kills',
    title: '100 İmha Ustası',
    englishBadge: '100 Kills',
    description: 'Tüm oyunlarda toplam 100 rakip imha sayısına ulaş.',
    metric: 'totalKills',
    target: 100,
    accentColor: '#FF2A85',
    icon: '💥'
  },
  {
    id: '5000-distance',
    title: 'Arena Maratoncusu',
    englishBadge: '5,000m Distance',
    description: 'Arenalarda toplam 5.000 metre mesafe kat et.',
    metric: 'totalDistance',
    target: 5000,
    accentColor: '#00F59B',
    icon: '⚡'
  },
  {
    id: '10-wins',
    title: 'Arena Şampiyonu',
    englishBadge: '10 Wins',
    description: 'Toplam 10 tur galibiyeti elde et.',
    metric: 'totalWins',
    target: 10,
    accentColor: '#9B5DE5',
    icon: '🏆'
  }
];

function sanitizeNonNegativeInt(val: unknown): number {
  const num = Number(val);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
}

export function createDefaultAchievementState(): AchievementState {
  return {
    stats: { ...DEFAULT_ACHIEVEMENT_STATS },
    unlockedIds: [],
    unlockedAt: {}
  };
}

export function normalizeAchievementState(input: unknown): AchievementState {
  if (!input || typeof input !== 'object') {
    return createDefaultAchievementState();
  }
  const obj = input as Record<string, unknown>;
  const rawStats =
    obj.stats && typeof obj.stats === 'object' ? (obj.stats as Record<string, unknown>) : {};

  const stats: AchievementStats = {
    gamesPlayed: sanitizeNonNegativeInt(rawStats.gamesPlayed),
    totalKills: sanitizeNonNegativeInt(rawStats.totalKills),
    totalDistance: sanitizeNonNegativeInt(rawStats.totalDistance),
    totalWins: sanitizeNonNegativeInt(rawStats.totalWins)
  };

  const validIds = new Set(ACHIEVEMENTS_LIST.map((a) => a.id));
  const unlockedIds: string[] = Array.isArray(obj.unlockedIds)
    ? Array.from(
        new Set(
          obj.unlockedIds.filter(
            (id): id is string => typeof id === 'string' && validIds.has(id)
          )
        )
      )
    : [];

  const unlockedAt: Record<string, string> = {};
  if (obj.unlockedAt && typeof obj.unlockedAt === 'object') {
    for (const [k, v] of Object.entries(obj.unlockedAt as Record<string, unknown>)) {
      if (validIds.has(k) && typeof v === 'string') {
        unlockedAt[k] = v;
      }
    }
  }

  return { stats, unlockedIds, unlockedAt };
}

export function loadAchievementState(
  storage: Pick<Storage, 'getItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): AchievementState {
  try {
    if (!storage) return createDefaultAchievementState();
    const raw = storage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return createDefaultAchievementState();
    return normalizeAchievementState(JSON.parse(raw));
  } catch {
    return createDefaultAchievementState();
  }
}

export function saveAchievementState(
  state: AchievementState,
  storage: Pick<Storage, 'setItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): boolean {
  try {
    if (!storage) return false;
    const normalized = normalizeAchievementState(state);
    storage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saf (Pure) Başarım Değerlendirme Fonksiyonu:
 * Mevcut durumu ve yeni istatistik farkını (delta) alır, güncellenmiş durumu ve
 * bu adımda kilidi YENİ açılan başarımların listesini döndürür.
 */
export function evaluateAchievements(
  prevState: AchievementState,
  delta: AchievementDelta,
  timestampIso: string = new Date().toISOString()
): { nextState: AchievementState; newlyUnlocked: AchievementDefinition[] } {
  const safePrev = normalizeAchievementState(prevState);

  const nextStats: AchievementStats = {
    gamesPlayed: safePrev.stats.gamesPlayed + sanitizeNonNegativeInt(delta.gamesPlayed),
    totalKills: safePrev.stats.totalKills + sanitizeNonNegativeInt(delta.kills),
    totalDistance: safePrev.stats.totalDistance + sanitizeNonNegativeInt(delta.distance),
    totalWins: safePrev.stats.totalWins + sanitizeNonNegativeInt(delta.wins)
  };

  const unlockedSet = new Set(safePrev.unlockedIds);
  const nextUnlockedAt: Record<string, string> = { ...safePrev.unlockedAt };
  const newlyUnlocked: AchievementDefinition[] = [];

  for (const achievement of ACHIEVEMENTS_LIST) {
    const currentValue = nextStats[achievement.metric];
    if (currentValue >= achievement.target && !unlockedSet.has(achievement.id)) {
      unlockedSet.add(achievement.id);
      nextUnlockedAt[achievement.id] = timestampIso;
      newlyUnlocked.push(achievement);
    }
  }

  const nextState: AchievementState = {
    stats: nextStats,
    unlockedIds: Array.from(unlockedSet),
    unlockedAt: nextUnlockedAt
  };

  return { nextState, newlyUnlocked };
}

export function recordAchievementProgress(
  delta: AchievementDelta,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): { state: AchievementState; newlyUnlocked: AchievementDefinition[] } {
  const current = loadAchievementState(storage);
  const { nextState, newlyUnlocked } = evaluateAchievements(current, delta);
  saveAchievementState(nextState, storage);
  return { state: nextState, newlyUnlocked };
}

export function clearAchievementState(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): AchievementState {
  const fresh = createDefaultAchievementState();
  try {
    if (storage) {
      storage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(fresh));
    }
  } catch {
    // localStorage engelliyse sessizce varsayılan durumu döndür
  }
  return fresh;
}
