// main.js
// 앱 초기화, UI 연결, 단일 게임 루프만 담당합니다.
// requestAnimationFrame은 이 파일에서만 호출합니다.

import { PERSONALITIES, TOWER_RULES, VERSION, WEAPONS } from './data.js';
import { advanceRunFloor, createBattleState, createRun, startState, togglePause } from './state.js';
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
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  enemyPreview: document.getElementById('enemyPreview'),
  version: document.getElementById('versionBadge')
};

let state = null;
let run = null;

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
  renderStatus();
  renderTowerInfo();
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
  updatePauseButton();
}

function startCurrentFloor() {
  startState(state);
  hideOverlay();
  updatePauseButton();
}

function goNextFloor() {
  state = advanceRunFloor(state);
  startState(state);
  hideOverlay();
  updatePauseButton();
}

function handleOverlayAction() {
  const action = controls.overlayActionBtn.dataset.action;
  if (action === 'next') {
    goNextFloor();
    return;
  }
  if (action === 'retry') {
    startNewRun();
    return;
  }
  startCurrentFloor();
}

function loop() {
  if (state) {
    updateBattle(state);
    render(ctx, state);
    renderStatus();
    renderTowerInfo();
    renderResultIfNeeded();
  }
  requestAnimationFrame(loop);
}

function renderStatus() {
  if (!state) return;
  controls.statusBox.innerHTML = [state.player, state.enemy].map((unit) => {
    const weapon = WEAPONS[unit.weaponId];
    const personality = PERSONALITIES[unit.personalityId];
    const ratio = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
    const attackScale = Math.round(unit.attackScale * 100);
    return `
      <div class="status-row">
        <div class="status-head">
          <strong>${unit.name}</strong>
          <span>${Math.ceil(unit.hp)} / ${unit.maxHp}</span>
        </div>
        <div class="hpbar"><i style="width:${ratio}%"></i></div>
        <div class="status-note">${weapon.name} · ${personality.name} · 공격 ${attackScale}% · ${unit.lastAction} · 명중 ${unit.hits}회</div>
      </div>
    `;
  }).join('');
}

function renderTowerInfo() {
  if (!state) return;
  const enemyWeapon = WEAPONS[state.enemy.weaponId];
  const enemyPersonality = PERSONALITIES[state.enemy.personalityId];
  const isBossFloor = state.run.floor % TOWER_RULES.bossInterval === 0;

  controls.towerBox.innerHTML = `
    <div class="tower-row"><span>현재 층</span><strong>${state.run.floor}층${isBossFloor ? ' · 보스' : ''}</strong></div>
    <div class="tower-row"><span>승리 횟수</span><strong>${state.run.victories}회</strong></div>
    <div class="tower-row"><span>상대 무기</span><strong>${enemyWeapon.name}</strong></div>
    <div class="tower-row"><span>상대 성격</span><strong>${enemyPersonality.name}</strong></div>
    <div class="tower-row"><span>상대 체력</span><strong>${state.enemy.maxHp}</strong></div>
  `;

  controls.enemyPreview.textContent = `다음 상대는 매 층 무기와 성격이 랜덤으로 정해지며, 층이 오를수록 체력·공격·방어가 상승합니다.`;
}

function renderResultIfNeeded() {
  if (!state || !state.result || controls.resultOverlay.dataset.resultFrame === String(state.frame)) return;
  controls.resultOverlay.dataset.resultFrame = String(state.frame);

  if (state.result === 'victory') {
    const nextFloor = state.run.floor + 1;
    showOverlay(
      'VICTORY',
      `${state.run.floor}층을 클리어했습니다. 다음 상대는 ${nextFloor}층에서 새롭게 랜덤 생성됩니다.`,
      `${nextFloor}층으로 이동`,
      'next'
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

function showOverlay(title, text, buttonText, action) {
  controls.resultTitle.textContent = title;
  controls.resultText.textContent = text;
  controls.overlayActionBtn.textContent = buttonText;
  controls.overlayActionBtn.dataset.action = action;
  controls.resultOverlay.dataset.resultFrame = '';
  controls.resultOverlay.classList.remove('hidden');
}

function hideOverlay() {
  controls.resultOverlay.classList.add('hidden');
}

function updatePauseButton() {
  controls.pauseBtn.textContent = state?.paused ? '계속' : '일시정지';
}
