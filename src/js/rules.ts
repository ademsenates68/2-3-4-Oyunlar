/**
 * CubeArena .io — Temel Oyun Kuralları, Fizik Matematiği ve Yapılandırma Modülü
 * Bu modül tüm 8 mini oyunun saf hesaplama mantığını ve oyuncu sabitlerini içerir.
 */

export interface PlayerConfig {
  id: number;
  name: string;
  shortName: string;
  color: string;
  glowColor: string;
  darkColor: string;
  keyHint: string;
}

export const PLAYERS_CONFIG: PlayerConfig[] = [
  {
    id: 0,
    name: 'Mavi Küp',
    shortName: 'P1 MAVİ',
    color: '#00F5D4',
    glowColor: 'rgba(0, 245, 212, 0.35)',
    darkColor: '#043B35',
    keyHint: 'WASD + Boşluk (veya 1-4)'
  },
  {
    id: 1,
    name: 'Pembe Küp',
    shortName: 'P2 PEMBE',
    color: '#FF2A85',
    glowColor: 'rgba(255, 42, 133, 0.35)',
    darkColor: '#4A0826',
    keyHint: 'Yön Tuşları + Enter'
  },
  {
    id: 2,
    name: 'Sarı Küp',
    shortName: 'P3 SARI',
    color: '#FEE440',
    glowColor: 'rgba(254, 228, 64, 0.35)',
    darkColor: '#473E05',
    keyHint: 'IJKL + O'
  },
  {
    id: 3,
    name: 'Mor Küp',
    shortName: 'P4 MOR',
    color: '#9B5DE5',
    glowColor: 'rgba(155, 93, 229, 0.35)',
    darkColor: '#291247',
    keyHint: 'TFGH + Y'
  }
];

export type GameId =
  | 'cube-royale'
  | 'tank-io'
  | 'evowars-io'
  | 'minigiants-io'
  | 'agar-io'
  | 'snake-io'
  | 'turbo-drift'
  | 'arena-futbol';

export interface GameMetadata {
  id: GameId;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  rulesSummary: string[];
  accentColor: string;
  controlMode: 'unit-buttons' | 'joystick-action' | 'steer-lr';
  actionLabel: string;
}

export const GAMES_LIST: GameMetadata[] = [
  {
    id: 'cube-royale',
    number: '01',
    title: 'Cube Royale',
    subtitle: 'Kule Savunma & Saldırı',
    description:
      'Enerji biriktir, 4 farklı geometrik birliği (Kılıçlı, Okçu, Atlı, Tank) sahaya sür ve rakip kuleleri yık.',
    rulesSummary: [
      'Kılıçlı (2 Enerji): Dengeli can, hız ve yakın dövüş hasarı.',
      'Okçu (3 Enerji): Uzaktan ateş eder, yakın dövüşte ve kalkanda zayıftır.',
      'Atlı (5 Enerji): Hızlı koşar, güçlü kalkan ve yüksek saldırı.',
      'Tank (6 Enerji): Yavaştır, birliklere az vurur ama kuleye yıkıcı hasar verir.'
    ],
    accentColor: '#00F5D4',
    controlMode: 'unit-buttons',
    actionLabel: 'BİRLİK'
  },
  {
    id: 'tank-io',
    number: '02',
    title: 'Tank.io',
    subtitle: 'Taktiksel Arena Savaşı',
    description:
      'Duvarlı arenada 2 mermi kapasiteli tankınla rakipleri tek vuruşta patlat. Güçlendirme kürelerini kaçırma.',
    rulesSummary: [
      'Her tankın 2 mermi hakkı vardır; bitince kısa sürede yeniden dolar.',
      'Tek mermi isabeti tankı anında patlatır (Kalkan yoksa).',
      'Küreler: Hız Küresi (Mavi), Küçülme Küresi (Sarı), Kalkan Küresi (Mor).'
    ],
    accentColor: '#FF2A85',
    controlMode: 'joystick-action',
    actionLabel: 'ATEŞ'
  },
  {
    id: 'evowars-io',
    number: '03',
    title: 'EvoWars.io',
    subtitle: 'Tek Vuruş Evrim Arenası',
    description:
      'Yerdeki XP küplerini toplayarak devleş ve kılıcını uzat. Tek darbede rakibini yok et ve XP’sinin %40’ını kap.',
    rulesSummary: [
      'XP topladıkça seviye atlar, gövden büyür ve kılıç menzilin uzar.',
      'Kılıç savurma butonuyla isabet eden rakip tek vuruşta elenir.',
      'Rakibi eleyen oyuncu, kurbanın toplam XP puanının %40’ını anında kazanır.'
    ],
    accentColor: '#FEE440',
    controlMode: 'joystick-action',
    actionLabel: 'KILIÇ'
  },
  {
    id: 'minigiants-io',
    number: '04',
    title: 'MiniGiants.io',
    subtitle: 'Can Barlı Yakın Dövüş',
    description:
      'XP toplayarak güçlen, rakiplerle göğüs göğüse çarpış. Tek vuruşta ölüm yok; can barını sıfırlayan kazanır.',
    rulesSummary: [
      'Her karakterin üzerinde can barı ve seviye göstergesi bulunur.',
      'Rakipler karşılaştığında seri darbelerle birbirinin canını azaltır.',
      'Elenen oyuncunun bölgesine yüksek değerli XP hazinesi saçılır.'
    ],
    accentColor: '#9B5DE5',
    controlMode: 'joystick-action',
    actionLabel: 'SALDIR'
  },
  {
    id: 'agar-io',
    number: '05',
    title: 'Agar.io',
    subtitle: 'Kütle Yutma Arenası',
    description:
      'Enerji noktalarını yutarak kütleni büyüt. Kendinden küçük rakiplerin merkezini kapsayarak tamamını yut.',
    rulesSummary: [
      'Noktaları topladıkça kütle büyür, hareket hızı kademeli olarak dengelenir.',
      'Kendinden küçük rakibin merkezini içine aldığında onu tamamen yutarsın.',
      'Yutulan rakibin tüm kütlesi ve skoru yutan oyuncuya geçer.'
    ],
    accentColor: '#00BBF9',
    controlMode: 'joystick-action',
    actionLabel: 'ATIL'
  },
  {
    id: 'snake-io',
    number: '06',
    title: 'Snake.io',
    subtitle: 'Neon Yılan Arenası',
    description:
      'Sürekli ilerleyen yılanını yönlendir, rakip yılanların önüne kır. Çarpan yılanın parlak gövde izini topla.',
    rulesSummary: [
      'Noktaları yedikçe yılan uzar; Hızlan butonuyla ani manevra yapabilirsin.',
      'Kafası başka bir yılanın gövdesine veya duvar sınırına çarpan yok olur.',
      'Yok olan yılanın tüm gövde izi boyunca yüksek puanlı parlak küreler oluşur.'
    ],
    accentColor: '#00F59B',
    controlMode: 'joystick-action',
    actionLabel: 'HIZLAN'
  },
  {
    id: 'turbo-drift',
    number: '07',
    title: 'Turbo Drift',
    subtitle: '3 Turluk Pist Yarışı',
    description:
      'Otomatik gazlı minimalist pistte sağ/sol yönlendirmeyle virajları dön, hız şeritlerini kullan ve 3 turu ilk bitir.',
    rulesSummary: [
      'Araçlar otomatik hızlanır; Sağ ve Sol butonlarla drift yaparak yönlendir.',
      'Pistteki mavi hızlanma şeritleri (Boost Pad) anlık turbo verir.',
      'Rakiplere çarparak onları dış kulvara itebilirsin. 3 turu ilk bitiren kazanır.'
    ],
    accentColor: '#FF6B35',
    controlMode: 'steer-lr',
    actionLabel: 'DRİFT'
  },
  {
    id: 'arena-futbol',
    number: '08',
    title: 'Arena Futbol',
    subtitle: 'Çok Kaleli Fizik Futbolu',
    description:
      'Kendi kaleni koru, depar ve sert şut hamlesiyle rakiplerin kalesine gol yağdır. 60 saniye veya 5 gol!',
    rulesSummary: [
      'Oyuncu sayısına göre haritada 2, 3 veya 4 aktif kale bulunur.',
      'Şut/Depar butonuyla hem hızlanır hem de topa sert vuruş yaparsın.',
      '60 saniye sonunda en çok gol atan veya 5 gole ilk ulaşan kazanır.'
    ],
    accentColor: '#38BDF8',
    controlMode: 'joystick-action',
    actionLabel: 'ŞUT / DEPAR'
  }
];

/**
 * 1. Cube Royale Birlik İstatistikleri
 */
export type CubeUnitType = 'swordsman' | 'archer' | 'cavalry' | 'tank';

export interface CubeUnitStats {
  type: CubeUnitType;
  label: string;
  shortLabel: string;
  cost: number;
  maxHp: number;
  shield: number; // Gelen hasarı azaltma yüzdesi (0..0.55)
  speed: number;
  range: number;
  unitDamage: number;
  towerDamage: number;
  attackCooldown: number;
  size: number;
}

export const CUBE_UNIT_STATS: Record<CubeUnitType, CubeUnitStats> = {
  swordsman: {
    type: 'swordsman',
    label: 'Kılıçlı',
    shortLabel: 'KILIÇ',
    cost: 2,
    maxHp: 110,
    shield: 0.15,
    speed: 68,
    range: 22,
    unitDamage: 24,
    towerDamage: 22,
    attackCooldown: 0.65,
    size: 11
  },
  archer: {
    type: 'archer',
    label: 'Okçu',
    shortLabel: 'OKÇU',
    cost: 3,
    maxHp: 60,
    shield: 0.0,
    speed: 58,
    range: 135,
    unitDamage: 22,
    towerDamage: 18,
    attackCooldown: 0.75,
    size: 10
  },
  cavalry: {
    type: 'cavalry',
    label: 'Atlı',
    shortLabel: 'ATLI',
    cost: 5,
    maxHp: 165,
    shield: 0.35,
    speed: 112,
    range: 26,
    unitDamage: 38,
    towerDamage: 35,
    attackCooldown: 0.6,
    size: 14
  },
  tank: {
    type: 'tank',
    label: 'Tank',
    shortLabel: 'TANK',
    cost: 6,
    maxHp: 320,
    shield: 0.4,
    speed: 38,
    range: 28,
    unitDamage: 10, // Diğer birliklere karşı zayıf
    towerDamage: 155, // Rakip kuleye ulaşırsa çok yüksek yıkıcı hasar
    attackCooldown: 1.05,
    size: 18
  }
};

export function getCubeRoyaleUnitStats(type: CubeUnitType): CubeUnitStats {
  return CUBE_UNIT_STATS[type];
}

/**
 * 3. EvoWars.io Seviye, Boyut, Kılıç Menzili ve %40 Öldürme Ödülü Hesaplaması
 */
export function calculateEvoLevel(xp: number): {
  level: number;
  bodyRadius: number;
  swordLength: number;
} {
  const safeXp = Math.max(0, xp);
  const level = Math.min(12, 1 + Math.floor(Math.sqrt(safeXp / 25)));
  const bodyRadius = 14 + (level - 1) * 2.4;
  const swordLength = 26 + (level - 1) * 7.5;
  return { level, bodyRadius, swordLength };
}

export function calculateEvoKillReward(victimTotalXp: number): number {
  return Math.round(Math.max(0, victimTotalXp) * 0.4);
}

/**
 * 5. Agar.io Kütle -> Yarıçap, Hız ve Yutma Kontrolü
 */
export function calculateAgarRadius(mass: number): number {
  return Math.max(12, Math.sqrt(Math.max(10, mass)) * 2.6);
}

export function calculateAgarSpeed(mass: number): number {
  // Büyüdükçe hareket hızı hafifçe azalır
  const baseSpeed = 145;
  const factor = Math.pow(Math.max(20, mass) / 20, -0.22);
  return Math.max(58, baseSpeed * factor);
}

export function canAgarSwallow(
  attackerMass: number,
  victimMass: number,
  centerDistance: number
): boolean {
  if (attackerMass <= victimMass * 1.1) return false;
  const attackerRadius = calculateAgarRadius(attackerMass);
  // Saldırganın dairesi rakibin merkezini kapsamalı
  return centerDistance <= attackerRadius * 0.92;
}

/**
 * Çoklu Dokunmatik (Multi-Touch) Sanal Joystick Vektör ve Açı Dönüşümü
 * Her oyuncunun ekran kenarındaki veya köşesindeki oturma açısına göre
 * parmak hareketini (dx, dy) dünya koordinatlarına veya doğrudan arena yönüne çevirir.
 */
export function computeJoystickVector(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  maxRadius: number
): { vx: number; vy: number; magnitude: number; angle: number } {
  const dx = currentX - startX;
  const dy = currentY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < 2 || maxRadius <= 0) {
    return { vx: 0, vy: 0, magnitude: 0, angle: 0 };
  }
  const clampedDist = Math.min(dist, maxRadius);
  const magnitude = clampedDist / maxRadius;
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    vx: nx * magnitude,
    vy: ny * magnitude,
    magnitude,
    angle: Math.atan2(ny, nx)
  };
}

/**
 * Daire - Dikdörtgen (Engel / Duvar) Çarpışma Testi ve İtme Vektörü
 */
export function resolveCircleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { collided: boolean; x: number; y: number; normalX: number; normalY: number } {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) {
    return { collided: false, x: cx, y: cy, normalX: 0, normalY: 0 };
  }

  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const penetration = radius - dist;
    return {
      collided: true,
      x: cx + nx * penetration,
      y: cy + ny * penetration,
      normalX: nx,
      normalY: ny
    };
  }

  // Merkez tam içerideyse en yakın kenara it
  const leftPen = cx - rx;
  const rightPen = rx + rw - cx;
  const topPen = cy - ry;
  const bottomPen = ry + rh - cy;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

  if (minPen === leftPen) return { collided: true, x: rx - radius, y: cy, normalX: -1, normalY: 0 };
  if (minPen === rightPen) return { collided: true, x: rx + rw + radius, y: cy, normalX: 1, normalY: 0 };
  if (minPen === topPen) return { collided: true, x: cx, y: ry - radius, normalX: 0, normalY: -1 };
  return { collided: true, x: cx, y: ry + rh + radius, normalX: 0, normalY: 1 };
}

/**
 * Hayatta Kalan Son Oyuncu / Kazanan Kontrolü
 */
export function checkEliminationWinner(
  players: Array<{ id: number; alive: boolean; score?: number }>
): { finished: boolean; winnerId: number | null } {
  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 1) {
    return { finished: true, winnerId: alivePlayers[0].id };
  }
  if (alivePlayers.length === 0) {
    // Aynı karede patladılarsa en yüksek skorlu kazanır
    const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { finished: true, winnerId: sorted[0]?.id ?? 0 };
  }
  return { finished: false, winnerId: null };
}

/**
 * Genel Skor Tablosu (Overall Scores) Kalıcı Depolama (localStorage) Yardımcıları
 */
export const OVERALL_SCORES_STORAGE_KEY = 'cubearena_overall_scores_v1';
export const DEFAULT_OVERALL_SCORES: [number, number, number, number] = [0, 0, 0, 0];

export function normalizeOverallScores(input: unknown): number[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_OVERALL_SCORES];
  }
  return Array.from({ length: PLAYERS_CONFIG.length }, (_, idx) => {
    const val = Number(input[idx]);
    return Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
  });
}

export function parseOverallScores(raw: string | null): number[] {
  if (!raw) {
    return [...DEFAULT_OVERALL_SCORES];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeOverallScores(parsed);
  } catch {
    return [...DEFAULT_OVERALL_SCORES];
  }
}

export function loadOverallScores(
  storage: Pick<Storage, 'getItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): number[] {
  try {
    if (!storage) return [...DEFAULT_OVERALL_SCORES];
    const raw = storage.getItem(OVERALL_SCORES_STORAGE_KEY);
    return parseOverallScores(raw);
  } catch {
    return [...DEFAULT_OVERALL_SCORES];
  }
}

export function saveOverallScores(
  scores: number[],
  storage: Pick<Storage, 'setItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): boolean {
  try {
    if (!storage) return false;
    const normalized = normalizeOverallScores(scores);
    storage.setItem(OVERALL_SCORES_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearOverallScores(
  storage: Pick<Storage, 'removeItem' | 'setItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : undefined
): number[] {
  const fresh = [...DEFAULT_OVERALL_SCORES];
  try {
    if (storage) {
      storage.setItem(OVERALL_SCORES_STORAGE_KEY, JSON.stringify(fresh));
    }
  } catch {
    // localStorage erişimi engelliyse sessizce varsayılan diziyi döndür
  }
  return fresh;
}

