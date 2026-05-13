// state.js
// 게임 상태 생성, 런 성장, 보상 적용만 담당합니다.
// 1:1 전용 구조이므로 allies, enemies, mode 배열을 만들지 않습니다.

import {
  BASE_STATS,
  ENEMY_NAMES,
  PERSONALITIES,
  PLAYER_START_STATS,
  PLAYER_START_STAT_POINTS,
  POSTURE_RULES,
  REWARD_RULES,
  SKILLS,
  STAT_KEYS,
  TOWER_RULES,
  WEAPONS
} from './data.js';
import { clamp, randomInt, randomSign, sample } from './utils.js';

export function createRun(config) {
  return {
    active: true,
    floor: TOWER_RULES.startFloor,
    bestFloor: TOWER_RULES.startFloor,
    victories: 0,
    pendingRewards: [],
    lastRewardLog: '',
    levelMessage: '',
    player: {
      name: 'PLAYER',
      weaponId: config.playerWeapon,
      personalityId: config.playerPersonality,
      level: 1,
      exp: 0,
      statPoints: PLAYER_START_STAT_POINTS,
      stats: { ...PLAYER_START_STATS },
      skills: [],
      mastery: 0,
      hp: null
    }
  };
}

export function createBattleState(run) {
  const enemyConfig = createRandomEnemyConfig(run.floor);
  const spawnSkew = randomSign() * randomInt(34, 82);
  const playerY = 250 + spawnSkew;
  const enemyY = 250 - spawnSkew;

  return {
    running: false,
    paused: false,
    frame: 0,
    elapsed: 0,
    result: null,
    rewardsPrepared: false,
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
    player: createUnitFromPlayer(run.player, 210, playerY),
    enemy: createUnitFromEnemy(enemyConfig, run.floor, 550, enemyY)
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

export function spendPlayerStat(run, statKey) {
  if (!run?.player || run.player.statPoints <= 0 || !STAT_KEYS.includes(statKey)) return false;
  run.player.stats[statKey] += 1;
  run.player.statPoints -= 1;
  healPlayerToFull(run.player);
  return true;
}

export function refreshPlayerUnit(state) {
  if (!state?.run?.player || state.running || state.result) return state;
  state.player = createUnitFromPlayer(state.run.player, state.player.x, state.player.y);
  return state;
}

export function completeFloorVictory(state) {
  if (state.rewardsPrepared) return;

  const run = state.run;
  const currentProfile = derivePlayerProfile(run.player);
  run.player.hp = clamp(state.player.hp, 0, currentProfile.maxHp);
  run.victories += 1;

  const expGain = REWARD_RULES.baseExp + run.floor * REWARD_RULES.expPerFloor;
  run.levelMessage = grantExp(run.player, expGain);
  run.pendingRewards = generateRewardChoices(run);
  state.rewardsPrepared = true;
}

export function applyRewardAndAdvance(state, rewardId) {
  const run = state.run;
  const reward = run.pendingRewards.find((item) => item.id === rewardId);
  if (!reward) return state;

  applyReward(run, reward);
  run.pendingRewards = [];
  run.floor += 1;
  run.bestFloor = Math.max(run.bestFloor, run.floor);
  healPlayerToFull(run.player);
  return createBattleState(run);
}

export function getNextLevelExp(level) {
  return 100 + (level - 1) * 42;
}

export function derivePlayerProfile(player) {
  const weapon = WEAPONS[player.weaponId];
  const personality = PERSONALITIES[player.personalityId];
  const skillEffects = collectSkillEffects(player.skills);
  const stats = player.stats;

  const maxHp = Math.round(
    BASE_STATS.maxHp +
    stats.vit * 12 +
    stats.str * 2 +
    stats.def * 4 +
    player.level * 7
  );

  const maxPosture = Math.round(
    POSTURE_RULES.baseMax +
    stats.def * POSTURE_RULES.defenseToMax +
    stats.vit * POSTURE_RULES.vitalityToMax +
    player.level * POSTURE_RULES.levelToMax
  );

  const attackScale =
    1 +
    stats.str * 0.065 +
    stats.agi * 0.012 +
    player.mastery * 0.035 +
    (personality.attackBonus || 0) +
    (skillEffects.attackBonus || 0);

  const defense = clamp(
    0.035 +
    stats.def * 0.012 +
    stats.vit * 0.002 +
    (personality.defenseBonus || 0) +
    (skillEffects.defenseBonus || 0),
    0,
    BASE_STATS.defenseCap
  );

  const evasion = clamp(
    0.025 +
    stats.agi * 0.007 +
    stats.luck * 0.002 +
    (personality.evasionBonus || 0) +
    (skillEffects.evasionBonus || 0),
    0,
    BASE_STATS.evasionCap
  );

  const crit = clamp(
    weapon.crit +
    stats.luck * 0.008 +
    (personality.critBonus || 0) +
    (skillEffects.critBonus || 0),
    0,
    BASE_STATS.critCap
  );

  const moveSpeedScale = 1 + stats.agi * 0.008 + (skillEffects.moveSpeedBonus || 0);
  const cooldownScale = 1 / (1 + stats.agi * 0.009 + player.mastery * 0.015 + (skillEffects.cooldownBonus || 0));
  const critDamage = 1.55 + stats.luck * 0.006 + (skillEffects.critDamageBonus || 0);

  return {
    maxHp,
    maxPosture,
    attackScale,
    defense,
    evasion,
    crit,
    moveSpeedScale,
    cooldownScale,
    critDamage,
    lowHpDefenseBonus: skillEffects.lowHpDefenseBonus || 0
  };
}

function createUnitFromPlayer(player, x, y) {
  const profile = derivePlayerProfile(player);
  const weapon = WEAPONS[player.weaponId];
  const personality = PERSONALITIES[player.personalityId];
  const hp = player.hp == null ? profile.maxHp : clamp(player.hp, 1, profile.maxHp);
  player.hp = hp;

  return {
    id: 'player',
    name: player.name,
    side: 'player',
    weaponId: player.weaponId,
    personalityId: player.personalityId,
    level: player.level,
    stats: { ...player.stats },
    skills: [...player.skills],
    mastery: player.mastery,
    radius: 18,
    x,
    y,
    facing: 0,
    hp,
    maxHp: profile.maxHp,
    posture: profile.maxPosture,
    maxPosture: profile.maxPosture,
    postureRecoveryDelay: 0,
    staggerTimer: 0,
    retreatFrames: 0,
    retreatLockout: 0,
    resetMoveCooldown: 0,
    clashCooldown: 0,
    flankPressureTimer: 0,
    daggerBurstCooldown: 0,
    parryCooldown: 0,
    parryFlashTimer: 0,
    counterTimer: 0,
    impactStopTimer: 0,
    attackWindupMax: 0,
    attackActiveMax: 0,
    attackRecoveryMax: 0,
    attackVisualPhase: 0,
    attackScale: profile.attackScale,
    defense: profile.defense,
    evasion: profile.evasion,
    crit: profile.crit,
    critDamage: profile.critDamage,
    lowHpDefenseBonus: profile.lowHpDefenseBonus,
    moveSpeedScale: profile.moveSpeedScale,
    cooldownScale: profile.cooldownScale,
    attackState: 'idle',
    attackTimer: 0,
    cooldownTimer: 30,
    vx: 0,
    vy: 0,
    orbitDir: randomSign(),
    orbitFlipTimer: randomInt(42, 110),
    hits: 0,
    damageDealt: 0,
    lastAction: `${weapon.name} · ${personality.name}`,
    isDead: false
  };
}

function createUnitFromEnemy(enemyConfig, floor, x, y) {
  const profile = deriveEnemyProfile(enemyConfig, floor);
  const weapon = WEAPONS[enemyConfig.weaponId];
  const personality = PERSONALITIES[enemyConfig.personalityId];

  return {
    id: 'enemy',
    name: enemyConfig.name,
    side: 'enemy',
    weaponId: enemyConfig.weaponId,
    personalityId: enemyConfig.personalityId,
    level: enemyConfig.level,
    stats: { ...enemyConfig.stats },
    skills: [...enemyConfig.skills],
    mastery: enemyConfig.mastery,
    radius: floor % TOWER_RULES.bossInterval === 0 ? 20 : 17,
    x,
    y,
    facing: Math.PI,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    posture: profile.maxPosture,
    maxPosture: profile.maxPosture,
    postureRecoveryDelay: 0,
    staggerTimer: 0,
    retreatFrames: 0,
    retreatLockout: 0,
    resetMoveCooldown: 0,
    clashCooldown: 0,
    flankPressureTimer: 0,
    daggerBurstCooldown: 0,
    parryCooldown: 0,
    parryFlashTimer: 0,
    counterTimer: 0,
    impactStopTimer: 0,
    attackWindupMax: 0,
    attackActiveMax: 0,
    attackRecoveryMax: 0,
    attackVisualPhase: 0,
    attackScale: profile.attackScale,
    defense: profile.defense,
    evasion: profile.evasion,
    crit: profile.crit,
    critDamage: profile.critDamage,
    lowHpDefenseBonus: profile.lowHpDefenseBonus,
    moveSpeedScale: profile.moveSpeedScale,
    cooldownScale: profile.cooldownScale,
    attackState: 'idle',
    attackTimer: 0,
    cooldownTimer: 30,
    vx: 0,
    vy: 0,
    orbitDir: randomSign(),
    orbitFlipTimer: randomInt(42, 110),
    hits: 0,
    damageDealt: 0,
    lastAction: `${weapon.name} · ${personality.name}`,
    isDead: false
  };
}

function createRandomEnemyConfig(floor) {
  const weaponIds = Object.keys(WEAPONS);
  const personalityIds = Object.keys(PERSONALITIES);
  const nameIndex = (floor + randomInt(0, ENEMY_NAMES.length - 1)) % ENEMY_NAMES.length;
  const isBossFloor = floor > 0 && floor % TOWER_RULES.bossInterval === 0;
  const base = 4 + Math.floor(floor * 0.55);
  const bossBonus = isBossFloor ? 3 : 0;

  return {
    name: isBossFloor ? `BOSS ${ENEMY_NAMES[nameIndex]}` : ENEMY_NAMES[nameIndex],
    weaponId: sample(weaponIds),
    personalityId: sample(personalityIds),
    level: Math.max(1, floor),
    stats: {
      str: base + bossBonus + randomInt(0, 2),
      vit: base + bossBonus + randomInt(0, 3),
      def: base + bossBonus + randomInt(0, 2),
      agi: base + bossBonus + randomInt(0, 2),
      luck: base + randomInt(0, 2)
    },
    skills: createEnemySkills(floor, isBossFloor),
    mastery: Math.floor(floor / 4) + (isBossFloor ? 2 : 0)
  };
}

function deriveEnemyProfile(enemy, floor) {
  const weapon = WEAPONS[enemy.weaponId];
  const personality = PERSONALITIES[enemy.personalityId];
  const skillEffects = collectSkillEffects(enemy.skills);
  const stats = enemy.stats;
  const floorIndex = Math.max(0, floor - 1);
  const bossMult = floor % TOWER_RULES.bossInterval === 0 ? 1.18 : 1;

  const maxHp = Math.round(
    (BASE_STATS.maxHp + stats.vit * 11 + stats.def * 3 + floorIndex * 4) *
    (1 + floorIndex * TOWER_RULES.hpGrowthPerFloor * 0.28) *
    bossMult
  );

  const maxPosture = Math.round(
    (POSTURE_RULES.baseMax +
    stats.def * (POSTURE_RULES.defenseToMax - 1) +
    stats.vit * POSTURE_RULES.vitalityToMax +
    floorIndex * POSTURE_RULES.enemyFloorToMax) *
    bossMult
  );

  const attackScale =
    (1 +
    stats.str * 0.057 +
    stats.agi * 0.01 +
    enemy.mastery * 0.027 +
    floorIndex * TOWER_RULES.damageGrowthPerFloor * 0.32 +
    (personality.attackBonus || 0) +
    (skillEffects.attackBonus || 0)) * bossMult;

  const defense = clamp(
    0.025 +
    stats.def * 0.01 +
    stats.vit * 0.0015 +
    floorIndex * TOWER_RULES.defenseGrowthPerFloor * 0.42 +
    (personality.defenseBonus || 0) +
    (skillEffects.defenseBonus || 0),
    0,
    TOWER_RULES.maxEnemyDefense + (floor % TOWER_RULES.bossInterval === 0 ? 0.06 : 0)
  );

  const evasion = clamp(
    0.018 +
    stats.agi * 0.006 +
    stats.luck * 0.0015 +
    (personality.evasionBonus || 0) +
    (skillEffects.evasionBonus || 0),
    0,
    0.32
  );

  const crit = clamp(
    weapon.crit +
    stats.luck * 0.006 +
    (personality.critBonus || 0) +
    (skillEffects.critBonus || 0),
    0,
    0.48
  );

  return {
    maxHp,
    maxPosture,
    attackScale,
    defense,
    evasion,
    crit,
    moveSpeedScale: 1 + stats.agi * 0.006 + (skillEffects.moveSpeedBonus || 0),
    cooldownScale: 1 / (1 + stats.agi * 0.007 + enemy.mastery * 0.012 + (skillEffects.cooldownBonus || 0)),
    critDamage: 1.5 + stats.luck * 0.004 + (skillEffects.critDamageBonus || 0),
    lowHpDefenseBonus: skillEffects.lowHpDefenseBonus || 0
  };
}

function createEnemySkills(floor, isBossFloor) {
  const pool = Object.keys(SKILLS);
  const count = Math.min(isBossFloor ? 3 : 2, Math.floor(floor / 5) + (isBossFloor ? 1 : 0));
  const skills = [];
  while (skills.length < count && skills.length < pool.length) {
    const skill = sample(pool);
    if (!skills.includes(skill)) skills.push(skill);
  }
  return skills;
}

function grantExp(player, amount) {
  player.exp += amount;
  let levelUps = 0;

  while (player.exp >= getNextLevelExp(player.level)) {
    player.exp -= getNextLevelExp(player.level);
    player.level += 1;
    player.statPoints += 2;
    levelUps += 1;
  }

  if (!levelUps) return `경험치 +${amount}`;
  return `경험치 +${amount} · 레벨 ${levelUps}회 상승 · 스탯 포인트 +${levelUps * 2}`;
}

function generateRewardChoices(run) {
  const rewards = [];
  const shuffledStats = [...STAT_KEYS].sort(() => Math.random() - 0.5);

  rewards.push({
    id: `stat-${shuffledStats[0]}`,
    type: 'stat',
    statKey: shuffledStats[0],
    amount: REWARD_RULES.statAmount,
    title: `${statName(shuffledStats[0])} 훈련`,
    description: `${statName(shuffledStats[0])} +${REWARD_RULES.statAmount}. 기본 전투 능력을 직접 올립니다.`
  });

  rewards.push({
    id: 'mastery',
    type: 'mastery',
    amount: REWARD_RULES.masteryAmount,
    title: '무기 숙련',
    description: `현재 무기 숙련도 +${REWARD_RULES.masteryAmount}. 공격력과 공격 회전이 조금 좋아집니다.`
  });

  const missingSkills = Object.keys(SKILLS).filter((skillId) => !run.player.skills.includes(skillId));
  if (missingSkills.length > 0) {
    const skillId = sample(missingSkills);
    rewards.push({
      id: `skill-${skillId}`,
      type: 'skill',
      skillId,
      title: `스킬 습득 · ${SKILLS[skillId].name}`,
      description: SKILLS[skillId].description
    });
  } else {
    rewards.push({
      id: 'stat-point',
      type: 'statPoint',
      amount: REWARD_RULES.bonusStatPoints,
      title: '자유 훈련권',
      description: `스탯 포인트 +${REWARD_RULES.bonusStatPoints}. 원하는 능력치를 직접 올릴 수 있습니다.`
    });
  }

  return rewards.slice(0, REWARD_RULES.choices);
}

function applyReward(run, reward) {
  const player = run.player;
  if (reward.type === 'stat') {
    player.stats[reward.statKey] += reward.amount;
    run.lastRewardLog = `${statName(reward.statKey)} +${reward.amount}`;
  }

  if (reward.type === 'mastery') {
    player.mastery += reward.amount;
    run.lastRewardLog = `무기 숙련 +${reward.amount}`;
  }

  if (reward.type === 'skill') {
    if (!player.skills.includes(reward.skillId)) player.skills.push(reward.skillId);
    run.lastRewardLog = `스킬 습득: ${SKILLS[reward.skillId].name}`;
  }

  if (reward.type === 'statPoint') {
    player.statPoints += reward.amount;
    run.lastRewardLog = `스탯 포인트 +${reward.amount}`;
  }

  const profile = derivePlayerProfile(player);
  player.hp = clamp(player.hp ?? profile.maxHp, 1, profile.maxHp);
}

function healPlayerToFull(player) {
  const profile = derivePlayerProfile(player);
  player.hp = profile.maxHp;
}

function collectSkillEffects(skillIds) {
  return skillIds.reduce((effects, skillId) => {
    const skill = SKILLS[skillId];
    if (!skill) return effects;
    Object.entries(skill.effects).forEach(([key, value]) => {
      effects[key] = (effects[key] || 0) + value;
    });
    return effects;
  }, {});
}

function statName(key) {
  const names = {
    str: '힘',
    vit: '체력',
    def: '방어',
    agi: '민첩',
    luck: '행운'
  };
  return names[key] || key;
}
