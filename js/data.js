// data.js
// 프로젝트의 순수 데이터만 관리합니다.
// 수정 원칙: 무기·성격 수치 변경은 이 파일에서 직접 수정합니다. 패치 블록을 추가하지 않습니다.

export const VERSION = '0.1.0';

export const WEAPONS = {
  spear: {
    id: 'spear',
    name: '창',
    color: '#cda2ff',
    range: 112,
    minRange: 54,
    idealRange: 92,
    arc: 0.26,
    damage: 15,
    cooldown: 66,
    windup: 15,
    recovery: 22,
    moveSpeed: 2.55,
    knockback: 15,
    description: '긴 사거리와 직선 찌르기가 강하지만 안쪽으로 파고든 적에게 약합니다.'
  },
  western: {
    id: 'western',
    name: '서양검',
    color: '#8fd0ff',
    range: 72,
    minRange: 12,
    idealRange: 58,
    arc: 1.26,
    damage: 19,
    cooldown: 58,
    windup: 12,
    recovery: 24,
    moveSpeed: 2.72,
    knockback: 11,
    description: '넓은 베기로 정면 교전이 강하지만 후딜이 있습니다.'
  },
  eastern: {
    id: 'eastern',
    name: '동양검',
    color: '#ffe18f',
    range: 58,
    minRange: 6,
    idealRange: 43,
    arc: 0.86,
    damage: 12,
    cooldown: 31,
    windup: 6,
    recovery: 10,
    moveSpeed: 3.08,
    knockback: 7,
    description: '빠른 진입과 연속 공격이 강한 무기입니다.'
  },
  dagger: {
    id: 'dagger',
    name: '단검',
    color: '#b8ff8f',
    range: 42,
    minRange: 0,
    idealRange: 28,
    arc: 0.58,
    damage: 8,
    cooldown: 22,
    windup: 4,
    recovery: 8,
    moveSpeed: 3.28,
    knockback: 5,
    backBonus: 2.25,
    flankBonus: 1.45,
    description: '정면은 약하지만 측후방을 잡으면 강해지는 위치 선정 무기입니다.'
  }
};

export const PERSONALITIES = {
  balanced: {
    id: 'balanced',
    name: '밸런스형',
    aggression: 0.52,
    caution: 0.48,
    orbit: 0.55,
    description: '거리 조절과 공격을 적당히 섞습니다.'
  },
  aggressive: {
    id: 'aggressive',
    name: '공격형',
    aggression: 0.82,
    caution: 0.25,
    orbit: 0.28,
    description: '적을 빠르게 압박하고 먼저 공격하려 합니다.'
  },
  defensive: {
    id: 'defensive',
    name: '방어형',
    aggression: 0.35,
    caution: 0.82,
    orbit: 0.48,
    description: '체력이 낮거나 거리가 가까우면 먼저 빠집니다.'
  },
  assassin: {
    id: 'assassin',
    name: '암살자형',
    aggression: 0.64,
    caution: 0.52,
    orbit: 0.9,
    description: '정면 교전보다 측후방 진입을 노립니다.'
  }
};

export const BASE_STATS = {
  maxHp: 120,
  attack: 1,
  defense: 0.08,
  evasion: 0.05,
  crit: 0.08
};
