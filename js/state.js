// state.js
// 게임 상태 생성과 초기화만 담당합니다.
// 1:1 전용 구조이므로 allies, enemies, mode 배열을 만들지 않습니다.

import { BASE_STATS, PERSONALITIES, WEAPONS } from './data.js';
import { randomSign } from './utils.js';

export function createUnit({ id, name, side, weaponId, personalityId, x, y }) {
  const weapon = WEAPONS[weaponId];
  const personality = PERSONALITIES[personalityId];

  return {
    id,
    name,
    side,
    weaponId,
    personalityId,
    x,
    y,
    radius: side === 'player' ? 18 : 17,
    facing: side === 'player' ? 0 : Math.PI,
    hp: BASE_STATS.maxHp,
    maxHp: BASE_STATS.maxHp,
    attackState: 'idle',
    attackTimer: 0,
    cooldownTimer: 30,
    vx: 0,
    vy: 0,
    orbitDir: randomSign(),
    hits: 0,
    damageDealt: 0,
    lastAction: `${weapon.name} · ${personality.name}`,
    isDead: false
  };
}

export function createInitialState(config) {
  return {
    running: false,
    paused: false,
    frame: 0,
    elapsed: 0,
    result: null,
    arena: {
      width: 760,
      height: 500,
      cx: 380,
      cy: 250,
      radius: 225
    },
    player: createUnit({
      id: 'player',
      name: 'PLAYER',
      side: 'player',
      weaponId: config.playerWeapon,
      personalityId: config.playerPersonality,
      x: 240,
      y: 250
    }),
    enemy: createUnit({
      id: 'enemy',
      name: 'ENEMY',
      side: 'enemy',
      weaponId: config.enemyWeapon,
      personalityId: config.enemyPersonality,
      x: 520,
      y: 250
    })
  };
}

export function startState(state) {
  state.running = true;
  state.paused = false;
  state.result = null;
}

export function togglePause(state) {
  if (!state.running || state.result) return;
  state.paused = !state.paused;
}
