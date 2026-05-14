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
  WEAPON_SKILL_LOADOUTS,
  PERSONALITY_SKILL_LOADOUTS,
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
      skills: getDefaultSkillIds(config.playerWeapon, config.playerPersonality),
      skillLevels: createInitialSkillLevels(getDefaultSkillIds(config.playerWeapon, config.playerPersonality)),
      externalSkillCount: 0,
      mastery: 0,
      hp: null
    }
  };
}

export function createBattleState(run, options = {}) {
  const enemyConfig = options.enemyConfig || createRandomEnemyConfig(run.floor);
  const spawnSkew = options.spawnSkew ?? randomSign() * randomInt(34, 82);
  const playerY = 250 + spawnSkew;
  const enemyY = 250 - spawnSkew;

  return {
    running: false,
    paused: false,
    frame: 0,
    elapsed: 0,
    result: null,
    rewardsPrepared: false,
    effects: [],
    eventLocks: {},
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
  const skillEffects = collectSkillEffects(player.skills, player.skillLevels);
  const stats = player.stats;

  const maxHp = Math.round(
    BASE_STATS.maxHp +
    stats.vit * 12 +
    stats.str * 2 +
    stats.def * 4 +
    player.level * 7
  );

  const maxPosture = Math.round((
    POSTURE_RULES.baseMax +
    stats.def * POSTURE_RULES.defenseToMax +
    stats.vit * POSTURE_RULES.vitalityToMax +
    player.level * POSTURE_RULES.levelToMax
  ) * (personality.postureMaxScale || 1));

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

  const speedScales = getWeaponAgilityScales(weapon, stats, player.mastery, skillEffects, true);
  const moveSpeedScale = speedScales.moveSpeedScale * (personality.moveSpeedScale || 1);
  const cooldownScale = speedScales.cooldownScale * (personality.cooldownScale || 1);
  const turnSpeedScale = speedScales.turnSpeedScale * (personality.turnSpeedScale || 1);
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
    turnSpeedScale,
    critDamage,
    lowHpAttackBonus: skillEffects.lowHpAttackBonus || 0,
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
    skillLevels: { ...(player.skillLevels || createInitialSkillLevels(player.skills)) },
    skillCooldowns: {},
    skillUsed: {},
    skillRuntime: {},
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
    daggerSideCommitLock: 0,
    daggerThreatStepCooldown: 0,
    daggerBaitSide: randomSign(),
    daggerBaitTimer: randomInt(18, 48),
    daggerManeuverPhase: '',
    daggerManeuverTimer: 0,
    daggerFeintSide: randomSign(),
    daggerResetTimer: 0,
    parryCooldown: 0,
    parryFlashTimer: 0,
    counterTimer: 0,
    comboTimer: 0,
    comboCount: 0,
    riposteTimer: 0,
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
    lowHpAttackBonus: profile.lowHpAttackBonus,
    lowHpDefenseBonus: profile.lowHpDefenseBonus,
    moveSpeedScale: profile.moveSpeedScale,
    cooldownScale: profile.cooldownScale,
    turnSpeedScale: profile.turnSpeedScale,
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
    skillLevels: { ...(enemyConfig.skillLevels || createInitialSkillLevels(enemyConfig.skills)) },
    skillCooldowns: {},
    skillUsed: {},
    skillRuntime: {},
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
    daggerSideCommitLock: 0,
    daggerThreatStepCooldown: 0,
    daggerBaitSide: randomSign(),
    daggerBaitTimer: randomInt(18, 48),
    daggerManeuverPhase: '',
    daggerManeuverTimer: 0,
    daggerFeintSide: randomSign(),
    daggerResetTimer: 0,
    parryCooldown: 0,
    parryFlashTimer: 0,
    counterTimer: 0,
    comboTimer: 0,
    comboCount: 0,
    riposteTimer: 0,
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
    lowHpAttackBonus: profile.lowHpAttackBonus,
    lowHpDefenseBonus: profile.lowHpDefenseBonus,
    moveSpeedScale: profile.moveSpeedScale,
    cooldownScale: profile.cooldownScale,
    turnSpeedScale: profile.turnSpeedScale,
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

  return {
    name: isBossFloor ? `BOSS ${ENEMY_NAMES[nameIndex]}` : ENEMY_NAMES[nameIndex],
    weaponId: sample(weaponIds),
    personalityId: sample(personalityIds),
    level: Math.max(1, floor),
    stats: createEnemyStats(floor, isBossFloor),
    skills: createEnemySkills(floor, isBossFloor),
    mastery: createEnemyMastery(floor, isBossFloor)
  };
}

export function createFixedEnemyConfig({ floor = TOWER_RULES.startFloor, weaponId = 'eastern', personalityId = 'balanced', stats = null, name = 'SIM ENEMY' } = {}) {
  const isBossFloor = floor > 0 && floor % TOWER_RULES.bossInterval === 0;
  const skills = createEnemySkills(floor, isBossFloor, weaponId, personalityId);
  return {
    name,
    weaponId,
    personalityId,
    level: Math.max(1, floor),
    stats: stats ? { ...stats } : createEnemyStats(floor, isBossFloor),
    skills,
    skillLevels: createEnemySkillLevels(skills, floor, isBossFloor),
    mastery: createEnemyMastery(floor, isBossFloor)
  };
}

function createEnemyStats(floor, isBossFloor) {
  if (floor === TOWER_RULES.startFloor && !isBossFloor) {
    return { ...PLAYER_START_STATS };
  }

  const floorIndex = Math.max(0, floor - TOWER_RULES.startFloor);
  const base = 5 + Math.floor(floorIndex * 0.55);
  const bossBonus = isBossFloor ? 3 : 0;

  return {
    str: base + bossBonus + randomInt(0, 2),
    vit: base + bossBonus + randomInt(0, 3),
    def: base + bossBonus + randomInt(0, 2),
    agi: base + bossBonus + randomInt(0, 2),
    luck: base + randomInt(0, 2)
  };
}

function createEnemyMastery(floor, isBossFloor) {
  if (floor === TOWER_RULES.startFloor && !isBossFloor) return 0;
  return Math.floor(floor / 4) + (isBossFloor ? 2 : 0);
}

function deriveEnemyProfile(enemy, floor) {
  const weapon = WEAPONS[enemy.weaponId];
  const personality = PERSONALITIES[enemy.personalityId];
  const skillEffects = collectSkillEffects(enemy.skills, enemy.skillLevels);
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
    bossMult *
    (personality.postureMaxScale || 1)
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

  const speedScales = getWeaponAgilityScales(weapon, stats, enemy.mastery, skillEffects, false);

  return {
    maxHp,
    maxPosture,
    attackScale,
    defense,
    evasion,
    crit,
    moveSpeedScale: speedScales.moveSpeedScale * (personality.moveSpeedScale || 1),
    cooldownScale: speedScales.cooldownScale * (personality.cooldownScale || 1),
    turnSpeedScale: speedScales.turnSpeedScale * (personality.turnSpeedScale || 1),
    critDamage: 1.5 + stats.luck * 0.004 + (skillEffects.critDamageBonus || 0),
    lowHpAttackBonus: skillEffects.lowHpAttackBonus || 0,
    lowHpDefenseBonus: skillEffects.lowHpDefenseBonus || 0
  };
}

function createEnemySkills(floor, isBossFloor, weaponId, personalityId) {
  const baseSkills = getDefaultSkillIds(weaponId, personalityId);
  const skills = [...baseSkills];
  const extraLimit = Math.min(isBossFloor ? 2 : 1, Math.floor(floor / 6));
  const pool = Object.keys(SKILLS).filter((skillId) => {
    const skill = SKILLS[skillId];
    if (!skill || skills.includes(skillId)) return false;
    if (skill.source !== 'personality') return false;
    return skill.owner !== personalityId;
  });

  while (skills.length < baseSkills.length + extraLimit && pool.length > 0) {
    const skill = sample(pool);
    if (!skills.includes(skill)) skills.push(skill);
  }

  return skills;
}

function createEnemySkillLevels(skills, floor, isBossFloor) {
  const levels = createInitialSkillLevels(skills);
  if (floor >= 6) {
    skills.forEach((skillId) => {
      const skill = SKILLS[skillId];
      const maxLevel = skill?.maxLevel || REWARD_RULES.skillMaxLevel || 3;
      const floorBonus = Math.floor(floor / 8);
      levels[skillId] = Math.min(maxLevel, 1 + floorBonus + (isBossFloor ? 1 : 0));
    });
  }
  return levels;
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

  const levelable = getLevelableOwnedSkills(run.player);
  if (levelable.length > 0) {
    const skillId = sample(levelable);
    const nextLevel = (run.player.skillLevels?.[skillId] || 1) + 1;
    rewards.push({
      id: `skill-level-${skillId}`,
      type: 'skillLevel',
      skillId,
      title: `스킬 강화 · ${SKILLS[skillId].name} Lv.${nextLevel}`,
      description: `${SKILLS[skillId].description} 현재 보유 스킬을 한 단계 강화합니다.`
    });
  } else {
    rewards.push({
      id: 'mastery',
      type: 'mastery',
      amount: REWARD_RULES.masteryAmount,
      title: '무기 숙련',
      description: `현재 무기 숙련도 +${REWARD_RULES.masteryAmount}. 공격력과 공격 회전이 조금 좋아집니다.`
    });
  }

  const crossSkills = getLearnableExternalPersonalitySkills(run.player);
  if (crossSkills.length > 0) {
    const skillId = sample(crossSkills);
    rewards.push({
      id: `skill-learn-${skillId}`,
      type: 'skillLearn',
      skillId,
      title: `외부 성격 스킬 습득 · ${SKILLS[skillId].name}`,
      description: `${SKILLS[skillId].description} 현재 성격에 없는 스킬을 낮은 레벨로 배웁니다.`
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
  player.skillLevels = player.skillLevels || createInitialSkillLevels(player.skills);

  if (reward.type === 'stat') {
    player.stats[reward.statKey] += reward.amount;
    run.lastRewardLog = `${statName(reward.statKey)} +${reward.amount}`;
  }

  if (reward.type === 'mastery') {
    player.mastery += reward.amount;
    run.lastRewardLog = `무기 숙련 +${reward.amount}`;
  }

  if (reward.type === 'skill' || reward.type === 'skillLearn') {
    if (!player.skills.includes(reward.skillId)) player.skills.push(reward.skillId);
    if (!player.skillLevels[reward.skillId]) player.skillLevels[reward.skillId] = 1;
    if (reward.type === 'skillLearn') player.externalSkillCount = (player.externalSkillCount || 0) + 1;
    run.lastRewardLog = `스킬 습득: ${SKILLS[reward.skillId].name}`;
  }

  if (reward.type === 'skillLevel') {
    levelUpSkill(player, reward.skillId);
    run.lastRewardLog = `스킬 강화: ${SKILLS[reward.skillId].name} Lv.${player.skillLevels[reward.skillId]}`;
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


function getWeaponAgilityScales(weapon, stats, mastery, skillEffects, isPlayer) {
  const agi = stats.agi || 0;
  const moveBonus = Math.min(
    (weapon.maxMoveScale || 1.25) - 1,
    agi * (weapon.agiMoveScale || 0.006) + (skillEffects.moveSpeedBonus || 0)
  );
  const turnBonus = Math.min(
    (weapon.maxTurnScale || 1.28) - 1,
    agi * (weapon.agiTurnScale || 0.007)
  );
  const cooldownBonus = Math.min(
    weapon.maxCooldownBonus || (isPlayer ? 0.28 : 0.22),
    agi * (weapon.agiCooldownScale || 0.006) + mastery * (isPlayer ? 0.014 : 0.011) + (skillEffects.cooldownBonus || 0)
  );

  return {
    moveSpeedScale: 1 + moveBonus,
    turnSpeedScale: 1 + turnBonus,
    cooldownScale: 1 / (1 + cooldownBonus)
  };
}

function getDefaultSkillIds(weaponId, personalityId) {
  return [
    ...(WEAPON_SKILL_LOADOUTS[weaponId] || []),
    ...(PERSONALITY_SKILL_LOADOUTS[personalityId] || [])
  ];
}

function createInitialSkillLevels(skillIds) {
  return skillIds.reduce((levels, skillId) => {
    levels[skillId] = 1;
    return levels;
  }, {});
}

function getSkillLevel(player, skillId) {
  return player.skillLevels?.[skillId] || (player.skills?.includes(skillId) ? 1 : 0);
}

function levelUpSkill(player, skillId) {
  if (!player.skills.includes(skillId)) player.skills.push(skillId);
  player.skillLevels = player.skillLevels || createInitialSkillLevels(player.skills);
  const skill = SKILLS[skillId];
  const isExternal = skill?.source === 'personality' && skill.owner !== player.personalityId;
  const maxLevel = isExternal
    ? Math.min(REWARD_RULES.externalSkillMaxLevel || 2, skill?.maxLevel || 3)
    : (skill?.maxLevel || REWARD_RULES.skillMaxLevel || 3);
  player.skillLevels[skillId] = Math.min(maxLevel, (player.skillLevels[skillId] || 1) + 1);
}

function getLevelableOwnedSkills(player) {
  player.skillLevels = player.skillLevels || createInitialSkillLevels(player.skills);
  return player.skills.filter((skillId) => {
    const skill = SKILLS[skillId];
    if (!skill) return false;
    const isExternal = skill.source === 'personality' && skill.owner !== player.personalityId;
    const maxLevel = isExternal
      ? Math.min(REWARD_RULES.externalSkillMaxLevel || 2, skill.maxLevel || 3)
      : (skill.maxLevel || REWARD_RULES.skillMaxLevel || 3);
    return (player.skillLevels[skillId] || 1) < maxLevel;
  });
}

function getLearnableExternalPersonalitySkills(player) {
  if ((player.externalSkillCount || 0) >= (REWARD_RULES.externalSkillLimit || 2)) return [];
  return Object.keys(SKILLS).filter((skillId) => {
    const skill = SKILLS[skillId];
    if (!skill || skill.source !== 'personality') return false;
    if (skill.owner === player.personalityId) return false;
    return !player.skills.includes(skillId);
  });
}

function collectSkillEffects(skillIds, skillLevels = {}) {
  return skillIds.reduce((effects, skillId) => {
    const skill = SKILLS[skillId];
    if (!skill?.effects) return effects;
    const level = skillLevels?.[skillId] || 1;
    const scale = 1 + (level - 1) * 0.45;
    Object.entries(skill.effects).forEach(([key, value]) => {
      effects[key] = (effects[key] || 0) + value * scale;
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
