import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAMES_LIST,
  PLAYERS_CONFIG,
  getCubeRoyaleUnitStats,
  calculateEvoLevel,
  calculateEvoKillReward,
  calculateAgarRadius,
  calculateAgarSpeed,
  canAgarSwallow,
  computeJoystickVector,
  resolveCircleRectCollision,
  checkEliminationWinner
} from './rules';

test('8 adet .io mini oyunu eksiksiz tanımlanmış olmalı', () => {
  assert.equal(GAMES_LIST.length, 8);
  const ids = GAMES_LIST.map((g) => g.id);
  assert.deepEqual(ids, [
    'cube-royale',
    'tank-io',
    'evowars-io',
    'minigiants-io',
    'agar-io',
    'snake-io',
    'turbo-drift',
    'arena-futbol'
  ]);
  assert.equal(PLAYERS_CONFIG.length, 4);
});

test('Cube Royale 4 birlik istatistikleri tasarım kurallarına uymalı', () => {
  const swordsman = getCubeRoyaleUnitStats('swordsman');
  const archer = getCubeRoyaleUnitStats('archer');
  const cavalry = getCubeRoyaleUnitStats('cavalry');
  const tank = getCubeRoyaleUnitStats('tank');

  // Enerji maliyet sıralaması: Kılıçlı < Okçu < Atlı <= Tank
  assert.equal(swordsman.cost < archer.cost, true);
  assert.equal(archer.cost < cavalry.cost, true);
  // Okçu uzaktan ateş etmeli ve canı az olmalı
  assert.equal(archer.range > swordsman.range * 3, true);
  assert.equal(archer.maxHp < swordsman.maxHp, true);
  // Atlı kılıçlıdan daha hızlı ve daha yüksek saldırı/kalkana sahip olmalı
  assert.equal(cavalry.speed > swordsman.speed, true);
  assert.equal(cavalry.unitDamage > swordsman.unitDamage, true);
  assert.equal(cavalry.shield > swordsman.shield, true);
  // Tank yavaş, birliklere karşı zayıf ama kuleye çok yüksek hasar vermeli
  assert.equal(tank.speed < swordsman.speed, true);
  assert.equal(tank.unitDamage < swordsman.unitDamage, true);
  assert.equal(tank.towerDamage > cavalry.towerDamage * 3, true);
});

test('EvoWars.io XP seviye büyümesi ve %40 öldürme ödülü doğru hesaplanmalı', () => {
  const lvl1 = calculateEvoLevel(0);
  const lvl5 = calculateEvoLevel(400);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl5.level > lvl1.level, true);
  assert.equal(lvl5.bodyRadius > lvl1.bodyRadius, true);
  assert.equal(lvl5.swordLength > lvl1.swordLength, true);

  // Ölen rakibin toplam XP'sinin %40'ı kazanılmalı
  assert.equal(calculateEvoKillReward(250), 100);
  assert.equal(calculateEvoKillReward(100), 40);
});

test('Agar.io kütle büyüdükçe hız azalmalı ve merkez kapsandığında yutmalı', () => {
  const smallSpeed = calculateAgarSpeed(25);
  const largeSpeed = calculateAgarSpeed(250);
  assert.equal(largeSpeed < smallSpeed, true);

  const largeRadius = calculateAgarRadius(200);
  // Büyük oyuncu (200) küçük oyuncunun (80) merkezini kapsadığında yutabilir
  assert.equal(canAgarSwallow(200, 80, largeRadius * 0.5), true);
  // Kendisiyle aynı veya büyük oyuncuyu yutamaz
  assert.equal(canAgarSwallow(100, 100, 2), false);
  // Mesafe uzaksa yutamaz
  assert.equal(canAgarSwallow(200, 80, largeRadius * 1.4), false);
});

test('Multi-touch sanal joystick vektörü sınırlandırılmış büyüklük üretmeli', () => {
  const idle = computeJoystickVector(100, 100, 100, 100, 50);
  assert.equal(idle.magnitude, 0);

  const half = computeJoystickVector(100, 100, 125, 100, 50);
  assert.equal(Math.abs(half.vx - 0.5) < 0.001, true);
  assert.equal(Math.abs(half.vy) < 0.001, true);

  const clamped = computeJoystickVector(100, 100, 300, 100, 50);
  assert.equal(Math.abs(clamped.vx - 1) < 0.001, true);
  assert.equal(clamped.magnitude, 1);
});

test('Daire-dikdörtgen çarpışma çözümü ve son kalan kazanan testi', () => {
  const hit = resolveCircleRectCollision(95, 50, 10, 100, 20, 40, 60);
  assert.equal(hit.collided, true);
  assert.equal(hit.x, 90);
  assert.equal(hit.normalX, -1);

  const winState = checkEliminationWinner([
    { id: 0, alive: false, score: 10 },
    { id: 1, alive: true, score: 25 },
    { id: 2, alive: false, score: 5 }
  ]);
  assert.equal(winState.finished, true);
  assert.equal(winState.winnerId, 1);
});

test('navigator.vibrate dokunsal geri bildirim (hapticService) buton, çarpışma ve gol desenlerini tetiklemeli', async () => {
  const { hapticService, HAPTIC_PATTERNS } = await import('./audio');
  const calls: Array<number | number[]> = [];

  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      vibrate: (pattern: number | number[]) => {
        calls.push(pattern);
        return true;
      }
    },
    configurable: true
  });

  try {
    assert.equal(hapticService.isEnabled(), true);
    assert.equal(hapticService.buttonPress(), true);
    assert.equal(hapticService.collision(), true);
    assert.equal(hapticService.goalScored(), true);

    assert.deepEqual(calls, [
      HAPTIC_PATTERNS.button,
      HAPTIC_PATTERNS.collision,
      HAPTIC_PATTERNS.goal
    ]);

    // Titreşimi kapatınca navigator.vibrate(0) çağrılmalı ve yeni titreşim üretmemeli
    assert.equal(hapticService.toggle(), false);
    assert.equal(hapticService.buttonPress(), false);
    // Tekrar aç
    assert.equal(hapticService.toggle(), true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true
    });
  }
});

test('GameStats computePlayerStatsBreakdown hudState.players verisinden imha, mesafe ve sıralama üretmeli', async () => {
  const { computePlayerStatsBreakdown } = await import('../components/GameStats');
  const rows = computePlayerStatsBreakdown(
    [
      { id: 0, alive: false, score: 120, metricText: 'ELENDİ', kills: 2, distance: 340 },
      { id: 1, alive: true, score: 450, metricText: 'SV.5 · 450 XP', kills: 6, distance: 890 }
    ],
    1,
    [1, 3, 0, 0]
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 1);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].isWinner, true);
  assert.equal(rows[0].kills, 6);
  assert.equal(rows[0].distance, 890);
  assert.equal(rows[0].overallWins, 3);
  assert.equal(rows[0].performancePercent, 100);

  assert.equal(rows[1].id, 0);
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[1].kills, 2);
  assert.equal(rows[1].distance, 340);
});

test('Genel skor tablosu (overallScores) localStorage üzerinde kalıcı olarak kaydedilmeli, okunmalı ve sıfırlanabilmeli', async () => {
  const {
    OVERALL_SCORES_STORAGE_KEY,
    loadOverallScores,
    saveOverallScores,
    clearOverallScores,
    parseOverallScores
  } = await import('./rules');

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };

  // Başlangıçta boş depodan [0, 0, 0, 0] dönmeli
  assert.deepEqual(loadOverallScores(mockStorage), [0, 0, 0, 0]);

  // Skor kaydedildiğinde depoya yazılmalı ve yenileme sonrasında geri okunmalı
  assert.equal(saveOverallScores([4, 2, 7, 1], mockStorage), true);
  assert.equal(store.get(OVERALL_SCORES_STORAGE_KEY), '[4,2,7,1]');
  assert.deepEqual(loadOverallScores(mockStorage), [4, 2, 7, 1]);

  // Bozuk veya negatif veri güvenli şekilde normalize edilmeli
  assert.deepEqual(parseOverallScores('invalid-json'), [0, 0, 0, 0]);
  assert.deepEqual(parseOverallScores('[-5, 3.8, "abc", 9]'), [0, 3, 0, 9]);

  // Sıfırlama işlemi hem depoyu hem dönen skoru [0, 0, 0, 0] yapmalı
  assert.deepEqual(clearOverallScores(mockStorage), [0, 0, 0, 0]);
  assert.deepEqual(loadOverallScores(mockStorage), [0, 0, 0, 0]);
});

test('Başarımlar (Achievements) sistemi 10 Games Played ve 100 Kills kilometre taşlarını localStorage üzerinde takip edip yeni açılanları bildirmeli', async () => {
  const {
    loadAchievementState,
    recordAchievementProgress,
    clearAchievementState
  } = await import('./achievements');

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };

  // Başlangıçta hiçbir başarım açık olmamalı
  const initial = loadAchievementState(mockStorage);
  assert.equal(initial.unlockedIds.length, 0);
  assert.equal(initial.stats.gamesPlayed, 0);
  assert.equal(initial.stats.totalKills, 0);

  // 1 oyun ve 12 imha kaydedildiğinde 'first-match' ve '10-kills' açılmalı
  const step1 = recordAchievementProgress({ gamesPlayed: 1, kills: 12 }, mockStorage);
  assert.deepEqual(
    step1.newlyUnlocked.map((a) => a.id),
    ['first-match', '10-kills']
  );

  // 9 oyun ve 88 imha daha eklendiğinde toplam 10 oyun ('10-games-played') ve 100 imha ('100-kills') açılmalı
  const step2 = recordAchievementProgress({ gamesPlayed: 9, kills: 88 }, mockStorage);
  assert.equal(step2.state.stats.gamesPlayed, 10);
  assert.equal(step2.state.stats.totalKills, 100);
  assert.deepEqual(
    step2.newlyUnlocked.map((a) => a.id),
    ['10-games-played', '100-kills']
  );
  assert.deepEqual(
    step2.newlyUnlocked.map((a) => a.englishBadge),
    ['10 Games Played', '100 Kills']
  );

  // Aynı eşikler tekrar tetiklendiğinde zaten açılmış başarımlar tekrar newlyUnlocked döndürmemeli
  const step3 = recordAchievementProgress({ gamesPlayed: 1, kills: 5 }, mockStorage);
  assert.equal(step3.newlyUnlocked.length, 0);

  // localStorage'dan okunduğunda açılan 4 başarım kalıcı olmalı
  const reloaded = loadAchievementState(mockStorage);
  assert.equal(reloaded.unlockedIds.length, 4);
  assert.equal(reloaded.stats.gamesPlayed, 11);
  assert.equal(reloaded.stats.totalKills, 105);

  // Sıfırlama işlemi tüm istatistikleri ve kilitleri temizlemeli
  const reset = clearAchievementState(mockStorage);
  assert.equal(reset.unlockedIds.length, 0);
  assert.equal(reset.stats.gamesPlayed, 0);
});


