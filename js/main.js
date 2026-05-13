// main.js
// 앱 초기화, UI 연결, 단일 게임 루프만 담당합니다.
// requestAnimationFrame은 이 파일에서만 호출합니다.

import { PERSONALITIES, VERSION, WEAPONS } from './data.js';
import { createInitialState, startState, togglePause } from './state.js';
import { updateBattle } from './battle.js';
import { render } from './render.js';

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');

const controls = {
  playerWeapon: document.getElementById('playerWeapon'),
  playerPersonality: document.getElementById('playerPersonality'),
  enemyWeapon: document.getElementById('enemyWeapon'),
  enemyPersonality: document.getElementById('enemyPersonality'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  statusBox: document.getElementById('statusBox'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText')
};

let state = null;

init();
requestAnimationFrame(loop);

function init() {
  populateSelect(controls.playerWeapon, WEAPONS, 'eastern');
  populateSelect(controls.enemyWeapon, WEAPONS, 'spear');
  populateSelect(controls.playerPersonality, PERSONALITIES, 'balanced');
  populateSelect(controls.enemyPersonality, PERSONALITIES, 'balanced');

  controls.startBtn.addEventListener('click', startBattleFromControls);
  controls.restartBtn.addEventListener('click', startBattleFromControls);
  controls.pauseBtn.addEventListener('click', () => {
    if (!state) return;
    togglePause(state);
    updatePauseButton();
  });

  state = createInitialState(readConfig());
  render(ctx, state);
  renderStatus();
  showIntroOverlay();
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
    playerPersonality: controls.playerPersonality.value,
    enemyWeapon: controls.enemyWeapon.value,
    enemyPersonality: controls.enemyPersonality.value
  };
}

function startBattleFromControls() {
  state = createInitialState(readConfig());
  startState(state);
  hideOverlay();
  updatePauseButton();
}

function loop() {
  if (state) {
    updateBattle(state);
    render(ctx, state);
    renderStatus();
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
    return `
      <div class="status-row">
        <div class="status-head">
          <strong>${unit.name}</strong>
          <span>${Math.ceil(unit.hp)} / ${unit.maxHp}</span>
        </div>
        <div class="hpbar"><i style="width:${ratio}%"></i></div>
        <div class="status-note">${weapon.name} · ${personality.name} · ${unit.lastAction} · 명중 ${unit.hits}회</div>
      </div>
    `;
  }).join('');
}

function renderResultIfNeeded() {
  if (!state || !state.result) return;

  if (state.result === 'victory') {
    showOverlay('VICTORY', '상대를 쓰러뜨렸습니다. 다음 단계에서는 보상과 층 이동을 붙일 수 있습니다.');
  } else if (state.result === 'defeat') {
    showOverlay('DEFEAT', '플레이어가 쓰러졌습니다. 전투 수치와 AI 이동을 조정해 다시 테스트하세요.');
  } else {
    showOverlay('DRAW', '두 유닛이 동시에 쓰러졌습니다.');
  }
}

function showIntroOverlay() {
  showOverlay('READY', '무기와 성격을 선택한 뒤 전투를 시작하세요.');
}

function showOverlay(title, text) {
  controls.resultTitle.textContent = title;
  controls.resultText.textContent = text;
  controls.resultOverlay.classList.remove('hidden');
}

function hideOverlay() {
  controls.resultOverlay.classList.add('hidden');
}

function updatePauseButton() {
  controls.pauseBtn.textContent = state?.paused ? '계속' : '일시정지';
}
