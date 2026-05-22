// bossPatterns.js
// 보스 전용 패턴, 2페이즈, 경고/타격 판정만 담당합니다.

import { WEAPONS } from '../data.js';
import { angleTo, clamp, distance } from '../utils.js';

export function processBossActionLock(unit) {
  if (!unit?.skillRuntime?.bossActionLock) return false;
  unit.skillRuntime.bossActionLock = Math.max(0, unit.skillRuntime.bossActionLock - 1);
  unit.vx *= 0.72;
  unit.vy *= 0.72;
  unit.lastAction = unit.skillRuntime.bossActionLabel || '보스 패턴 준비';
  return unit.skillRuntime.bossActionLock > 0;
}

export function updateBossPattern(state, helpers = {}) {
  const boss = state.enemy;
  const player = state.player;
  if (!boss?.bossSkill || !boss.bossSkillState || boss.isDead || player.isDead) return;

  updateBossPhaseTransition(state, boss, helpers);

  const skill = getEffectiveBossSkill(boss.bossSkill, boss);
  const runtime = boss.bossSkillState;
  if (runtime.cooldown > 0) runtime.cooldown -= 1;

  if (runtime.phase === 'ready') {
    const cooldownReady = runtime.cooldown <= 0;
    const distanceOk = distance(boss, player) < 360 || skill.id === 'deathMark';
    if (!cooldownReady || !distanceOk) return;

    runtime.phase = 'casting';
    runtime.timer = Math.max(30, skill.telegraph || 60);
    runtime.resolved = false;
    runtime.payload = createBossSkillPayload(skill, boss, player);
    boss.skillRuntime.bossActionLock = runtime.timer + 12;
    boss.skillRuntime.bossActionLabel = skill.name;
    boss.lastAction = skill.name;
    emitBossTelegraph(state, boss, player, skill, runtime.payload, helpers);
    helpers.emitCombatEvent?.(state, skill.name, boss.x, boss.y - 58, boss.bossPhase >= 2 ? '#ffd45a' : '#ff5d6c');
    helpers.addScreenShake?.(state, boss.bossPhase >= 2 ? 5 : 3);
    return;
  }

  if (runtime.phase !== 'casting') return;
  runtime.timer -= 1;
  if (!runtime.resolved && runtime.timer <= 0) {
    resolveBossSkillImpact(state, boss, player, skill, runtime.payload || {}, helpers);
    runtime.resolved = true;
    runtime.phase = 'ready';
    runtime.cooldown = Math.max(110, Math.round((boss.bossSkill.cooldown || 320) * (boss.bossPhase >= 2 ? (boss.bossSkill.phase2?.cooldownScale || 0.72) : 1)));
    runtime.payload = null;
  }
}

function updateBossPhaseTransition(state, boss, helpers) {
  if (!boss || boss.bossPhase2Triggered || boss.maxHp <= 0) return;
  const hpRatio = boss.hp / boss.maxHp;
  if (hpRatio > 0.5) return;

  boss.bossPhase = 2;
  boss.bossPhase2Triggered = true;
  if (boss.bossSkillState) boss.bossSkillState.cooldown = Math.min(boss.bossSkillState.cooldown || 0, 36);
  boss.skillRuntime.bossActionLock = Math.max(boss.skillRuntime.bossActionLock || 0, 58);
  boss.skillRuntime.bossActionLabel = '2페이즈 각성';
  boss.lastAction = '2페이즈 각성';

  if (state.bossEncounter) {
    state.bossEncounter.phase = 'phase2';
    state.bossEncounter.timer = 96;
    state.bossEncounter.maxTimer = 96;
    state.bossEncounter.phaseLine = boss.bossPhaseLine || state.bossEncounter.phaseLine || '보스의 기세가 변했습니다.';
  }

  helpers.emitCombatEvent?.(state, '2페이즈', boss.x, boss.y - 72, '#ffd45a');
  helpers.emitVisualEffect?.(state, { type: 'warningCircle', x: boss.x, y: boss.y, radius: 136, color: '#ffd45a', life: 72, maxLife: 72 });
  helpers.emitVisualEffect?.(state, { type: 'ring', x: boss.x, y: boss.y, color: '#ffd45a', life: 42, maxLife: 42, size: 128, power: 2 });
  helpers.addScreenShake?.(state, 8);
}

function getEffectiveBossSkill(skill, boss) {
  if (!skill || boss?.bossPhase < 2 || !skill.phase2) return skill;
  const phase = skill.phase2;
  return {
    ...skill,
    name: phase.label || skill.name,
    cooldown: Math.round((skill.cooldown || 320) * (phase.cooldownScale || 0.72)),
    telegraph: Math.round((skill.telegraph || 60) * (phase.telegraphScale || 1)),
    radius: Math.round((skill.radius || 0) * (phase.radiusScale || 1)) || skill.radius,
    width: Math.round((skill.width || 0) * (phase.widthScale || 1)) || skill.width,
    length: Math.round((skill.length || 0) * (phase.lengthScale || 1)) || skill.length,
    damageScale: (skill.damageScale || 1.35) + (phase.damageScaleBonus || 0),
    doubleStrike: !!phase.doubleStrike,
    shadowFollowUp: !!phase.shadowFollowUp
  };
}

function createBossSkillPayload(skill, boss, player) {
  if (skill.id === 'archerVanguardPierce') {
    const aim = angleTo(boss, player);
    const sideOffset = boss.bossPhase >= 2 && skill.doubleStrike ? Math.PI / 18 : 0;
    return {
      aim,
      secondAim: skill.doubleStrike ? aim - sideOffset * 2 : null,
      x1: boss.x + Math.cos(aim + sideOffset) * boss.radius,
      y1: boss.y + Math.sin(aim + sideOffset) * boss.radius,
      x2: boss.x + Math.cos(aim + sideOffset) * (skill.length || 420),
      y2: boss.y + Math.sin(aim + sideOffset) * (skill.length || 420),
      x1b: skill.doubleStrike ? boss.x + Math.cos(aim - sideOffset) * boss.radius : null,
      y1b: skill.doubleStrike ? boss.y + Math.sin(aim - sideOffset) * boss.radius : null,
      x2b: skill.doubleStrike ? boss.x + Math.cos(aim - sideOffset) * (skill.length || 420) : null,
      y2b: skill.doubleStrike ? boss.y + Math.sin(aim - sideOffset) * (skill.length || 420) : null
    };
  }
  if (skill.id === 'arbiterWarGodPressure') {
    return { x: boss.x, y: boss.y };
  }
  return { x: player.x, y: player.y };
}

function emitBossTelegraph(state, boss, player, skill, payload, helpers) {
  const telegraph = Math.max(30, skill.telegraph || 60);
  const common = { life: telegraph, maxLife: telegraph, color: boss.bossPhase >= 2 ? '#ffd45a' : '#ff4d5f' };
  if (skill.id === 'archerVanguardPierce') {
    helpers.emitVisualEffect?.(state, {
      ...common,
      type: 'warningLine',
      x1: payload.x1,
      y1: payload.y1,
      x2: payload.x2,
      y2: payload.y2,
      width: skill.width || 48
    });
    if (skill.doubleStrike) {
      helpers.emitVisualEffect?.(state, {
        ...common,
        type: 'warningLine',
        x1: payload.x1b,
        y1: payload.y1b,
        x2: payload.x2b,
        y2: payload.y2b,
        width: skill.width || 48
      });
    }
    return;
  }
  if (skill.id === 'deathMark') {
    helpers.emitVisualEffect?.(state, {
      ...common,
      type: 'deathMark',
      x: player.x,
      y: player.y,
      targetSide: player.side,
      radius: skill.radius || 72
    });
    return;
  }
  helpers.emitVisualEffect?.(state, {
    ...common,
    type: 'warningCircle',
    x: payload.x,
    y: payload.y,
    radius: skill.radius || 86
  });
}

function resolveBossSkillImpact(state, boss, player, skill, payload, helpers) {
  if (player.isDead || player.hp <= 0) return;
  let hit = false;
  if (skill.id === 'archerVanguardPierce') {
    const firstHit = distancePointToSegment(player.x, player.y, payload.x1, payload.y1, payload.x2, payload.y2) <= (skill.width || 48) / 2 + player.radius * 0.5;
    const secondHit = skill.doubleStrike && distancePointToSegment(player.x, player.y, payload.x1b, payload.y1b, payload.x2b, payload.y2b) <= (skill.width || 48) / 2 + player.radius * 0.5;
    hit = firstHit || secondHit;
    helpers.emitVisualEffect?.(state, { type: 'trail', x1: payload.x1, y1: payload.y1, x2: payload.x2, y2: payload.y2, color: '#ff7a5c', life: 18, maxLife: 18, width: 7, skillId: 'bossPierce' });
    if (skill.doubleStrike) {
      helpers.emitVisualEffect?.(state, { type: 'trail', x1: payload.x1b, y1: payload.y1b, x2: payload.x2b, y2: payload.y2b, color: '#ffd45a', life: 20, maxLife: 20, width: 6, skillId: 'bossPierce' });
    }
  } else if (skill.id === 'deathMark') {
    hit = true;
    helpers.emitVisualEffect?.(state, { type: 'ring', x: player.x, y: player.y, color: '#a56cff', life: 24, maxLife: 24, size: (skill.radius || 72) * 0.8, power: 1.45 });
    if (skill.shadowFollowUp) {
      helpers.emitVisualEffect?.(state, { type: 'afterimage', x: player.x - 18, y: player.y + 12, color: '#a56cff', life: 34, maxLife: 34, size: 30 });
    }
  } else {
    const center = skill.id === 'arbiterWarGodPressure' ? payload : payload;
    hit = distance(player, center) <= (skill.radius || 86) + player.radius;
    helpers.emitVisualEffect?.(state, { type: 'ring', x: center.x, y: center.y, color: skill.id === 'callonJudgement' ? '#ffd45a' : '#a888ff', life: 24, maxLife: 24, size: (skill.radius || 86), power: 1.6 });
  }
  if (!hit) {
    helpers.emitCombatEvent?.(state, '회피', player.x, player.y - 44, '#b5ffcf');
    return;
  }
  applyBossSkillDamage(state, boss, player, skill, helpers);
  if (!player.isDead && skill.shadowFollowUp) {
    applyBossSkillDamage(state, boss, player, { ...skill, name: '그림자 추격', damageScale: Math.max(0.6, (skill.damageScale || 1.4) * 0.45) }, helpers);
  }
}

function applyBossSkillDamage(state, attacker, defender, skill, helpers) {
  const weapon = WEAPONS[attacker.weaponId] || WEAPONS.western;
  const base = weapon.damage * (attacker.attackScale || 1) * (skill.damageScale || 1.35);
  const damage = Math.max(1, base * (1 - (helpers.getEffectiveDefense?.(defender) ?? 0)));
  defender.hp = clamp(defender.hp - damage, 0, defender.maxHp);
  defender.posture = clamp(defender.posture - damage * 0.56, 0, defender.maxPosture);
  attacker.damageDealt += damage;
  attacker.hits += 1;
  defender.staggerTimer = Math.max(defender.staggerTimer || 0, 10);
  defender.vx += Math.cos(angleTo(attacker, defender)) * 2.3;
  defender.vy += Math.sin(angleTo(attacker, defender)) * 2.3;
  attacker.lastAction = skill.name;
  helpers.emitCombatEvent?.(state, skill.name, defender.x, defender.y - 52, '#ff4d5f');
  helpers.addScreenShake?.(state, 7);
  if (defender.hp <= 0) {
    defender.isDead = true;
    defender.lastAction = '전투 불능';
  }
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  const sx = x1 + dx * t;
  const sy = y1 + dy * t;
  const ddx = px - sx;
  const ddy = py - sy;
  return Math.hypot(ddx, ddy);
}

