// state.js
// 게임 상태 생성과 초기화만 담당합니다.
// 1:1 전용 구조이므로 allies, enemies, mode 배열을 만들지 않습니다.

import { BASE_STATS, ENEMY_NAMES, PERSONALITIES, TOWER_RULES, WEAPONS } from './data.js';
import { randomInt, randomSign, sample } from './utils.js';

export function createRun(config) {
  return {
    active: true,
    floor: TOWER_RULES.startFloor,
    bestFloor: TOWER_RULES.startFloor,
    playerWeapon: config.playerWeapon,
    playerPersonality: config.playerPersonality,
    victories: 0
  };
}

export function createBattleState(run) {
  const enemyConfig = createRandomEnemyConfig(run.floor);

  return {
    running: false,
    paused: false,
    frame: 0,
    elapsed: 0,
    result: null,
    run,
    arena: {
      width: 760,
      height: 500,
      left: 24,
      right: 736,
      top: 24,
      bottom: 476,
      centerX: 380,
      centerY: 250
    },
    player: createUnit({
      id: 'player',
      name: 'PLAYER',
      side: 'player',
      weaponId: run.playerWeapon,
      personalityId: run.playerPersonality,
      floor: run.floor,
      x: 210,
      y: 250
    }),
    enemy: createUnit({
      id: 'enemy',
      name: enemyConfig.name,
      side: 'enemy',
      weaponId: enemyConfig.weaponId,
      personalityId: enemyConfig.personalityId,
      floor: run.floor,
      x: 550,
      y: 250
    })
  };
}

export function advanceRunFloor(state) {
  state.run.victories += 1;
  state.run.floor += 1;
  state.run.bestFloor = Math.max(state.run.bestFloor, state.run.floor);
  return createBattleState(state.run);
}

export function createUnit({ id, name, side, weaponId, personalityId, floor, x, y }) {
  const weapon = WEAPONS[weaponId];
  const personality = PERSONALITIES[personalityId];
  const scale = getUnitScale(side, floor);
  const maxHp = Math.round(BASE_STATS.maxHp * scale.hp);

  return {
    id,
    name,
    side,
    weaponId,
    personalityId,
    floor,
    radius: side === 'player' ? 18 : 17,
    x,
    y,
    facing: side === 'player' ? 0 : Math.PI,
    hp: maxHp,
    maxHp,
    attackScale: scale.attack,
    defense: scale.defense,
    evasion: BASE_STATS.evasion,
    crit: BASE_STATS.crit,
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

export function startState(state) {
  state.running = true;
  state.paused = false;
  state.result = null;
}

export function togglePause(state) {
  if (!state.running || state.result) return;
  state.paused = !state.paused;
}

function createRandomEnemyConfig(floor) {
  const weaponIds = Object.keys(WEAPONS);
  const personalityIds = Object.keys(PERSONALITIES);
  const nameIndex = (floor + randomInt(0, ENEMY_NAMES.length - 1)) % ENEMY_NAMES.length;
  const isBossFloor = floor > 0 && floor % TOWER_RULES.bossInterval === 0;

  return {
    name: isBossFloor ? `BOSS ${ENEMY_NAMES[nameIndex]}` : ENEMY_NAMES[nameIndex],
    weaponId: sample(weaponIds),
    personalityId: sample(personalityIds)
  };
}

function getUnitScale(side, floor) {
  if (side === 'player') {
    return {
      hp: 1,
      attack: 1,
      defense: BASE_STATS.defense
    };
  }

  const floorBonus = Math.max(0, floor - 1);
  const bossBonus = floor % TOWER_RULES.bossInterval === 0 ? 0.25 : 0;

  return {
    hp: 1 + floorBonus * TOWER_RULES.hpGrowthPerFloor + bossBonus,
    attack: 1 + floorBonus * TOWER_RULES.damageGrowthPerFloor + bossBonus * 0.7,
    defense: Math.min(
      TOWER_RULES.maxEnemyDefense,
      BASE_STATS.defense + floorBonus * TOWER_RULES.defenseGrowthPerFloor + bossBonus * 0.04
    )
  };
}
