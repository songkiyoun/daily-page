// simulator.js
// 전체 무기·성격 조합을 반복 실행해 복사 가능한 밸런스 결과를 만듭니다.
// 수정 원칙: 실제 전투 로직을 복사하지 않고 state.js와 battle.js의 기존 함수를 사용합니다.

import { PERSONALITIES, WEAPONS } from './data.js';
import { createBattleState, createFixedEnemyConfig, createRun, startState } from './state.js';
import { updateBattle } from './battle.js';

const DEFAULT_MAX_FRAMES = 60 * 90;

export function runAllMatchupSimulator(config = {}) {
  const rounds = Number(config.rounds || 10);
  const floor = Number(config.floor || 1);
  const combos = getAllCombos();
  const rows = [];

  for (const player of combos) {
    for (const enemy of combos) {
      const row = runMatchup({
        playerWeapon: player.weaponId,
        playerPersonality: player.personalityId,
        enemyWeapon: enemy.weaponId,
        enemyPersonality: enemy.personalityId,
        rounds,
        floor
      });
      rows.push(row);
    }
  }

  return buildAllSummary(rows, rounds, floor);
}

function getAllCombos() {
  const combos = [];
  Object.values(WEAPONS).forEach((weapon) => {
    Object.values(PERSONALITIES).forEach((personality) => {
      combos.push({ weaponId: weapon.id, personalityId: personality.id });
    });
  });
  return combos;
}

function runMatchup(config) {
  const summary = createMatchupSummary(config);
  for (let i = 0; i < config.rounds; i += 1) {
    const reversed = i % 2 === 1;
    const result = runSingleSimulation(config, i, reversed);
    applyRoundResult(summary, result);
  }
  finalizeMatchupSummary(summary);
  return summary;
}

function runSingleSimulation(config, index, reversed = false) {
  const logicalPlayer = {
    weaponId: config.playerWeapon,
    personalityId: config.playerPersonality
  };
  const logicalEnemy = {
    weaponId: config.enemyWeapon,
    personalityId: config.enemyPersonality
  };

  const leftCombo = reversed ? logicalEnemy : logicalPlayer;
  const rightCombo = reversed ? logicalPlayer : logicalEnemy;

  const run = createRun({
    playerWeapon: leftCombo.weaponId,
    playerPersonality: leftCombo.personalityId
  });
  run.floor = config.floor;
  run.player.name = reversed ? 'SIM RIGHT' : 'SIM LEFT';

  const enemyConfig = createFixedEnemyConfig({
    weaponId: rightCombo.weaponId,
    personalityId: rightCombo.personalityId,
    floor: config.floor,
    name: reversed ? 'SIM LEFT' : 'SIM RIGHT'
  });

  const spawnSkew = index % 4 < 2 ? 54 : -54;
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

  const leftWon = state.result === 'victory';
  const rightWon = state.result === 'defeat';
  const logicalPlayerWon = reversed ? rightWon : leftWon;
  const logicalEnemyWon = reversed ? leftWon : rightWon;

  const playerUnit = reversed ? state.enemy : state.player;
  const enemyUnit = reversed ? state.player : state.enemy;

  return {
    result: state.result === 'draw' ? 'draw' : logicalPlayerWon ? 'victory' : logicalEnemyWon ? 'defeat' : 'draw',
    frames,
    playerHits: playerUnit.hits,
    enemyHits: enemyUnit.hits,
    playerDamage: playerUnit.damageDealt,
    enemyDamage: enemyUnit.damageDealt,
    playerHp: Math.max(0, playerUnit.hp),
    enemyHp: Math.max(0, enemyUnit.hp),
    reversed
  };
}

function createMatchupSummary(config) {
  return {
    rounds: config.rounds,
    floor: config.floor,
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
    enemyHpLeft: 0
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

function finalizeMatchupSummary(summary) {
  const rounds = Math.max(1, summary.rounds);
  summary.winRate = Math.round((summary.wins / rounds) * 100);
  summary.avgSeconds = round1(summary.totalFrames / rounds / 60);
  summary.avgPlayerHits = round1(summary.playerHits / rounds);
  summary.avgEnemyHits = round1(summary.enemyHits / rounds);
  summary.avgHitDiff = round1(summary.avgPlayerHits - summary.avgEnemyHits);
  summary.avgPlayerDamage = round1(summary.playerDamage / rounds);
  summary.avgEnemyDamage = round1(summary.enemyDamage / rounds);
  summary.avgPlayerHpLeft = round1(summary.playerHpLeft / rounds);
  summary.avgEnemyHpLeft = round1(summary.enemyHpLeft / rounds);
}

function buildAllSummary(rows, rounds, floor) {
  const sortedRows = [...rows].sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.avgHitDiff - a.avgHitDiff;
  });
  return {
    rounds,
    floor,
    rows,
    sortedRows,
    totalMatchups: rows.length,
    topRows: sortedRows.slice(0, 8),
    weakRows: sortedRows.slice(-8).reverse()
  };
}

export function formatAllMatchupSummary(summary) {
  const top = summary.topRows.slice(0, 3).map((row) => `${label(row.playerWeapon, row.playerPersonality)} ${row.winRate}%`).join(' · ');
  const weak = summary.weakRows.slice(0, 3).map((row) => `${label(row.playerWeapon, row.playerPersonality)} ${row.winRate}%`).join(' · ');
  return `
    <div class="sim-result-row"><span>전체 대진</span><strong>${summary.totalMatchups}개 조합 · 각 ${summary.rounds}회 · 양방향 보정</strong></div>
    <div class="sim-result-row"><span>상위 경향</span><strong>${top}</strong></div>
    <div class="sim-result-row"><span>하위 경향</span><strong>${weak}</strong></div>
  `;
}

export function copyableAllMatchupText(summary) {
  const lines = [
    `Circle Battle Tower Rebuild v0.6.11 전체 조합 시뮬레이션`,
    `반복 횟수	${summary.rounds}`,
    `대진 방식	양방향 보정`,
    `층	${summary.floor}`,
    '',
    '내 조합	상대 조합	승	패	무	승률%	평균 시간	내 평균 명중	상대 평균 명중	명중 차이	내 평균 피해	상대 평균 피해	내 평균 잔여HP	상대 평균 잔여HP'
  ];

  summary.rows.forEach((row) => {
    lines.push([
      label(row.playerWeapon, row.playerPersonality),
      label(row.enemyWeapon, row.enemyPersonality),
      row.wins,
      row.losses,
      row.draws,
      row.winRate,
      row.avgSeconds,
      row.avgPlayerHits,
      row.avgEnemyHits,
      row.avgHitDiff,
      row.avgPlayerDamage,
      row.avgEnemyDamage,
      row.avgPlayerHpLeft,
      row.avgEnemyHpLeft
    ].join('	'));
  });

  return lines.join('\n');
}

function label(weaponId, personalityId) {
  return `${WEAPONS[weaponId]?.name || weaponId}-${PERSONALITIES[personalityId]?.name || personalityId}`;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
