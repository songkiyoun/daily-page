// features/soulRoad.js
// 영혼의 길 계열 콘텐츠를 관리합니다.
// 보스 도감, 클리어 기록, 업적, 라이벌/숙적 기록은 이 모듈에서 확장합니다.

import { BOSS_PROFILES, TOWER_RULES, WEAPONS } from '../data.js';
import { normalizeRivalList } from './rivals.js';

export const SOUL_ROAD_TABS = [
  { id: 'bossCodex', name: '보스 도감', description: '만난 보스와 처치 기록을 확인합니다.' },
  { id: 'clearRecords', name: '클리어 기록', description: '도전과 층 등반 기록을 확인합니다.' },
  { id: 'achievements', name: '업적', description: '달성한 업적과 앞으로 열릴 목표를 확인합니다.' },
  { id: 'rivals', name: '라이벌 기록', description: '일반층에서 나를 쓰러뜨린 라이벌을 확인합니다.' },
  { id: 'nemesis', name: '숙적 기록', description: '활성 숙적과 봉인된 숙적을 확인합니다.' }
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
  const rivals = normalizeRivalList(source.rivals || []);
  const activeNemesisCount = rivals.filter((item) => item.isNemesis && item.nemesisState !== 'sealed').length;
  const sealedNemesisCount = rivals.filter((item) => item.nemesisState === 'sealed' || item.isSealed).length;
  return {
    bossCodex: normalizeBossCodex(source.bossCodex || {}),
    records: {
      bestFloor: Math.max(TOWER_RULES.startFloor, Math.floor(toNumber(recordsSource.bestFloor, TOWER_RULES.startFloor))),
      totalVictories: Math.max(0, Math.floor(toNumber(recordsSource.totalVictories, 0))),
      bossClears: Math.max(0, Math.floor(toNumber(recordsSource.bossClears, 0))),
      highestBossFloor: Math.max(0, Math.floor(toNumber(recordsSource.highestBossFloor, 0))),
      totalChallenges: Math.max(0, Math.floor(toNumber(recordsSource.totalChallenges, 0))),
      rivalDefeats: Math.max(0, Math.floor(toNumber(recordsSource.rivalDefeats, 0))),
      nemesisCount: rivals.length ? activeNemesisCount : Math.max(0, Math.floor(toNumber(recordsSource.nemesisCount, 0))),
      sealedNemesisCount: rivals.length ? sealedNemesisCount : Math.max(0, Math.floor(toNumber(recordsSource.sealedNemesisCount ?? recordsSource.nemesisSealed, 0)))
    },
    achievements: { ...(source.achievements || {}) },
    rivals,
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
      <div><span>활성 숙적</span><strong>${records.nemesisCount || 0}명</strong></div>
      <div><span>봉인된 숙적</span><strong>${records.sealedNemesisCount || 0}명</strong></div>
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
  const rivals = normalizeRivalList(data.rivals || []).filter((rival) => !rival.isNemesis);
  const notes = data.roadmap?.notes || [];
  if (!rivals.length) {
    return `
      <div class="soul-road-line-list">
        <article class="soul-road-line-card">
          <strong>아직 등록된 라이벌이 없습니다.</strong>
          <span>보스층이 아닌 일반층에서 적에게 쓰러지면, 해당 적이 라이벌로 기록됩니다.</span>
        </article>
        ${notes.slice(0, 2).map((note) => `<article class="soul-road-line-card muted"><span>${escapeHtml(note)}</span></article>`).join('')}
      </div>
    `;
  }

  return `
    <div class="soul-road-line-list">
      ${rivals.map((rival) => `
        <article class="soul-road-line-card ${rival.isResolved ? 'is-cleared' : ''}">
          <strong>${escapeHtml(rival.isResolved ? '복수 완료' : '라이벌')} · ${escapeHtml(rival.name)} Lv.${rival.level}</strong>
          <span>${escapeHtml(rival.weaponName)} / ${escapeHtml(rival.personalityName)} / ${escapeHtml(rival.weaponGradeName)} / ${escapeHtml(rival.weaponStageName)} +${rival.weaponEnhancement}</span>
          <small>${escapeHtml(`${rival.defeatCount}회 패배 · ${rival.victoryCount || 0}회 복수 · 최초 ${rival.firstFloor || '-'}층 · 최근 패배 ${rival.lastFloor || '-'}층`)}</small>
          <small>${escapeHtml(rival.isResolved ? `복수 완료 · 활성 라이벌 제외` : (rival.lastSeenFloor ? `최근 조우 ${rival.lastSeenFloor}층 · ${rival.lastEncounterResult === 'victory' ? '복수 성공' : rival.lastEncounterResult === 'defeat' ? '패배' : '조우'}` : '아직 재등장 기록 없음'))}</small>
          ${rival.note ? `<small>${escapeHtml(rival.note)}</small>` : ''}
        </article>
      `).join('')}
      <article class="soul-road-line-card muted">
        <strong>라이벌 규칙</strong>
        <span>활성 라이벌은 10층 이상 일반층에서 랜덤 재등장하며, 복수에 성공하면 활성 목록에서 제외됩니다. 같은 라이벌에게 3회 이상 패배하면 숙적 기록으로 넘어갑니다.</span>
      </article>
    </div>
  `;
}

function renderNemesis(data) {
  const nemeses = normalizeRivalList(data.rivals || []).filter((rival) => rival.isNemesis);
  if (!nemeses.length) {
    return `
      <div class="soul-road-line-list">
        <article class="soul-road-line-card">
          <strong>아직 숙적이 없습니다.</strong>
          <span>같은 라이벌에게 3회 이상 패배하면 활성 숙적으로 승격됩니다.</span>
        </article>
        <article class="soul-road-line-card muted">
          <strong>예정 흐름</strong>
          <span>활성 숙적은 50층 이후 보스 후보가 되며, 토벌 후에는 봉인된 숙적으로 기록됩니다.</span>
        </article>
      </div>
    `;
  }

  return `
    <div class="soul-road-line-list">
      ${nemeses.map((rival) => {
        const sealed = rival.nemesisState === 'sealed' || rival.isSealed || rival.isResolved;
        const title = sealed ? '봉인된 숙적' : '활성 숙적';
        return `
          <article class="soul-road-line-card ${sealed ? 'is-cleared' : 'is-seen'}">
            <strong>${escapeHtml(title)} · ${escapeHtml(rival.name)} Lv.${rival.level}</strong>
            <span>${escapeHtml(rival.weaponName)} / ${escapeHtml(rival.personalityName)} / ${escapeHtml(rival.weaponGradeName)} / ${escapeHtml(rival.weaponStageName)} +${rival.weaponEnhancement}</span>
            <small>${escapeHtml(`${rival.defeatCount}회 패배 · ${rival.victoryCount || 0}회 복수 · 숙적 토벌 ${rival.nemesisClearCount || 0}회`)}</small>
            <small>${escapeHtml(sealed ? '봉인 완료 · 50층 이후 숙적 보스 후보에서 제외' : '50층 이후 숙적 보스 후보 · 보스화 대기')}</small>
            ${rival.note ? `<small>${escapeHtml(rival.note)}</small>` : ''}
          </article>
        `;
      }).join('')}
      <article class="soul-road-line-card muted">
        <strong>숙적 규칙</strong>
        <span>숙적은 일반 라이벌처럼 사라지지 않고, 보스화와 봉인 기록으로 이어지는 개인 서사 콘텐츠입니다.</span>
      </article>
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
  else if (activeTab === 'nemesis') body = renderNemesis(normalized);
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
