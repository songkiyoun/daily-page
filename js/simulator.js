// simulator.js
// 전투 코어를 반복 실행해 무기·성격 조합의 흐름을 빠르게 확인합니다.
// 수정 원칙: 실제 전투 로직을 복사하지 않고 state.js와 battle.js의 기존 함수를 사용합니다.

import { PERSONALITIES, WEAPONS } from './data.js';
import { createBattleState, createFixedEnemyConfig, createRun, startState } from './state.js';
import { updateBattle } from './battle.js';

const DEFAULT_MAX_FRAMES = 60 * 90;

export function runSimulator(config) {
  const rounds = Number(config.rounds || 30);
  const floor = Number(config.floor || 1);
  const summary = createSummary(config, rounds);

  for (let i = 0; i < rounds; i += 1) {
    const result = runSingleSimulation(config, floor, i);
    applyRoundResult(summary, result);
  }

  finalizeSummary(summary);
  return summary;
}

function runSingleSimulation(config, floor, index) {
  const run = createRun({
    playerWeapon: config.playerWeapon,
    playerPersonality: config.playerPersonality
  });
  run.floor = floor;
  run.player.name = 'SIM PLAYER';

  const enemyConfig = createFixedEnemyConfig({
    weaponId: config.enemyWeapon,
    personalityId: config.enemyPersonality,
    floor,
    name: 'SIM ENEMY'
  });

  const spawnSkew = index % 2 === 0 ? 54 : -54;
  const state = createBattleState(run, { enemyConfig, spawnSkew });
  startState(state);

  let frames = 0;
  while (!state.result && frames < DEFAULT_MAX_FRAMES) {
    updateBattle(state);
    frames += 1;
  }

  if (!state.result) {
    state.result = 'draw';
    state.running = false;
  }

  return {
    result: state.result,
    frames,
    playerHits: state.player.hits,
    enemyHits: state.enemy.hits,
    playerDamage: state.player.damageDealt,
    enemyDamage: state.enemy.damageDealt,
    playerHp: Math.max(0, state.player.hp),
    enemyHp: Math.max(0, state.enemy.hp)
  };
}

function createSummary(config, rounds) {
  return {
    rounds,
    playerWeapon: config.playerWeapon,
    playerPersonality: config.playerPersonality,
    enemyWeapon: config.enemyWeapon,
    enemyPersonality: config.enemyPersonality,
    wins: 0,
    losses: 0,
    draws: 0,
    totalFrames: 0,
    playerHits: 0,
    enemyHits: 0,
    playerDamage: 0,
    enemyDamage: 0,
    playerHpLeft: 0,
    enemyHpLeft: 0,
    avgSeconds: 0,
    winRate: 0
  };
}

function applyRoundResult(summary, result) {
  if (result.result === 'victory') summary.wins += 1;
  else if (result.result === 'defeat') summary.losses += 1;
  else summary.draws += 1;

  summary.totalFrames += result.frames;
  summary.playerHits += result.playerHits;
  summary.enemyHits += result.enemyHits;
  summary.playerDamage += result.playerDamage;
  summary.enemyDamage += result.enemyDamage;
  summary.playerHpLeft += result.playerHp;
  summary.enemyHpLeft += result.enemyHp;
}

function finalizeSummary(summary) {
  const rounds = Math.max(1, summary.rounds);
  summary.winRate = Math.round((summary.wins / rounds) * 100);
  summary.avgSeconds = Math.round((summary.totalFrames / rounds / 60) * 10) / 10;
  summary.avgPlayerHits = Math.round((summary.playerHits / rounds) * 10) / 10;
  summary.avgEnemyHits = Math.round((summary.enemyHits / rounds) * 10) / 10;
  summary.avgPlayerDamage = Math.round((summary.playerDamage / rounds) * 10) / 10;
  summary.avgEnemyDamage = Math.round((summary.enemyDamage / rounds) * 10) / 10;
  summary.avgPlayerHpLeft = Math.round((summary.playerHpLeft / rounds) * 10) / 10;
  summary.avgEnemyHpLeft = Math.round((summary.enemyHpLeft / rounds) * 10) / 10;
}

export function formatSimulatorSummary(summary) {
  const playerLabel = `${WEAPONS[summary.playerWeapon]?.name || summary.playerWeapon} · ${PERSONALITIES[summary.playerPersonality]?.name || summary.playerPersonality}`;
  const enemyLabel = `${WEAPONS[summary.enemyWeapon]?.name || summary.enemyWeapon} · ${PERSONALITIES[summary.enemyPersonality]?.name || summary.enemyPersonality}`;

  return `
    <div class="sim-result-row"><span>조합</span><strong>${playerLabel} vs ${enemyLabel}</strong></div>
    <div class="sim-result-row"><span>결과</span><strong>${summary.wins}승 ${summary.losses}패 ${summary.draws}무 · 승률 ${summary.winRate}%</strong></div>
    <div class="sim-result-row"><span>평균 시간</span><strong>${summary.avgSeconds}초</strong></div>
    <div class="sim-result-row"><span>평균 명중</span><strong>내 ${summary.avgPlayerHits}회 / 상대 ${summary.avgEnemyHits}회</strong></div>
    <div class="sim-result-row"><span>평균 피해</span><strong>내 ${summary.avgPlayerDamage} / 상대 ${summary.avgEnemyDamage}</strong></div>
    <div class="sim-result-row"><span>평균 잔여 HP</span><strong>내 ${summary.avgPlayerHpLeft} / 상대 ${summary.avgEnemyHpLeft}</strong></div>
  `;
}
