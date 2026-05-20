// data.js
// 프로젝트의 순수 데이터만 관리합니다.
// 수정 원칙: 무기·성격·스탯·스킬·층 스케일링 수치 변경은 이 파일에서 직접 수정합니다. 패치 블록을 추가하지 않습니다.

export const VERSION = '0.7.24';

export const WEAPONS = {
  spear: {
    id: 'spear',
    name: '창',
    color: '#cda2ff',
    range: 120,
    minRange: 60,
    idealRange: 104,
    neutralBuffer: 22,
    attackStartBuffer: 28,
    hitReachBonus: 8,
    arc: 0.24,
    damage: 15,
    cooldown: 74,
    windup: 17,
    recovery: 30,
    activeFrames: 5,
    missRecoveryAdd: 9,
    impactStopFrames: 5,
    swingVisualArc: 0.14,
    windupDriftScale: 0.42,
    activeLungeScale: 1.96,
    recoveryMoveScale: 1.24,
    turnSpeed: 0.048,
    windupTurnScale: 0.4,
    activeTurnScale: 0.17,
    recoveryTurnScale: 0.17,
    shakenTurnScale: 0.4,
    feintResponseTurnScale: 0.42,
    hitRecoveryScale: 0.82,
    failRecoveryScale: 1.3,
    postureDamage: 23,
    parryEfficiency: 0.36,
    parryBreak: 0.1,
    moveSpeed: 2.42,
    agiMoveScale: 0.0048,
    agiTurnScale: 0.0052,
    agiCooldownScale: 0.0046,
    maxMoveScale: 1.18,
    maxTurnScale: 1.2,
    knockback: 22,
    hitKnockback: 66,
    hitPostureScale: 1.02,
    selfRetreatOnHit: 0.12,
    parryKnockbackTaken: 1.68,
    clashKnockbackScale: 1.46,
    crit: 0.03,
    description: '긴 사거리와 직선 찌르기가 강하지만 안쪽으로 파고든 적에게 약합니다.',
    identity: '거리 재설정',
    identityNote: '맞히면 상대를 크게 밀어 다시 창 사거리를 만든다. 패링당하면 크게 흔들리고 회복이 느리다.',
    closePushScale: 1.62,
    staggerRecoveryPenalty: 1.42,
    parryRecoveryPenalty: 1.42,
    comboOnHit: 0,
    hitStunFrames: 2,
    feintStrength: 0.08,
    movementStyle: 'keepaway',
    strafeWeight: 0.44,
    approachOffset: 0.18,
    flankBias: 0.2,
    lungePower: 1.52,
    entryForward: 1.68,
    entrySide: 0.1,
    recoveryBackstep: 0.92
  },
  western: {
    id: 'western',
    name: '서양검',
    color: '#8fd0ff',
    range: 73,
    minRange: 14,
    idealRange: 63,
    neutralBuffer: 15,
    attackStartBuffer: 18,
    hitReachBonus: 4,
    arc: 0.9,
    damage: 19,
    cooldown: 70,
    windup: 15,
    recovery: 36,
    activeFrames: 8,
    missRecoveryAdd: 8,
    impactStopFrames: 5,
    swingVisualArc: 1.34,
    windupDriftScale: 0.54,
    activeLungeScale: 1.24,
    recoveryMoveScale: 1.08,
    turnSpeed: 0.038,
    windupTurnScale: 0.54,
    activeTurnScale: 0.25,
    recoveryTurnScale: 0.32,
    shakenTurnScale: 0.58,
    feintResponseTurnScale: 0.48,
    hitRecoveryScale: 0.96,
    failRecoveryScale: 1.12,
    postureDamage: 24,
    parryEfficiency: 0.58,
    parryBreak: 0.1,
    moveSpeed: 2.38,
    agiMoveScale: 0.0038,
    agiTurnScale: 0.004,
    agiCooldownScale: 0.0042,
    maxMoveScale: 1.14,
    maxTurnScale: 1.14,
    knockback: 13,
    hitKnockback: 25,
    hitPostureScale: 1.42,
    selfRetreatOnHit: 0.36,
    parryKnockbackTaken: 1.32,
    clashKnockbackScale: 1.32,
    crit: 0.06,
    description: '넓은 베기로 정면 교전이 강하지만 후딜이 있습니다.',
    identity: '자세 붕괴',
    identityNote: '상대를 멀리 날리기보다 내 공격 범위 안에서 자세를 크게 무너뜨린다.',
    closePushScale: 1.08,
    staggerRecoveryPenalty: 1.04,
    parryRecoveryPenalty: 0.9,
    riposteOnParry: true,
    riposteCooldownScale: 0.46,
    parryFrontArcScale: 1.18,
    parryReachScale: 1.18,
    closeGuardVsDagger: true,
    closeGuardPostureScale: 1.06,
    comboOnHit: 0,
    hitStunFrames: 5,
    feintStrength: 0.12,
    movementStyle: 'angled_slash',
    strafeWeight: 0.62,
    approachOffset: 0.56,
    flankBias: 0.48,
    lungePower: 0.94,
    entryForward: 1.12,
    entrySide: 0.22,
    recoveryBackstep: 0.58
  },
  eastern: {
    id: 'eastern',
    name: '동양검',
    color: '#ffe18f',
    range: 59,
    minRange: 7,
    idealRange: 46,
    neutralBuffer: 12,
    attackStartBuffer: 17,
    hitReachBonus: 4,
    arc: 0.82,
    damage: 12,
    cooldown: 43,
    windup: 8,
    recovery: 19,
    activeFrames: 4,
    missRecoveryAdd: 4,
    impactStopFrames: 3,
    swingVisualArc: 1.18,
    windupDriftScale: 0.86,
    activeLungeScale: 1.38,
    recoveryMoveScale: 0.96,
    turnSpeed: 0.104,
    windupTurnScale: 0.76,
    activeTurnScale: 0.46,
    recoveryTurnScale: 0.58,
    shakenTurnScale: 0.82,
    feintResponseTurnScale: 0.82,
    hitRecoveryScale: 0.9,
    failRecoveryScale: 1.04,
    postureDamage: 12,
    parryEfficiency: 0.42,
    parryBreak: 0.02,
    moveSpeed: 3.08,
    agiMoveScale: 0.0066,
    agiTurnScale: 0.0076,
    agiCooldownScale: 0.0058,
    maxMoveScale: 1.28,
    maxTurnScale: 1.32,
    knockback: 8,
    hitKnockback: 14,
    hitPostureScale: 0.9,
    selfRetreatOnHit: 0.55,
    parryKnockbackTaken: 1.08,
    clashKnockbackScale: 1.04,
    crit: 0.1,
    description: '짧게 자세를 잡고 앞으로 베어 지나가는 발도 돌파가 강한 무기입니다.',
    identity: '발도 돌파',
    identityNote: '순간적으로 선을 긋듯 베고 적을 관통해 뒤쪽으로 빠져나간다.',
    closePushScale: 0.86,
    staggerRecoveryPenalty: 0.88,
    parryRecoveryPenalty: 0.82,
    riposteOnParry: true,
    glancingSlipVsHeavy: true,
    glancingSlipChance: 0.13,
    comboOnHit: 2,
    comboCooldownScale: 0.72,
    hitStunFrames: 2,
    feintStrength: 0.52,
    movementStyle: 'hit_and_run',
    strafeWeight: 0.82,
    approachOffset: 0.86,
    flankBias: 0.7,
    lungePower: 1.08,
    entryForward: 1.26,
    entrySide: 0.38,
    recoveryBackstep: 0.48
  },
  dagger: {
    id: 'dagger',
    name: '단검',
    color: '#b8ff8f',
    range: 43,
    minRange: 0,
    idealRange: 33,
    neutralBuffer: 12,
    attackStartBuffer: 18,
    hitReachBonus: 3,
    arc: 0.54,
    damage: 8,
    cooldown: 24,
    windup: 5,
    recovery: 10,
    activeFrames: 3,
    missRecoveryAdd: 3,
    impactStopFrames: 2,
    swingVisualArc: 0.54,
    windupDriftScale: 1.12,
    activeLungeScale: 1.72,
    recoveryMoveScale: 1.18,
    turnSpeed: 0.196,
    windupTurnScale: 0.88,
    activeTurnScale: 0.58,
    recoveryTurnScale: 0.86,
    shakenTurnScale: 1.12,
    feintResponseTurnScale: 1,
    hitRecoveryScale: 0.78,
    failRecoveryScale: 0.96,
    postureDamage: 10,
    parryEfficiency: 0.24,
    parryBreak: -0.03,
    flankPostureBonus: 1.65,
    backPostureBonus: 1.16,
    moveSpeed: 3.72,
    agiMoveScale: 0.0082,
    agiTurnScale: 0.0095,
    agiCooldownScale: 0.0066,
    maxMoveScale: 1.38,
    maxTurnScale: 1.44,
    knockback: 5,
    hitKnockback: 6,
    hitPostureScale: 0.82,
    selfRetreatOnHit: 4.75,
    parryKnockbackTaken: 1.06,
    clashKnockbackScale: 0.96,
    crit: 0.18,
    backBonus: 1.18,
    flankBonus: 1.45,
    description: '정면은 약하지만 측후방을 잡으면 강해지는 위치 선정 무기입니다.',
    identity: '측후방 암살',
    identityNote: '좌우 페이크로 측후방을 찌르고 짧은 스턴 후 크게 이탈한다.',
    closePushScale: 0.72,
    staggerRecoveryPenalty: 0.78,
    parryRecoveryPenalty: 0.74,
    flankStunFrames: 12,
    comboOnHit: 0,
    hitStunFrames: 6,
    feintStrength: 3.05,
    movementStyle: 'flank',
    strafeWeight: 1.42,
    approachOffset: 1.62,
    flankBias: 1.48,
    lungePower: 1.36,
    entryForward: 1.34,
    entrySide: 1.36,
    recoveryBackstep: 1.28
  }
};


export const WEAPON_GRADES = [
  { id: 'common', name: '일반', order: 0 },
  { id: 'advanced', name: '고급', order: 1 },
  { id: 'rare', name: '희귀', order: 2 },
  { id: 'hero', name: '영웅', order: 3 },
  { id: 'legendary', name: '전설', order: 4 },
  { id: 'mythic', name: '신화', order: 5 },
  { id: 'awakened', name: '각성', order: 6 }
];

export const WEAPON_EVOLUTIONS = {
  western: [
    { id: 'oldLongsword', name: '낡은 롱소드', description: '서양검 진화의 첫 단계입니다.' },
    { id: 'sharpLongsword', name: '날카로운 롱소드', description: '낡은 롱소드보다 날이 선 서양검입니다.' },
    { id: 'knightLongsword', name: '나이트 롱소드', description: '기사의 전투 방식에 맞춰 다듬어진 서양검입니다.' },
    { id: 'caliburn', name: '칼리번', description: '전설의 서양검 계보로 이어지는 강력한 검입니다.' },
    { id: 'excalibur', name: '엑스칼리버', description: '서양검 진화의 최종 단계로 사용할 예정입니다.' }
  ],
  eastern: [
    { id: 'rustyIronSword', name: '녹슨 철검', description: '동양검 진화의 첫 단계입니다.' },
    { id: 'sharpIronSword', name: '날카로운 철검', description: '녹슨 철검보다 날이 선 동양검입니다.' },
    { id: 'warriorSword', name: '무사의 검', description: '무사의 전투 흐름에 맞춰 다듬어진 검입니다.' },
    { id: 'masterSword', name: '달인의 검', description: '숙련된 검사의 연속 베기를 담는 검입니다.' },
    { id: 'martialGodSword', name: '무신의 검', description: '동양검 진화의 최종 단계로 사용할 예정입니다.' }
  ],
  spear: [
    { id: 'woodenStick', name: '나무막대기', description: '창 진화의 첫 단계입니다.' },
    { id: 'edgedSpear', name: '날선 창', description: '끝이 날카롭게 다듬어진 창입니다.' },
    { id: 'knightSpear', name: '기사의 창', description: '기사가 사용하는 균형 잡힌 창입니다.' },
    { id: 'dragonKnightSpear', name: '용기사의 창', description: '강한 돌파력과 위압감을 가진 창입니다.' },
    { id: 'ancientDragonSpear', name: '고룡창', description: '창 진화의 최종 단계로 사용할 예정입니다.' }
  ],
  dagger: [
    { id: 'oldDagger', name: '낡은 단검', description: '단검 진화의 첫 단계입니다.' },
    { id: 'thiefDagger', name: '도둑의 단검', description: '빠른 기습에 어울리는 단검입니다.' },
    { id: 'assassinDagger', name: '어쌔신의 단검', description: '암살자의 측면 침투에 맞춰 다듬어진 단검입니다.' },
    { id: 'blackWolfFang', name: '흑랑아', description: '검은 늑대의 송곳니처럼 날카로운 단검입니다.' },
    { id: 'bloodWolfFang', name: '혈랑아', description: '단검 진화의 최종 단계로 사용할 예정입니다.' }
  ]
};


export const PERSONALITIES = {
  balanced: {
    id: 'balanced',
    name: '밸런스형',
    aggression: 0.52,
    caution: 0.5,
    orbit: 0.55,
    rangeScale: 1,
    retreatHpRatio: 0.3,
    flankPreference: 0.52,
    pressure: 0.55,
    attackBonus: 0,
    defenseBonus: 0,
    evasionBonus: 0,
    critBonus: 0,
    parryBonus: 0.04,
    moveSpeedScale: 1,
    turnSpeedScale: 1,
    cooldownScale: 1,
    postureMaxScale: 1,
    knockbackDealtScale: 1,
    knockbackTakenScale: 1,
    postureDamageDealtScale: 1,
    postureDamageTakenScale: 1,
    description: '공격과 방어, 거리 운영이 모두 평균적인 기준 성격입니다.',
    weaponIdentityScale: 1,
    feintScale: 1,
    comboScale: 1,
    closePushScale: 1,
    counterScale: 1
  },
  aggressive: {
    id: 'aggressive',
    name: '공격형',
    aggression: 0.84,
    caution: 0.22,
    orbit: 0.34,
    rangeScale: 0.92,
    retreatHpRatio: 0.16,
    flankPreference: 0.36,
    pressure: 0.88,
    attackBonus: 0.08,
    defenseBonus: -0.035,
    evasionBonus: -0.01,
    critBonus: 0.01,
    parryBonus: -0.07,
    moveSpeedScale: 1.03,
    turnSpeedScale: 1.02,
    cooldownScale: 0.9,
    postureMaxScale: 0.94,
    knockbackDealtScale: 1.16,
    knockbackTakenScale: 1.06,
    postureDamageDealtScale: 1.08,
    postureDamageTakenScale: 1.07,
    description: '공격력, 공격 속도, 밀쳐내기가 좋아지지만 방어와 패링 안정성이 낮아집니다.',
    weaponIdentityScale: 1.08,
    feintScale: 1.02,
    comboScale: 1.12,
    closePushScale: 1.12,
    counterScale: 0.82
  },
  defensive: {
    id: 'defensive',
    name: '방어형',
    aggression: 0.34,
    caution: 0.8,
    orbit: 0.46,
    rangeScale: 1.1,
    retreatHpRatio: 0.42,
    flankPreference: 0.42,
    pressure: 0.34,
    attackBonus: -0.1,
    defenseBonus: 0.065,
    evasionBonus: -0.004,
    critBonus: -0.005,
    parryBonus: 0.13,
    moveSpeedScale: 0.96,
    turnSpeedScale: 0.96,
    cooldownScale: 1.14,
    postureMaxScale: 1.12,
    knockbackDealtScale: 0.9,
    knockbackTakenScale: 0.84,
    postureDamageDealtScale: 0.88,
    postureDamageTakenScale: 0.88,
    description: '공격 템포는 낮지만 방어, 패링, 밀림 저항, 자세 안정성이 높습니다.',
    weaponIdentityScale: 0.98,
    feintScale: 0.82,
    comboScale: 0.74,
    closePushScale: 1.08,
    counterScale: 1.32
  },
  assassin: {
    id: 'assassin',
    name: '암살형',
    aggression: 0.62,
    caution: 0.5,
    orbit: 0.98,
    rangeScale: 0.86,
    retreatHpRatio: 0.22,
    flankPreference: 1.08,
    pressure: 0.6,
    attackBonus: 0.02,
    defenseBonus: -0.045,
    evasionBonus: 0.045,
    critBonus: 0.055,
    parryBonus: -0.02,
    moveSpeedScale: 1.12,
    turnSpeedScale: 1.12,
    cooldownScale: 0.94,
    postureMaxScale: 0.9,
    knockbackDealtScale: 0.92,
    knockbackTakenScale: 1.18,
    postureDamageDealtScale: 1.04,
    postureDamageTakenScale: 1.14,
    description: '이동, 회전, 측후방 진입, 치명타가 좋아지지만 방어와 밀림 저항이 낮습니다.',
    weaponIdentityScale: 1.04,
    feintScale: 1.36,
    comboScale: 0.96,
    closePushScale: 0.9,
    counterScale: 1.04
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
  staggerMoveScale: 0.12,
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
  daggerFlankPressureFrames: 26,
  daggerFlankTurnScale: 0.32,
  daggerBurstCooldownFrames: 17,
  daggerSideCommitLockFrames: 18,
  parryBaseChance: 0.08,
  parryMaxChance: 0.62,
  parryFrontArc: 0.82,
  parryCooldownFrames: 36,
  parryFlashFrames: 14,
  parryPostureDamage: 21,
  parryRecoveryAddFrames: 12,
  parryKnockback: 4.85,
  weaponClashKnockback: 4.15,
  preciseHitKnockbackBonus: 0.48,
  counterWindowFrames: 34,
  counterDamageBonus: 1.08,
  counterPostureBonus: 1.16,
  eventTextFrames: 36,
  eventTextCooldownFrames: 24,
  daggerFeintFrames: 42,
  daggerCutFrames: 15,
  daggerResetFrames: 24,
  daggerCutTurnLagFrames: 44,
  easternComboWindowFrames: 24,
  easternComboMax: 2,
  riposteWindowFrames: 38
};

export const SKILLS = {
  westernBash: {
    id: 'westernBash',
    name: '베쉬',
    source: 'weapon',
    owner: 'western',
    type: 'attack',
    maxLevel: 3,
    cooldown: 720,
    description: '서양검 전용. 더 넓고 묵직한 베기로 피해와 자세 피해를 조금 높입니다.'
  },
  westernLastStand: {
    id: 'westernLastStand',
    name: '기사회생',
    source: 'weapon',
    owner: 'western',
    type: 'survival',
    maxLevel: 3,
    cooldown: 9999,
    description: '서양검 전용. 전투당 1회, 죽음에 이르는 피해를 버티고 체력을 약간 회복합니다.'
  },
  westernKnightInstinct: {
    id: 'westernKnightInstinct',
    name: '기사의 직감',
    source: 'weapon',
    owner: 'western',
    type: 'passive',
    maxLevel: 3,
    cooldown: 1200,
    description: '서양검 전용. 측후면 공격을 감지하면 상대 방향으로 몸을 돌리고 짧게 밀어냅니다.'
  },

  easternIaiSlash: {
    id: 'easternIaiSlash',
    name: '발도술',
    source: 'weapon',
    owner: 'eastern',
    type: 'attack',
    maxLevel: 3,
    cooldown: 980,
    description: '동양검 전용. 앞으로 빠르게 나아가며 베고, 적을 관통해 뒤쪽으로 지나갑니다.'
  },
  easternComboSlash: {
    id: 'easternComboSlash',
    name: '연속베기',
    source: 'weapon',
    owner: 'eastern',
    type: 'evolution',
    maxLevel: 3,
    cooldown: 1200,
    description: '동양검 후반 강화/진화 후보입니다. 기본 장착 스킬에서는 제외하고 무신연참 계열로 확장할 예정입니다.'
  },
  easternMindFocus: {
    id: 'easternMindFocus',
    name: '정신합일',
    source: 'weapon',
    owner: 'eastern',
    type: 'survival',
    maxLevel: 3,
    cooldown: 1200,
    description: '동양검 전용. 자세 게이지가 낮을 때 자세를 일부 회복합니다.'
  },
  easternBambooStance: {
    id: 'easternBambooStance',
    name: '대나무의 자세',
    source: 'weapon',
    owner: 'eastern',
    type: 'passive',
    maxLevel: 3,
    cooldown: 1200,
    description: '동양검 전용. 일정 간격으로 공격을 유연하게 흘려 피해와 자세 피해를 줄입니다.'
  },

  spearDoubleThrust: {
    id: 'spearDoubleThrust',
    name: '연속 찌르기',
    source: 'weapon',
    owner: 'spear',
    type: 'attack',
    maxLevel: 3,
    cooldown: 1200,
    description: '창 전용. 찌르기 명중 후 낮은 피해의 추가 찌르기를 시도합니다.'
  },
  spearFocus: {
    id: 'spearFocus',
    name: '집중',
    source: 'weapon',
    owner: 'spear',
    type: 'survival',
    maxLevel: 3,
    cooldown: 780,
    description: '창 전용. 자세가 흔들렸을 때 집중해 자세를 회복하고 창끝을 다시 상대에게 맞춥니다.'
  },
  spearSweep: {
    id: 'spearSweep',
    name: '벤다!',
    source: 'weapon',
    owner: 'spear',
    type: 'passive',
    maxLevel: 3,
    cooldown: 980,
    description: '창 전용. 적이 너무 가까이 붙으면 창을 휘둘러 약한 피해와 밀어내기를 줍니다.'
  },

  daggerVitalStrike: {
    id: 'daggerVitalStrike',
    name: '급소 찌르기',
    source: 'weapon',
    owner: 'dagger',
    type: 'attack',
    maxLevel: 3,
    cooldown: 620,
    description: '단검 전용. 측면 또는 후면 찌르기 1회를 확정 치명타로 만듭니다.'
  },
  daggerDecoyDoll: {
    id: 'daggerDecoyDoll',
    name: '분신 인형',
    source: 'weapon',
    owner: 'dagger',
    type: 'survival',
    maxLevel: 3,
    cooldown: 980,
    description: '단검 전용. 큰 피해를 받을 때 피해를 줄이고 상대 측후면으로 빠져나갑니다.'
  },
  daggerHighSpeed: {
    id: 'daggerHighSpeed',
    name: '고속이동',
    source: 'weapon',
    owner: 'dagger',
    type: 'passive',
    maxLevel: 3,
    cooldown: 1200,
    description: '단검 전용. 공격 기회를 잡을 때 짧은 시간 이동 속도가 증가합니다.'
  },

  aggressiveBestDefense: {
    id: 'aggressiveBestDefense',
    name: '최선의 방어',
    source: 'personality',
    owner: 'aggressive',
    type: 'passive',
    maxLevel: 3,
    description: '공격형. 방어력을 낮추고 공격력을 올립니다.',
    effects: { attackBonus: 0.008, defenseBonus: -0.004 }
  },
  aggressiveFullPower: {
    id: 'aggressiveFullPower',
    name: '혼신의 힘',
    source: 'personality',
    owner: 'aggressive',
    type: 'passive',
    maxLevel: 3,
    description: '공격형. 회피율을 낮추고 이동 속도를 올립니다.',
    effects: { moveSpeedBonus: 0.012, evasionBonus: -0.006 }
  },
  aggressiveBerserker: {
    id: 'aggressiveBerserker',
    name: '버서커',
    source: 'personality',
    owner: 'aggressive',
    type: 'passive',
    maxLevel: 3,
    description: '공격형. 체력이 낮을 때 방어를 희생하고 공격력을 올립니다.',
    effects: { lowHpAttackBonus: 0.025, lowHpDefenseBonus: -0.01 }
  },

  defensiveGuardStance: {
    id: 'defensiveGuardStance',
    name: '방어자세',
    source: 'personality',
    owner: 'defensive',
    type: 'passive',
    maxLevel: 3,
    description: '방어형. 공격력과 이동속도를 낮추고 방어력을 올립니다.',
    effects: { attackBonus: -0.008, defenseBonus: 0.014, moveSpeedBonus: -0.006 }
  },
  defensiveReflect: {
    id: 'defensiveReflect',
    name: '피해반사',
    source: 'personality',
    owner: 'defensive',
    type: 'passive',
    maxLevel: 3,
    cooldown: 1800,
    description: '방어형. 받은 체력 피해 일부를 적에게 되돌립니다.'
  },
  defensiveLightArmor: {
    id: 'defensiveLightArmor',
    name: '경량무장',
    source: 'personality',
    owner: 'defensive',
    type: 'passive',
    maxLevel: 3,
    description: '방어형. 방어력을 낮추고 이동 속도를 올립니다.',
    effects: { defenseBonus: -0.008, moveSpeedBonus: 0.014 }
  },

  balancedAttackStance: {
    id: 'balancedAttackStance',
    name: '공격자세',
    source: 'personality',
    owner: 'balanced',
    type: 'passive',
    maxLevel: 3,
    description: '밸런스형. 방어력을 소폭 낮추고 공격력을 소폭 올립니다.',
    effects: { attackBonus: 0.008, defenseBonus: -0.004 }
  },
  balancedDefenseStance: {
    id: 'balancedDefenseStance',
    name: '방어자세',
    source: 'personality',
    owner: 'balanced',
    type: 'passive',
    maxLevel: 3,
    description: '밸런스형. 공격력을 소폭 낮추고 방어력을 소폭 올립니다.',
    effects: { attackBonus: -0.004, defenseBonus: 0.008 }
  },
  balancedCentering: {
    id: 'balancedCentering',
    name: '중심잡기',
    source: 'personality',
    owner: 'balanced',
    type: 'survival',
    maxLevel: 3,
    cooldown: 1200,
    description: '밸런스형. 자세 게이지가 낮을 때 자세를 일부 회복합니다.'
  },

  assassinOneStrike: {
    id: 'assassinOneStrike',
    name: '일격필살',
    source: 'personality',
    owner: 'assassin',
    type: 'passive',
    maxLevel: 3,
    description: '암살형. 방어력을 크게 낮추고 공격력과 이동속도를 올립니다.',
    effects: { attackBonus: 0.018, moveSpeedBonus: 0.012, defenseBonus: -0.014 }
  },
  assassinInstantKill: {
    id: 'assassinInstantKill',
    name: '즉살',
    source: 'personality',
    owner: 'assassin',
    type: 'passive',
    maxLevel: 3,
    description: '암살형. 방어력을 낮추고 치명타 확률과 치명 피해량을 올립니다.',
    effects: { critBonus: 0.014, critDamageBonus: 0.04, defenseBonus: -0.012 }
  },
  assassinShadowMove: {
    id: 'assassinShadowMove',
    name: '그림자이동',
    source: 'personality',
    owner: 'assassin',
    type: 'survival',
    maxLevel: 3,
    cooldown: 1200,
    description: '암살형. 자세가 낮을 때 뒤로 빠지며 자세를 일부 회복합니다.'
  }
};

export const WEAPON_SKILL_LOADOUTS = {
  western: ['westernBash', 'westernLastStand', 'westernKnightInstinct'],
  eastern: ['easternIaiSlash', 'easternMindFocus', 'easternBambooStance'],
  spear: ['spearDoubleThrust', 'spearFocus', 'spearSweep'],
  dagger: ['daggerVitalStrike', 'daggerDecoyDoll', 'daggerHighSpeed']
};

export const PERSONALITY_SKILL_LOADOUTS = {
  aggressive: ['aggressiveBestDefense', 'aggressiveFullPower', 'aggressiveBerserker'],
  defensive: ['defensiveGuardStance', 'defensiveReflect', 'defensiveLightArmor'],
  balanced: ['balancedAttackStance', 'balancedDefenseStance', 'balancedCentering'],
  assassin: ['assassinOneStrike', 'assassinInstantKill', 'assassinShadowMove']
};



export const SHOP_RULES = {
  initialGold: 260,
  statPointPrice: 70,
  weaponGradeBasePrice: 150,
  weaponGradePriceStep: 75,
  weaponStageBasePrice: 190,
  weaponStagePriceStep: 95
};

export const REWARD_RULES = {
  choices: 3,
  statAmount: 2,
  rareStatPoints: 2,
  heroStatAmount: 3,
  heroStatPoints: 3,
  masteryAmount: 1,
  skillMaxLevel: 3,
  externalSkillLimit: 2,
  externalSkillMaxLevel: 2,
  bonusStatPoints: 1,
  baseExp: 44,
  expPerFloor: 7,
  normalGoldMin: 32,
  normalGoldMax: 68,
  normalExpMin: 24,
  normalExpMax: 48,
  rarityWeights: {
    normal: 68,
    rare: 24,
    hero: 7,
    legendary: 1
  }
};

export const REWARD_RARITIES = {
  normal: { id: 'normal', name: '일반' },
  rare: { id: 'rare', name: '희귀' },
  hero: { id: 'hero', name: '영웅' },
  legendary: { id: 'legendary', name: '전설' }
};

export const REWARD_TRAITS = {
  glassCannon: {
    id: 'glassCannon',
    name: '유리대포',
    rarity: 'rare',
    description: '공격력이 크게 오르지만 방어 안정성이 낮아집니다.',
    effects: { attackBonus: 0.18, defenseBonus: -0.045 }
  },
  giantForm: {
    id: 'giantForm',
    name: '거인화',
    rarity: 'rare',
    description: '최대 체력이 증가하지만 회피율이 낮아집니다.',
    effects: { maxHpBonus: 0.1, evasionBonus: -0.018 }
  },
  cursedSword: {
    id: 'cursedSword',
    name: '저주받은 검',
    rarity: 'rare',
    description: '공격력이 오르지만 치명타 확률이 낮아집니다.',
    effects: { attackBonus: 0.075, critBonus: -0.03 }
  },
  nimbleFootwork: {
    id: 'nimbleFootwork',
    name: '날렵한 발놀림',
    rarity: 'rare',
    description: '이동속도가 오르지만 최대 체력이 조금 낮아집니다.',
    effects: { moveSpeedBonus: 0.08, maxHpBonus: -0.05 }
  },
  heavyArmor: {
    id: 'heavyArmor',
    name: '무거운 갑옷',
    rarity: 'rare',
    description: '방어력이 오르지만 이동속도가 낮아집니다.',
    effects: { defenseBonus: 0.032, moveSpeedBonus: -0.06 }
  },
  gambler: {
    id: 'gambler',
    name: '승부사',
    rarity: 'rare',
    description: '치명타 확률이 오르지만 방어력이 낮아집니다.',
    effects: { critBonus: 0.05, defenseBonus: -0.025 }
  },
  focusedTraining: {
    id: 'focusedTraining',
    name: '집중 훈련',
    rarity: 'rare',
    description: '공격 회전이 조금 좋아지지만 최대 체력이 낮아집니다.',
    effects: { cooldownBonus: -0.05, maxHpBonus: -0.05 }
  },
  ironWill: {
    id: 'ironWill',
    name: '강철 의지',
    rarity: 'rare',
    description: '자세 게이지가 증가하지만 공격 회전이 조금 느려집니다.',
    effects: { postureBonus: 0.1, cooldownBonus: 0.04 }
  },
  battleSense: {
    id: 'battleSense',
    name: '전투 감각',
    rarity: 'hero',
    description: '치명타 확률과 회피율이 함께 오릅니다.',
    effects: { critBonus: 0.04, evasionBonus: 0.024 }
  },
  trainedPosture: {
    id: 'trainedPosture',
    name: '숙련된 자세',
    rarity: 'hero',
    description: '자세 게이지가 크게 증가하고 자세 안정성이 좋아집니다.',
    effects: { postureBonus: 0.12, postureTakenBonus: -0.035 }
  },
  weaponUnderstanding: {
    id: 'weaponUnderstanding',
    name: '무기 이해',
    rarity: 'hero',
    description: '무기 숙련과 무기 스킬 성장을 함께 노립니다.',
    effects: {}
  },
  personalityReinforcement: {
    id: 'personalityReinforcement',
    name: '성격 강화',
    rarity: 'hero',
    description: '성격 스킬 성장과 추가 스탯 포인트를 함께 노립니다.',
    effects: {}
  }
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
