/**
 * CubeArena .io — Mini Oyun Motoru Ortak Arayüzü
 */

import { PlayerInputState } from '../controls';

export interface PlayerHudInfo {
  id: number;
  alive: boolean;
  score: number;
  metricText: string; // Örn: "7⚡", "2/2 Mermi", "Sv.4", "3/3 Tur", "2 Gol"
  energy?: number; // Cube Royale için 0..10 arası enerji
  maxEnergy?: number;
  kills?: number; // Toplam leş / imha sayısı
  distance?: number; // Kat edilen mesafe (m) veya uzunluk
}

export interface GameHudSnapshot {
  timeRemaining: number | null;
  statusMessage: string;
  players: PlayerHudInfo[];
  isGameOver: boolean;
  winnerId: number | null;
  winReason: string;
}

export interface MiniGameEngine {
  init(width: number, height: number, playerCount: number): void;
  resize(width: number, height: number): void;
  update(dt: number, inputs: PlayerInputState[], botAssist: boolean): void;
  render(ctx: CanvasRenderingContext2D): void;
  getHudState(): GameHudSnapshot;
}
