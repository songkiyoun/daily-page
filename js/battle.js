// battle.js
// 공격 판정, 피해 계산, 승패 판정만 담당합니다.
// 수정 원칙: 새 resolveAttack 패치 함수를 뒤에 추가하지 말고 기존 함수를 직접 수정합니다.

import { BASE_STATS, PERSONALITIES, WEAPONS } from './data.js';
import { decideMovement } from './ai.js';
import { angleDiff, angleTo, clamp, distance, moveToward } from './utils.js';

const ARENA_PADDING = 18;

export function updateBattle(state) {
  if (!state.running || state.paused || state.result) return;

  state.frame += 1;
  state.elapsed += 1 / 60;

  updateUnit(state.player, state.enemy, state);
  updateUnit(state.enemy, state.player, state);

  resolveBodyCollision(state.player, state.enemy);
  clampToArena(state.player, state.arena);
  clampToArena(state.enemy, state.arena);
  checkResult(state);
}

function updateUnit(unit, enemy, state) {
  if (unit.isDead) return;

  const weapon = WEAPONS[unit.weaponId];
  const movement = decideMovement(unit, enemy);
  unit.lastAction = movement.label;
  unit.facing = moveToward(unit.facing, movement.faceAngle, 0.11);

  if (unit.cooldownTimer > 0) unit.cooldownTimer -= 1;

  if (unit.attackState === 'idle') {
    applyMovement(unit, movement, weapon);
    if (unit.cooldownTimer <= 0 && canStartAttack(unit, enemy)) {
      beginAttack(unit, enemy);
    }
    return;
  }

  updateAttackState(unit, enemy, state);
}

function applyMovement(unit, movement, weapon) {
  const acceleration = 0.22;
  const friction = 0.86;
  const maxSpeed = weapon.moveSpeed;

  unit.vx += movement.ax * acceleration;
  unit.vy += movement.ay * acceleration;
  unit.vx *= friction;
  unit.vy *= friction;

  const speed = Math.hypot(unit.vx, unit.vy);
  if (speed > maxSpeed) {
    unit.vx = (unit.vx / speed) * maxSpeed;
    unit.vy = (unit.vy / speed) * maxSpeed;
  }

  unit.x += unit.vx;
  unit.y += unit.vy;
}

function canStartAttack(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));

  if (dist > weapon.range + defender.radius) return false;
  if (dist < weapon.minRange) return false;
  if (angleGap > Math.max(weapon.arc * 1.2, 0.42)) return false;
  return true;
}

function beginAttack(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  attacker.attackState = 'windup';
  attacker.attackTimer = weapon.windup;
  attacker.facing = angleTo(attacker, defender);
  attacker.vx *= 0.45;
  attacker.vy *= 0.45;
  attacker.lastAction = '공격 준비';
}

function updateAttackState(attacker, defender, state) {
  const weapon = WEAPONS[attacker.weaponId];

  attacker.attackTimer -= 1;

  if (attacker.attackState === 'windup' && attacker.attackTimer <= 0) {
    attacker.attackState = 'active';
    attacker.attackTimer = 5;
    attacker.lastAction = '타격 판정';
    resolveAttack(attacker, defender, state);
    return;
  }

  if (attacker.attackState === 'active' && attacker.attackTimer <= 0) {
    attacker.attackState = 'recovery';
    attacker.attackTimer = weapon.recovery;
    attacker.lastAction = '후딜';
    return;
  }

  if (attacker.attackState === 'recovery' && attacker.attackTimer <= 0) {
    attacker.attackState = 'idle';
    attacker.cooldownTimer = weapon.cooldown;
    attacker.lastAction = '재정비';
  }
}

function resolveAttack(attacker, defender, state) {
  if (defender.isDead) return;

  const weapon = WEAPONS[attacker.weaponId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));

  if (dist > weapon.range + defender.radius) return;
  if (dist < weapon.minRange) return;
  if (angleGap > weapon.arc) return;

  const evaded = Math.random() < BASE_STATS.evasion;
  if (evaded) {
    defender.lastAction = '회피';
    return;
  }

  const crit = Math.random() < BASE_STATS.crit;
  const positionalBonus = getPositionalBonus(attacker, defender);
  const personality = PERSONALITIES[attacker.personalityId];
  const aggressionBonus = 1 + personality.aggression * 0.08;
  const rawDamage = weapon.damage * BASE_STATS.attack * positionalBonus * aggressionBonus * (crit ? 1.65 : 1);
  const damage = Math.max(2, rawDamage * (1 - BASE_STATS.defense));

  defender.hp = clamp(defender.hp - damage, 0, defender.maxHp);
  attacker.hits += 1;
  attacker.damageDealt += damage;
  attacker.lastAction = crit ? '치명타' : '명중';
  defender.lastAction = '피격';

  applyKnockback(attacker, defender, weapon.knockback);

  if (defender.hp <= 0) {
    defender.isDead = true;
    defender.lastAction = '전투 불능';
  }
}

function getPositionalBonus(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  if (weapon.id !== 'dagger') return 1;

  const attackerFromDefender = angleTo(defender, attacker);
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const sideGap = Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender));
  const otherSideGap = Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender));

  if (backGap < 0.85) return weapon.backBonus;
  if (sideGap < 0.72 || otherSideGap < 0.72) return weapon.flankBonus;
  return 1;
}

function applyKnockback(attacker, defender, force) {
  const angle = angleTo(attacker, defender);
  defender.vx += Math.cos(angle) * force * 0.12;
  defender.vy += Math.sin(angle) * force * 0.12;
}

function resolveBodyCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = a.radius + b.radius;

  if (dist >= minDist) return;

  const push = (minDist - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

function clampToArena(unit, arena) {
  const dx = unit.x - arena.cx;
  const dy = unit.y - arena.cy;
  const dist = Math.hypot(dx, dy) || 1;
  const limit = arena.radius - unit.radius - ARENA_PADDING;

  if (dist <= limit) return;

  unit.x = arena.cx + (dx / dist) * limit;
  unit.y = arena.cy + (dy / dist) * limit;
  unit.vx *= -0.18;
  unit.vy *= -0.18;
}

function checkResult(state) {
  if (state.player.isDead && state.enemy.isDead) {
    state.result = 'draw';
    state.running = false;
    return;
  }

  if (state.enemy.isDead) {
    state.result = 'victory';
    state.running = false;
    return;
  }

  if (state.player.isDead) {
    state.result = 'defeat';
    state.running = false;
  }
}
