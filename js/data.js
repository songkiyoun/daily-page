// data.js
// 프로젝트의 순수 데이터만 관리합니다.
// 수정 원칙: 무기·성격·스탯·스킬·층 스케일링 수치 변경은 이 파일에서 직접 수정합니다. 패치 블록을 추가하지 않습니다.

export const VERSION = '0.5.1';

export const WEAPONS = {
  spear: {
    id: 'spear',
    name: '창',
    color: '#cda2ff',
    range: 112,
    minRange: 58,
    idealRange: 96,
    neutralBuffer: 18,
    attackStartBuffer: 23,
    hitReachBonus: 2,
    arc: 0.26,
    damage: 15,
    cooldown: 66,
    windup: 15,
    recovery: 28,
    activeFrames: 5,
    missRecoveryAdd: 8,
    impactStopFrames: 5,
    swingVisualArc: 0.18,
    windupDriftScale: 0.36,
    activeLungeScale: 1.52,
    recoveryMoveScale: 1.12,
    turnSpeed: 0.052,
    windupTurnScale: 0.5,
    activeTurnScale: 0.22,
    recoveryTurnScale: 0.28,
    postureDamage: 22,
    parryEfficiency: 0.36,
    parryBreak: 0.1,
    moveSpeed: 2.55,
    knockback: 15,
    crit: 0.03,
    description: '긴 사거리와 직선 찌르기가 강하지만 안쪽으로 파고든 적에게 약합니다.',
    movementStyle: 'keepaway',
    strafeWeight: 0.44,
    approachOffset: 0.18,
    flankBias: 0.2,
    lungePower: 1.18,
    recoveryBackstep: 0.74
  },
  western: {
    id: 'western',
    name: '서양검',
    color: '#8fd0ff',
    range: 74,
    minRange: 12,
    idealRange: 61,
    neutralBuffer: 13,
    attackStartBuffer: 15,
    hitReachBonus: 4,
    arc: 1.08,
    damage: 19,
    cooldown: 58,
    windup: 12,
    recovery: 31,
    activeFrames: 8,
    missRecoveryAdd: 7,
    impactStopFrames: 5,
    swingVisualArc: 1.8,
    windupDriftScale: 0.48,
    activeLungeScale: 1.08,
    recoveryMoveScale: 1.15,
    turnSpeed: 0.07,
    windupTurnScale: 0.58,
    activeTurnScale: 0.28,
    recoveryTurnScale: 0.34,
    postureDamage: 20,
    parryEfficiency: 0.46,
    parryBreak: 0.08,
    moveSpeed: 2.72,
    knockback: 11,
    crit: 0.06,
    description: '넓은 베기로 정면 교전이 강하지만 후딜이 있습니다.',
    movementStyle: 'angled_slash',
    strafeWeight: 0.62,
    approachOffset: 0.56,
    flankBias: 0.48,
    lungePower: 0.86,
    recoveryBackstep: 0.52
  },
  eastern: {
    id: 'eastern',
    name: '동양검',
    color: '#ffe18f',
    range: 59,
    minRange: 6,
    idealRange: 44,
    neutralBuffer: 10,
    attackStartBuffer: 13,
    hitReachBonus: 4,
    arc: 0.88,
    damage: 12,
    cooldown: 31,
    windup: 6,
    recovery: 13,
    activeFrames: 4,
    missRecoveryAdd: 4,
    impactStopFrames: 3,
    swingVisualArc: 1.28,
    windupDriftScale: 0.72,
    activeLungeScale: 1.22,
    recoveryMoveScale: 0.92,
    turnSpeed: 0.118,
    windupTurnScale: 0.72,
    activeTurnScale: 0.42,
    recoveryTurnScale: 0.52,
    postureDamage: 13,
    parryEfficiency: 0.42,
    parryBreak: 0.02,
    moveSpeed: 3.08,
    knockback: 7,
    crit: 0.1,
    description: '빠른 진입과 연속 공격이 강한 무기입니다.',
    movementStyle: 'hit_and_run',
    strafeWeight: 0.82,
    approachOffset: 0.86,
    flankBias: 0.7,
    lungePower: 1.0,
    recoveryBackstep: 0.42
  },
  dagger: {
    id: 'dagger',
    name: '단검',
    color: '#b8ff8f',
    range: 43,
    minRange: 0,
    idealRange: 31,
    neutralBuffer: 9,
    attackStartBuffer: 14,
    hitReachBonus: 3,
    arc: 0.58,
    damage: 8,
    cooldown: 22,
    windup: 4,
    recovery: 9,
    activeFrames: 3,
    missRecoveryAdd: 3,
    impactStopFrames: 2,
    swingVisualArc: 0.62,
    windupDriftScale: 0.82,
    activeLungeScale: 1.48,
    recoveryMoveScale: 0.8,
    turnSpeed: 0.162,
    windupTurnScale: 0.82,
    activeTurnScale: 0.52,
    recoveryTurnScale: 0.62,
    postureDamage: 10,
    parryEfficiency: 0.24,
    parryBreak: -0.03,
    flankPostureBonus: 1.65,
    backPostureBonus: 2.25,
    moveSpeed: 3.38,
    knockback: 5,
    crit: 0.18,
    backBonus: 2.25,
    flankBonus: 1.45,
    description: '정면은 약하지만 측후방을 잡으면 강해지는 위치 선정 무기입니다.',
    movementStyle: 'flank',
    strafeWeight: 1.08,
    approachOffset: 1.25,
    flankBias: 1.18,
    lungePower: 1.24,
    recoveryBackstep: 1.18
  }
};

export const PERSONALITIES = {
  balanced: {
    id: 'balanced',
    name: '밸런스형',
    aggression: 0.52,
    caution: 0.48,
    orbit: 0.55,
    rangeScale: 1,
    retreatHpRatio: 0.28,
    flankPreference: 0.52,
    pressure: 0.55,
    parryBonus: 0.04,
    defenseBonus: 0.01,
    description: '거리 조절과 공격을 적당히 섞습니다.'
  },
  aggressive: {
    id: 'aggressive',
    name: '공격형',
    aggression: 0.82,
    caution: 0.25,
    orbit: 0.28,
    rangeScale: 0.9,
    retreatHpRatio: 0.16,
    flankPreference: 0.34,
    pressure: 0.86,
    parryBonus: -0.03,
    attackBonus: 0.06,
    description: '적을 빠르게 압박하고 먼저 공격하려 합니다.'
  },
  defensive: {
    id: 'defensive',
    name: '방어형',
    aggression: 0.35,
    caution: 0.82,
    orbit: 0.48,
    rangeScale: 1.13,
    retreatHpRatio: 0.44,
    flankPreference: 0.44,
    pressure: 0.32,
    parryBonus: 0.13,
    defenseBonus: 0.04,
    description: '낮은 체력에서는 거리를 재정렬하고, 오래 밀리면 측면 견제와 반격으로 전환합니다.'
  },
  assassin: {
    id: 'assassin',
    name: '암살자형',
    aggression: 0.64,
    caution: 0.52,
    orbit: 0.96,
    rangeScale: 0.86,
    retreatHpRatio: 0.26,
    flankPreference: 1,
    pressure: 0.58,
    parryBonus: 0.02,
    evasionBonus: 0.035,
    critBonus: 0.04,
    description: '정면 교전보다 측후방 진입을 노립니다.'
  }
};

export const STAT_KEYS = ['str', 'vit', 'def', 'agi', 'luck'];

export const STAT_LABELS = {
  str: '힘',
  vit: '체력',
  def: '방어',
  agi: '민첩',
  luck: '행운'
};

export const STAT_DESCRIPTIONS = {
  str: '공격력과 약간의 최대 체력 상승',
  vit: '최대 체력 상승',
  def: '받는 피해 감소',
  agi: '이동, 공격 회전, 회피 상승',
  luck: '치명타와 회피 소폭 상승'
};

export const PLAYER_START_STATS = {
  str: 5,
  vit: 5,
  def: 5,
  agi: 5,
  luck: 5
};

export const PLAYER_START_STAT_POINTS = 10;

export const BASE_STATS = {
  maxHp: 110,
  defenseCap: 0.46,
  evasionCap: 0.38,
  critCap: 0.62
};


export const POSTURE_RULES = {
  baseMax: 100,
  defenseToMax: 5,
  vitalityToMax: 2,
  levelToMax: 2,
  enemyFloorToMax: 2,
  recoveryDelayFrames: 96,
  recoveryPerFrame: 0.22,
  staggerFrames: 52,
  staggerPostureRestoreRatio: 0.42,
  staggerDamageTakenBonus: 1.12,
  staggerMoveScale: 0.08,
  minPostureDamage: 3,
  impactTurnMin: 0.18,
  impactTurnMax: 0.78,
  impactTurnPostureScale: 0.011,
  staggerFacingTwist: 0.92,
  retreatMaxFrames: 38,
  retreatLockoutFrames: 42,
  closeResetCooldown: 30,
  closeResetPostureDamage: 17,
  weaponClashCooldown: 24,
  weaponClashPostureDamage: 11,
  daggerFlankPressureFrames: 14,
  daggerFlankTurnScale: 0.46,
  daggerBurstCooldownFrames: 22,
  parryBaseChance: 0.08,
  parryMaxChance: 0.62,
  parryFrontArc: 0.82,
  parryCooldownFrames: 36,
  parryFlashFrames: 14,
  parryPostureDamage: 21,
  parryRecoveryAddFrames: 12,
  parryKnockback: 2.4,
  counterWindowFrames: 34,
  counterDamageBonus: 1.08,
  counterPostureBonus: 1.16
};

export const SKILLS = {
  ironSkin: {
    id: 'ironSkin',
    name: '철갑 감각',
    description: '방어력이 증가합니다.',
    effects: { defenseBonus: 0.045 }
  },
  quickStep: {
    id: 'quickStep',
    name: '순간 회피',
    description: '회피율과 이동 속도가 증가합니다.',
    effects: { evasionBonus: 0.045, moveSpeedBonus: 0.06 }
  },
  battleFocus: {
    id: 'battleFocus',
    name: '전투 집중',
    description: '치명타 확률이 증가합니다.',
    effects: { critBonus: 0.07 }
  },
  weaponMaster: {
    id: 'weaponMaster',
    name: '무기 숙련',
    description: '공격력과 공격 회전이 함께 좋아집니다.',
    effects: { attackBonus: 0.07, cooldownBonus: 0.06 }
  },
  survival: {
    id: 'survival',
    name: '생존 본능',
    description: '체력이 낮을 때 받는 피해가 줄어듭니다.',
    effects: { lowHpDefenseBonus: 0.09 }
  },
  execution: {
    id: 'execution',
    name: '결정타 감각',
    description: '치명타 피해량이 증가합니다.',
    effects: { critDamageBonus: 0.22 }
  }
};

export const REWARD_RULES = {
  choices: 3,
  statAmount: 1,
  masteryAmount: 1,
  bonusStatPoints: 1,
  baseExp: 44,
  expPerFloor: 7
};

export const TOWER_RULES = {
  startFloor: 1,
  hpGrowthPerFloor: 0.12,
  damageGrowthPerFloor: 0.075,
  defenseGrowthPerFloor: 0.006,
  maxEnemyDefense: 0.28,
  bossInterval: 10
};

export const ENEMY_NAMES = [
  'RAVEN',
  'KAIN',
  'MIRA',
  'BLADE',
  'ONYX',
  'NOVA',
  'ASH',
  'VEGA',
  'ZERO',
  'RYU',
  'LUNA',
  'CROW'
];
