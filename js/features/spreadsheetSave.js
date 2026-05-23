// spreadsheetSave.js
// localStorage 중심 저장 데이터를 Google Spreadsheet 탭 구조로 변환합니다.
// 현재 프론트엔드는 saveData와 함께 이 sheetData를 서버로 전송합니다.

import { SAVE_SCHEMA_VERSION, SPREADSHEET_TABS, createEmptySpreadsheetTabs } from '../data/saveSchema.js';

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch (error) {
    return '{}';
  }
}

function normalizeAccountId(saveData = {}, context = {}) {
  return safeText(context.accountId || saveData.account?.id || 'local-temp');
}

function pushResourceRows(tabs, accountId, resources = {}, savedAt) {
  ['gold', 'enhancementStone', 'bossSoul', 'grudgeMass'].forEach((resourceKey) => {
    tabs.Resources.push({
      accountId,
      resourceKey,
      amount: Math.max(0, Math.floor(safeNumber(resources[resourceKey], 0))),
      updatedAt: savedAt
    });
  });
}

function pushHeirloomRows(tabs, accountId, permanentProgress = {}, savedAt) {
  const heirloom = permanentProgress.heirloom || {};
  Object.entries(heirloom).forEach(([weaponId, value]) => {
    tabs.Heirlooms.push({
      accountId,
      weaponId,
      weaponGrade: safeText(value?.weaponGrade || 'common'),
      weaponEvolution: safeText(value?.weaponEvolution || ''),
      enhancementLevel: Math.max(0, Math.floor(safeNumber(value?.enhancementLevel, 0))),
      updatedAt: savedAt
    });
  });
}

function pushSoulEngravingRows(tabs, accountId, permanentProgress = {}, savedAt) {
  const soul = permanentProgress.soulEngraving || {};
  Object.entries(soul).forEach(([engravingId, level]) => {
    tabs.SoulEngraving.push({
      accountId,
      engravingId,
      level: Math.max(0, Math.floor(safeNumber(level, 0))),
      updatedAt: savedAt
    });
  });
}

function pushBossCodexRows(tabs, accountId, soulRoadData = {}, savedAt) {
  const codex = soulRoadData.bossCodex || {};
  Object.values(codex).forEach((boss) => {
    tabs.BossCodex.push({
      accountId,
      bossId: safeText(boss.bossId),
      name: safeText(boss.name),
      seen: !!boss.seen,
      defeated: !!boss.defeated,
      defeatCount: Math.max(0, Math.floor(safeNumber(boss.defeatCount, 0))),
      firstSeenFloor: Math.max(0, Math.floor(safeNumber(boss.firstSeenFloor, 0))),
      firstDefeatedFloor: Math.max(0, Math.floor(safeNumber(boss.firstDefeatedFloor, 0))),
      lastSeenAt: safeText(boss.lastSeenAt),
      lastDefeatedAt: safeText(boss.lastDefeatedAt),
      updatedAt: savedAt
    });
  });
}

function pushRivalRows(tabs, accountId, soulRoadData = {}, savedAt) {
  const rivals = Array.isArray(soulRoadData.rivals) ? soulRoadData.rivals : [];
  rivals.forEach((rival) => {
    const row = {
      accountId,
      rivalId: safeText(rival.id || rival.rivalId),
      name: safeText(rival.name),
      weaponId: safeText(rival.weaponId),
      weaponName: safeText(rival.weaponName),
      personalityId: safeText(rival.personalityId),
      personalityName: safeText(rival.personalityName),
      level: Math.max(1, Math.floor(safeNumber(rival.level, 1))),
      defeatCount: Math.max(0, Math.floor(safeNumber(rival.defeatCount, 0))),
      victoryCount: Math.max(0, Math.floor(safeNumber(rival.victoryCount, 0))),
      firstFloor: Math.max(0, Math.floor(safeNumber(rival.firstFloor, 0))),
      lastFloor: Math.max(0, Math.floor(safeNumber(rival.lastFloor, 0))),
      lastEncounterResult: safeText(rival.lastEncounterResult),
      isResolved: !!rival.isResolved,
      isNemesis: !!rival.isNemesis,
      nemesisState: safeText(rival.nemesisState),
      updatedAt: savedAt
    };
    if (row.isNemesis || row.nemesisState) tabs.Nemeses.push(row);
    else tabs.Rivals.push(row);
  });
}

function pushFarmRows(tabs, accountId, farmData = {}, savedAt) {
  const slots = Array.isArray(farmData.slots) ? farmData.slots : [];
  slots.forEach((slot, index) => {
    tabs.Farm.push({
      accountId,
      slotIndex: index,
      cropId: safeText(slot.cropId || ''),
      plantedAt: safeText(slot.plantedAt || ''),
      wateredAt: safeText(slot.wateredAt || ''),
      harvestedAt: safeText(slot.harvestedAt || ''),
      state: safeText(slot.state || ''),
      raw: toJson(slot),
      updatedAt: savedAt
    });
  });
}

function pushAchievementRows(tabs, accountId, soulRoadData = {}, savedAt) {
  const achievements = soulRoadData.achievements || {};
  Object.entries(achievements).forEach(([achievementId, value]) => {
    tabs.Achievements.push({
      accountId,
      achievementId,
      achieved: !!value,
      raw: toJson(value),
      updatedAt: savedAt
    });
  });
}

function pushInventoryRows(tabs, accountId, saveData = {}, savedAt) {
  const resources = saveData.resources || {};
  tabs.Inventory.push({
    accountId,
    itemKey: 'grudge_mass',
    name: '원한덩어리',
    amount: Math.max(0, Math.floor(safeNumber(resources.grudgeMass, 0))),
    icon: 'item_grudge_mass.png',
    source: 'nemesisReward',
    updatedAt: savedAt
  });

  const farmInventory = saveData.farmData?.inventory || {};
  Object.entries(farmInventory.seeds || {}).forEach(([itemKey, amount]) => {
    tabs.Inventory.push({
      accountId,
      itemKey,
      name: itemKey,
      amount: Math.max(0, Math.floor(safeNumber(amount, 0))),
      icon: '',
      source: 'farmSeed',
      updatedAt: savedAt
    });
  });
  Object.entries(farmInventory.crops || {}).forEach(([itemKey, amount]) => {
    tabs.Inventory.push({
      accountId,
      itemKey,
      name: itemKey,
      amount: Math.max(0, Math.floor(safeNumber(amount, 0))),
      icon: '',
      source: 'farmCrop',
      updatedAt: savedAt
    });
  });
}

export function buildSpreadsheetSyncPayload(saveData = {}, context = {}) {
  const savedAt = saveData.savedAt || new Date().toISOString();
  const accountId = normalizeAccountId(saveData, context);
  const tabs = createEmptySpreadsheetTabs();
  const sessionRun = saveData.session?.run || null;
  const player = sessionRun?.player || {};

  tabs.Accounts.push({
    accountId,
    role: safeText(saveData.account?.role || context.role || 'player'),
    mode: safeText(saveData.account?.mode || context.mode || 'cloud'),
    version: safeText(saveData.version || context.version),
    schemaVersion: SAVE_SCHEMA_VERSION,
    updatedAt: savedAt
  });

  tabs.Characters.push({
    accountId,
    profileImageUrl: safeText(saveData.profile?.imageUrl),
    weaponId: safeText(player.weaponId),
    personalityId: safeText(player.personalityId),
    level: Math.max(1, Math.floor(safeNumber(player.level, 1))),
    statPoints: Math.max(0, Math.floor(safeNumber(player.statPoints, 0))),
    raw: toJson(player),
    updatedAt: savedAt
  });

  pushResourceRows(tabs, accountId, saveData.resources || {}, savedAt);

  tabs.Progress.push({
    accountId,
    bestFloor: Math.max(1, Math.floor(safeNumber(saveData.stats?.bestFloor || saveData.soulRoadData?.records?.bestFloor, 1))),
    totalVictories: Math.max(0, Math.floor(safeNumber(saveData.stats?.totalVictories || saveData.soulRoadData?.records?.totalVictories, 0))),
    bossClears: Math.max(0, Math.floor(safeNumber(saveData.stats?.bossClears || saveData.soulRoadData?.records?.bossClears, 0))),
    totalChallenges: Math.max(0, Math.floor(safeNumber(saveData.soulRoadData?.records?.totalChallenges, 0))),
    activeNemesisCount: Math.max(0, Math.floor(safeNumber(saveData.soulRoadData?.records?.nemesisCount, 0))),
    sealedNemesisCount: Math.max(0, Math.floor(safeNumber(saveData.soulRoadData?.records?.sealedNemesisCount, 0))),
    updatedAt: savedAt
  });

  tabs.Weapons.push({
    accountId,
    weaponId: safeText(player.weaponId),
    weaponGrade: safeText(player.weaponGrade || player.weaponGradeId),
    weaponEvolution: safeText(player.weaponEvolution || player.weaponEvolutionId),
    weaponStageName: safeText(player.weaponStageName),
    weaponEnhancement: Math.max(0, Math.floor(safeNumber(player.weaponEnhancement || player.weaponEnhancementLevel, 0))),
    mastery: Math.max(0, Math.floor(safeNumber(player.mastery, 0))),
    updatedAt: savedAt
  });

  pushHeirloomRows(tabs, accountId, saveData.permanentProgress || {}, savedAt);
  pushSoulEngravingRows(tabs, accountId, saveData.permanentProgress || {}, savedAt);
  pushFarmRows(tabs, accountId, saveData.farmData || {}, savedAt);
  pushBossCodexRows(tabs, accountId, saveData.soulRoadData || {}, savedAt);
  pushAchievementRows(tabs, accountId, saveData.soulRoadData || {}, savedAt);
  pushRivalRows(tabs, accountId, saveData.soulRoadData || {}, savedAt);
  pushInventoryRows(tabs, accountId, saveData, savedAt);

  tabs.ClearRecords.push({
    accountId,
    raw: toJson(saveData.soulRoadData?.records || {}),
    updatedAt: savedAt
  });

  tabs.SystemLog.push({
    accountId,
    action: safeText(context.action || saveData.reason || 'save'),
    reason: safeText(saveData.reason || context.reason || 'save'),
    version: safeText(saveData.version || context.version),
    tabCount: SPREADSHEET_TABS.length,
    savedAt
  });

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    app: 'circle-battle-tower-rebuild',
    accountId,
    savedAt,
    tabs
  };
}

export { SAVE_SCHEMA_VERSION, SPREADSHEET_TABS };
