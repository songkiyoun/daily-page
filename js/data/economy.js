// economy.js
// data.js에서 분리된 순수 데이터 모듈입니다.

export const SHOP_RULES = {
  initialGold: 260,
  statPointPrice: 70,
  weaponGradeBasePrice: 150,
  weaponGradePriceStep: 75,
  weaponStageBasePrice: 190,
  weaponStagePriceStep: 95,
  masteryPrice: 90,
  personalityBoostBasePrice: 130,
  personalityBoostPriceStep: 90,
  personalityBoostMaxLevel: 3,
  rewardChoicePrice: 180,
  highRewardChanceBasePrice: 140,
  highRewardChancePriceStep: 85,
  highRewardRareWeightBonus: 6,
  highRewardHeroWeightBonus: 2,
  victoryGoldBoostPrice: 160,
  victoryGoldBoostScale: 0.1,
  expBoostPrice: 160,
  expBoostScale: 0.1
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
  baseExp: 70,
  expPerFloor: 12,
  levelUpStatPoints: 5,
  victoryGoldBase: 24,
  victoryGoldPerFloor: 6,
  normalGoldMin: 32,
  normalGoldMax: 68,
  normalExpMin: 36,
  normalExpMax: 72,
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
    description: '무기 운용 이해도가 올라 공격 준비와 기본 공격 효율이 좋아집니다.',
    effects: { attackBonus: 0.015, cooldownBonus: -0.015 }
  },
  personalityReinforcement: {
    id: 'personalityReinforcement',
    name: '성격 강화',
    rarity: 'hero',
    description: '현재 성격의 장점을 고르게 끌어올립니다.',
    effects: { maxHpBonus: 0.012, attackBonus: 0.012, defenseBonus: 0.008, evasionBonus: 0.006, critBonus: 0.006, postureBonus: 0.01 }
  }
};
