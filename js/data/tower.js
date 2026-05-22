// tower.js
// data.js에서 분리된 순수 데이터 모듈입니다.

export const TOWER_RULES = {
  startFloor: 1,
  hpGrowthPerFloor: 0.072,
  damageGrowthPerFloor: 0.044,
  defenseGrowthPerFloor: 0.0035,
  maxEnemyDefense: 0.23,
  bossInterval: 10,
  bossSoulReward: 1,
  bossMasteryReward: 1,
  bossLevelUpReward: 1,
  bossGoldBase: 80,
  bossGoldPerFloor: 8,
  bossStoneBaseMin: 0,
  bossStoneBaseMax: 3
};

export const BOSS_PROFILES = [
  {
    id: 'callon',
    floorCycle: 1,
    name: '방랑기사 Callon',
    title: '방랑기사',
    weaponId: 'western',
    personalityId: 'defensive',
    weaponGrade: 'rare',
    weaponEvolution: 'caliburn',
    weaponEnhancement: 2,
    skills: ['westernBash', 'westernLastStand', 'westernKnightInstinct', 'westernCaliburnCharge', 'defensiveGuardStance'],
    statBonus: { str: 2, vit: 4, def: 4, agi: 0, luck: 1 },
    tuning: { hpScale: 1.16, postureScale: 1.18, attackScale: 1.04, defenseBonus: 0.025, evasionBonus: -0.015, critBonus: 0 },
    description: '정면 교전에 강한 기사형 보스입니다. 보스 전용 패턴으로 플레이어 위치에 심판의 일격을 내려찍습니다.',
    pattern: '심판의 일격 · 방어 · 반격',
    introLine: '이 탑을 오를 자격이 있는지, 내 검으로 판결하겠다.',
    defeatLine: '좋다. 네 의지는 검보다 단단하군.',
    phaseLine: '판결은 아직 끝나지 않았다. 이 일격부터 견뎌 보아라.',
    bossSkill: { id: 'callonJudgement', name: '심판의 일격', cooldown: 330, telegraph: 64, radius: 82, damageScale: 1.58, phase2: { label: '대심판의 일격', radiusScale: 1.32, damageScaleBonus: 0.16, cooldownScale: 0.7 } }
  },
  {
    id: 'archer',
    floorCycle: 2,
    name: '선봉장 Archer',
    title: '선봉장',
    weaponId: 'spear',
    personalityId: 'aggressive',
    weaponGrade: 'rare',
    weaponEvolution: 'dragonKnightSpear',
    weaponEnhancement: 2,
    skills: ['spearDoubleThrust', 'spearFocus', 'spearSweep', 'spearPierce', 'aggressiveFullPower'],
    statBonus: { str: 3, vit: 2, def: 1, agi: 4, luck: 1 },
    tuning: { hpScale: 1.08, postureScale: 1.06, attackScale: 1.1, defenseBonus: 0.005, evasionBonus: 0.025, critBonus: 0.01 },
    description: '긴 사거리와 속도로 거리를 잡는 선봉장 보스입니다. 보스 전용 패턴으로 긴 직선 관통 공격을 사용합니다.',
    pattern: '선봉 관통창 · 거리 유지 · 밀어내기',
    introLine: '선봉은 물러서지 않는다. 네 걸음을 여기서 멈추겠다.',
    defeatLine: '대열이 무너졌군. 다음 길은 네 것이다.',
    phaseLine: '선봉은 무너지지 않는다. 두 번째 창끝을 받아라.',
    bossSkill: { id: 'archerVanguardPierce', name: '선봉 관통창', cooldown: 305, telegraph: 56, width: 48, length: 420, damageScale: 1.34, phase2: { label: '선봉 쌍관통창', widthScale: 1.12, lengthScale: 1.08, damageScaleBonus: 0.1, cooldownScale: 0.68, doubleStrike: true } }
  },
  {
    id: 'arbiter',
    floorCycle: 3,
    name: '무신의 기억 Arbiter',
    title: '무신의 기억',
    weaponId: 'eastern',
    personalityId: 'balanced',
    weaponGrade: 'hero',
    weaponEvolution: 'martialGodSword',
    weaponEnhancement: 3,
    skills: ['easternIaiSlash', 'easternMindFocus', 'easternBambooStance', 'easternComboSlash', 'easternAnnihilation', 'balancedCentering'],
    statBonus: { str: 3, vit: 3, def: 2, agi: 4, luck: 2 },
    tuning: { hpScale: 1.12, postureScale: 1.1, attackScale: 1.12, defenseBonus: 0.012, evasionBonus: 0.018, critBonus: 0.015 },
    description: '발도와 연속 베기를 연결하는 검사형 보스입니다. 보스 전용 패턴으로 넓은 검압을 터뜨립니다.',
    pattern: '무신의 검압 · 발도 돌파 · 섬멸',
    introLine: '기억뿐인 몸이라도, 검의 끝은 아직 살아 있다.',
    defeatLine: '무신의 기억을 넘어섰다면, 더 높은 곳을 보아라.',
    phaseLine: '이제 기억이 아니라, 무신의 잔향을 상대해라.',
    bossSkill: { id: 'arbiterWarGodPressure', name: '무신의 검압', cooldown: 318, telegraph: 60, radius: 118, damageScale: 1.42, phase2: { label: '무신의 대검압', radiusScale: 1.22, damageScaleBonus: 0.14, cooldownScale: 0.66 } }
  },
  {
    id: 'death',
    floorCycle: 0,
    name: '죽음인도자 Death',
    title: '죽음인도자',
    weaponId: 'dagger',
    personalityId: 'assassin',
    weaponGrade: 'legendary',
    weaponEvolution: 'bloodWolfFang',
    weaponEnhancement: 4,
    skills: ['daggerVitalStrike', 'daggerDecoyDoll', 'daggerHighSpeed', 'daggerAssassinate', 'daggerCloneTechnique', 'assassinInstantKill'],
    statBonus: { str: 4, vit: 2, def: 0, agi: 5, luck: 4 },
    tuning: { hpScale: 1.04, postureScale: 0.98, attackScale: 1.18, defenseBonus: -0.005, evasionBonus: 0.04, critBonus: 0.035 },
    description: '측후면을 노리는 암살형 보스입니다. 보스 전용 패턴으로 죽음의 표식을 남긴 뒤 지연 피해를 줍니다.',
    pattern: '죽음의 표식 · 암살 · 분신술',
    introLine: '그림자가 닿는 순간, 네 생명은 이미 내 손에 있다.',
    defeatLine: '죽음도 붙잡지 못한 자라... 흥미롭군.',
    phaseLine: '그림자가 짙어졌다. 이제 표식은 피할 수 없다.',
    bossSkill: { id: 'deathMark', name: '죽음의 표식', cooldown: 292, telegraph: 88, radius: 72, damageScale: 1.52, phase2: { label: '사신의 표식', radiusScale: 1.18, damageScaleBonus: 0.18, cooldownScale: 0.68, shadowFollowUp: true } }
  }
];


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
