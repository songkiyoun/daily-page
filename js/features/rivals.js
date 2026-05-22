// features/rivals.js
// 라이벌/숙적 기록을 관리합니다.
// v0.9.2에서는 라이벌 등록, 재등장, 처치/패배 갱신을 담당합니다.

import { TOWER_RULES, WEAPONS, PERSONALITIES, WEAPON_GRADES, WEAPON_EVOLUTIONS } from '../data.js';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function getWeaponStageNumber(weaponId, value) {
  const evolution = WEAPON_EVOLUTIONS[weaponId] || [];
  if (typeof value === 'string' && value.trim()) {
    const index = evolution.findIndex((item) => item.id === value || item.name === value);
    if (index >= 0) return index + 1;
  }
  return Math.max(1, Math.floor(Number(value) || 1));
}

function getWeaponStageName(weaponId, stageNumber) {
  const evolution = WEAPON_EVOLUTIONS[weaponId] || [];
  const safeStage = Math.max(1, Math.floor(Number(stageNumber) || 1));
  const stage = evolution[safeStage - 1];
  return stage?.name || `${safeStage}단계`;
}

function getGradeName(gradeId) {
  return WEAPON_GRADES.find((item) => item.id === gradeId)?.name || '일반';
}

export function createRivalKey(enemy = {}) {
  return [
    sanitizeId(enemy.name),
    sanitizeId(enemy.weaponId),
    sanitizeId(enemy.personalityId),
    sanitizeId(enemy.weaponEvolution || enemy.weaponStage || 'base')
  ].join('__');
}

export function normalizeRivalList(source = []) {
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => {
      const weaponId = item.weaponId || 'eastern';
      const stageNumber = getWeaponStageNumber(weaponId, item.weaponStageNumber || item.weaponStage || item.weaponEvolution || 1);
      const defeatCount = Math.max(0, Math.floor(toNumber(item.defeatCount, 0)));
      const level = Math.max(1, Math.floor(toNumber(item.level, 1 + Math.max(0, defeatCount - 1))));
      return {
        id: item.id || createRivalKey(item),
        name: item.name || '이름 없는 라이벌',
        weaponId,
        weaponName: item.weaponName || WEAPONS[weaponId]?.name || '미확인 무기',
        personalityId: item.personalityId || 'balanced',
        personalityName: item.personalityName || PERSONALITIES[item.personalityId]?.name || '균형형',
        weaponGrade: item.weaponGrade || 'common',
        weaponGradeName: item.weaponGradeName || getGradeName(item.weaponGrade || 'common'),
        weaponStageNumber: stageNumber,
        weaponStageName: item.weaponStageName || getWeaponStageName(weaponId, stageNumber),
        weaponEnhancement: Math.max(0, Math.floor(toNumber(item.weaponEnhancement, 0))),
        firstFloor: Math.max(0, Math.floor(toNumber(item.firstFloor, 0))),
        lastFloor: Math.max(0, Math.floor(toNumber(item.lastFloor, item.firstFloor || 0))),
        defeatCount,
        level,
        isNemesis: !!item.isNemesis || defeatCount >= 3,
        firstDefeatedAt: item.firstDefeatedAt || '',
        lastDefeatedAt: item.lastDefeatedAt || '',
        lastSeenAt: item.lastSeenAt || '',
        lastSeenFloor: Math.max(0, Math.floor(toNumber(item.lastSeenFloor, item.lastFloor || 0))),
        victoryCount: Math.max(0, Math.floor(toNumber(item.victoryCount, 0))),
        lastEncounterResult: item.lastEncounterResult || '',
        note: item.note || ''
      };
    })
    .sort((a, b) => (b.isNemesis - a.isNemesis) || (b.defeatCount - a.defeatCount) || (b.level - a.level) || (b.lastFloor - a.lastFloor));
}

export function registerRivalDefeat(data = {}, enemy = null, floor = 0) {
  const safeFloor = Math.max(0, Math.floor(toNumber(floor, 0)));
  if (!enemy || enemy.bossId || (safeFloor > 0 && safeFloor % TOWER_RULES.bossInterval === 0)) {
    return data;
  }

  const next = {
    ...data,
    records: { ...(data.records || {}) },
    rivals: normalizeRivalList(data.rivals || [])
  };

  const now = new Date().toISOString();
  const weaponId = enemy.weaponId || 'eastern';
  const stageNumber = getWeaponStageNumber(weaponId, enemy.weaponEvolution || enemy.weaponStage || 1);
  const key = createRivalKey({
    name: enemy.name,
    weaponId,
    personalityId: enemy.personalityId,
    weaponEvolution: stageNumber
  });

  let rival = next.rivals.find((item) => item.id === key);
  if (!rival) {
    rival = {
      id: key,
      name: enemy.name || '이름 없는 라이벌',
      weaponId,
      weaponName: WEAPONS[weaponId]?.name || '미확인 무기',
      personalityId: enemy.personalityId || 'balanced',
      personalityName: PERSONALITIES[enemy.personalityId]?.name || '균형형',
      weaponGrade: enemy.weaponGrade || 'common',
      weaponGradeName: getGradeName(enemy.weaponGrade || 'common'),
      weaponStageNumber: stageNumber,
      weaponStageName: getWeaponStageName(weaponId, stageNumber),
      weaponEnhancement: Math.max(0, Math.floor(toNumber(enemy.weaponEnhancement, 0))),
      firstFloor: safeFloor,
      lastFloor: safeFloor,
      defeatCount: 0,
      level: 1,
      isNemesis: false,
      firstDefeatedAt: now,
      lastDefeatedAt: now,
      lastSeenAt: now,
      lastSeenFloor: safeFloor,
      victoryCount: 0,
      lastEncounterResult: 'defeat',
      note: ''
    };
    next.rivals.push(rival);
  }

  rival.defeatCount += 1;
  rival.level = Math.max(1, rival.level + 1);
  rival.lastFloor = safeFloor;
  rival.lastDefeatedAt = now;
  rival.lastSeenAt = now;
  rival.lastSeenFloor = safeFloor;
  rival.lastEncounterResult = 'defeat';
  if (!rival.firstDefeatedAt) rival.firstDefeatedAt = now;
  if (!rival.firstFloor) rival.firstFloor = safeFloor;
  rival.isNemesis = rival.defeatCount >= 3;
  rival.note = rival.isNemesis
    ? '3회 이상 패배하여 숙적 후보로 기록되었습니다. 추후 50층 이후 보스 후보가 됩니다.'
    : '일반층에서 플레이어를 쓰러뜨린 라이벌입니다.';

  next.rivals = normalizeRivalList(next.rivals).slice(0, 24);
  next.records.rivalDefeats = Math.max(0, Math.floor(toNumber(next.records.rivalDefeats, 0))) + 1;
  next.records.nemesisCount = next.rivals.filter((item) => item.isNemesis).length;
  next.records.bestFloor = Math.max(Math.floor(toNumber(next.records.bestFloor, TOWER_RULES.startFloor)), safeFloor);
  return next;
}


export function getRivalSpawnChance(rival = {}, floor = 0) {
  const base = 0.22;
  const levelBonus = Math.min(0.18, Math.max(0, (rival.level || 1) - 1) * 0.035);
  const nemesisBonus = rival.isNemesis ? 0.08 : 0;
  const floorBonus = Math.min(0.08, Math.max(0, Math.floor((floor - 10) / 10)) * 0.02);
  return Math.min(0.48, base + levelBonus + nemesisBonus + floorBonus);
}

export function selectRivalForFloor(data = {}, floor = 0) {
  const safeFloor = Math.max(0, Math.floor(toNumber(floor, 0)));
  if (safeFloor < 10 || safeFloor % TOWER_RULES.bossInterval === 0) return null;
  const rivals = normalizeRivalList(data.rivals || []).filter((rival) => rival.defeatCount > 0);
  if (!rivals.length) return null;

  const chance = Math.max(...rivals.map((rival) => getRivalSpawnChance(rival, safeFloor)));
  if (Math.random() > chance) return null;

  const weighted = rivals.map((rival) => ({
    rival,
    weight: 3 + Math.max(0, rival.level || 1) + Math.max(0, rival.defeatCount || 0) * 2 + (rival.isNemesis ? 5 : 0)
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.rival;
  }
  return weighted[0]?.rival || null;
}

export function registerRivalEncounter(data = {}, rivalId = '', floor = 0, result = 'seen') {
  if (!rivalId) return data;
  const next = {
    ...data,
    records: { ...(data.records || {}) },
    rivals: normalizeRivalList(data.rivals || [])
  };
  const rival = next.rivals.find((item) => item.id === rivalId);
  if (!rival) return data;
  const now = new Date().toISOString();
  rival.lastSeenAt = now;
  rival.lastSeenFloor = Math.max(0, Math.floor(toNumber(floor, 0)));
  rival.lastEncounterResult = result;
  if (result === 'victory') {
    rival.victoryCount = Math.max(0, Math.floor(toNumber(rival.victoryCount, 0))) + 1;
    rival.note = rival.isNemesis
      ? '숙적 후보에게 복수했습니다. 추후 숙적 보스화 단계에서 별도 보상으로 연결됩니다.'
      : '라이벌에게 복수에 성공했습니다. 이후에도 다시 등장할 수 있습니다.';
    next.records.rivalVictories = Math.max(0, Math.floor(toNumber(next.records.rivalVictories, 0))) + 1;
  }
  next.rivals = normalizeRivalList(next.rivals);
  return next;
}
