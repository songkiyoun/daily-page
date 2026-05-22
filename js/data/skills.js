// skills.js
// data.js에서 분리된 순수 데이터 모듈입니다.

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
  westernCaliburnCharge: {
    id: 'westernCaliburnCharge',
    name: '돌격자세',
    source: 'weaponEvolution',
    owner: 'western',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 1500,
    description: '칼리번 전용. 적에게 다가가 좁은 범위로 강하게 찌릅니다. 반드시 치명타이며 준비 중 방어력이 오릅니다.'
  },
  westernExcaliburBeam: {
    id: 'westernExcaliburBeam',
    name: '승리의 검',
    source: 'weaponEvolution',
    owner: 'western',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 2100,
    description: '엑스칼리버 전용. 짧게 기를 모은 뒤 일직선 빛의 검기를 뿜습니다. 준비 중 방어력이 오릅니다.'
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
    source: 'weaponEvolution',
    owner: 'eastern',
    type: 'evolutionFollowUp',
    maxLevel: 1,
    cooldown: 920,
    description: '달인의 검 전용. 기본 공격 명중 후 추가 베기를 이어갑니다.'
  },
  easternAnnihilation: {
    id: 'easternAnnihilation',
    name: '섬멸',
    source: 'weaponEvolution',
    owner: 'eastern',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 1900,
    description: '무신의 검 전용. 발도술을 연속으로 발동하듯 상대를 관통하며 베어냅니다. 반드시 치명타입니다.'
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
  spearPierce: {
    id: 'spearPierce',
    name: '꿰뚫어라',
    source: 'weaponEvolution',
    owner: 'spear',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 1600,
    description: '용기사의 창 전용. 빠르고 강하게 찌른 뒤 무기를 휘둘러 적을 크게 밀어냅니다. 반드시 치명타입니다.'
  },
  spearLuBu: {
    id: 'spearLuBu',
    name: '여포강림',
    source: 'weaponEvolution',
    owner: 'spear',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 2200,
    description: '고룡창 전용. 연속 찌르기를 여러 번 몰아친 뒤 적을 크게 넉백시킵니다.'
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
  daggerAssassinate: {
    id: 'daggerAssassinate',
    name: '암살',
    source: 'weaponEvolution',
    owner: 'dagger',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 1600,
    description: '흑랑아 전용. 적의 측면 또는 측후면으로 연속 이동하며 여러 번 찌릅니다. 반드시 치명타입니다.'
  },
  daggerCloneTechnique: {
    id: 'daggerCloneTechnique',
    name: '분신술',
    source: 'weaponEvolution',
    owner: 'dagger',
    type: 'evolutionAttack',
    maxLevel: 1,
    cooldown: 2400,
    description: '혈랑아 전용. 일정 시간 동안 낮은 능력치의 분신을 소환해 함께 공격하게 합니다.'
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

export const WEAPON_EVOLUTION_SKILL_LOADOUTS = {
  western: [
    { stageNumber: 4, skillId: 'westernCaliburnCharge' },
    { stageNumber: 5, skillId: 'westernExcaliburBeam' }
  ],
  eastern: [
    { stageNumber: 4, skillId: 'easternComboSlash' },
    { stageNumber: 5, skillId: 'easternAnnihilation' }
  ],
  spear: [
    { stageNumber: 4, skillId: 'spearPierce' },
    { stageNumber: 5, skillId: 'spearLuBu' }
  ],
  dagger: [
    { stageNumber: 4, skillId: 'daggerAssassinate' },
    { stageNumber: 5, skillId: 'daggerCloneTechnique' }
  ]
};

export const PERSONALITY_SKILL_LOADOUTS = {
  aggressive: ['aggressiveBestDefense', 'aggressiveFullPower', 'aggressiveBerserker'],
  defensive: ['defensiveGuardStance', 'defensiveReflect', 'defensiveLightArmor'],
  balanced: ['balancedAttackStance', 'balancedDefenseStance', 'balancedCentering'],
  assassin: ['assassinOneStrike', 'assassinInstantKill', 'assassinShadowMove']
};
