// features/soulRoad.js
// 영혼의 길 계열 콘텐츠를 관리합니다.
// 보스 도감, 클리어 기록, 업적, 라이벌/숙적 기록은 이 모듈에서 확장합니다.

import { BOSS_PROFILES, TOWER_RULES, WEAPONS } from '../data.js';

export const SOUL_ROAD_TABS = [
  { id: 'bossCodex', name: '보스 도감', description: '만난 보스와 처치 기록을 확인합니다.' },
  { id: 'clearRecords', name: '클리어 기록', description: '도전과 층 등반 기록을 확인합니다.' },
  { id: 'achievements', name: '업적', description: '달성한 업적과 앞으로 열릴 목표를 확인합니다.' },
  { id: 'rivals', name: '라이벌 기록', description: '앞으로 추가될 라이벌과 숙적 기록을 확인합니다.' }
];

const DEFAULT_ACHIEVEMENTS = [
  { id: 'firstBoss', name: '첫 보스 처치', text: '아무 보스나 1회 처치합니다.', test: (data) => (data.records?.bossClears || 0) >= 1 },
  { id: 'floor20', name: '20층 도달', text: '최고 도달 층 20층 이상을 기록합니다.', test: (data) => (data.records?.bestFloor || 1) >= 20 },
  { id: 'floor40', name: '40층 도달', text: '최고 도달 층 40층 이상을 기록합니다.', test: (data) => (data.records?.bestFloor || 1) >= 40 },
  { id: 'bossCollector', name: '보스 관찰자', text: '서로 다른 보스를 4종 이상 만납니다.', test: (data) => Object.values(data.bossCodex || {}).filter((item) => item.seen).length >= 4 },
  { id: 'bossHunter', name: '보스 사냥꾼', text: '보스를 누적 5회 처치합니다.', test: (data) => (data.records?.bossClears || 0) >= 5 }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBossCodex(source = {}) {
  const codex = {};
  BOSS_PROFILES.forEach((boss) => {
    const current = source[boss.id] || {};
    codex[boss.id] = {
      bossId: boss.id,
      name: boss.name,
      title: boss.title || '',
      description: boss.description || '',
      pattern: boss.pattern || '',
      weaponId: boss.weaponId || '',
      bossSkillName: boss.bossSkill?.name || boss.bossSkill?.id || '',
      seen: !!current.seen,
      defeated: !!current.defeated,
      firstSeenFloor: toNumber(current.firstSeenFloor, 0),
      firstDefeatedFloor: toNumber(current.firstDefeatedFloor, 0),
      defeatCount: Math.max(0, Math.floor(toNumber(current.defeatCount, 0))),
      lastSeenAt: current.lastSeenAt || '',
      lastDefeatedAt: current.lastDefeatedAt || ''
    };
  });
  return codex;
}

export function normalizeSoulRoadData(source = {}) {
  const recordsSource = source.records || {};
  return {
    bossCodex: normalizeBossCodex(source.bossCodex || {}),
    records: {
      bestFloor: Math.max(TOWER_RULES.startFloor, Math.floor(toNumber(recordsSource.bestFloor, TOWER_RULES.startFloor))),
      totalVictories: Math.max(0, Math.floor(toNumber(recordsSource.totalVictories, 0))),
      bossClears: Math.max(0, Math.floor(toNumber(recordsSource.bossClears, 0))),
      highestBossFloor: Math.max(0, Math.floor(toNumber(recordsSource.highestBossFloor, 0))),
      totalChallenges: Math.max(0, Math.floor(toNumber(recordsSource.totalChallenges, 0))),
      rivalDefeats: Math.max(0, Math.floor(toNumber(recordsSource.rivalDefeats, 0))),
      nemesisCount: Math.max(0, Math.floor(toNumber(recordsSource.nemesisCount, 0)))
    },
    achievements: { ...(source.achievements || {}) },
    rivals: Array.isArray(source.rivals) ? source.rivals.map((item) => ({ ...item })) : [],
    roadmap: {
      rivalSystemPlanned: true,
      nemesisBossFloorStart: 50,
      notes: [
        '일반층에서 사망 시 라이벌 등록',
        '같은 라이벌에게 반복 패배 시 라이벌 레벨 상승',
        '같은 라이벌에게 3회 이상 패배 시 숙적 승격',
        '숙적은 50층 이후 보스 후보로 등장'
      ]
    }
  };
}

export function cloneSoulRoadData(data) {
  return normalizeSoulRoadData(clone(data));
}

export function registerChallengeStart(data = {}) {
  const next = normalizeSoulRoadData(data);
  next.records.totalChallenges += 1;
  return next;
}

export function updateSoulRoadRecords(data = {}, run = null) {
  const next = normalizeSoulRoadData(data);
  if (!run) return next;
  next.records.bestFloor = Math.max(next.records.bestFloor, Math.floor(run.bestFloor || run.floor || TOWER_RULES.startFloor));
  next.records.totalVictories = Math.max(next.records.totalVictories, Math.floor(run.victories || 0));
  return next;
}

export function recordBossEncounter(data = {}, enemy = null, floor = 0, outcome = 'seen') {
  const next = normalizeSoulRoadData(data);
  if (!enemy?.bossId) return next;
  const boss = next.bossCodex[enemy.bossId];
  if (!boss) return next;
  const now = new Date().toISOString();
  const safeFloor = Math.max(0, Math.floor(floor || 0));
  boss.seen = true;
  boss.lastSeenAt = now;
  if (!boss.firstSeenFloor) boss.firstSeenFloor = safeFloor;

  if (outcome === 'victory') {
    boss.defeated = true;
    boss.defeatCount += 1;
    boss.lastDefeatedAt = now;
    if (!boss.firstDefeatedFloor) boss.firstDefeatedFloor = safeFloor;
    next.records.bossClears += 1;
    next.records.highestBossFloor = Math.max(next.records.highestBossFloor, safeFloor);
  }

  next.records.bestFloor = Math.max(next.records.bestFloor, safeFloor);
  return next;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBossCodex(data) {
  const codex = Object.values(data.bossCodex || {});
  return `
    <div class="soul-road-grid">
      ${codex.map((boss) => {
        const weapon = WEAPONS[boss.weaponId]?.name || '미확인';
        const status = boss.defeated ? '처치 완료' : (boss.seen ? '조우 완료' : '미조우');
        return `
          <article class="soul-road-card ${boss.defeated ? 'is-cleared' : boss.seen ? 'is-seen' : 'is-locked'}">
            <div class="soul-road-card-head">
              <strong>${escapeHtml(boss.seen ? boss.name : '???')}</strong>
              <span>${escapeHtml(status)}</span>
            </div>
            <p>${escapeHtml(boss.seen ? boss.title : '아직 기록되지 않은 보스입니다.')}</p>
            <dl>
              <div><dt>무기</dt><dd>${escapeHtml(boss.seen ? weapon : '-')}</dd></div>
              <div><dt>전용기</dt><dd>${escapeHtml(boss.seen ? boss.bossSkillName : '-')}</dd></div>
              <div><dt>처치</dt><dd>${boss.defeatCount}회</dd></div>
              <div><dt>최초 처치층</dt><dd>${boss.firstDefeatedFloor || '-'}</dd></div>
            </dl>
            <small>${escapeHtml(boss.seen ? boss.pattern : '보스를 만나면 패턴 정보가 기록됩니다.')}</small>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderClearRecords(data) {
  const records = data.records || {};
  return `
    <div class="soul-road-record-grid">
      <div><span>최고 도달 층</span><strong>${records.bestFloor || TOWER_RULES.startFloor}층</strong></div>
      <div><span>누적 승리</span><strong>${records.totalVictories || 0}회</strong></div>
      <div><span>보스 처치</span><strong>${records.bossClears || 0}회</strong></div>
      <div><span>최고 보스층</span><strong>${records.highestBossFloor || '-'}${records.highestBossFloor ? '층' : ''}</strong></div>
      <div><span>도전 시작</span><strong>${records.totalChallenges || 0}회</strong></div>
      <div><span>숙적 등록</span><strong>${records.nemesisCount || 0}명</strong></div>
    </div>
  `;
}

function renderAchievements(data) {
  const rows = DEFAULT_ACHIEVEMENTS.map((item) => {
    const achieved = !!data.achievements?.[item.id] || item.test(data);
    return `
      <article class="soul-road-line-card ${achieved ? 'is-cleared' : ''}">
        <strong>${achieved ? '달성' : '미달성'} · ${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.text)}</span>
      </article>
    `;
  }).join('');
  return `<div class="soul-road-line-list">${rows}</div>`;
}

function renderRivals(data) {
  const notes = data.roadmap?.notes || [];
  return `
    <div class="soul-road-line-list">
      <article class="soul-road-line-card">
        <strong>라이벌 시스템 예정</strong>
        <span>일반층에서 플레이어를 쓰러뜨린 적은 라이벌로 등록되고, 일정 층 이후 재등장합니다.</span>
      </article>
      <article class="soul-road-line-card">
        <strong>숙적 보스 예정</strong>
        <span>같은 라이벌에게 3회 이상 패배하면 숙적으로 승격되며, 50층 이후 보스 후보로 등장합니다.</span>
      </article>
      ${notes.map((note) => `<article class="soul-road-line-card muted"><span>${escapeHtml(note)}</span></article>`).join('')}
    </div>
  `;
}

export function renderSoulRoadPanel(container, data = {}, activeTab = 'bossCodex') {
  if (!container) return;
  const normalized = normalizeSoulRoadData(data);
  let body = '';
  if (activeTab === 'clearRecords') body = renderClearRecords(normalized);
  else if (activeTab === 'achievements') body = renderAchievements(normalized);
  else if (activeTab === 'rivals') body = renderRivals(normalized);
  else body = renderBossCodex(normalized);

  container.innerHTML = `
    <div class="soul-road-tabs">
      ${SOUL_ROAD_TABS.map((tab) => `
        <button class="mini-button soul-road-tab ${tab.id === activeTab ? 'active' : ''}" type="button" data-soul-road-tab="${tab.id}">
          ${escapeHtml(tab.name)}
        </button>
      `).join('')}
    </div>
    <p class="hint-text">${escapeHtml(SOUL_ROAD_TABS.find((tab) => tab.id === activeTab)?.description || '')}</p>
    ${body}
  `;
}
