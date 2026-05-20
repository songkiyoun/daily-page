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
  REWARD_RARITIES,
  REWARD_TRAITS,
  SHOP_RULES,
  SKILLS,
  WEAPON_SKILL_LOADOUTS,
  PERSONALITY_SKILL_LOADOUTS,
  STAT_KEYS,
  TOWER_RULES,
  WEAPONS,
  WEAPON_EVOLUTIONS,
  WEAPON_GRADES
} from './data.js';
import { clamp, randomInt, randomSign, sample } from './utils.js';

export function getWeaponGrowthInfo(player) {
  const grade = WEAPON_GRADES.find((item) => item.id === (player.weaponGrade || 'common')) || WEAPON_GRADES[0];
  const nextGrade = WEAPON_GRADES.find((item) => item.order === grade.order + 1) || null;
  const options = getWeaponEvolutionOptions(player.weaponId);
  const evolutionIndex = options.findIndex((item) => item.id === player.weaponEvolution);
  const currentIndex = evolutionIndex >= 0 ? evolutionIndex : 0;
  const currentStage = options[currentIndex] || null;
  const nextStage = currentIndex < options.length - 1 ? options[currentIndex + 1] : null;

  return {
    grade,
    nextGrade,
    isMaxGrade: !nextGrade,
    evolution: evolutionIndex >= 0 ? options[evolutionIndex] : null,
    options,
    currentStage,
    nextStage,
    currentStageNumber: currentStage ? currentIndex + 1 : 0,
    nextStageNumber: nextStage ? currentIndex + 2 : null,
    currentStageText: currentStage ? `${currentIndex + 1}단계 : ${currentStage.name}` : '단계 없음',
    isEvolutionActive: evolutionIndex >= 0,
    isMaxStage: !nextStage
  };
}

function getWeaponEvolutionOptions(weaponId) {
  return [...(WEAPON_EVOLUTIONS[weaponId] || [])];
}

function getWeaponGradeEffects(unit) {
  const growth = getWeaponGrowthInfo(unit);
  const order = growth.grade?.order || 0;

  return {
    attackBonus: order * 0.02,
    postureBonus: order * 0.012
  };
}

function getWeaponStageEffects(unit) {
  const growth = getWeaponGrowthInfo(unit);
  const stageStep = Math.max(0, (growth.currentStageNumber || 1) - 1);
  const effects = {
    attackBonus: 0,
    postureDamageBonus: 0,
    reachBonus: 0,
    critBonus: 0,
    cooldownBonus: 0,
    turnSpeedBonus: 0,
    easternFlowBonus: 0,
    flankDamageBonus: 0
  };

  if (stageStep <= 0) return effects;

  if (unit.weaponId === 'western') {
    effects.attackBonus = stageStep * 0.01;
    effects.postureDamageBonus = stageStep * 0.018;
  }

  if (unit.weaponId === 'eastern') {
    effects.cooldownBonus = -stageStep * 0.008;
    effects.turnSpeedBonus = stageStep * 0.01;
    effects.easternFlowBonus = stageStep * 0.035;
  }

  if (unit.weaponId === 'spear') {
    effects.reachBonus = stageStep * 2;
    effects.postureDamageBonus = stageStep * 0.016;
  }

  if (unit.weaponId === 'dagger') {
    effects.critBonus = stageStep * 0.01;
    effects.flankDamageBonus = stageStep * 0.018;
  }

  return effects;
}

function upgradeWeaponGrade(player, amount = 1) {
  const growth = getWeaponGrowthInfo(player);
  if (growth.isMaxGrade) return growth.grade;

  const targetOrder = Math.min((growth.grade?.order || 0) + amount, WEAPON_GRADES[WEAPON_GRADES.length - 1].order);
  const nextGrade = WEAPON_GRADES.find((item) => item.order === targetOrder) || growth.grade;
  player.weaponGrade = nextGrade.id;
  return nextGrade;
}

function upgradeWeaponStage(player, amount = 1) {
  const growth = getWeaponGrowthInfo(player);
  if (growth.isMaxStage || !growth.options.length) return growth.currentStage;

  const currentIndex = Math.max(0, growth.currentStageNumber - 1);
  const targetIndex = Math.min(currentIndex + amount, growth.options.length - 1);
  const nextStage = growth.options[targetIndex] || growth.currentStage;
  player.weaponEvolution = nextStage?.id || null;
  return nextStage;
}

export function isPreTowerShopAvailable(run) {
  return !!run?.shop?.available && run.floor === TOWER_RULES.startFloor && run.victories === 0 && !!run.active;
}

function ensureShopState(run) {
  if (!run.shop) run.shop = {};
  run.shop.purchases = {
    rewardChoice: !!run.shop.purchases?.rewardChoice,
    victoryGoldBoost: !!run.shop.purchases?.victoryGoldBoost,
    expBoost: !!run.shop.purchases?.expBoost
  };
  if (!run.player.shopBoosts) {
    run.player.shopBoosts = {
      rewardChoiceBonus: 0,
      highRewardPurchases: 0,
      victoryGoldBonus: 0,
      expBonus: 0,
      personalityBoostLevel: 0
    };
  }
  return run.shop;
}

function getShopBoosts(player) {
  return player?.shopBoosts || {
    rewardChoiceBonus: 0,
    highRewardPurchases: 0,
    victoryGoldBonus: 0,
    expBonus: 0,
    personalityBoostLevel: 0
  };
}

function getRewardChoiceCount(run) {
  const boost = getShopBoosts(run.player).rewardChoiceBonus || 0;
  return REWARD_RULES.choices + boost;
}

function getRewardRarityWeights(run, floor = run?.floor || TOWER_RULES.startFloor, extraHighRewardPurchases = 0) {
  const floorBonus = Math.max(0, floor - 1);
  const weights = { ...REWARD_RULES.rarityWeights };

  weights.hero += Math.floor(floorBonus / 5);
  weights.rare += Math.floor(floorBonus / 3);
  if (floor >= 5) weights.legendary += 1;
  if (floor >= 10) weights.legendary += 1;
  if (floor % TOWER_RULES.bossInterval === 0) {
    weights.rare += 12;
    weights.hero += 5;
    weights.legendary += 2;
  }

  const highRewardPurchases = (getShopBoosts(run.player).highRewardPurchases || 0) + extraHighRewardPurchases;
  weights.rare += highRewardPurchases * SHOP_RULES.highRewardRareWeightBonus;
  weights.hero += highRewardPurchases * SHOP_RULES.highRewardHeroWeightBonus;

  return weights;
}

function getAdvancedRewardChance(run, extraHighRewardPurchases = 0) {
  const weights = getRewardRarityWeights(run, run?.floor || TOWER_RULES.startFloor, extraHighRewardPurchases);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return ((weights.rare || 0) + (weights.hero || 0) + (weights.legendary || 0)) / total;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function getGoldRewardAmount(player, amount) {
  const bonus = getShopBoosts(player).victoryGoldBonus || 0;
  return Math.max(0, Math.round(amount * (1 + bonus)));
}

function getExpRewardAmount(player, amount) {
  const bonus = getShopBoosts(player).expBonus || 0;
  return Math.max(0, Math.round(amount * (1 + bonus)));
}

function getPersonalityBoostEffects(player) {
  const level = Math.min(SHOP_RULES.personalityBoostMaxLevel, getShopBoosts(player).personalityBoostLevel || 0);
  const effects = {
    maxHpBonus: 0,
    postureBonus: 0,
    attackBonus: 0,
    defenseBonus: 0,
    evasionBonus: 0,
    critBonus: 0,
    moveSpeedBonus: 0,
    cooldownBonus: 0,
    turnSpeedBonus: 0
  };
  if (level <= 0) return effects;

  if (player.personalityId === 'balanced') {
    effects.attackBonus = level * 0.012;
    effects.defenseBonus = level * 0.006;
    effects.evasionBonus = level * 0.004;
    effects.critBonus = level * 0.004;
    effects.postureBonus = level * 0.008;
  }

  if (player.personalityId === 'aggressive') {
    effects.attackBonus = level * 0.025;
    effects.cooldownBonus = -level * 0.012;
    effects.critBonus = level * 0.004;
  }

  if (player.personalityId === 'defensive') {
    effects.maxHpBonus = level * 0.01;
    effects.postureBonus = level * 0.02;
    effects.defenseBonus = level * 0.012;
  }

  if (player.personalityId === 'assassin') {
    effects.critBonus = level * 0.012;
    effects.evasionBonus = level * 0.01;
    effects.moveSpeedBonus = level * 0.008;
    effects.turnSpeedBonus = level * 0.008;
  }

  return effects;
}

export function getShopSummary(run) {
  if (!run?.player) return null;
  ensureShopState(run);
  const boosts = getShopBoosts(run.player);
  return {
    gold: run.player.gold || 0,
    available: isPreTowerShopAvailable(run),
    rewardChoices: getRewardChoiceCount(run),
    advancedRewardChance: formatPercent(getAdvancedRewardChance(run)),
    personalityBoostLevel: boosts.personalityBoostLevel || 0,
    highRewardPurchases: boosts.highRewardPurchases || 0,
    goldBonusPercent: Math.round((boosts.victoryGoldBonus || 0) * 100),
    expBonusPercent: Math.round((boosts.expBonus || 0) * 100),
    lastLog: run.lastRewardLog || ''
  };
}

export function getShopOffers(run) {
  if (!run?.player) return [];
  ensureShopState(run);
  const player = run.player;
  const boosts = getShopBoosts(player);
  const purchases = run.shop.purchases || {};
  const growth = getWeaponGrowthInfo(player);
  const gradePrice = SHOP_RULES.weaponGradeBasePrice + (growth.grade?.order || 0) * SHOP_RULES.weaponGradePriceStep;
  const stageStep = Math.max(0, (growth.currentStageNumber || 1) - 1);
  const stagePrice = SHOP_RULES.weaponStageBasePrice + stageStep * SHOP_RULES.weaponStagePriceStep;
  const personalityLevel = boosts.personalityBoostLevel || 0;
  const personalityPrice = SHOP_RULES.personalityBoostBasePrice + personalityLevel * SHOP_RULES.personalityBoostPriceStep;
  const highRewardPurchases = boosts.highRewardPurchases || 0;
  const highRewardPrice = SHOP_RULES.highRewardChanceBasePrice + highRewardPurchases * SHOP_RULES.highRewardChancePriceStep;
  const currentHighRewardChance = formatPercent(getAdvancedRewardChance(run));
  const nextHighRewardChance = formatPercent(getAdvancedRewardChance(run, 1));

  return [
    createShopOffer({
      id: 'statPoint',
      title: '스탯포인트 +1',
      description: '스탯포인트 +1. 좌측 스탯 설정에서 원하는 능력치에 배분할 수 있습니다.',
      price: SHOP_RULES.statPointPrice,
      disabled: false,
      disabledReason: ''
    }, player.gold),
    createShopOffer({
      id: 'weaponGradeUp',
      title: '무기 등급 강화',
      description: growth.isMaxGrade ? '이미 최고 등급입니다.' : `${growth.grade.name} → ${growth.nextGrade.name}`,
      price: gradePrice,
      disabled: growth.isMaxGrade,
      disabledReason: '이미 최고 등급입니다.'
    }, player.gold),
    createShopOffer({
      id: 'weaponStageUp',
      title: '무기 진화',
      description: growth.isMaxStage ? '이미 최종 단계입니다.' : `${growth.currentStage.name} → ${growth.nextStage.name}`,
      price: stagePrice,
      disabled: growth.isMaxStage,
      disabledReason: '이미 최종 단계입니다.'
    }, player.gold),
    createShopOffer({
      id: 'masteryUp',
      title: '무기 숙련도 +1',
      description: `현재 무기 숙련도 ${player.mastery || 0} → ${(player.mastery || 0) + 1}`,
      price: SHOP_RULES.masteryPrice,
      disabled: false,
      disabledReason: ''
    }, player.gold),
    createShopOffer({
      id: 'personalityBoost',
      title: '성격 강화',
      description: personalityLevel >= SHOP_RULES.personalityBoostMaxLevel ? '이미 최대 강화 단계입니다.' : `${PERSONALITIES[player.personalityId].name} 강화 Lv.${personalityLevel} → Lv.${personalityLevel + 1}`,
      price: personalityPrice,
      disabled: personalityLevel >= SHOP_RULES.personalityBoostMaxLevel,
      disabledReason: '이미 최대 강화 단계입니다.'
    }, player.gold),
    createShopOffer({
      id: 'rewardChoicePlus',
      title: '보상 선택지 +1',
      description: purchases.rewardChoice ? '구매 완료. 이번 런 보상 선택지가 1개 늘어났습니다.' : `이번 런 보상 선택지 ${REWARD_RULES.choices}개 → ${REWARD_RULES.choices + 1}개`,
      price: SHOP_RULES.rewardChoicePrice,
      disabled: purchases.rewardChoice,
      disabledReason: '한 번만 구매할 수 있습니다.'
    }, player.gold),
    createShopOffer({
      id: 'highRewardChanceUp',
      title: '고급보상 확률증가',
      description: `현재 희귀 이상 확률 ${currentHighRewardChance} → ${nextHighRewardChance}`,
      price: highRewardPrice,
      disabled: false,
      disabledReason: ''
    }, player.gold),
    createShopOffer({
      id: 'victoryGoldBoost',
      title: '승리골드 보상 +10%',
      description: purchases.victoryGoldBoost ? '구매 완료. 이번 런의 골드 보상 획득량이 증가했습니다.' : '이번 런의 골드 보상 획득량이 10% 증가합니다.',
      price: SHOP_RULES.victoryGoldBoostPrice,
      disabled: purchases.victoryGoldBoost,
      disabledReason: '한 번만 구매할 수 있습니다.'
    }, player.gold),
    createShopOffer({
      id: 'expBoost',
      title: '경험치 보상 +10%',
      description: purchases.expBoost ? '구매 완료. 이번 런의 경험치 보상 획득량이 증가했습니다.' : '이번 런의 경험치 보상 획득량이 10% 증가합니다.',
      price: SHOP_RULES.expBoostPrice,
      disabled: purchases.expBoost,
      disabledReason: '한 번만 구매할 수 있습니다.'
    }, player.gold)
  ];
}

function createShopOffer(offer, gold) {
  const notEnoughGold = (gold || 0) < offer.price;
  return {
    ...offer,
    disabled: offer.disabled || notEnoughGold,
    disabledReason: offer.disabled ? offer.disabledReason : (notEnoughGold ? '골드가 부족합니다.' : '')
  };
}

export function purchasePreTowerShopItem(run, itemId) {
  if (!isPreTowerShopAvailable(run)) return { ok: false, message: '상점은 탑에 오르기 전까지만 이용할 수 있습니다.' };
  ensureShopState(run);
  const offer = getShopOffers(run).find((item) => item.id === itemId);
  if (!offer) return { ok: false, message: '구매할 수 없는 상품입니다.' };
  if (offer.disabled) return { ok: false, message: offer.disabledReason || '구매할 수 없습니다.' };

  const player = run.player;
  const boosts = getShopBoosts(player);
  const purchases = run.shop.purchases;
  player.gold = Math.max(0, (player.gold || 0) - offer.price);

  if (itemId === 'statPoint') {
    player.statPoints += 1;
    run.lastRewardLog = '상점 구매: 스탯포인트 +1';
  }

  if (itemId === 'weaponGradeUp') {
    const before = getWeaponGrowthInfo(player).grade;
    const after = upgradeWeaponGrade(player, 1);
    run.lastRewardLog = `상점 구매: 무기 등급 ${before.name} → ${after.name}`;
  }

  if (itemId === 'weaponStageUp') {
    const before = getWeaponGrowthInfo(player).currentStage;
    const after = upgradeWeaponStage(player, 1);
    run.lastRewardLog = `상점 구매: 무기 단계 ${before.name} → ${after.name}`;
  }

  if (itemId === 'masteryUp') {
    player.mastery += 1;
    run.lastRewardLog = `상점 구매: 무기 숙련도 +1`;
  }

  if (itemId === 'personalityBoost') {
    boosts.personalityBoostLevel = Math.min(SHOP_RULES.personalityBoostMaxLevel, (boosts.personalityBoostLevel || 0) + 1);
    run.lastRewardLog = `상점 구매: ${PERSONALITIES[player.personalityId].name} 강화 Lv.${boosts.personalityBoostLevel}`;
  }

  if (itemId === 'rewardChoicePlus') {
    purchases.rewardChoice = true;
    boosts.rewardChoiceBonus = 1;
    run.lastRewardLog = `상점 구매: 보상 선택지 +1`;
  }

  if (itemId === 'highRewardChanceUp') {
    boosts.highRewardPurchases = (boosts.highRewardPurchases || 0) + 1;
    run.lastRewardLog = `상점 구매: 고급보상 확률증가 · 현재 ${formatPercent(getAdvancedRewardChance(run))}`;
  }

  if (itemId === 'victoryGoldBoost') {
    purchases.victoryGoldBoost = true;
    boosts.victoryGoldBonus = SHOP_RULES.victoryGoldBoostScale;
    run.lastRewardLog = `상점 구매: 승리골드 보상 +10%`;
  }

  if (itemId === 'expBoost') {
    purchases.expBoost = true;
    boosts.expBonus = SHOP_RULES.expBoostScale;
    run.lastRewardLog = `상점 구매: 경험치 보상 +10%`;
  }

  player.shopBoosts = boosts;
  healPlayerToFull(player);
  return { ok: true, message: run.lastRewardLog };
}

export function lockPreTowerShop(run) {
  if (!run?.shop) return;
  run.shop.available = false;
  run.shop.enteredTower = true;
}


export function createRun(config) {
  return {
    active: true,
    floor: TOWER_RULES.startFloor,
    bestFloor: TOWER_RULES.startFloor,
    victories: 0,
    pendingRewards: [],
    lastRewardLog: '',
    levelMessage: '',
    shop: {
      available: true,
      enteredTower: false,
      purchases: {
        rewardChoice: false,
        victoryGoldBoost: false,
        expBoost: false
      }
    },
    player: {
      name: 'PLAYER',
      weaponId: config.playerWeapon,
      personalityId: config.playerPersonality,
      level: 1,
      exp: 0,
      gold: Number.isFinite(config.startingGold) ? Math.max(0, Math.floor(config.startingGold)) : SHOP_RULES.initialGold,
      statPoints: PLAYER_START_STAT_POINTS,
      stats: { ...PLAYER_START_STATS },
      rewardTraits: [],
      shopBoosts: {
        rewardChoiceBonus: 0,
        highRewardPurchases: 0,
        victoryGoldBonus: 0,
        expBonus: 0,
        personalityBoostLevel: 0
      },
      weaponGrade: 'common',
      weaponEvolution: null,
      weaponEvolutionOptions: getWeaponEvolutionOptions(config.playerWeapon),
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
    visualEffects: [],
    screenShake: 0,
    camera: { x: 0, y: 0 },
    eventLocks: {},
    engagement: {
      defensiveMirrorStallFrames: 0,
      defensiveMirrorForceFrames: 0,
      lastPlayerHits: 0,
      lastEnemyHits: 0
    },
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

  const baseExpGain = REWARD_RULES.baseExp + run.floor * REWARD_RULES.expPerFloor;
  const expGain = getExpRewardAmount(run.player, baseExpGain);
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
  const rewardEffects = collectRewardEffects(player.rewardTraits);
  const gradeEffects = getWeaponGradeEffects(player);
  const stageEffects = getWeaponStageEffects(player);
  const personalityBoostEffects = getPersonalityBoostEffects(player);
  const stats = player.stats;

  const maxHp = Math.round((
    BASE_STATS.maxHp +
    stats.vit * 12 +
    stats.str * 2 +
    stats.def * 4 +
    player.level * 7
  ) * (1 + (rewardEffects.maxHpBonus || 0) + (personalityBoostEffects.maxHpBonus || 0)));

  const maxPosture = Math.round((
    POSTURE_RULES.baseMax +
    stats.def * POSTURE_RULES.defenseToMax +
    stats.vit * POSTURE_RULES.vitalityToMax +
    player.level * POSTURE_RULES.levelToMax
  ) * (personality.postureMaxScale || 1) * (1 + (rewardEffects.postureBonus || 0) + (gradeEffects.postureBonus || 0) + (personalityBoostEffects.postureBonus || 0)));

  const attackScale =
    1 +
    stats.str * 0.065 +
    stats.agi * 0.012 +
    player.mastery * 0.035 +
    (personality.attackBonus || 0) +
    (skillEffects.attackBonus || 0) +
    (rewardEffects.attackBonus || 0) +
    (personalityBoostEffects.attackBonus || 0) +
    (gradeEffects.attackBonus || 0) +
    (stageEffects.attackBonus || 0);

  const defense = clamp(
    0.035 +
    stats.def * 0.012 +
    stats.vit * 0.002 +
    (personality.defenseBonus || 0) +
    (skillEffects.defenseBonus || 0) +
    (rewardEffects.defenseBonus || 0) +
    (personalityBoostEffects.defenseBonus || 0),
    0,
    BASE_STATS.defenseCap
  );

  const evasion = clamp(
    0.025 +
    stats.agi * 0.007 +
    stats.luck * 0.002 +
    (personality.evasionBonus || 0) +
    (skillEffects.evasionBonus || 0) +
    (rewardEffects.evasionBonus || 0) +
    (personalityBoostEffects.evasionBonus || 0),
    0,
    BASE_STATS.evasionCap
  );

  const crit = clamp(
    weapon.crit +
    stats.luck * 0.008 +
    (personality.critBonus || 0) +
    (skillEffects.critBonus || 0) +
    (rewardEffects.critBonus || 0) +
    (personalityBoostEffects.critBonus || 0) +
    (stageEffects.critBonus || 0),
    0,
    BASE_STATS.critCap
  );

  const speedScales = getWeaponAgilityScales(weapon, stats, player.mastery, skillEffects, true);
  const moveSpeedScale = speedScales.moveSpeedScale * (personality.moveSpeedScale || 1) * (1 + (rewardEffects.moveSpeedBonus || 0) + (personalityBoostEffects.moveSpeedBonus || 0));
  const cooldownScale = speedScales.cooldownScale * (personality.cooldownScale || 1) * (1 + (rewardEffects.cooldownBonus || 0) + (stageEffects.cooldownBonus || 0) + (personalityBoostEffects.cooldownBonus || 0));
  const turnSpeedScale = speedScales.turnSpeedScale * (personality.turnSpeedScale || 1) * (1 + (stageEffects.turnSpeedBonus || 0) + (personalityBoostEffects.turnSpeedBonus || 0));
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
    lowHpDefenseBonus: skillEffects.lowHpDefenseBonus || 0,
    stagePostureDamageBonus: stageEffects.postureDamageBonus || 0,
    stageReachBonus: stageEffects.reachBonus || 0,
    easternFlowBonus: stageEffects.easternFlowBonus || 0,
    stageFlankDamageBonus: stageEffects.flankDamageBonus || 0,
    postureDamageTakenRewardScale: 1 + (rewardEffects.postureTakenBonus || 0)
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
    stagePostureDamageBonus: profile.stagePostureDamageBonus,
    stageReachBonus: profile.stageReachBonus,
    easternFlowBonus: profile.easternFlowBonus,
    stageFlankDamageBonus: profile.stageFlankDamageBonus,
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
    weaponGrade: enemyConfig.weaponGrade || 'common',
    weaponEvolution: enemyConfig.weaponEvolution || null,
    weaponEvolutionOptions: getWeaponEvolutionOptions(enemyConfig.weaponId),
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
    stagePostureDamageBonus: profile.stagePostureDamageBonus,
    stageReachBonus: profile.stageReachBonus,
    easternFlowBonus: profile.easternFlowBonus,
    stageFlankDamageBonus: profile.stageFlankDamageBonus,
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
  const weaponId = sample(weaponIds);
  const personalityId = sample(personalityIds);
  const skills = createEnemySkills(floor, isBossFloor, weaponId, personalityId);

  return {
    name: isBossFloor ? `BOSS ${ENEMY_NAMES[nameIndex]}` : ENEMY_NAMES[nameIndex],
    weaponId,
    personalityId,
    level: Math.max(1, floor),
    stats: createEnemyStats(floor, isBossFloor),
    skills,
    skillLevels: createEnemySkillLevels(skills, floor, isBossFloor),
    weaponGrade: 'common',
    weaponEvolution: null,
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
    weaponGrade: 'common',
    weaponEvolution: null,
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
  const gradeEffects = getWeaponGradeEffects(enemy);
  const stageEffects = getWeaponStageEffects(enemy);
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
    (personality.postureMaxScale || 1) *
    (1 + (gradeEffects.postureBonus || 0))
  );

  const attackScale =
    (1 +
    stats.str * 0.057 +
    stats.agi * 0.01 +
    enemy.mastery * 0.027 +
    floorIndex * TOWER_RULES.damageGrowthPerFloor * 0.32 +
    (personality.attackBonus || 0) +
    (skillEffects.attackBonus || 0) +
    (gradeEffects.attackBonus || 0) +
    (stageEffects.attackBonus || 0)) * bossMult;

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
    (skillEffects.critBonus || 0) +
    (stageEffects.critBonus || 0),
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
    cooldownScale: speedScales.cooldownScale * (personality.cooldownScale || 1) * (1 + (stageEffects.cooldownBonus || 0)),
    turnSpeedScale: speedScales.turnSpeedScale * (personality.turnSpeedScale || 1) * (1 + (stageEffects.turnSpeedBonus || 0)),
    critDamage: 1.5 + stats.luck * 0.004 + (skillEffects.critDamageBonus || 0),
    lowHpAttackBonus: skillEffects.lowHpAttackBonus || 0,
    lowHpDefenseBonus: skillEffects.lowHpDefenseBonus || 0,
    stagePostureDamageBonus: stageEffects.postureDamageBonus || 0,
    stageReachBonus: stageEffects.reachBonus || 0,
    easternFlowBonus: stageEffects.easternFlowBonus || 0,
    stageFlankDamageBonus: stageEffects.flankDamageBonus || 0
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

export function validateSkillLoadout(entity) {
  const expected = getDefaultSkillIds(entity.weaponId, entity.personalityId);
  const skills = entity.skills || [];
  const missing = expected.filter((skillId) => !skills.includes(skillId));
  const levels = entity.skillLevels || createInitialSkillLevels(skills);
  const missingLevels = skills.filter((skillId) => !levels[skillId]);
  return {
    expectedCount: expected.length,
    skillCount: skills.length,
    missing,
    missingLevels,
    valid: missing.length === 0 && missingLevels.length === 0
  };
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
  const usedIds = new Set();
  const usedFamilies = new Set();
  const choiceCount = getRewardChoiceCount(run);
  let guard = 0;

  while (rewards.length < choiceCount && guard < 100) {
    guard += 1;
    const rarity = rollRewardRarity(run);
    const reward = createRewardByRarity(run, rarity);
    const family = getRewardFamily(reward);

    if (!reward || usedIds.has(reward.id) || usedFamilies.has(family)) continue;
    usedIds.add(reward.id);
    usedFamilies.add(family);
    rewards.push(reward);
  }

  if (rewards.length < choiceCount) {
    getFallbackRewards(run).forEach((reward) => {
      const family = getRewardFamily(reward);
      if (rewards.length < choiceCount && reward && !usedIds.has(reward.id) && !usedFamilies.has(family)) {
        usedIds.add(reward.id);
        usedFamilies.add(family);
        rewards.push(reward);
      }
    });
  }

  return rewards.slice(0, choiceCount);
}

function getRewardFamily(reward) {
  if (!reward) return 'none';
  if (reward.type === 'stat') return `stat-${reward.statKey}`;
  if (reward.type === 'skillLevel' || reward.type === 'skillLevelMastery' || reward.type === 'skillLevelStatPoint') return 'skillLevel';
  if (reward.type === 'skillLearn') return 'skillLearn';
  if (reward.type === 'trait') return `trait-${reward.traitId}`;
  return reward.type;
}

function rollRewardRarity(run) {
  const weights = getRewardRarityWeights(run, run.floor);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;

  for (const rarity of ['normal', 'rare', 'hero', 'legendary']) {
    roll -= weights[rarity];
    if (roll <= 0) return rarity;
  }

  return 'normal';
}

function createRewardByRarity(run, rarity) {
  const factories = {
    normal: createNormalReward,
    rare: createRareReward,
    hero: createHeroReward,
    legendary: createLegendaryReward
  };

  const reward = factories[rarity]?.(run);
  if (reward) return reward;

  if (rarity === 'legendary') return createHeroReward(run) || createRareReward(run) || createNormalReward(run);
  if (rarity === 'hero') return createRareReward(run) || createNormalReward(run);
  if (rarity === 'rare') return createNormalReward(run);
  return null;
}

function createNormalReward(run) {
  const pool = [];
  const shuffledStats = [...STAT_KEYS].sort(() => Math.random() - 0.5);

  shuffledStats.forEach((statKey) => {
    pool.push({
      id: `normal-stat-${statKey}`,
      type: 'stat',
      rarity: 'normal',
      statKey,
      amount: REWARD_RULES.statAmount,
      title: `${statName(statKey)} 훈련`,
      description: `${statName(statKey)} +${REWARD_RULES.statAmount}`
    });
  });

  const crossSkills = getLearnableExternalPersonalitySkills(run.player);
  if (crossSkills.length > 0) {
    const skillId = sample(crossSkills);
    pool.push({
      id: `normal-skill-learn-${skillId}`,
      type: 'skillLearn',
      rarity: 'normal',
      skillId,
      title: `${SKILLS[skillId].name} 습득`,
      description: getShortSkillDescription(skillId)
    });
  }

  const levelable = getLevelableOwnedSkills(run.player);
  if (levelable.length > 0) {
    const skillId = sample(levelable);
    const nextLevel = (run.player.skillLevels?.[skillId] || 1) + 1;
    pool.push({
      id: `normal-skill-level-${skillId}`,
      type: 'skillLevel',
      rarity: 'normal',
      skillId,
      title: `${SKILLS[skillId].name} Lv.${nextLevel}`,
      description: `${getShortSkillDescription(skillId)} / 스킬 레벨 +1`
    });
  }

  const baseGold = randomInt(REWARD_RULES.normalGoldMin, REWARD_RULES.normalGoldMax);
  const gold = getGoldRewardAmount(run.player, baseGold);
  pool.push({
    id: `normal-gold-${baseGold}`,
    type: 'gold',
    rarity: 'normal',
    amount: gold,
    title: `골드 보상`,
    description: gold === baseGold ? `골드 +${gold}` : `골드 +${gold} / 기본 ${baseGold}`
  });

  const baseExp = randomInt(REWARD_RULES.normalExpMin, REWARD_RULES.normalExpMax);
  const exp = getExpRewardAmount(run.player, baseExp);
  pool.push({
    id: `normal-exp-${baseExp}`,
    type: 'exp',
    rarity: 'normal',
    amount: exp,
    title: `경험치 획득`,
    description: exp === baseExp ? `경험치 +${exp}` : `경험치 +${exp} / 기본 ${baseExp}`
  });

  return sample(pool);
}

function createRareReward(run) {
  const pool = [
    {
      id: 'rare-stat-points',
      type: 'statPoint',
      rarity: 'rare',
      amount: REWARD_RULES.rareStatPoints,
      title: `스탯포인트 +${REWARD_RULES.rareStatPoints}`,
      description: `스탯포인트 +${REWARD_RULES.rareStatPoints}`
    },
    {
      id: 'rare-mastery',
      type: 'mastery',
      rarity: 'rare',
      amount: REWARD_RULES.masteryAmount,
      title: `무기 숙련도 상승`,
      description: `무기 숙련도 +${REWARD_RULES.masteryAmount}`
    }
  ];

  Object.values(REWARD_TRAITS)
    .filter((trait) => trait.rarity === 'rare' && !run.player.rewardTraits?.includes(trait.id))
    .forEach((trait) => {
      pool.push({
        id: `rare-trait-${trait.id}`,
        type: 'trait',
        rarity: 'rare',
        traitId: trait.id,
        title: `${trait.name}`,
        description: describeTraitEffects(trait.id)
      });
    });

  return pool.length ? sample(pool) : createNormalReward(run);
}

function createHeroReward(run) {
  const pool = [];
  const shuffledStats = [...STAT_KEYS].sort(() => Math.random() - 0.5);

  shuffledStats.forEach((statKey) => {
    pool.push({
      id: `hero-stat-${statKey}`,
      type: 'stat',
      rarity: 'hero',
      statKey,
      amount: REWARD_RULES.heroStatAmount,
      title: `${statName(statKey)} 집중 훈련`,
      description: `${statName(statKey)} +${REWARD_RULES.heroStatAmount}`
    });
  });

  pool.push({
    id: 'hero-stat-points',
    type: 'statPoint',
    rarity: 'hero',
    amount: REWARD_RULES.heroStatPoints,
    title: `스탯포인트 +${REWARD_RULES.heroStatPoints}`,
    description: `스탯포인트 +${REWARD_RULES.heroStatPoints}`
  });

  const weaponGrowth = getWeaponGrowthInfo(run.player);
  if (!weaponGrowth.isMaxGrade && weaponGrowth.nextGrade) {
    pool.push({
      id: `hero-weapon-grade-${weaponGrowth.nextGrade.id}`,
      type: 'weaponGradeUp',
      rarity: 'hero',
      amount: 1,
      title: `무기 등급 상승`,
      description: `${weaponGrowth.grade.name} → ${weaponGrowth.nextGrade.name}`
    });
  }

  Object.values(REWARD_TRAITS)
    .filter((trait) => trait.rarity === 'hero' && !run.player.rewardTraits?.includes(trait.id))
    .forEach((trait) => {
      pool.push({
        id: `hero-trait-${trait.id}`,
        type: 'trait',
        rarity: 'hero',
        traitId: trait.id,
        title: `${trait.name}`,
        description: describeTraitEffects(trait.id)
      });
    });

  const weaponSkills = getLevelableOwnedSkills(run.player).filter((skillId) => SKILLS[skillId]?.source === 'weapon');
  if (weaponSkills.length > 0) {
    const skillId = sample(weaponSkills);
    pool.push({
      id: `hero-weapon-skill-${skillId}`,
      type: 'skillLevelMastery',
      rarity: 'hero',
      skillId,
      masteryAmount: 1,
      title: `무기 이해 · ${SKILLS[skillId].name}`,
      description: `${SKILLS[skillId].name} Lv.+1 / 무기 숙련도 +1`
    });
  }

  const personalitySkills = getLevelableOwnedSkills(run.player).filter((skillId) => SKILLS[skillId]?.source === 'personality' && SKILLS[skillId]?.owner === run.player.personalityId);
  if (personalitySkills.length > 0) {
    const skillId = sample(personalitySkills);
    pool.push({
      id: `hero-personality-skill-${skillId}`,
      type: 'skillLevelStatPoint',
      rarity: 'hero',
      skillId,
      statPointAmount: 1,
      title: `성격 강화 · ${SKILLS[skillId].name}`,
      description: `${SKILLS[skillId].name} Lv.+1 / 스탯포인트 +1`
    });
  }

  return pool.length ? sample(pool) : createRareReward(run);
}

function createLegendaryReward(run) {
  const pool = [];
  const weaponGrowth = getWeaponGrowthInfo(run.player);

  if (!weaponGrowth.isMaxStage && weaponGrowth.nextStage) {
    pool.push({
      id: `legendary-weapon-stage-${weaponGrowth.nextStage.id}`,
      type: 'weaponStageUp',
      rarity: 'legendary',
      amount: 1,
      title: `무기 단계 상승`,
      description: `${weaponGrowth.currentStage.name} → ${weaponGrowth.nextStage.name}`
    });
  }

  return pool.length ? sample(pool) : null;
}

function getFallbackRewards(run) {
  return [
    createNormalReward(run),
    createRareReward(run),
    createHeroReward(run)
  ].filter(Boolean);
}

function getShortSkillDescription(skillId) {
  const skill = SKILLS[skillId];
  if (!skill?.description) return '';
  return skill.description
    .replace(/^.+? 전용\.\s*/, '')
    .replace(/^공격형\.\s*/, '')
    .replace(/^방어형\.\s*/, '')
    .replace(/^밸런스형\.\s*/, '')
    .replace(/^암살형\.\s*/, '')
    .replace(/[.。]$/, '')
    .trim();
}


function describeTraitEffects(traitId) {
  const trait = REWARD_TRAITS[traitId];
  if (!trait?.effects) return trait?.description || '';

  const labels = {
    attackBonus: '공격력',
    defenseBonus: '방어력',
    maxHpBonus: '최대 체력',
    evasionBonus: '회피율',
    critBonus: '치명타 확률',
    moveSpeedBonus: '이동속도',
    cooldownBonus: '공격 준비/회복 시간',
    postureBonus: '자세 게이지',
    postureTakenBonus: '받는 자세 피해'
  };

  const parts = Object.entries(trait.effects).map(([key, value]) => {
    const label = labels[key] || key;
    const percent = Math.round(Math.abs(value) * 100);
    if (key === 'cooldownBonus') {
      return value < 0 ? `${label} ${percent}% 감소` : `${label} ${percent}% 증가`;
    }
    if (key === 'postureTakenBonus') {
      return value < 0 ? `${label} ${percent}% 감소` : `${label} ${percent}% 증가`;
    }
    return `${label} ${value >= 0 ? '+' : '-'}${percent}%`;
  });

  return parts.join(' / ');
}


function rarityLabel(rarity) {
  return `[${REWARD_RARITIES[rarity]?.name || rarity}]`;
}

function applyReward(run, reward) {
  const player = run.player;
  player.skillLevels = player.skillLevels || createInitialSkillLevels(player.skills);
  player.rewardTraits = player.rewardTraits || [];
  player.gold = player.gold || 0;

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

  if (reward.type === 'skillLevelMastery') {
    levelUpSkill(player, reward.skillId);
    player.mastery += reward.masteryAmount || 1;
    run.lastRewardLog = `${SKILLS[reward.skillId].name} 강화 + 무기 숙련 +${reward.masteryAmount || 1}`;
  }

  if (reward.type === 'skillLevelStatPoint') {
    levelUpSkill(player, reward.skillId);
    player.statPoints += reward.statPointAmount || 1;
    run.lastRewardLog = `${SKILLS[reward.skillId].name} 강화 + 스탯 포인트 +${reward.statPointAmount || 1}`;
  }

  if (reward.type === 'statPoint') {
    player.statPoints += reward.amount;
    run.lastRewardLog = `스탯 포인트 +${reward.amount}`;
  }

  if (reward.type === 'gold') {
    player.gold += reward.amount;
    run.lastRewardLog = `골드 +${reward.amount}`;
  }

  if (reward.type === 'exp') {
    run.lastRewardLog = `${grantExp(player, reward.amount)}`;
  }

  if (reward.type === 'trait') {
    if (!player.rewardTraits.includes(reward.traitId)) player.rewardTraits.push(reward.traitId);
    run.lastRewardLog = `${REWARD_TRAITS[reward.traitId]?.name || reward.traitId} 획득`;
  }

  if (reward.type === 'weaponGradeUp') {
    const before = getWeaponGrowthInfo(player).grade;
    const after = upgradeWeaponGrade(player, reward.amount || 1);
    run.lastRewardLog = `무기 등급 상승: ${before.name} → ${after.name}`;
  }

  if (reward.type === 'weaponStageUp') {
    const before = getWeaponGrowthInfo(player).currentStage;
    const after = upgradeWeaponStage(player, reward.amount || 1);
    run.lastRewardLog = `무기 단계 상승: ${before.name} → ${after.name}`;
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

function collectRewardEffects(traitIds = []) {
  return traitIds.reduce((effects, traitId) => {
    const trait = REWARD_TRAITS[traitId];
    if (!trait?.effects) return effects;
    Object.entries(trait.effects).forEach(([key, value]) => {
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
