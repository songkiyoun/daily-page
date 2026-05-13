// main.js
// 앱 초기화, UI 연결, 단일 게임 루프만 담당합니다.
// requestAnimationFrame은 이 파일에서만 호출합니다.

import { PERSONALITIES, SKILLS, STAT_LABELS, TOWER_RULES, VERSION, WEAPONS } from './data.js';
import {
  applyRewardAndAdvance,
  completeFloorVictory,
  createBattleState,
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
  overlayActionBtn: document.getElementById('overlayActionBtn'),
  statusBox: document.getElementById('statusBox'),
  towerBox: document.getElementById('towerBox'),
  playerBox: document.getElementById('playerBox'),
  rewardCard: document.getElementById('rewardCard'),
  rewardBox: document.getElementById('rewardBox'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  enemyPreview: document.getElementById('enemyPreview'),
  version: document.getElementById('versionBadge')
};

let state = null;
let run = null;
let rewardRenderKey = '';

init();
requestAnimationFrame(loop);

function init() {
  populateSelect(controls.playerWeapon, WEAPONS, 'eastern');
  populateSelect(controls.playerPersonality, PERSONALITIES, 'balanced');
  controls.version.textContent = `v${VERSION}`;

  controls.startBtn.addEventListener('click', startNewRun);
  controls.overlayActionBtn.addEventListener('click', handleOverlayAction);
  controls.pauseBtn.addEventListener('click', () => {
    if (!state) return;
    togglePause(state);
    updatePauseButton();
  });

  run = createRun(readConfig());
  state = createBattleState(run);
  render(ctx, state);
  renderAllPanels();
  showOverlay('READY', '무기와 성격을 선택한 뒤 탑 등반을 시작하세요.', '탑 등반 시작', 'start');
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
  startState(state);
  hideOverlay();
  hideRewardBox();
  updatePauseButton();
}

function startCurrentFloor() {
  startState(state);
  hideOverlay();
  updatePauseButton();
}

function handleOverlayAction() {
  const action = controls.overlayActionBtn.dataset.action;
  if (action === 'retry') {
    startNewRun();
    return;
  }
  if (action === 'start') {
    startCurrentFloor();
  }
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

function renderAllPanels() {
  renderStatus();
  renderTowerInfo();
  renderPlayerInfo();
  renderRewardBox();
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

function renderTowerInfo() {
  if (!state) return;
  const enemyWeapon = WEAPONS[state.enemy.weaponId];
  const enemyPersonality = PERSONALITIES[state.enemy.personalityId];
  const isBossFloor = state.run.floor % TOWER_RULES.bossInterval === 0;
  const enemySkillText = state.enemy.skills.length
    ? state.enemy.skills.map((skillId) => SKILLS[skillId]?.name).join(' · ')
    : '없음';

  controls.towerBox.innerHTML = `
    <div class="tower-row"><span>현재 층</span><strong>${state.run.floor}층${isBossFloor ? ' · 보스' : ''}</strong></div>
    <div class="tower-row"><span>승리 횟수</span><strong>${state.run.victories}회</strong></div>
    <div class="tower-row"><span>상대 무기</span><strong>${enemyWeapon.name}</strong></div>
    <div class="tower-row"><span>상대 성격</span><strong>${enemyPersonality.name}</strong></div>
    <div class="tower-row"><span>상대 스킬</span><strong>${enemySkillText}</strong></div>
    <div class="tower-row"><span>상대 체력</span><strong>${state.enemy.maxHp}</strong></div>
  `;

  controls.enemyPreview.textContent = '상대는 매 층 무기, 성격, 스탯, 스킬이 랜덤으로 정해지며 층이 오를수록 강해집니다.';
}

function renderPlayerInfo() {
  if (!run) return;
  const player = run.player;
  const expNeed = getNextLevelExp(player.level);
  const expRatio = Math.min(100, Math.round((player.exp / expNeed) * 100));
  const skillText = player.skills.length
    ? player.skills.map((skillId) => `<span class="tag">${SKILLS[skillId]?.name}</span>`).join('')
    : '<span class="muted-small">보유 스킬 없음</span>';
  const statButtons = Object.entries(player.stats).map(([key, value]) => {
    const canSpend = player.statPoints > 0 && !state.running && !state.result;
    return `
      <button class="stat-button" data-stat="${key}" ${canSpend ? '' : 'disabled'}>
        <span>${STAT_LABELS[key]}</span>
        <strong>${value}</strong>
      </button>
    `;
  }).join('');

  controls.playerBox.innerHTML = `
    <div class="tower-row"><span>레벨</span><strong>Lv.${player.level}</strong></div>
    <div class="tower-row"><span>경험치</span><strong>${player.exp} / ${expNeed}</strong></div>
    <div class="hpbar expbar"><i style="width:${expRatio}%"></i></div>
    <div class="tower-row"><span>스탯 포인트</span><strong>${player.statPoints}</strong></div>
    <div class="tower-row"><span>무기 숙련</span><strong>${player.mastery}</strong></div>
    <div class="stat-grid">${statButtons}</div>
    <div class="skill-list">${skillText}</div>
    <p class="hint-text">새 런은 기본 스탯 포인트를 가지고 시작합니다. 전투가 시작되기 전 스탯 버튼을 눌러 방향성을 정하세요.</p>
  `;

  controls.playerBox.querySelectorAll('.stat-button').forEach((button) => {
    button.addEventListener('click', () => {
      const didSpend = spendPlayerStat(run, button.dataset.stat);
      if (!didSpend) return;
      refreshPlayerUnit(state);
      renderAllPanels();
    });
  });
}

function renderRewardBox() {
  if (!state?.run.pendingRewards?.length || state.result !== 'victory') {
    hideRewardBox();
    return;
  }

  const nextKey = `${state.run.floor}:${state.run.pendingRewards.map((reward) => reward.id).join('|')}`;
  controls.rewardCard.classList.remove('hidden');

  // 보상 화면이 열린 뒤 매 프레임 버튼을 다시 만들면 클릭 중인 DOM이 교체되어
  // 마우스 클릭이 정상적으로 완료되지 않을 수 있습니다.
  // 따라서 같은 보상 묶음은 한 번만 렌더링하고, 실제 수정은 이 함수 내부에서 직접 처리합니다.
  if (rewardRenderKey === nextKey) return;
  rewardRenderKey = nextKey;

  controls.rewardBox.innerHTML = state.run.pendingRewards.map((reward) => `
    <button class="reward-button" type="button" data-reward="${reward.id}">
      <strong>${reward.title}</strong>
      <span>${reward.description}</span>
    </button>
  `).join('');

  controls.rewardBox.querySelectorAll('.reward-button').forEach((button) => {
    button.addEventListener('click', () => {
      state = applyRewardAndAdvance(state, button.dataset.reward);
      hideRewardBox();
      updatePauseButton();
      renderAllPanels();
      showOverlay(
        'NEXT FLOOR',
        `${state.run.floor}층에 도착했습니다. 체력은 완전히 회복되었습니다. 스탯 포인트가 있다면 배분한 뒤 전투를 시작하세요.`,
        '전투 시작',
        'start'
      );
    });
  });
}

function hideRewardBox() {
  rewardRenderKey = '';
  controls.rewardCard.classList.add('hidden');
  controls.rewardBox.innerHTML = '';
}

function renderResultIfNeeded() {
  if (!state || !state.result || controls.resultOverlay.dataset.resultFrame === String(state.frame)) return;
  controls.resultOverlay.dataset.resultFrame = String(state.frame);

  if (state.result === 'victory') {
    completeFloorVictory(state);
    const nextFloor = state.run.floor + 1;
    const levelText = state.run.levelMessage ? `${state.run.levelMessage}\n` : '';
    showOverlay(
      'VICTORY',
      `${levelText}${state.run.floor}층을 클리어했습니다. 오른쪽에서 보상을 선택하면 ${nextFloor}층으로 이동합니다.`,
      '보상 선택 대기',
      'waitReward',
      true
    );
  } else if (state.result === 'defeat') {
    showOverlay(
      'DEFEAT',
      `${state.run.floor}층에서 쓰러졌습니다. 같은 구조로 새 런을 다시 시작합니다.`,
      '새 런 시작',
      'retry'
    );
  } else {
    showOverlay('DRAW', '두 유닛이 동시에 쓰러졌습니다. 현재 층을 다시 진행합니다.', '현재 층 재도전', 'start');
  }
}

function showOverlay(title, text, buttonText, action, disabled = false) {
  controls.resultTitle.textContent = title;
  controls.resultText.textContent = text;
  controls.overlayActionBtn.textContent = buttonText;
  controls.overlayActionBtn.dataset.action = action;
  controls.overlayActionBtn.disabled = disabled;
  controls.resultOverlay.classList.remove('hidden');
}

function hideOverlay() {
  controls.resultOverlay.classList.add('hidden');
  controls.overlayActionBtn.disabled = false;
}

function updatePauseButton() {
  controls.pauseBtn.textContent = state?.paused ? '계속' : '일시정지';
}
