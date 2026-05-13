// battle.js
// 공격 판정, 피해 계산, 승패 판정만 담당합니다.
// 수정 원칙: 새 resolveAttack 패치 함수를 뒤에 추가하지 말고 기존 함수를 직접 수정합니다.

import { PERSONALITIES, WEAPONS } from './data.js';
import { decideMovement } from './ai.js';
import { angleDiff, angleTo, clamp, distance, moveToward } from './utils.js';

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
  const movement = decideMovement(unit, enemy, state);
  unit.lastAction = movement.label;
  unit.facing = moveToward(unit.facing, movement.faceAngle, getTurnSpeed(unit));

  updateOrbitDirection(unit, enemy);

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

function getTurnSpeed(unit) {
  if (unit.weaponId === 'spear') return 0.09;
  if (unit.weaponId === 'western') return 0.1;
  if (unit.weaponId === 'eastern') return 0.15;
  if (unit.weaponId === 'dagger') return 0.18;
  return 0.11;
}

function updateOrbitDirection(unit, enemy) {
  unit.orbitFlipTimer -= 1;
  const dist = distance(unit, enemy);
  const personality = PERSONALITIES[unit.personalityId];
  const tooClose = dist < unit.radius + enemy.radius + 18;
  const isFlanker = unit.weaponId === 'dagger' || personality.id === 'assassin';

  if (unit.orbitFlipTimer <= 0 || tooClose) {
    const flipChance = isFlanker ? (tooClose ? 0.08 : 0.26) : (tooClose ? 0.18 : 0.68);
    if (Math.random() < flipChance) unit.orbitDir *= -1;
    unit.orbitFlipTimer = (isFlanker ? 76 : 42) + Math.floor(Math.random() * (isFlanker ? 110 : 92));
  }
}

function applyMovement(unit, movement, weapon) {
  const acceleration = getAcceleration(unit, movement);
  const friction = 0.865;
  const maxSpeed = weapon.moveSpeed * (unit.moveSpeedScale || 1);

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

function getAcceleration(unit, movement) {
  const personality = PERSONALITIES[unit.personalityId];
  let value = 0.21 + (personality.pressure || 0.5) * 0.025;
  if (unit.weaponId === 'spear' && movement.label.includes('확보')) value = 0.27;
  if (unit.weaponId === 'eastern') value = 0.25;
  if (unit.weaponId === 'dagger') value = 0.28;
  if (personality.id === 'defensive' && movement.label.includes('후퇴')) value += 0.035;
  if (personality.id === 'assassin' && movement.label.includes('측')) value += 0.035;
  return value;
}

function canStartAttack(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  const personality = PERSONALITIES[attacker.personalityId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
  const startTolerance = Math.max(weapon.arc * 1.28, attacker.weaponId === 'spear' ? 0.3 : 0.52);

  if (dist > weapon.range + defender.radius) return false;
  if (dist < weapon.minRange) return false;
  if (angleGap > startTolerance) return false;

  if (attacker.weaponId === 'dagger' && !hasDaggerAttackAngle(attacker, defender)) {
    return false;
  }

  const committedToAngle = attacker.lastAction.includes('측') || attacker.lastAction.includes('후방');
  if (personality.id === 'assassin' && attacker.weaponId !== 'spear' && isDirectlyInFrontOf(defender, attacker) && !committedToAngle) {
    return false;
  }

  return true;
}

function beginAttack(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  attacker.attackState = 'windup';
  attacker.attackTimer = weapon.windup;
  attacker.attackResolved = false;
  attacker.facing = angleTo(attacker, defender);
  attacker.vx *= 0.42;
  attacker.vy *= 0.42;
  attacker.lastAction = '공격 준비';
}

function updateAttackState(attacker, defender, state) {
  const weapon = WEAPONS[attacker.weaponId];
  attacker.attackTimer -= 1;

  if (attacker.attackState === 'windup') {
    applyWindupDrift(attacker, defender, weapon);
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'active';
      attacker.attackTimer = getActiveFrames(attacker);
      attacker.lastAction = '타격 판정';
      applyAttackLunge(attacker, defender, weapon);
      attacker.attackResolved = resolveAttack(attacker, defender, state);
    }
    return;
  }

  if (attacker.attackState === 'active') {
    applyAttackLunge(attacker, defender, weapon, 0.36);
    if (!attacker.attackResolved) {
      attacker.attackResolved = resolveAttack(attacker, defender, state);
    }
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'recovery';
      attacker.attackTimer = weapon.recovery;
      attacker.lastAction = '후딜';
    }
    return;
  }

  if (attacker.attackState === 'recovery') {
    applyRecoveryStep(attacker, defender, weapon);
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'idle';
      attacker.cooldownTimer = Math.max(8, Math.round(weapon.cooldown * (attacker.cooldownScale || 1)));
      attacker.lastAction = '재정비';
    }
  }
}

function getActiveFrames(attacker) {
  if (attacker.weaponId === 'spear') return 4;
  if (attacker.weaponId === 'western') return 7;
  if (attacker.weaponId === 'eastern') return 5;
  if (attacker.weaponId === 'dagger') return 4;
  return 5;
}

function applyWindupDrift(attacker, defender, weapon) {
  const targetAngle = angleTo(attacker, defender);
  const sideAngle = targetAngle + Math.PI / 2 * attacker.orbitDir;
  const sidePower = weapon.strafeWeight * 0.025;

  attacker.vx += Math.cos(sideAngle) * sidePower;
  attacker.vy += Math.sin(sideAngle) * sidePower;
  attacker.vx *= 0.9;
  attacker.vy *= 0.9;
  attacker.x += attacker.vx;
  attacker.y += attacker.vy;
}

function applyAttackLunge(attacker, defender, weapon, scale = 1) {
  const targetAngle = angleTo(attacker, defender);
  const sideAngle = targetAngle + Math.PI / 2 * attacker.orbitDir;
  const forward = weapon.lungePower * 0.42 * scale;
  const side = weapon.strafeWeight * 0.08 * scale;

  attacker.vx += Math.cos(targetAngle) * forward + Math.cos(sideAngle) * side;
  attacker.vy += Math.sin(targetAngle) * forward + Math.sin(sideAngle) * side;
  attacker.x += attacker.vx;
  attacker.y += attacker.vy;
}

function applyRecoveryStep(attacker, defender, weapon) {
  const awayAngle = angleTo(defender, attacker);
  const sideAngle = awayAngle + Math.PI / 2 * attacker.orbitDir;
  const back = weapon.recoveryBackstep * 0.15;
  const side = weapon.strafeWeight * 0.035;

  attacker.vx += Math.cos(awayAngle) * back + Math.cos(sideAngle) * side;
  attacker.vy += Math.sin(awayAngle) * back + Math.sin(sideAngle) * side;
  attacker.vx *= 0.91;
  attacker.vy *= 0.91;
  attacker.x += attacker.vx;
  attacker.y += attacker.vy;
}

function resolveAttack(attacker, defender, state) {
  if (defender.isDead) return true;

  const weapon = WEAPONS[attacker.weaponId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
  const hitArc = getHitArc(attacker, weapon);
  const reachBonus = getReachBonus(attacker, weapon);

  if (dist > weapon.range + defender.radius + reachBonus) return false;
  if (dist < weapon.minRange) return false;
  if (angleGap > hitArc) return false;

  const evaded = Math.random() < defender.evasion;
  if (evaded) {
    defender.lastAction = '회피';
    return true;
  }

  const crit = Math.random() < attacker.crit;
  const positionalBonus = getPositionalBonus(attacker, defender);
  const personality = PERSONALITIES[attacker.personalityId];
  const aggressionBonus = 1 + personality.aggression * 0.08;
  const lowHpAttackBonus = attacker.hp / attacker.maxHp < 0.35 && attacker.skills?.includes('survival') ? 1.06 : 1;
  const rawDamage = weapon.damage * attacker.attackScale * positionalBonus * aggressionBonus * lowHpAttackBonus * (crit ? attacker.critDamage : 1);
  const effectiveDefense = getEffectiveDefense(defender);
  const damage = Math.max(2, rawDamage * (1 - effectiveDefense));

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

  return true;
}

function getHitArc(attacker, weapon) {
  if (weapon.id === 'western') return weapon.arc * 1.08;
  if (weapon.id === 'eastern') return weapon.arc * 1.06;
  if (weapon.id === 'dagger') return weapon.arc * 1.12;
  return weapon.arc;
}

function getReachBonus(attacker, weapon) {
  if (weapon.id === 'western') return 5;
  if (weapon.id === 'eastern') return 4;
  if (weapon.id === 'dagger') return 3;
  return 0;
}

function hasDaggerAttackAngle(attacker, defender) {
  const attackerFromDefender = angleTo(defender, attacker);
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const sideGap = Math.min(
    Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender)),
    Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender))
  );
  const defenderLowHp = defender.hp / defender.maxHp < 0.22;
  const committedToFlank = attacker.lastAction.includes('측') || attacker.lastAction.includes('후방');

  return backGap < 1.08 || sideGap < 0.86 || committedToFlank || defenderLowHp;
}

function isDirectlyInFrontOf(observer, target) {
  const observerToTarget = angleTo(observer, target);
  const frontGap = Math.abs(angleDiff(observer.facing, observerToTarget));
  return frontGap < 0.62;
}

function getEffectiveDefense(unit) {
  const lowHpBonus = unit.hp / unit.maxHp < 0.35 ? unit.lowHpDefenseBonus || 0 : 0;
  return clamp(unit.defense + lowHpBonus, 0, 0.62);
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
  const attackAngle = angleTo(attacker, defender);
  const sideAngle = attackAngle + Math.PI / 2 * attacker.orbitDir;
  defender.vx += Math.cos(attackAngle) * force * 0.12 + Math.cos(sideAngle) * force * 0.018;
  defender.vy += Math.sin(attackAngle) * force * 0.12 + Math.sin(sideAngle) * force * 0.018;
}

function resolveBodyCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = a.radius + b.radius + 1;

  if (dist >= minDist) return;

  const push = (minDist - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  const tangentX = -ny;
  const tangentY = nx;
  const tangentPush = 0.42;

  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;

  a.vx -= nx * 0.22 + tangentX * a.orbitDir * tangentPush;
  a.vy -= ny * 0.22 + tangentY * a.orbitDir * tangentPush;
  b.vx += nx * 0.22 - tangentX * b.orbitDir * tangentPush;
  b.vy += ny * 0.22 - tangentY * b.orbitDir * tangentPush;
}

function clampToArena(unit, arena) {
  const minX = arena.left + unit.radius;
  const maxX = arena.right - unit.radius;
  const minY = arena.top + unit.radius;
  const maxY = arena.bottom - unit.radius;
  const beforeX = unit.x;
  const beforeY = unit.y;

  unit.x = clamp(unit.x, minX, maxX);
  unit.y = clamp(unit.y, minY, maxY);

  if (unit.x !== beforeX) {
    unit.vx *= -0.18;
    unit.orbitDir *= -1;
  }
  if (unit.y !== beforeY) {
    unit.vy *= -0.18;
    unit.orbitDir *= -1;
  }
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
