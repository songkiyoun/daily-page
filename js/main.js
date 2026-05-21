// main.js
// 앱 초기화, UI 연결, 단일 게임 루프만 담당합니다.
// requestAnimationFrame은 이 파일에서만 호출합니다.

import { PERSONALITIES, PLAYER_START_STATS, REWARD_RARITIES, REWARD_TRAITS, SHOP_RULES, SKILLS, STAT_LABELS, TOWER_RULES, VERSION, WEAPONS } from './data.js';
import {
  applyRewardAndAdvance,
  completeFloorVictory,
  createBattleState,
  createFixedEnemyConfig,
  createRun,
  getNextLevelExp,
  getPlayerCombatSummary,
  getPlayerInventory,
  getShopOffers,
  getShopSummary,
  getWeaponGrowthInfo,
  isPreTowerShopAvailable,
  lockPreTowerShop,
  purchasePreTowerShopItem,
  refreshPlayerUnit,
  spendPlayerStat,
  startState,
  togglePause
} from './state.js';
import { updateBattle } from './battle.js';
import { render } from './render.js';

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');

const controls = {
  prepScreen: document.getElementById('prepScreen'),
  towerScreen: document.getElementById('towerScreen'),
  characterSetupCard: document.getElementById('characterSetupCard'),
  prepStatCard: document.getElementById('prepStatCard'),
  prepShopCard: document.getElementById('prepShopCard'),
  playerWeapon: document.getElementById('playerWeapon'),
  playerPersonality: document.getElementById('playerPersonality'),
  startBtn: document.getElementById('startBtn'),
  climbBtn: document.getElementById('climbBtn'),
  simToggleBtn: document.getElementById('simToggleBtn'),
  shopStatusBox: document.getElementById('shopStatusBox'),
  simulatorPanel: document.getElementById('simulatorPanel'),
  pauseBtn: document.getElementById('pauseBtn'),
  giveUpBtn: document.getElementById('giveUpBtn'),
  overlayActionBtn: document.getElementById('overlayActionBtn'),
  overlayRewardBox: document.getElementById('overlayRewardBox'),
  resultDetailBox: document.getElementById('resultDetailBox'),
  overlayShopBox: document.getElementById('overlayShopBox'),
  statusBox: document.getElementById('statusBox'),
  towerBox: document.getElementById('towerBox'),
  prepPlayerBox: document.getElementById('prepPlayerBox'),
  towerPlayerBox: document.getElementById('towerPlayerBox'),
  combatSummaryBox: document.getElementById('combatSummaryBox'),
  inventoryBox: document.getElementById('inventoryBox'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  enemyPreview: document.getElementById('enemyPreview'),
  simPlayerWeapon: document.getElementById('simPlayerWeapon'),
  simPlayerPersonality: document.getElementById('simPlayerPersonality'),
  simEnemyWeapon: document.getElementById('simEnemyWeapon'),
  simEnemyPersonality: document.getElementById('simEnemyPersonality'),
  simCount: document.getElementById('simCount'),
  simRunBtn: document.getElementById('simRunBtn'),
  simMatrixBtn: document.getElementById('simMatrixBtn'),
  simMirrorAuditBtn: document.getElementById('simMirrorAuditBtn'),
  simGrowthBtn: document.getElementById('simGrowthBtn'),
  simCopyBtn: document.getElementById('simCopyBtn'),
  simResultBox: document.getElementById('simResultBox'),
  version: document.getElementById('versionBadge')
};

let state = null;
let run = null;
let bankGold = null;
let bankInventory = { gold: null, enhancementStone: 0, bossSoul: 0 };
let lastSimulationText = '아직 복사할 시뮬레이션 결과가 없습니다.';
let panelKeys = {
  player: '',
  tower: '',
  reward: '',
  shop: '',
  controls: '',
  inventory: '',
  combatSummary: ''
};

init();
requestAnimationFrame(loop);

function init() {
  populateSelect(controls.playerWeapon, WEAPONS, 'eastern');
  populateSelect(controls.playerPersonality, PERSONALITIES, 'balanced');
  populateSelect(controls.simPlayerWeapon, WEAPONS, 'spear');
  populateSelect(controls.simPlayerPersonality, PERSONALITIES, 'balanced');
  populateSelect(controls.simEnemyWeapon, WEAPONS, 'dagger');
  populateSelect(controls.simEnemyPersonality, PERSONALITIES, 'assassin');
  controls.version.textContent = `v${VERSION}`;

  controls.startBtn.addEventListener('click', handleMainButton);
  controls.climbBtn.addEventListener('click', startCurrentFloor);
  controls.playerWeapon.addEventListener('change', handleConfigChange);
  controls.playerPersonality.addEventListener('change', handleConfigChange);
  controls.overlayActionBtn.addEventListener('click', handleOverlayAction);
  controls.pauseBtn.addEventListener('click', () => {
    if (!state) return;
    togglePause(state);
    updatePauseButton();
  });
  controls.giveUpBtn.addEventListener('click', handleGiveUp);
  controls.prepPlayerBox.addEventListener('click', handleStatClick);
  controls.towerPlayerBox.addEventListener('click', handleStatClick);
  controls.overlayRewardBox.addEventListener('click', handleRewardClick);
  controls.overlayShopBox.addEventListener('click', handleShopClick);
  controls.simToggleBtn.addEventListener('click', handleSimulatorToggle);
  controls.simRunBtn.addEventListener('click', handleSimulationRun);
  controls.simMatrixBtn.addEventListener('click', handleSimulationMatrix);
  controls.simMirrorAuditBtn.addEventListener('click', handleMirrorAudit);
  controls.simGrowthBtn.addEventListener('click', handleGrowthSimulation);
  controls.simCopyBtn.addEventListener('click', handleSimulationCopy);

  run = null;
  state = null;
  bankGold = null;
  clearPanelKeys();
  showPrepScreen();
  renderAllPanels(true);
  console.info(`Circle Battle Tower Rebuild v${VERSION}`);
}

function populateSelect(select, source, selectedValue) {
  select.innerHTML = '';
  Object.values(source).forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    if (item.id === selectedValue) option.selected = true;
    select.appendChild(option);
  });
}

function readConfig() {
  return {
    playerWeapon: controls.playerWeapon.value,
    playerPersonality: controls.playerPersonality.value
  };
}

function startNewRun() {
  const startingGold = Number.isFinite(bankInventory.gold)
    ? bankInventory.gold
    : (Number.isFinite(bankGold) ? bankGold : undefined);
  run = createRun({
    ...readConfig(),
    startingGold,
    startingEnhancementStone: bankInventory.enhancementStone || 0,
    startingBossSoul: bankInventory.bossSoul || 0
  });
  state = createBattleState(run);
  clearPanelKeys();
  render(ctx, state);
  renderAllPanels(true);
  showPrepScreen();
  renderShopBox(true);
  updatePauseButton();
}

function handleMainButton() {
  if (!state) {
    startNewRun();
    return;
  }

  if (state.running && !state.result) return;

  if (isPreTowerShopAvailable(run)) {
    return;
  }

  if (canStartCurrentFloor()) {
    startCurrentFloor();
    return;
  }

  if (canCreateNewCharacter()) {
    startNewRun();
  }
}

function handleConfigChange() {
  if (!canEditCharacterSetup()) return;
  clearPanelKeys();
  renderAllPanels(true);
}

function startCurrentFloor() {
  if (!canStartCurrentFloor()) return;
  lockPreTowerShop(run);
  startState(state);
  showTowerScreen();
  hideOverlay();
  updatePauseButton();
  renderAllPanels(true);
}

function canStartCurrentFloor() {
  return !!state && !state.running && !state.result && !!run?.active;
}

function canCreateNewCharacter() {
  return !state || state.result === 'defeat' || state.result === 'draw';
}

function canEditCharacterSetup() {
  return !state || state.result === 'defeat' || state.result === 'draw';
}

function hasPreparedCharacter() {
  return !!run && !!state && isPreTowerShopAvailable(run) && !state.running && !state.result;
}

function handleOverlayAction() {
  const action = controls.overlayActionBtn.dataset.action;
  if (action === 'newChallenge') {
    resetToPrepScreen();
    return;
  }
  if (action === 'retry' || action === 'newRun') {
    startNewRun();
    return;
  }
  if (action === 'start' || action === 'climbTower') {
    startCurrentFloor();
  }
}

function syncBankFromRun() {
  if (!run?.player) return;
  const inventory = getPlayerInventory(run.player);
  bankInventory = {
    gold: inventory.gold,
    enhancementStone: inventory.enhancementStone,
    bossSoul: inventory.bossSoul
  };
  bankGold = inventory.gold;
}

function resetToPrepScreen() {
  syncBankFromRun();
  state = null;
  run = null;
  clearPanelKeys();
  showPrepScreen();
  renderAllPanels(true);
}

function handleGiveUp() {
  if (!state || state.result || !run?.active) return;
  state.running = false;
  state.paused = false;
  state.result = 'defeat';
  state.player.isDead = true;
  state.player.lastAction = '런 포기';
  syncBankFromRun();
  clearPanelKeys();
  render(ctx, state);
  renderAllPanels(true);
  showChallengeEndOverlay('도전 포기', `${state.run.floor}층에서 런을 포기했습니다.`);
}

function handleStatClick(event) {
  const button = event.target.closest('.stat-button');
  if (!button || button.disabled || !run || !state) return;
  const didSpend = spendPlayerStat(run, button.dataset.stat);
  if (!didSpend) return;
  refreshPlayerUnit(state);
  panelKeys.player = '';
  renderAllPanels(true);
  render(ctx, state);
}

function handleRewardClick(event) {
  const button = event.target.closest('.reward-button');
  const hasRewards = !!state?.run && ((state.run.pendingRewards?.length || 0) > 0 || (state.run.pendingBossRewards?.length || 0) > 0);
  if (!button || !hasRewards || state.result !== 'victory') return;
  const rewardType = button.dataset.rewardType || 'normal';
  state = applyRewardAndAdvance(state, button.dataset.reward, rewardType);
  run = state.run;
  syncBankFromRun();
  clearPanelKeys();
  updatePauseButton();
  render(ctx, state);
  renderAllPanels(true);

  if (state.result === 'victory') {
    showOverlay(
      'REWARD',
      '남은 보상을 선택하세요. 일반 보상과 보스 전용 보상은 각각 한 번씩 선택할 수 있습니다.',
      '',
      'waitReward',
      { hideButton: true, keepRewards: true }
    );
    renderRewardBox(true);
    return;
  }

  showOverlay(
    'NEXT FLOOR',
    `${state.run.floor}층에 도착했습니다. 체력은 완전히 회복되었습니다. 스탯 포인트가 있다면 배분한 뒤 전투를 시작하세요.`,
    '전투 시작',
    'start'
  );
}

function handleShopClick(event) {
  const button = event.target.closest('.shop-button');
  if (!button || !run || !state) return;
  const result = purchasePreTowerShopItem(run, button.dataset.shopItem);
  syncBankFromRun();
  refreshPlayerUnit(state);
  clearPanelKeys();
  render(ctx, state);
  renderAllPanels(true);
  renderShopBox(true, result.message);
}

function handleSimulatorToggle() {
  const isHidden = controls.simulatorPanel.classList.toggle('hidden');
  controls.simToggleBtn.textContent = isHidden ? '시뮬레이터' : '시뮬레이터 닫기';
}


function handleSimulationRun() {
  const count = readSimulationCount(10);
  const result = simulateFairMatchSet({
    playerWeapon: controls.simPlayerWeapon.value,
    playerPersonality: controls.simPlayerPersonality.value,
    enemyWeapon: controls.simEnemyWeapon.value,
    enemyPersonality: controls.simEnemyPersonality.value,
    count
  });
  renderSimulationResult(result);
}

function handleSimulationMatrix() {
  const count = readSimulationCount(10);
  const rows = [];
  getAllCombatantConfigs().forEach((playerConfig) => {
    getAllCombatantConfigs().forEach((enemyConfig) => {
      rows.push(simulateFairMatchSet({
        playerWeapon: playerConfig.weaponId,
        playerPersonality: playerConfig.personalityId,
        enemyWeapon: enemyConfig.weaponId,
        enemyPersonality: enemyConfig.personalityId,
        count
      }));
    });
  });
  renderSimulationMatrix(rows, count);
}

function handleMirrorAudit() {
  const count = readSimulationCount(10);
  const rows = getAllCombatantConfigs().map((config) => simulateFairMatchSet({
    playerWeapon: config.weaponId,
    playerPersonality: config.personalityId,
    enemyWeapon: config.weaponId,
    enemyPersonality: config.personalityId,
    count
  }));
  renderMirrorAudit(rows, count);
}


function handleGrowthSimulation() {
  const count = Math.min(readSimulationCount(2), 3);
  const result = simulateAllGrowthProgressionSets({ count });
  renderGrowthSimulation(result);
}

const GROWTH_PROFILES = [
  {
    id: 'early',
    name: '초반형',
    description: '초반 생존과 빠른 화력을 우선합니다.',
    statPriority: ['str', 'agi', 'vit', 'def', 'luck'],
    rewardBias: { stat: 11, skillLevel: 10, mastery: 9, weaponGradeUp: 8, weaponStageUp: 8, trait: 6, statPoint: 5, exp: 4, gold: 1 }
  },
  {
    id: 'mid',
    name: '중반형',
    description: '능력치, 스킬, 무기 성장을 고르게 챙깁니다.',
    statPriority: ['vit', 'str', 'def', 'agi', 'luck'],
    rewardBias: { weaponGradeUp: 12, weaponStageUp: 12, trait: 10, skillLevel: 9, mastery: 9, stat: 8, statPoint: 6, exp: 5, gold: 1 }
  },
  {
    id: 'late',
    name: '후반형',
    description: '보스층과 장기 등반을 보고 내구와 무기 성장을 우선합니다.',
    statPriority: ['def', 'vit', 'str', 'luck', 'agi'],
    rewardBias: { weaponStageUp: 15, weaponGradeUp: 14, trait: 11, mastery: 10, skillLevel: 8, statPoint: 8, stat: 6, exp: 5, gold: 1 }
  }
];

function simulateGrowthProgressionSet({ playerWeapon, playerPersonality, count }) {
  const rows = GROWTH_PROFILES.map((profile) => {
    const attempts = [];
    for (let i = 0; i < count; i += 1) {
      attempts.push(simulateSingleProgressionRun({ playerWeapon, playerPersonality, profile, seedIndex: i }));
    }
    return summarizeProgressionProfile(profile, attempts);
  });

  return {
    playerWeapon,
    playerPersonality,
    count,
    rows
  };
}

function simulateAllGrowthProgressionSets({ count }) {
  const groups = getAllCombatantConfigs().map((config) => simulateGrowthProgressionSet({
    playerWeapon: config.weaponId,
    playerPersonality: config.personalityId,
    count
  }));

  return {
    count,
    groups,
    rows: groups.flatMap((group) => group.rows.map((row) => ({
      playerWeapon: group.playerWeapon,
      playerPersonality: group.playerPersonality,
      ...row
    })))
  };
}

function simulateSingleProgressionRun({ playerWeapon, playerPersonality, profile, seedIndex }) {
  let simRun = createRun({ playerWeapon, playerPersonality, startingGold: 0, startingEnhancementStone: 0, startingBossSoul: 0 });
  allocateProgressionStats(simRun, profile);

  const maxFloor = 60;
  let clearedFloor = 0;
  let bossClears = 0;
  let lastResult = 'defeat';

  while (simRun.floor <= maxFloor) {
    const spawnSkew = getSymmetricSpawnSkew(simRun.floor + seedIndex);
    let simState = createBattleState(simRun, { spawnSkew });
    startState(simState);

    const maxFrames = 60 * 85;
    while (!simState.result && simState.frame < maxFrames) {
      updateBattle(simState);
    }

    if (!simState.result) {
      simState.result = 'draw';
      simState.running = false;
    }

    if (simState.result !== 'victory') {
      lastResult = simState.result;
      break;
    }

    completeFloorVictory(simState);
    const isBoss = simRun.floor % TOWER_RULES.bossInterval === 0;
    if (isBoss) bossClears += 1;
    clearedFloor = simRun.floor;

    const reward = chooseProgressionReward(simRun.pendingRewards, profile);
    if (!reward) break;
    simState = applyRewardAndAdvance(simState, reward.id, 'normal');
    simRun = simState.run;

    if (simState.result === 'victory' && simRun.pendingBossRewards?.length) {
      const bossReward = chooseProgressionReward(simRun.pendingBossRewards, profile);
      if (!bossReward) break;
      simState = applyRewardAndAdvance(simState, bossReward.id, 'boss');
      simRun = simState.run;
    }

    allocateProgressionStats(simRun, profile);
    lastResult = 'victory';
  }

  return {
    clearedFloor,
    failedFloor: lastResult === 'victory' ? clearedFloor + 1 : simRun.floor,
    bossClears,
    finalLevel: simRun.player.level,
    finalStats: { ...simRun.player.stats },
    finalGrade: getWeaponGrowthInfo(simRun.player).grade.name,
    finalStage: getWeaponGrowthInfo(simRun.player).currentStageText,
    result: lastResult
  };
}

function allocateProgressionStats(simRun, profile) {
  let guard = 0;
  while (simRun.player.statPoints > 0 && guard < 200) {
    guard += 1;
    const statKey = profile.statPriority[(guard - 1) % profile.statPriority.length];
    spendPlayerStat(simRun, statKey);
  }
}

function chooseProgressionReward(rewards, profile) {
  if (!rewards?.length) return null;
  return [...rewards].sort((a, b) => scoreProgressionReward(b, profile) - scoreProgressionReward(a, profile))[0];
}

function scoreProgressionReward(reward, profile) {
  const bias = profile.rewardBias || {};
  let score = bias[reward.type] || 0;
  if (reward.type === 'skillLevelMastery' || reward.type === 'skillLevelStatPoint') score += bias.skillLevel || 0;
  if (reward.type === 'bossJackpot') score += bias.gold || 0;
  if (reward.type === 'stat' && profile.statPriority.includes(reward.statKey)) {
    score += Math.max(1, profile.statPriority.length - profile.statPriority.indexOf(reward.statKey));
  }
  if (reward.rarity === 'rare') score += 1.5;
  if (reward.rarity === 'hero') score += 3;
  if (reward.rarity === 'legendary') score += 5;
  return score + Math.random() * 0.2;
}

function summarizeProgressionProfile(profile, attempts) {
  const count = Math.max(1, attempts.length);
  const avgFloor = attempts.reduce((sum, item) => sum + item.clearedFloor, 0) / count;
  const avgBoss = attempts.reduce((sum, item) => sum + item.bossClears, 0) / count;
  const avgLevel = attempts.reduce((sum, item) => sum + item.finalLevel, 0) / count;
  const best = attempts.reduce((bestItem, item) => item.clearedFloor > bestItem.clearedFloor ? item : bestItem, attempts[0]);
  const worst = attempts.reduce((worstItem, item) => item.clearedFloor < worstItem.clearedFloor ? item : worstItem, attempts[0]);
  return {
    profile,
    attempts,
    avgFloor,
    avgBoss,
    avgLevel,
    best,
    worst
  };
}

function renderGrowthSimulation(result) {
  lastSimulationText = buildGrowthSimulationText(result);
  const rows = result.rows.map((row) => `
    <tr>
      <td>${combatantLabel(row.playerWeapon, row.playerPersonality)}</td>
      <td>${row.profile.name}</td>
      <td>${row.avgFloor.toFixed(1)}층</td>
      <td>${row.best.clearedFloor}층</td>
      <td>${row.worst.clearedFloor}층</td>
      <td>${row.avgBoss.toFixed(1)}회</td>
      <td>Lv.${row.avgLevel.toFixed(1)}</td>
      <td>${row.profile.description}</td>
    </tr>
  `).join('');

  controls.simResultBox.innerHTML = `
    <div class="sim-summary">
      <strong>전체 성장 등반 예측 · 16개 조합 펼침</strong>
      <span>무기 4종 × 성격 4종 × 초반형·중반형·후반형 · 각 ${result.count}회 · 최대 60층까지 실제 전투 로직 반복</span>
    </div>
    <table class="sim-table growth-table">
      <thead>
        <tr>
          <th>조합</th>
          <th>성장 유형</th>
          <th>평균 클리어</th>
          <th>최고</th>
          <th>최저</th>
          <th>평균 보스 처치</th>
          <th>평균 레벨</th>
          <th>성향</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <textarea class="sim-copy-text" readonly>${escapeTextarea(lastSimulationText)}</textarea>
  `;
}

function buildGrowthSimulationText(result) {
  const lines = [
    '[전체 성장 등반 예측]',
    `버전: v${VERSION}`,
    '대상: 무기 4종 × 성격 4종 전체 조합',
    `반복: 조합/유형별 ${result.count}회`,
    '기준: 자동 스탯 분배 + 자동 보상 선택 + 실제 전투 로직 / 최대 60층',
    '',
    '조합	성장유형	평균클리어층	최고층	최저층	평균보스처치	평균레벨	설명'
  ];

  result.rows.forEach((row) => {
    lines.push([
      combatantLabel(row.playerWeapon, row.playerPersonality),
      row.profile.name,
      row.avgFloor.toFixed(1),
      row.best.clearedFloor,
      row.worst.clearedFloor,
      row.avgBoss.toFixed(1),
      row.avgLevel.toFixed(1),
      row.profile.description
    ].join('	'));
  });

  return lines.join('\n');
}

function handleSimulationCopy() {
  if (!lastSimulationText) return;
  copyTextToClipboard(lastSimulationText);
  controls.simCopyBtn.textContent = '복사 완료';
  window.setTimeout(() => {
    controls.simCopyBtn.textContent = '결과 복사';
  }, 900);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    return;
  }
  fallbackCopyText(text);
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function getAllCombatantConfigs() {
  const configs = [];
  Object.values(WEAPONS).forEach((weapon) => {
    Object.values(PERSONALITIES).forEach((personality) => {
      configs.push({ weaponId: weapon.id, personalityId: personality.id });
    });
  });
  return configs;
}

function readSimulationCount(defaultCount) {
  const value = Number.parseInt(controls.simCount.value, 10);
  if (!Number.isFinite(value)) return defaultCount;
  return Math.max(1, Math.min(50, value));
}

function simulateFairMatchSet({ playerWeapon, playerPersonality, enemyWeapon, enemyPersonality, count }) {
  const summary = createSimulationSummary({
    playerWeapon,
    playerPersonality,
    enemyWeapon,
    enemyPersonality,
    count,
    fairnessMode: '양방향 보정'
  });

  for (let i = 0; i < count; i += 1) {
    const spawnSkew = getSymmetricSpawnSkew(i);

    const forward = simulateSingleMatch({
      playerWeapon,
      playerPersonality,
      enemyWeapon,
      enemyPersonality,
      spawnSkew
    });
    addResultFromPerspective(summary, forward, false);

    const reverse = simulateSingleMatch({
      playerWeapon: enemyWeapon,
      playerPersonality: enemyPersonality,
      enemyWeapon: playerWeapon,
      enemyPersonality: playerPersonality,
      spawnSkew: -spawnSkew
    });
    addResultFromPerspective(summary, reverse, true);
  }

  finalizeSimulationSummary(summary);
  return summary;
}

function createSimulationSummary({ playerWeapon, playerPersonality, enemyWeapon, enemyPersonality, count, fairnessMode }) {
  return {
    playerWeapon,
    playerPersonality,
    enemyWeapon,
    enemyPersonality,
    count,
    actualCount: count * 2,
    fairnessMode,
    wins: 0,
    losses: 0,
    draws: 0,
    playerHits: 0,
    enemyHits: 0,
    time: 0,
    playerHp: 0,
    enemyHp: 0,
    forwardWins: 0,
    reverseWins: 0,
    forwardLosses: 0,
    reverseLosses: 0,
    forwardDraws: 0,
    reverseDraws: 0
  };
}

function addResultFromPerspective(summary, result, invertedPerspective) {
  let outcome = result.outcome;
  let playerHits = result.playerHits;
  let enemyHits = result.enemyHits;
  let playerHp = result.playerHp;
  let enemyHp = result.enemyHp;

  if (invertedPerspective) {
    outcome = invertOutcome(result.outcome);
    playerHits = result.enemyHits;
    enemyHits = result.playerHits;
    playerHp = result.enemyHp;
    enemyHp = result.playerHp;
  }

  if (outcome === 'victory') {
    summary.wins += 1;
    if (invertedPerspective) summary.reverseWins += 1;
    else summary.forwardWins += 1;
  } else if (outcome === 'defeat') {
    summary.losses += 1;
    if (invertedPerspective) summary.reverseLosses += 1;
    else summary.forwardLosses += 1;
  } else {
    summary.draws += 1;
    if (invertedPerspective) summary.reverseDraws += 1;
    else summary.forwardDraws += 1;
  }

  summary.playerHits += playerHits;
  summary.enemyHits += enemyHits;
  summary.time += result.time;
  summary.playerHp += playerHp;
  summary.enemyHp += enemyHp;
}

function finalizeSimulationSummary(summary) {
  const denominator = Math.max(1, summary.actualCount);
  summary.winRate = summary.wins / denominator;
  summary.avgPlayerHits = summary.playerHits / denominator;
  summary.avgEnemyHits = summary.enemyHits / denominator;
  summary.avgTime = summary.time / denominator;
  summary.avgPlayerHp = summary.playerHp / denominator;
  summary.avgEnemyHp = summary.enemyHp / denominator;
  summary.mirrorDelta = Math.abs(50 - Math.round(summary.winRate * 100));
}

function invertOutcome(outcome) {
  if (outcome === 'victory') return 'defeat';
  if (outcome === 'defeat') return 'victory';
  return 'draw';
}

function getSymmetricSpawnSkew(index) {
  const sequence = [0, 36, -36, 64, -64, 18, -18, 82, -82, 48, -48, 28, -28, 72, -72, 8, -8];
  return sequence[index % sequence.length];
}

function simulateSingleMatch({ playerWeapon, playerPersonality, enemyWeapon, enemyPersonality, spawnSkew = 0 }) {
  const simRun = createRun({ playerWeapon, playerPersonality });
  simRun.floor = TOWER_RULES.startFloor;
  simRun.player.stats = { ...PLAYER_START_STATS };
  simRun.player.statPoints = 0;
  simRun.player.skills = [];
  simRun.player.mastery = 0;
  simRun.player.hp = null;

  const enemyConfig = createFixedEnemyConfig({
    floor: TOWER_RULES.startFloor,
    weaponId: enemyWeapon,
    personalityId: enemyPersonality,
    stats: { ...PLAYER_START_STATS },
    name: 'SIM ENEMY'
  });
  const simState = createBattleState(simRun, { enemyConfig, spawnSkew });
  startState(simState);

  const maxFrames = 60 * 110;
  while (!simState.result && simState.frame < maxFrames) {
    updateBattle(simState);
  }
  if (!simState.result) {
    simState.result = 'draw';
    simState.running = false;
  }

  return {
    outcome: simState.result,
    playerHits: simState.player.hits,
    enemyHits: simState.enemy.hits,
    time: simState.elapsed,
    playerHp: Math.max(0, simState.player.hp),
    enemyHp: Math.max(0, simState.enemy.hp)
  };
}

function renderSimulationResult(result) {
  const playerLabel = combatantLabel(result.playerWeapon, result.playerPersonality);
  const enemyLabel = combatantLabel(result.enemyWeapon, result.enemyPersonality);
  lastSimulationText = buildSingleSimulationText(result);

  controls.simResultBox.innerHTML = `
    <div class="sim-summary">
      <strong>${playerLabel} vs ${enemyLabel}</strong>
      <span>${result.count}회 양방향 보정 · 실제 ${result.actualCount}판 · 승률 ${Math.round(result.winRate * 100)}%</span>
    </div>
    <div class="sim-stat-grid">
      <div><span>승/패/무</span><strong>${result.wins}/${result.losses}/${result.draws}</strong></div>
      <div><span>평균 명중</span><strong>${result.avgPlayerHits.toFixed(1)} : ${result.avgEnemyHits.toFixed(1)}</strong></div>
      <div><span>평균 시간</span><strong>${result.avgTime.toFixed(1)}초</strong></div>
      <div><span>잔여 체력</span><strong>${result.avgPlayerHp.toFixed(0)} : ${result.avgEnemyHp.toFixed(0)}</strong></div>
      <div><span>정방향 승/패/무</span><strong>${result.forwardWins}/${result.forwardLosses}/${result.forwardDraws}</strong></div>
      <div><span>역방향 보정 승/패/무</span><strong>${result.reverseWins}/${result.reverseLosses}/${result.reverseDraws}</strong></div>
    </div>
    <textarea class="sim-copy-text" readonly>${escapeTextarea(lastSimulationText)}</textarea>
  `;
}

function renderSimulationMatrix(rows, count) {
  lastSimulationText = buildMatrixSimulationText(rows, count);
  const table = rows.map((row) => `
    <tr class="${getSimulationRowClass(row)}">
      <td>${WEAPONS[row.playerWeapon].name}</td>
      <td>${PERSONALITIES[row.playerPersonality].name}</td>
      <td>${WEAPONS[row.enemyWeapon].name}</td>
      <td>${PERSONALITIES[row.enemyPersonality].name}</td>
      <td>${Math.round(row.winRate * 100)}%</td>
      <td>${row.avgPlayerHits.toFixed(1)} : ${row.avgEnemyHits.toFixed(1)}</td>
      <td>${row.avgTime.toFixed(1)}초</td>
      <td>${row.fairnessMode}</td>
    </tr>
  `).join('');

  controls.simResultBox.innerHTML = `
    <div class="sim-summary">
      <strong>전체 조합 비교</strong>
      <span>내 16조합 × 상대 16조합 · 총 ${rows.length}매치업 · 각 ${count}회 양방향 보정 · 실제 조합당 ${count * 2}판</span>
    </div>
    <table class="sim-table">
      <thead>
        <tr>
          <th>내 무기</th>
          <th>내 성격</th>
          <th>상대 무기</th>
          <th>상대 성격</th>
          <th>승률</th>
          <th>평균 명중</th>
          <th>평균 시간</th>
          <th>보정</th>
        </tr>
      </thead>
      <tbody>${table}</tbody>
    </table>
    <textarea class="sim-copy-text" readonly>${escapeTextarea(lastSimulationText)}</textarea>
  `;
}

function renderMirrorAudit(rows, count) {
  lastSimulationText = buildMirrorAuditText(rows, count);
  const table = rows.map((row) => `
    <tr class="${getSimulationRowClass(row)}">
      <td>${WEAPONS[row.playerWeapon].name}</td>
      <td>${PERSONALITIES[row.playerPersonality].name}</td>
      <td>${Math.round(row.winRate * 100)}%</td>
      <td>${row.avgPlayerHits.toFixed(1)} : ${row.avgEnemyHits.toFixed(1)}</td>
      <td>${row.avgTime.toFixed(1)}초</td>
      <td>${getMirrorAuditLabel(row)}</td>
    </tr>
  `).join('');

  controls.simResultBox.innerHTML = `
    <div class="sim-summary">
      <strong>미러전 검증</strong>
      <span>16개 미러전 · 각 ${count}회 양방향 보정 · 실제 조합당 ${count * 2}판 · 45~55% 근처가 정상 기준</span>
    </div>
    <table class="sim-table">
      <thead>
        <tr>
          <th>무기</th>
          <th>성격</th>
          <th>승률</th>
          <th>평균 명중</th>
          <th>평균 시간</th>
          <th>판정</th>
        </tr>
      </thead>
      <tbody>${table}</tbody>
    </table>
    <textarea class="sim-copy-text" readonly>${escapeTextarea(lastSimulationText)}</textarea>
  `;
}

function getSimulationRowClass(row) {
  const rate = Math.round(row.winRate * 100);
  if (rate <= 25 || rate >= 75) return 'sim-alert';
  if (rate <= 35 || rate >= 65) return 'sim-warn';
  return '';
}

function getMirrorAuditLabel(row) {
  const rate = Math.round(row.winRate * 100);
  if (rate >= 45 && rate <= 55) return '정상';
  if (rate >= 40 && rate <= 60) return '허용';
  return '편향 확인';
}

function combatantLabel(weaponId, personalityId) {
  return `${WEAPONS[weaponId].name} ${PERSONALITIES[personalityId].name}`;
}

function buildSingleSimulationText(result) {
  return [
    '[시뮬레이션 결과]',
    `버전: v${VERSION}`,
    `반복: ${result.count}회 양방향 보정`,
    `실제 전투 수: ${result.actualCount}판`,
    `내 세팅: ${combatantLabel(result.playerWeapon, result.playerPersonality)} / 스탯 5-5-5-5-5`,
    `상대 세팅: ${combatantLabel(result.enemyWeapon, result.enemyPersonality)} / 스탯 5-5-5-5-5`,
    '',
    `승패: 내 승리 ${result.wins}회 / 상대 승리 ${result.losses}회 / 무승부 ${result.draws}회`,
    `승률: ${Math.round(result.winRate * 100)}%`,
    `평균 명중: 내 ${result.avgPlayerHits.toFixed(1)}회 / 상대 ${result.avgEnemyHits.toFixed(1)}회`,
    `평균 전투 시간: ${result.avgTime.toFixed(1)}초`,
    `평균 잔여 체력: 내 ${result.avgPlayerHp.toFixed(0)} / 상대 ${result.avgEnemyHp.toFixed(0)}`,
    `정방향 승/패/무: ${result.forwardWins}/${result.forwardLosses}/${result.forwardDraws}`,
    `역방향 보정 승/패/무: ${result.reverseWins}/${result.reverseLosses}/${result.reverseDraws}`
  ].join('\n');
}

function buildMatrixSimulationText(rows, count) {
  const lines = [
    '[전체 조합 시뮬레이션 결과]',
    `버전: v${VERSION}`,
    `반복: 각 ${count}회 양방향 보정`,
    `실제 전투 수: 조합당 ${count * 2}판`,
    '기준: 1층 / 양쪽 스탯 5-5-5-5-5 / 미러전 포함 / A-B와 B-A 방향 평균',
    '',
    '내무기\t내성격\t상대무기\t상대성격\t승률\t내평균명중\t상대평균명중\t평균시간\t내잔여체력\t상대잔여체력\t정방향승패무\t역방향승패무\t보정'
  ];

  rows.forEach((row) => {
    lines.push([
      WEAPONS[row.playerWeapon].name,
      PERSONALITIES[row.playerPersonality].name,
      WEAPONS[row.enemyWeapon].name,
      PERSONALITIES[row.enemyPersonality].name,
      `${Math.round(row.winRate * 100)}%`,
      row.avgPlayerHits.toFixed(1),
      row.avgEnemyHits.toFixed(1),
      row.avgTime.toFixed(1),
      row.avgPlayerHp.toFixed(0),
      row.avgEnemyHp.toFixed(0),
      `${row.forwardWins}/${row.forwardLosses}/${row.forwardDraws}`,
      `${row.reverseWins}/${row.reverseLosses}/${row.reverseDraws}`,
      row.fairnessMode
    ].join('\t'));
  });

  return lines.join('\n');
}

function buildMirrorAuditText(rows, count) {
  const lines = [
    '[미러전 검증 결과]',
    `버전: v${VERSION}`,
    `반복: 각 ${count}회 양방향 보정`,
    `실제 전투 수: 조합당 ${count * 2}판`,
    '기준: 같은 무기·성격끼리 45~55% 근처면 정상, 40~60%까지 허용',
    '',
    '무기\t성격\t승률\t내평균명중\t상대평균명중\t평균시간\t내잔여체력\t상대잔여체력\t판정'
  ];

  rows.forEach((row) => {
    lines.push([
      WEAPONS[row.playerWeapon].name,
      PERSONALITIES[row.playerPersonality].name,
      `${Math.round(row.winRate * 100)}%`,
      row.avgPlayerHits.toFixed(1),
      row.avgEnemyHits.toFixed(1),
      row.avgTime.toFixed(1),
      row.avgPlayerHp.toFixed(0),
      row.avgEnemyHp.toFixed(0),
      getMirrorAuditLabel(row)
    ].join('\t'));
  });

  return lines.join('\n');
}

function escapeTextarea(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}



function loop() {
  if (state) {
    updateBattle(state);
    render(ctx, state);
    renderAllPanels();
    renderResultIfNeeded();
  }
  requestAnimationFrame(loop);
}

function renderAllPanels(force = false) {
  renderStatus();
  renderTowerInfo(force);
  renderPlayerInfo(force);
  renderCombatSummary(force);
  renderInventory(force);
  renderShopStatus(force);
  renderRewardBox(force);
  renderShopBox(force);
  renderControlState(force);
}

function renderStatus() {
  if (!state) return;
  controls.statusBox.innerHTML = [state.player, state.enemy].map((unit) => {
    const weapon = WEAPONS[unit.weaponId];
    const personality = PERSONALITIES[unit.personalityId];
    const ratio = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
    const postureRatio = Math.max(0, Math.round((unit.posture / unit.maxPosture) * 100));
    const attackScale = Math.round(unit.attackScale * 100);
    const defense = Math.round(unit.defense * 100);
    const crit = Math.round(unit.crit * 100);
    return `
      <div class="status-row">
        <div class="status-head">
          <strong>${unit.name} Lv.${unit.level}</strong>
          <span>${Math.ceil(unit.hp)} / ${unit.maxHp}</span>
        </div>
        <div class="hpbar"><i style="width:${ratio}%"></i></div>
        <div class="hpbar posturebar"><i style="width:${postureRatio}%"></i></div>
        <div class="status-note">${weapon.name} · ${personality.name} · 공격 ${attackScale}% · 방어 ${defense}% · 치명 ${crit}% · 자세 ${Math.round(unit.posture)}/${unit.maxPosture} · ${unit.lastAction} · 명중 ${unit.hits}회</div>
      </div>
    `;
  }).join('');
}

function renderTowerInfo(force = false) {
  if (!state) return;
  const enemyWeapon = WEAPONS[state.enemy.weaponId];
  const enemyPersonality = PERSONALITIES[state.enemy.personalityId];
  const enemyGrowth = getWeaponGrowthInfo(state.enemy);
  const isBossFloor = state.run.floor % TOWER_RULES.bossInterval === 0;
  const enemySkillText = state.enemy.skills.length
    ? state.enemy.skills.map((skillId) => `${SKILLS[skillId]?.name || skillId} Lv.${state.enemy.skillLevels?.[skillId] || 1}`).join(' · ')
    : '없음';

  const key = [
    state.run.floor,
    state.run.victories,
    state.enemy.weaponId,
    state.enemy.personalityId,
    state.enemy.maxHp,
    state.enemy.weaponGrade || 'common',
    state.enemy.weaponEvolution || 'none',
    enemySkillText
  ].join('|');
  if (!force && panelKeys.tower === key) return;
  panelKeys.tower = key;

  const nextBossFloor = Math.ceil(state.run.floor / TOWER_RULES.bossInterval) * TOWER_RULES.bossInterval;
  const floorsToBoss = isBossFloor ? 0 : Math.max(0, nextBossFloor - state.run.floor);

  controls.towerBox.innerHTML = `
    <div class="tower-row boss-row"><span>현재 층</span><strong>${state.run.floor}층${isBossFloor ? ' · 보스' : ''}</strong></div>
    <div class="tower-row"><span>층 유형</span><strong>${isBossFloor ? '보스층' : '일반층'}</strong></div>
    <div class="tower-row"><span>다음 보스층</span><strong>${isBossFloor ? '현재 층' : `${nextBossFloor}층 · ${floorsToBoss}층 남음`}</strong></div>
    <div class="tower-row"><span>승리 횟수</span><strong>${state.run.victories}회</strong></div>
    <div class="tower-row"><span>상대 무기</span><strong>${enemyWeapon.name}</strong></div>
    <div class="tower-row"><span>상대 성격</span><strong>${enemyPersonality.name}</strong></div>
    <div class="tower-row"><span>상대 무기 등급</span><strong>${enemyGrowth.grade.name}</strong></div>
    <div class="tower-row"><span>상대 무기 단계</span><strong>${enemyGrowth.currentStageText}</strong></div>
    <div class="tower-row"><span>상대 스킬</span><strong>${enemySkillText}</strong></div>
    <div class="tower-row"><span>상대 최대 체력</span><strong>${state.enemy.maxHp}</strong></div>
  `;

  controls.enemyPreview.textContent = isBossFloor
    ? '보스층입니다. 일반층보다 체력, 자세, 공격 성능이 높고 처치 시 보스의 영혼을 얻습니다.'
    : `상대는 매 층 랜덤으로 정해지며 ${nextBossFloor}층마다 보스가 등장합니다.`;
}

function renderPlayerInfo(force = false) {
  if (!run || !state) {
    const emptyHtml = `
      <div class="empty-panel">
        <strong>캐릭터 생성 전</strong>
        <span>먼저 무기와 성격을 선택한 뒤 새 캐릭터를 생성하세요.</span>
      </div>
    `;
    if (controls.prepPlayerBox) controls.prepPlayerBox.innerHTML = emptyHtml;
    if (controls.towerPlayerBox) controls.towerPlayerBox.innerHTML = '';
    panelKeys.player = 'empty';
    return;
  }
  const player = run.player;
  const expNeed = getNextLevelExp(player.level);
  const expRatio = Math.min(100, Math.round((player.exp / expNeed) * 100));
  const canSpend = player.statPoints > 0 && !state.running && !state.result;
  const skillText = player.skills.length
    ? player.skills.map((skillId) => {
      const skill = SKILLS[skillId];
      const level = player.skillLevels?.[skillId] || 1;
      return `<span class="tag" title="${skill?.description || ''}">${skill?.name || skillId} Lv.${level}</span>`;
    }).join('')
    : '<span class="muted-small">보유 스킬 없음</span>';
  const statKey = Object.entries(player.stats).map(([key, value]) => `${key}:${value}`).join(',');
  const key = [
    player.level,
    player.exp,
    player.gold || 0,
    player.enhancementStone || 0,
    player.bossSoul || 0,
    player.statPoints,
    player.mastery,
    JSON.stringify(player.shopBoosts || {}),
    player.weaponGrade || 'common',
    player.weaponEvolution || 'none',
    (player.rewardTraits || []).join(','),
    statKey,
    player.skills.map((skillId) => `${skillId}:${player.skillLevels?.[skillId] || 1}`).join(','),
    player.externalSkillCount || 0,
    state.running ? 'running' : 'ready',
    state.result || 'none'
  ].join('|');
  if (!force && panelKeys.player === key) return;
  panelKeys.player = key;

  const weaponGrowth = getWeaponGrowthInfo(player);

  const traitText = player.rewardTraits?.length
    ? player.rewardTraits.map((traitId) => {
      const trait = REWARD_TRAITS[traitId];
      return `<span class="tag reward-trait" title="${trait?.description || ''}">${trait?.name || traitId}</span>`;
    }).join('')
    : '<span class="muted-small">보상 특성 없음</span>';

  const statButtons = Object.entries(player.stats).map(([key, value]) => `
    <button class="stat-button" type="button" data-stat="${key}" ${canSpend ? '' : 'disabled'}>
      <span>${STAT_LABELS[key]}</span>
      <strong>${value}</strong>
    </button>
  `).join('');

  const playerInfoHtml = `
    <div class="tower-row"><span>레벨</span><strong>Lv.${player.level}</strong></div>
    <div class="tower-row"><span>경험치</span><strong>${player.exp} / ${expNeed}</strong></div>
    <div class="hpbar expbar"><i style="width:${expRatio}%"></i></div>
    <div class="tower-row"><span>스탯 포인트</span><strong>${player.statPoints}</strong></div>
    <div class="tower-row"><span>무기 숙련</span><strong>${player.mastery}</strong></div>
    <div class="tower-row"><span>성격 강화</span><strong>Lv.${player.shopBoosts?.personalityBoostLevel || 0}</strong></div>
    <div class="stat-grid">${statButtons}</div>
    <div class="skill-list">${skillText}</div>
    <div class="skill-list">${traitText}</div>
    <p class="hint-text">스탯 포인트는 탑 입장 전 또는 다음 층 대기 상태에서 배분할 수 있습니다.</p>
  `;
  controls.prepPlayerBox.innerHTML = playerInfoHtml;
  controls.towerPlayerBox.innerHTML = playerInfoHtml;
}

function getWeaponIcon(weaponId) {
  if (weaponId === 'western') return '⚔';
  if (weaponId === 'eastern') return '◈';
  if (weaponId === 'spear') return '♆';
  if (weaponId === 'dagger') return '🗡';
  return '□';
}

function renderCombatSummary(force = false) {
  if (!controls.combatSummaryBox) return;
  if (!run?.player) {
    controls.combatSummaryBox.innerHTML = `
      <div class="empty-panel slim">
        <strong>전투 능력 없음</strong>
        <span>탑에 오르면 현재 총 전투 능력이 표시됩니다.</span>
      </div>
    `;
    panelKeys.combatSummary = 'empty';
    return;
  }

  const summary = getPlayerCombatSummary(run.player);
  const key = Object.values(summary).join('|');
  if (!force && panelKeys.combatSummary === key) return;
  panelKeys.combatSummary = key;

  controls.combatSummaryBox.innerHTML = `
    <div><span>총 체력</span><strong>${summary.maxHp}</strong></div>
    <div><span>총 공격력</span><strong>${summary.totalAttack}</strong><em>${summary.attackScalePercent}%</em></div>
    <div><span>총 방어력</span><strong>${summary.defensePercent}%</strong></div>
    <div><span>자세</span><strong>${summary.maxPosture}</strong></div>
    <div><span>회피율</span><strong>${summary.evasionPercent}%</strong></div>
    <div><span>치명타 확률</span><strong>${summary.critPercent}%</strong></div>
    <div><span>치명타 피해</span><strong>${summary.critDamagePercent}%</strong></div>
  `;
}

function renderInventory(force = false) {
  if (!controls.inventoryBox) return;
  if (!run?.player) {
    controls.inventoryBox.innerHTML = `
      <div class="empty-panel">
        <strong>인벤토리 없음</strong>
        <span>탑에 오르면 현재 무기와 보유 재화가 표시됩니다.</span>
      </div>
    `;
    panelKeys.inventory = 'empty';
    return;
  }

  const inventory = getPlayerInventory(run.player);
  const key = [
    inventory.weaponId,
    inventory.weaponName,
    inventory.weaponGrade,
    inventory.weaponStage,
    inventory.mastery,
    inventory.gold,
    inventory.enhancementStone,
    inventory.bossSoul
  ].join('|');
  if (!force && panelKeys.inventory === key) return;
  panelKeys.inventory = key;

  controls.inventoryBox.innerHTML = `
    <div class="weapon-slot">
      <div class="weapon-icon">${getWeaponIcon(inventory.weaponId)}</div>
      <div class="weapon-info">
        <strong>${inventory.weaponName}</strong>
        <span>${inventory.weaponStage}</span>
        <em>${inventory.weaponGrade} · 숙련도 ${inventory.mastery}</em>
      </div>
    </div>
    <div class="resource-grid">
      <div><span>골드</span><strong>${inventory.gold}G</strong></div>
      <div><span>강화석</span><strong>${inventory.enhancementStone}</strong></div>
      <div><span>보스의 영혼</span><strong>${inventory.bossSoul}</strong></div>
    </div>
  `;
}

function renderShopStatus(force = false) {
  if (!controls.shopStatusBox) return;
  const resources = run?.player
    ? getPlayerInventory(run.player)
    : {
      gold: Number.isFinite(bankInventory.gold) ? bankInventory.gold : SHOP_RULES.initialGold,
      enhancementStone: bankInventory.enhancementStone || 0,
      bossSoul: bankInventory.bossSoul || 0
    };
  const key = [resources.gold, resources.enhancementStone, resources.bossSoul, run?.lastRewardLog || ''].join('|');
  if (!force && controls.shopStatusBox.dataset.key === key) return;
  controls.shopStatusBox.dataset.key = key;
  controls.shopStatusBox.innerHTML = `
    <span><small>골드</small><strong>${resources.gold}G</strong></span>
    <span><small>강화석</small><strong>${resources.enhancementStone}</strong></span>
    <span><small>보스의 영혼</small><strong>${resources.bossSoul}</strong></span>
  `;
}

function renderShopBox(force = false, message = '') {
  if (!run || !state) {
    panelKeys.shop = 'empty';
    controls.overlayShopBox.classList.remove('hidden');
    controls.overlayShopBox.innerHTML = `
      <div class="empty-panel">
        <strong>준비 상점 비활성화</strong>
        <span>새 캐릭터 생성 후 상점과 탑 오르기가 활성화됩니다.</span>
      </div>
    `;
    return;
  }

  if (!isPreTowerShopAvailable(run)) {
    hideShopBox();
    return;
  }

  const offers = getShopOffers(run);
  const key = [
    run.player.gold || 0,
    message,
    run.player.statPoints,
    run.player.weaponGrade,
    run.player.weaponEvolution,
    offers.map((item) => `${item.id}:${item.price}:${item.disabled}:${item.disabledReason}:${item.description}`).join('|')
  ].join('|');
  if (!force && panelKeys.shop === key) return;
  panelKeys.shop = key;

  controls.overlayShopBox.classList.remove('hidden');
  controls.overlayShopBox.innerHTML = `
    ${message ? `<div class="shop-message">${message}</div>` : ''}
    <div class="shop-line-list">
      ${offers.map((item) => `
        <div class="shop-line" title="${item.description}">
          <div class="shop-line-main">
            <strong>${item.title}</strong>
            <span>${item.description}</span>
          </div>
          <em>${item.price}G</em>
          <button class="button mini shop-button" type="button" data-shop-item="${item.id}" ${item.disabled ? 'disabled' : ''}>
            ${item.disabledReason || '구매'}
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function hideShopBox() {
  panelKeys.shop = '';
  controls.overlayShopBox.classList.add('hidden');
  controls.overlayShopBox.innerHTML = '';
}

function renderRewardBox(force = false) {
  const normalRewards = state?.run?.pendingRewards || [];
  const bossRewards = state?.run?.pendingBossRewards || [];
  if ((normalRewards.length + bossRewards.length === 0) || state.result !== 'victory') {
    hideRewardBox();
    return;
  }

  const nextKey = `${state.run.floor}:N:${normalRewards.map((reward) => reward.id).join('|')}:B:${bossRewards.map((reward) => reward.id).join('|')}`;
  if (!force && panelKeys.reward === nextKey) return;
  panelKeys.reward = nextKey;

  const renderRewardButtons = (rewards, type) => rewards.map((reward) => {
    const rarity = reward.rarity || 'normal';
    const rarityName = REWARD_RARITIES[rarity]?.name || rarity;
    return `
      <button class="reward-button reward-${rarity}" type="button" data-reward="${reward.id}" data-reward-type="${type}">
        <em>${rarityName}</em>
        <strong>${reward.title}</strong>
        <span>${reward.description}</span>
      </button>
    `;
  }).join('');

  controls.overlayRewardBox.classList.remove('hidden');
  controls.overlayRewardBox.innerHTML = `
    ${normalRewards.length ? `
      <div class="reward-section">
        <h3>일반 보상 선택</h3>
        <div class="reward-grid">${renderRewardButtons(normalRewards, 'normal')}</div>
      </div>
    ` : ''}
    ${bossRewards.length ? `
      <div class="reward-section boss-reward-section">
        <h3>보스 전용 보상 선택</h3>
        <div class="reward-grid">${renderRewardButtons(bossRewards, 'boss')}</div>
      </div>
    ` : ''}
  `;
}

function hideRewardBox() {
  panelKeys.reward = '';
  controls.overlayRewardBox.classList.add('hidden');
  controls.overlayRewardBox.innerHTML = '';
}

function renderControlState(force = false) {
  const prepared = hasPreparedCharacter();
  const setupEditable = canEditCharacterSetup();
  const canStartFloor = canStartCurrentFloor();
  const canNewCharacter = canCreateNewCharacter();
  const key = [
    state?.running ? 'running' : 'idle',
    state?.result || 'none',
    state?.paused ? 'paused' : 'live',
    setupEditable ? 'setup' : 'locked',
    prepared ? 'prepared' : 'notPrepared',
    run?.floor || 0,
    run?.victories || 0
  ].join('|');
  if (!force && panelKeys.controls === key) return;
  panelKeys.controls = key;

  controls.playerWeapon.disabled = !setupEditable || prepared;
  controls.playerPersonality.disabled = !setupEditable || prepared;
  controls.pauseBtn.disabled = !state?.running || !!state?.result;
  const freshReady = !!state && !state.running && !state.result && run?.floor === TOWER_RULES.startFloor && run?.victories === 0;
  controls.giveUpBtn.disabled = !run?.active || !!state?.result || freshReady;
  controls.climbBtn.disabled = !prepared;

  controls.characterSetupCard?.classList.toggle('is-disabled', prepared);
  controls.prepStatCard?.classList.toggle('is-disabled', !prepared);
  controls.prepShopCard?.classList.toggle('is-disabled', !prepared);

  if (!state) {
    controls.startBtn.textContent = '새 캐릭터 생성';
    controls.startBtn.disabled = false;
  } else if (state.running && !state.result) {
    controls.startBtn.textContent = '전투 진행 중';
    controls.startBtn.disabled = true;
  } else if (state.result === 'victory') {
    controls.startBtn.textContent = '보상 선택 필요';
    controls.startBtn.disabled = true;
  } else if (prepared) {
    controls.startBtn.textContent = '캐릭터 생성 완료';
    controls.startBtn.disabled = true;
  } else if (canNewCharacter) {
    controls.startBtn.textContent = '새 캐릭터 생성';
    controls.startBtn.disabled = false;
  } else if (canStartFloor) {
    controls.startBtn.textContent = run.floor === TOWER_RULES.startFloor && run.victories === 0 ? '탑 오르기' : '현재 층 전투 시작';
    controls.startBtn.disabled = false;
  } else {
    controls.startBtn.textContent = '진행 불가';
    controls.startBtn.disabled = true;
  }

  updatePauseButton();
}

function renderResultIfNeeded() {
  if (!state || !state.result || controls.resultOverlay.dataset.resultFrame === String(state.frame)) return;
  controls.resultOverlay.dataset.resultFrame = String(state.frame);

  if (state.result === 'victory') {
    completeFloorVictory(state);
    const nextFloor = state.run.floor + 1;
    const levelText = state.run.levelMessage ? `${state.run.levelMessage}\n` : '';
    const goldText = state.run.victoryGoldMessage ? `${state.run.victoryGoldMessage}\n` : '';
    const bossText = state.run.lastBossRewardMessage ? `${state.run.lastBossRewardMessage}\n` : '';
    panelKeys.player = '';
    panelKeys.tower = '';
    showOverlay(
      state.run.lastBossRewardMessage ? 'BOSS CLEAR' : 'VICTORY',
      `${levelText}${goldText}${bossText}${state.run.floor}층을 클리어했습니다. ${state.run.pendingBossRewards?.length ? '일반 보상과 보스 전용 보상을 각각 하나씩 선택하면' : '보상을 하나 선택하면'} ${nextFloor}층으로 이동합니다.`,
      '',
      'waitReward',
      { hideButton: true }
    );
    renderAllPanels(true);
  } else if (state.result === 'defeat') {
    syncBankFromRun();
    showChallengeEndOverlay('도전 종료', `${state.run.floor}층에서 쓰러졌습니다.`);
    renderAllPanels(true);
  } else {
    showOverlay('DRAW', '두 유닛이 동시에 쓰러졌습니다. 현재 층을 다시 진행합니다.', '현재 층 재도전', 'start');
    renderAllPanels(true);
  }
}

function buildChallengeEndDetails() {
  if (!run?.player) return '';
  const inventory = getPlayerInventory(run.player);
  const reachedFloor = Math.max(TOWER_RULES.startFloor, run.floor || TOWER_RULES.startFloor);
  return `
    <div class="challenge-result-grid">
      <div><span>도달 층수</span><strong>${reachedFloor}층</strong></div>
      <div><span>처치 수</span><strong>${run.victories || 0}회</strong></div>
      <div><span>최종 레벨</span><strong>Lv.${run.player.level}</strong></div>
      <div><span>획득 골드</span><strong>${run.challenge?.earnedGold || 0}G</strong></div>
      <div><span>획득 강화석</span><strong>${run.challenge?.earnedEnhancementStone || 0}</strong></div>
      <div><span>획득 보스의 영혼</span><strong>${run.challenge?.earnedBossSoul || 0}</strong></div>
    </div>
    <div class="challenge-weapon-summary">
      <span>${getWeaponIcon(inventory.weaponId)}</span>
      <strong>${inventory.weaponName}</strong>
      <em>${inventory.weaponGrade} · ${inventory.weaponStage}</em>
    </div>
  `;
}

function showChallengeEndOverlay(title, text) {
  showOverlay(title, text, '새 도전 시작', 'newChallenge', { detailsHtml: buildChallengeEndDetails() });
  if (state) controls.resultOverlay.dataset.resultFrame = String(state.frame);
}

function showShopOverlay(message = '') {
  if (!run || !state) return;
  showPrepScreen();
  renderShopBox(true, message);
}

function showPrepScreen() {
  controls.prepScreen.classList.remove('hidden');
  controls.towerScreen.classList.add('hidden');
  hideOverlay();
}

function showTowerScreen() {
  controls.prepScreen.classList.add('hidden');
  controls.towerScreen.classList.remove('hidden');
}

function showOverlay(title, text, buttonText, action, options = {}) {
  controls.resultTitle.textContent = title;
  controls.resultText.textContent = text;
  if (controls.resultDetailBox) {
    controls.resultDetailBox.innerHTML = options.detailsHtml || '';
    controls.resultDetailBox.classList.toggle('hidden', !options.detailsHtml);
  }
  controls.overlayActionBtn.textContent = buttonText;
  controls.overlayActionBtn.dataset.action = action;
  controls.overlayActionBtn.disabled = !!options.disabled;
  controls.overlayActionBtn.classList.toggle('hidden', !!options.hideButton);
  if (!options.keepRewards) hideRewardBox();
  if (!options.keepShop) hideShopBox();
  controls.resultOverlay.classList.remove('hidden');
}

function hideOverlay() {
  controls.resultOverlay.classList.add('hidden');
  controls.overlayActionBtn.disabled = false;
  controls.overlayActionBtn.classList.remove('hidden');
  hideRewardBox();
  hideShopBox();
  if (controls.resultDetailBox) {
    controls.resultDetailBox.innerHTML = '';
    controls.resultDetailBox.classList.add('hidden');
  }
  delete controls.resultOverlay.dataset.resultFrame;
}

function updatePauseButton() {
  controls.pauseBtn.textContent = state?.paused ? '계속' : '일시정지';
}

function clearPanelKeys() {
  panelKeys = {
    player: '',
    tower: '',
    reward: '',
    shop: '',
    controls: '',
    inventory: '',
    combatSummary: ''
  };
}
