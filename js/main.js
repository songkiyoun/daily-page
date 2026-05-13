// main.js
// 앱 초기화, UI 연결, 단일 게임 루프만 담당합니다.
// requestAnimationFrame은 이 파일에서만 호출합니다.

import { PERSONALITIES, PLAYER_START_STATS, SKILLS, STAT_LABELS, TOWER_RULES, VERSION, WEAPONS } from './data.js';
import {
  applyRewardAndAdvance,
  completeFloorVictory,
  createBattleState,
  createFixedEnemyConfig,
  createRun,
  getNextLevelExp,
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
  playerWeapon: document.getElementById('playerWeapon'),
  playerPersonality: document.getElementById('playerPersonality'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  giveUpBtn: document.getElementById('giveUpBtn'),
  overlayActionBtn: document.getElementById('overlayActionBtn'),
  overlayRewardBox: document.getElementById('overlayRewardBox'),
  statusBox: document.getElementById('statusBox'),
  towerBox: document.getElementById('towerBox'),
  playerBox: document.getElementById('playerBox'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  enemyPreview: document.getElementById('enemyPreview'),
  simEnemyWeapon: document.getElementById('simEnemyWeapon'),
  simEnemyPersonality: document.getElementById('simEnemyPersonality'),
  simCount: document.getElementById('simCount'),
  simRunBtn: document.getElementById('simRunBtn'),
  simMatrixBtn: document.getElementById('simMatrixBtn'),
  simResultBox: document.getElementById('simResultBox'),
  version: document.getElementById('versionBadge')
};

let state = null;
let run = null;
let panelKeys = {
  player: '',
  tower: '',
  reward: '',
  controls: ''
};

init();
requestAnimationFrame(loop);

function init() {
  populateSelect(controls.playerWeapon, WEAPONS, 'eastern');
  populateSelect(controls.playerPersonality, PERSONALITIES, 'balanced');
  populateSelect(controls.simEnemyWeapon, WEAPONS, 'spear');
  populateSelect(controls.simEnemyPersonality, PERSONALITIES, 'balanced');
  controls.version.textContent = `v${VERSION}`;

  controls.startBtn.addEventListener('click', handleMainButton);
  controls.playerWeapon.addEventListener('change', handleConfigChange);
  controls.playerPersonality.addEventListener('change', handleConfigChange);
  controls.overlayActionBtn.addEventListener('click', handleOverlayAction);
  controls.pauseBtn.addEventListener('click', () => {
    if (!state) return;
    togglePause(state);
    updatePauseButton();
  });
  controls.giveUpBtn.addEventListener('click', handleGiveUp);
  controls.playerBox.addEventListener('click', handleStatClick);
  controls.overlayRewardBox.addEventListener('click', handleRewardClick);
  controls.simRunBtn.addEventListener('click', handleSimulationRun);
  controls.simMatrixBtn.addEventListener('click', handleSimulationMatrix);

  run = createRun(readConfig());
  state = createBattleState(run);
  render(ctx, state);
  renderAllPanels(true);
  showOverlay('READY', '무기와 성격, 기본 스탯을 정한 뒤 탑 등반을 시작하세요.', '탑 등반 시작', 'start');
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
  run = createRun(readConfig());
  state = createBattleState(run);
  clearPanelKeys();
  render(ctx, state);
  renderAllPanels(true);
  showOverlay('READY', '무기와 성격, 기본 스탯을 정한 뒤 탑 등반을 시작하세요.', '탑 등반 시작', 'start');
  updatePauseButton();
}

function handleMainButton() {
  if (!state) {
    startNewRun();
    return;
  }

  if (state.running && !state.result) return;

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
  run = createRun(readConfig());
  state = createBattleState(run);
  clearPanelKeys();
  render(ctx, state);
  renderAllPanels(true);
  showOverlay('READY', '무기와 성격, 기본 스탯을 정한 뒤 탑 등반을 시작하세요.', '탑 등반 시작', 'start');
}

function startCurrentFloor() {
  if (!canStartCurrentFloor()) return;
  startState(state);
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
  return !state ||
    state.result === 'defeat' ||
    state.result === 'draw' ||
    (run?.floor === TOWER_RULES.startFloor && run?.victories === 0 && !state.running && !state.result);
}

function handleOverlayAction() {
  const action = controls.overlayActionBtn.dataset.action;
  if (action === 'retry' || action === 'newRun') {
    startNewRun();
    return;
  }
  if (action === 'start') {
    startCurrentFloor();
  }
}

function handleGiveUp() {
  if (!state || state.result || !run?.active) return;
  state.running = false;
  state.paused = false;
  state.result = 'defeat';
  state.player.isDead = true;
  state.player.lastAction = '런 포기';
  clearPanelKeys();
  render(ctx, state);
  renderAllPanels(true);
  showOverlay('DEFEAT', `${state.run.floor}층에서 런을 포기했습니다. 새 캐릭터를 생성할 수 있습니다.`, '새 캐릭터 생성', 'retry');
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
  if (!button || !state?.run?.pendingRewards?.length || state.result !== 'victory') return;
  state = applyRewardAndAdvance(state, button.dataset.reward);
  run = state.run;
  clearPanelKeys();
  updatePauseButton();
  render(ctx, state);
  renderAllPanels(true);
  showOverlay(
    'NEXT FLOOR',
    `${state.run.floor}층에 도착했습니다. 체력은 완전히 회복되었습니다. 스탯 포인트가 있다면 배분한 뒤 전투를 시작하세요.`,
    '전투 시작',
    'start'
  );
}


function handleSimulationRun() {
  const count = readSimulationCount(50);
  const result = simulateMatchSet({
    playerWeapon: controls.playerWeapon.value,
    playerPersonality: controls.playerPersonality.value,
    enemyWeapon: controls.simEnemyWeapon.value,
    enemyPersonality: controls.simEnemyPersonality.value,
    count
  });
  renderSimulationResult(result);
}

function handleSimulationMatrix() {
  const count = Math.min(readSimulationCount(20), 30);
  const rows = [];
  Object.values(WEAPONS).forEach((weapon) => {
    Object.values(PERSONALITIES).forEach((personality) => {
      rows.push(simulateMatchSet({
        playerWeapon: controls.playerWeapon.value,
        playerPersonality: controls.playerPersonality.value,
        enemyWeapon: weapon.id,
        enemyPersonality: personality.id,
        count
      }));
    });
  });
  renderSimulationMatrix(rows, count);
}

function readSimulationCount(defaultCount) {
  const value = Number.parseInt(controls.simCount.value, 10);
  if (!Number.isFinite(value)) return defaultCount;
  return Math.max(1, Math.min(120, value));
}

function simulateMatchSet({ playerWeapon, playerPersonality, enemyWeapon, enemyPersonality, count }) {
  const summary = {
    playerWeapon,
    playerPersonality,
    enemyWeapon,
    enemyPersonality,
    count,
    wins: 0,
    losses: 0,
    draws: 0,
    playerHits: 0,
    enemyHits: 0,
    time: 0,
    playerHp: 0,
    enemyHp: 0
  };

  for (let i = 0; i < count; i += 1) {
    const result = simulateSingleMatch({ playerWeapon, playerPersonality, enemyWeapon, enemyPersonality });
    if (result.outcome === 'victory') summary.wins += 1;
    else if (result.outcome === 'defeat') summary.losses += 1;
    else summary.draws += 1;
    summary.playerHits += result.playerHits;
    summary.enemyHits += result.enemyHits;
    summary.time += result.time;
    summary.playerHp += result.playerHp;
    summary.enemyHp += result.enemyHp;
  }

  summary.winRate = summary.wins / count;
  summary.avgPlayerHits = summary.playerHits / count;
  summary.avgEnemyHits = summary.enemyHits / count;
  summary.avgTime = summary.time / count;
  summary.avgPlayerHp = summary.playerHp / count;
  summary.avgEnemyHp = summary.enemyHp / count;
  return summary;
}

function simulateSingleMatch({ playerWeapon, playerPersonality, enemyWeapon, enemyPersonality }) {
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
  const simState = createBattleState(simRun, { enemyConfig });
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
  const playerWeapon = WEAPONS[result.playerWeapon].name;
  const playerPersonality = PERSONALITIES[result.playerPersonality].name;
  const enemyWeapon = WEAPONS[result.enemyWeapon].name;
  const enemyPersonality = PERSONALITIES[result.enemyPersonality].name;
  controls.simResultBox.innerHTML = `
    <div class="sim-summary">
      <strong>${playerWeapon} ${playerPersonality} vs ${enemyWeapon} ${enemyPersonality}</strong>
      <span>${result.count}회 시뮬레이션 · 승률 ${Math.round(result.winRate * 100)}%</span>
    </div>
    <div class="sim-stat-grid">
      <div><span>승/패/무</span><strong>${result.wins}/${result.losses}/${result.draws}</strong></div>
      <div><span>평균 명중</span><strong>${result.avgPlayerHits.toFixed(1)} : ${result.avgEnemyHits.toFixed(1)}</strong></div>
      <div><span>평균 시간</span><strong>${result.avgTime.toFixed(1)}초</strong></div>
      <div><span>잔여 체력</span><strong>${result.avgPlayerHp.toFixed(0)} : ${result.avgEnemyHp.toFixed(0)}</strong></div>
    </div>
  `;
}

function renderSimulationMatrix(rows, count) {
  const table = rows.map((row) => `
    <tr>
      <td>${WEAPONS[row.enemyWeapon].name}</td>
      <td>${PERSONALITIES[row.enemyPersonality].name}</td>
      <td>${Math.round(row.winRate * 100)}%</td>
      <td>${row.avgPlayerHits.toFixed(1)} : ${row.avgEnemyHits.toFixed(1)}</td>
    </tr>
  `).join('');

  controls.simResultBox.innerHTML = `
    <div class="sim-summary">
      <strong>전체 상대 비교</strong>
      <span>상대 16조합 · 각 ${count}회 · 1층 기본 스탯 5 기준</span>
    </div>
    <table class="sim-table">
      <thead><tr><th>상대 무기</th><th>상대 성격</th><th>승률</th><th>평균 명중</th></tr></thead>
      <tbody>${table}</tbody>
    </table>
  `;
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
  renderRewardBox(force);
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
  const isBossFloor = state.run.floor % TOWER_RULES.bossInterval === 0;
  const enemySkillText = state.enemy.skills.length
    ? state.enemy.skills.map((skillId) => SKILLS[skillId]?.name).join(' · ')
    : '없음';

  const key = [
    state.run.floor,
    state.run.victories,
    state.enemy.weaponId,
    state.enemy.personalityId,
    state.enemy.maxHp,
    enemySkillText
  ].join('|');
  if (!force && panelKeys.tower === key) return;
  panelKeys.tower = key;

  controls.towerBox.innerHTML = `
    <div class="tower-row"><span>현재 층</span><strong>${state.run.floor}층${isBossFloor ? ' · 보스' : ''}</strong></div>
    <div class="tower-row"><span>승리 횟수</span><strong>${state.run.victories}회</strong></div>
    <div class="tower-row"><span>상대 무기</span><strong>${enemyWeapon.name}</strong></div>
    <div class="tower-row"><span>상대 성격</span><strong>${enemyPersonality.name}</strong></div>
    <div class="tower-row"><span>상대 스킬</span><strong>${enemySkillText}</strong></div>
    <div class="tower-row"><span>상대 최대 체력</span><strong>${state.enemy.maxHp}</strong></div>
  `;

  controls.enemyPreview.textContent = '상대는 매 층 무기, 성격, 스탯, 스킬이 랜덤으로 정해지며 층이 오를수록 강해집니다.';
}

function renderPlayerInfo(force = false) {
  if (!run || !state) return;
  const player = run.player;
  const expNeed = getNextLevelExp(player.level);
  const expRatio = Math.min(100, Math.round((player.exp / expNeed) * 100));
  const canSpend = player.statPoints > 0 && !state.running && !state.result;
  const skillText = player.skills.length
    ? player.skills.map((skillId) => `<span class="tag">${SKILLS[skillId]?.name}</span>`).join('')
    : '<span class="muted-small">보유 스킬 없음</span>';
  const statKey = Object.entries(player.stats).map(([key, value]) => `${key}:${value}`).join(',');
  const key = [
    player.level,
    player.exp,
    player.statPoints,
    player.mastery,
    statKey,
    player.skills.join(','),
    state.running ? 'running' : 'ready',
    state.result || 'none'
  ].join('|');
  if (!force && panelKeys.player === key) return;
  panelKeys.player = key;

  const statButtons = Object.entries(player.stats).map(([key, value]) => `
    <button class="stat-button" type="button" data-stat="${key}" ${canSpend ? '' : 'disabled'}>
      <span>${STAT_LABELS[key]}</span>
      <strong>${value}</strong>
    </button>
  `).join('');

  controls.playerBox.innerHTML = `
    <div class="tower-row"><span>레벨</span><strong>Lv.${player.level}</strong></div>
    <div class="tower-row"><span>경험치</span><strong>${player.exp} / ${expNeed}</strong></div>
    <div class="hpbar expbar"><i style="width:${expRatio}%"></i></div>
    <div class="tower-row"><span>스탯 포인트</span><strong>${player.statPoints}</strong></div>
    <div class="tower-row"><span>무기 숙련</span><strong>${player.mastery}</strong></div>
    <div class="stat-grid">${statButtons}</div>
    <div class="skill-list">${skillText}</div>
    <p class="hint-text">전투 전과 다음 층 대기 상태에서 스탯을 배분할 수 있습니다.</p>
  `;
}

function renderRewardBox(force = false) {
  if (!state?.run?.pendingRewards?.length || state.result !== 'victory') {
    hideRewardBox();
    return;
  }

  const nextKey = `${state.run.floor}:${state.run.pendingRewards.map((reward) => reward.id).join('|')}`;
  if (!force && panelKeys.reward === nextKey) return;
  panelKeys.reward = nextKey;

  controls.overlayRewardBox.classList.remove('hidden');
  controls.overlayRewardBox.innerHTML = state.run.pendingRewards.map((reward) => `
    <button class="reward-button" type="button" data-reward="${reward.id}">
      <strong>${reward.title}</strong>
      <span>${reward.description}</span>
    </button>
  `).join('');
}

function hideRewardBox() {
  panelKeys.reward = '';
  controls.overlayRewardBox.classList.add('hidden');
  controls.overlayRewardBox.innerHTML = '';
}

function renderControlState(force = false) {
  if (!state) return;
  const setupEditable = canEditCharacterSetup();
  const canStartFloor = canStartCurrentFloor();
  const canNewCharacter = canCreateNewCharacter();
  const key = [
    state.running ? 'running' : 'idle',
    state.result || 'none',
    state.paused ? 'paused' : 'live',
    setupEditable ? 'setup' : 'locked',
    run?.floor || 0,
    run?.victories || 0
  ].join('|');
  if (!force && panelKeys.controls === key) return;
  panelKeys.controls = key;

  controls.playerWeapon.disabled = !setupEditable;
  controls.playerPersonality.disabled = !setupEditable;
  controls.pauseBtn.disabled = !state.running || !!state.result;
  const freshReady = !state.running && !state.result && run?.floor === TOWER_RULES.startFloor && run?.victories === 0;
  controls.giveUpBtn.disabled = !run?.active || !!state.result || freshReady;

  if (state.running && !state.result) {
    controls.startBtn.textContent = '전투 진행 중';
    controls.startBtn.disabled = true;
  } else if (state.result === 'victory') {
    controls.startBtn.textContent = '보상 선택 필요';
    controls.startBtn.disabled = true;
  } else if (canStartFloor) {
    controls.startBtn.textContent = run.floor === TOWER_RULES.startFloor && run.victories === 0 ? '탑 등반 시작' : '현재 층 전투 시작';
    controls.startBtn.disabled = false;
  } else if (canNewCharacter) {
    controls.startBtn.textContent = '새 캐릭터 생성';
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
    panelKeys.player = '';
    panelKeys.tower = '';
    showOverlay(
      'VICTORY',
      `${levelText}${state.run.floor}층을 클리어했습니다. 보상을 하나 선택하면 ${nextFloor}층으로 이동합니다.`,
      '',
      'waitReward',
      { hideButton: true }
    );
    renderAllPanels(true);
  } else if (state.result === 'defeat') {
    showOverlay(
      'DEFEAT',
      `${state.run.floor}층에서 쓰러졌습니다. 같은 구조로 새 런을 다시 시작합니다.`,
      '새 캐릭터 생성',
      'retry'
    );
    renderAllPanels(true);
  } else {
    showOverlay('DRAW', '두 유닛이 동시에 쓰러졌습니다. 현재 층을 다시 진행합니다.', '현재 층 재도전', 'start');
    renderAllPanels(true);
  }
}

function showOverlay(title, text, buttonText, action, options = {}) {
  controls.resultTitle.textContent = title;
  controls.resultText.textContent = text;
  controls.overlayActionBtn.textContent = buttonText;
  controls.overlayActionBtn.dataset.action = action;
  controls.overlayActionBtn.disabled = !!options.disabled;
  controls.overlayActionBtn.classList.toggle('hidden', !!options.hideButton);
  if (!options.keepRewards) hideRewardBox();
  controls.resultOverlay.classList.remove('hidden');
}

function hideOverlay() {
  controls.resultOverlay.classList.add('hidden');
  controls.overlayActionBtn.disabled = false;
  controls.overlayActionBtn.classList.remove('hidden');
  hideRewardBox();
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
    controls: ''
  };
}
