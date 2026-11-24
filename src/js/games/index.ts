/**
 * CubeArena .io — 8 Mini Oyun Fabrika Modülü
 */

import { GameId } from '../rules';
import { AgarIoGame } from './agarIo';
import { ArenaFutbolGame } from './arenaFutbol';
import { CubeRoyaleGame } from './cubeRoyale';
import { EvoWarsGame } from './evoWars';
import { MiniGiantsGame } from './miniGiants';
import { SnakeIoGame } from './snakeIo';
import { TankIoGame } from './tankIo';
import { TurboDriftGame } from './turboDrift';
import { MiniGameEngine } from './types';

export function createMiniGame(gameId: GameId): MiniGameEngine {
  switch (gameId) {
    case 'cube-royale':
      return new CubeRoyaleGame();
    case 'tank-io':
      return new TankIoGame();
    case 'evowars-io':
      return new EvoWarsGame();
    case 'minigiants-io':
      return new MiniGiantsGame();
    case 'agar-io':
      return new AgarIoGame();
    case 'snake-io':
      return new SnakeIoGame();
    case 'turbo-drift':
      return new TurboDriftGame();
    case 'arena-futbol':
      return new ArenaFutbolGame();
    default:
      return new CubeRoyaleGame();
  }
}
