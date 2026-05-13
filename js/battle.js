// battle.js
// 공격 판정, 피해 계산, 승패 판정만 담당합니다.
// 수정 원칙: 새 resolveAttack 패치 함수를 뒤에 추가하지 말고 기존 함수를 직접 수정합니다.

import { PERSONALITIES, POSTURE_RULES, WEAPONS } from './data.js';
import { decideMovement } from './ai.js';
import { angleDiff, angleTo, clamp, distance, moveToward } from './utils.js';

export function updateBattle(state) {
  if (!state.running || state.paused || state.result) return;

  state.frame += 1;
  state.elapsed += 1 / 60;

  updateUnit(state.player, state.enemy, state);
  updateUnit(state.enemy, state.player, state);

  resolveWeaponClash(state.player, state.enemy);
  resolveBodyCollision(state.player, state.enemy);
  clampToArena(state.player, state.arena);
  clampToArena(state.enemy, state.arena);
  checkResult(state);
}

function updateUnit(unit, enemy, state) {
  if (unit.isDead) return;

  const weapon = WEAPONS[unit.weaponId];
  tickTimers(unit);

  if (unit.impactStopTimer > 0) {
    unit.impactStopTimer -= 1;
    unit.vx *= 0.62;
    unit.vy *= 0.62;
    unit.lastAction = unit.lastAction.includes('패링') ? unit.lastAction : '충격 정지';
    return;
  }

  if (unit.staggerTimer > 0) {
    applyStaggerDrift(unit);
    unit.lastAction = '자세 흐트러짐';
    return;
  }

  recoverPosture(unit);

  const movement = decideMovement(unit, enemy, state);
  updateRetreatState(unit, movement);
  unit.lastAction = movement.label;
  unit.facing = moveToward(unit.facing, movement.faceAngle, getTurnSpeed(unit));

  updateOrbitDirection(unit, enemy);

  if (unit.attackState === 'idle') {
    applyMovement(unit, movement, weapon, enemy);
    if (tryCloseRangeReset(unit, enemy, movement)) return;
    if (unit.cooldownTimer <= 0 && canStartAttack(unit, enemy)) {
      beginAttack(unit, enemy);
    }
    return;
  }

  updateAttackState(unit, enemy, state);
}

function tickTimers(unit) {
  if (unit.cooldownTimer > 0) unit.cooldownTimer -= 1;
  if (unit.postureRecoveryDelay > 0) unit.postureRecoveryDelay -= 1;
  if (unit.staggerTimer > 0) unit.staggerTimer -= 1;
  if (unit.retreatLockout > 0) unit.retreatLockout -= 1;
  if (unit.resetMoveCooldown > 0) unit.resetMoveCooldown -= 1;
  if (unit.clashCooldown > 0) unit.clashCooldown -= 1;
  if (unit.flankPressureTimer > 0) unit.flankPressureTimer -= 1;
  if (unit.daggerBurstCooldown > 0) unit.daggerBurstCooldown -= 1;
  if (unit.parryCooldown > 0) unit.parryCooldown -= 1;
  if (unit.parryFlashTimer > 0) unit.parryFlashTimer -= 1;
  if (unit.counterTimer > 0) unit.counterTimer -= 1;
}

function updateRetreatState(unit, movement) {
  const label = movement.label || '';
  const isRetreat = label.includes('후퇴') || label.includes('최소거리 확보') || label.includes('거리 이탈') || label.includes('체력 관리');

  if (isRetreat) {
    unit.retreatFrames = (unit.retreatFrames || 0) + 1;
    if (unit.retreatFrames > POSTURE_RULES.retreatMaxFrames) {
      unit.retreatLockout = Math.max(unit.retreatLockout || 0, POSTURE_RULES.retreatLockoutFrames);
    }
    return;
  }

  unit.retreatFrames = Math.max(0, (unit.retreatFrames || 0) - 2);
}

function recoverPosture(unit) {
  if (unit.postureRecoveryDelay > 0 || unit.posture >= unit.maxPosture) return;

  const stateScale = unit.attackState === 'idle' ? 1 : 0.35;
  unit.posture = clamp(
    unit.posture + POSTURE_RULES.recoveryPerFrame * stateScale,
    0,
    unit.maxPosture
  );
}

function getTurnSpeed(unit) {
  const weapon = WEAPONS[unit.weaponId];
  const personality = PERSONALITIES[unit.personalityId];
  const agilityScale = 1 + unit.stats.agi * 0.012;
  let scale = agilityScale;

  if (personality.id === 'assassin') scale *= 1.08;
  if (personality.id === 'defensive') scale *= 0.96;

  if (unit.attackState === 'windup') scale *= weapon.windupTurnScale;
  if (unit.attackState === 'active') scale *= weapon.activeTurnScale;
  if (unit.attackState === 'recovery') scale *= weapon.recoveryTurnScale;
  if (unit.postureRecoveryDelay > 0) scale *= 0.78;
  if (unit.flankPressureTimer > 0) scale *= POSTURE_RULES.daggerFlankTurnScale;
  if (unit.parryFlashTimer > 0) scale *= 0.72;
  if (unit.posture < unit.maxPosture * 0.35) scale *= 0.86;
  if (unit.staggerTimer > 0) scale *= POSTURE_RULES.staggerMoveScale;

  return weapon.turnSpeed * scale;
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

function applyMovement(unit, movement, weapon, enemy = null) {
  const acceleration = getAcceleration(unit, movement);
  const friction = 0.865;
  const burstScale = unit.weaponId === 'dagger' && isDaggerBurstLabel(movement.label) ? 1.46 : 1;
  const maxSpeed = weapon.moveSpeed * (unit.moveSpeedScale || 1) * burstScale;

  unit.vx += movement.ax * acceleration;
  unit.vy += movement.ay * acceleration;
  unit.vx *= friction;
  unit.vy *= friction;

  if (unit.retreatLockout > 0 && movement.label.includes('측면')) {
    unit.vx *= 1.06;
    unit.vy *= 1.06;
  }

  const speed = Math.hypot(unit.vx, unit.vy);
  if (speed > maxSpeed) {
    unit.vx = (unit.vx / speed) * maxSpeed;
    unit.vy = (unit.vy / speed) * maxSpeed;
  }

  unit.x += unit.vx;
  unit.y += unit.vy;

  if (enemy && unit.weaponId === 'dagger' && isDaggerBurstLabel(movement.label)) {
    const dist = distance(unit, enemy);
    if (dist < WEAPONS[unit.weaponId].range + enemy.radius + 46) {
      enemy.flankPressureTimer = Math.max(enemy.flankPressureTimer || 0, POSTURE_RULES.daggerFlankPressureFrames);
      unit.daggerBurstCooldown = Math.max(unit.daggerBurstCooldown || 0, POSTURE_RULES.daggerBurstCooldownFrames);
    }
  }
}

function getAcceleration(unit, movement) {
  const personality = PERSONALITIES[unit.personalityId];
  let value = 0.21 + (personality.pressure || 0.5) * 0.025;
  if (unit.weaponId === 'spear' && movement.label.includes('확보')) value = 0.25;
  if (unit.weaponId === 'spear' && movement.label.includes('측면')) value = 0.29;
  if (unit.weaponId === 'eastern') value = 0.25;
  if (unit.weaponId === 'dagger') value = isDaggerBurstLabel(movement.label) ? 0.48 : 0.31;
  if (personality.id === 'defensive' && movement.label.includes('후퇴')) value += 0.015;
  if (personality.id === 'defensive' && movement.label.includes('측면')) value += 0.045;
  if (personality.id === 'assassin' && movement.label.includes('측')) value += 0.035;
  return value;
}

function isDaggerBurstLabel(label = '') {
  return label.includes('순간') || label.includes('침투') || label.includes('후방') || label.includes('돌파') || label.includes('빠른') || label.includes('미러 짧은 교전');
}

function tryCloseRangeReset(unit, enemy, movement) {
  if (unit.resetMoveCooldown > 0 || unit.attackState !== 'idle') return false;

  const weapon = WEAPONS[unit.weaponId];
  const personality = PERSONALITIES[unit.personalityId];
  const dist = distance(unit, enemy);
  const bodyClose = dist < unit.radius + enemy.radius + 18;
  const spearPinned = weapon.id === 'spear' && (
    dist < weapon.minRange + 16 ||
    ((unit.retreatFrames || 0) > 12 && dist < weapon.minRange + 30) ||
    (unit.retreatLockout > 0 && dist < weapon.minRange + 24)
  );
  const defensivePinned = personality.id === 'defensive' && (
    bodyClose ||
    ((unit.retreatFrames || 0) > 18 && dist < unit.radius + enemy.radius + 42) ||
    (unit.retreatLockout > 0 && dist < unit.radius + enemy.radius + 36)
  );

  if (!spearPinned && !defensivePinned) return false;

  const pushAngle = angleTo(unit, enemy);
  const sideAngle = pushAngle + Math.PI / 2 * unit.orbitDir;
  const force = spearPinned ? 5.8 : 3.8;
  const sideForce = spearPinned ? 1.45 : 1.35;
  const selfSide = spearPinned ? 2.1 : 1.55;

  enemy.vx += Math.cos(pushAngle) * force + Math.cos(sideAngle) * sideForce;
  enemy.vy += Math.sin(pushAngle) * force + Math.sin(sideAngle) * sideForce;
  unit.vx += -Math.cos(pushAngle) * 0.75 + Math.cos(sideAngle) * selfSide;
  unit.vy += -Math.sin(pushAngle) * 0.75 + Math.sin(sideAngle) * selfSide;
  unit.retreatFrames = 0;
  unit.retreatLockout = Math.max(unit.retreatLockout || 0, Math.floor(POSTURE_RULES.retreatLockoutFrames * 0.45));
  unit.resetMoveCooldown = POSTURE_RULES.closeResetCooldown;
  unit.cooldownTimer = Math.max(unit.cooldownTimer, spearPinned ? 10 : 14);
  enemy.cooldownTimer = Math.max(enemy.cooldownTimer || 0, spearPinned ? 12 : 9);

  const postureDamage = POSTURE_RULES.closeResetPostureDamage * (spearPinned ? 1.22 : 0.94);
  applyPostureDamage(unit, enemy, postureDamage);
  twistBodyOnImpact(enemy, unit, postureDamage, weapon);

  unit.lastAction = spearPinned ? '창 밀어내기' : '방어 견제 밀어내기';
  enemy.lastAction = '자세 밀림';
  return true;
}

function canStartAttack(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  const personality = PERSONALITIES[attacker.personalityId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
  const daggerMirror = attacker.weaponId === 'dagger' && defender.weaponId === 'dagger';
  const startTolerance = daggerMirror
    ? 1.45
    : Math.max(weapon.arc * 1.28, attacker.weaponId === 'spear' ? 0.3 : 0.52);
  const attackStartReach = getAttackStartReach(attacker, defender, weapon);

  if (defender.staggerTimer > 0 && dist <= attackStartReach) {
    return true;
  }

  if (dist > attackStartReach) return false;
  if (dist < weapon.minRange) return false;
  if (angleGap > startTolerance) return false;

  if (attacker.weaponId === 'dagger' && !hasDaggerAttackAngle(attacker, defender)) {
    return false;
  }

  const committedToAngle = attacker.lastAction.includes('측') || attacker.lastAction.includes('후방') || attacker.lastAction.includes('미러') || attacker.lastAction.includes('돌파') || attacker.lastAction.includes('침투');
  if (personality.id === 'assassin' && attacker.weaponId !== 'spear' && isDirectlyInFrontOf(defender, attacker) && !committedToAngle) {
    return false;
  }

  return true;
}

function beginAttack(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  attacker.attackState = 'windup';
  attacker.attackTimer = weapon.windup;
  attacker.attackWindupMax = weapon.windup;
  attacker.attackActiveMax = getActiveFrames(attacker);
  attacker.attackRecoveryMax = weapon.recovery;
  attacker.attackResolved = false;
  attacker.attackAim = angleTo(attacker, defender);
  attacker.attackVisualPhase = 0;
  attacker.vx *= getAttackEntryBrake(attacker.weaponId);
  attacker.vy *= getAttackEntryBrake(attacker.weaponId);
  attacker.lastAction = getWindupLabel(attacker.weaponId);
}

function updateAttackState(attacker, defender, state) {
  const weapon = WEAPONS[attacker.weaponId];
  attacker.attackTimer -= 1;

  if (attacker.attackState === 'windup') {
    attacker.attackVisualPhase = 1 - attacker.attackTimer / Math.max(1, attacker.attackWindupMax || weapon.windup);
    applyWindupDrift(attacker, weapon);
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'active';
      attacker.attackTimer = attacker.attackActiveMax || getActiveFrames(attacker);
      attacker.attackVisualPhase = 0;
      attacker.lastAction = getActiveLabel(attacker.weaponId);
      applyAttackLunge(attacker, weapon);
      attacker.attackResolved = resolveAttack(attacker, defender, state);
    }
    return;
  }

  if (attacker.attackState === 'active') {
    attacker.attackVisualPhase = 1 - attacker.attackTimer / Math.max(1, attacker.attackActiveMax || getActiveFrames(attacker));
    applyAttackLunge(attacker, weapon, 0.36);
    if (!attacker.attackResolved) {
      attacker.attackResolved = resolveAttack(attacker, defender, state);
    }
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'recovery';
      const missPenalty = attacker.attackResolved ? 0 : (weapon.missRecoveryAdd || 0);
      attacker.attackTimer = weapon.recovery + missPenalty;
      attacker.attackRecoveryMax = attacker.attackTimer;
      attacker.lastAction = attacker.attackResolved ? getRecoveryLabel(attacker.weaponId) : '헛침 후딜';
    }
    return;
  }

  if (attacker.attackState === 'recovery') {
    attacker.attackVisualPhase = 1 - attacker.attackTimer / Math.max(1, attacker.attackRecoveryMax || weapon.recovery);
    applyRecoveryStep(attacker, defender, weapon);
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'idle';
      attacker.attackVisualPhase = 0;
      attacker.cooldownTimer = Math.max(8, Math.round(weapon.cooldown * (attacker.cooldownScale || 1)));
      attacker.lastAction = '재정비';
    }
  }
}

function getActiveFrames(attacker) {
  return WEAPONS[attacker.weaponId]?.activeFrames || 5;
}

function getAttackEntryBrake(weaponId) {
  if (weaponId === 'spear') return 0.3;
  if (weaponId === 'western') return 0.34;
  if (weaponId === 'eastern') return 0.46;
  if (weaponId === 'dagger') return 0.52;
  return 0.42;
}

function getWindupLabel(weaponId) {
  if (weaponId === 'spear') return '창 찌르기 준비';
  if (weaponId === 'western') return '서양검 크게 감기';
  if (weaponId === 'eastern') return '동양검 빠른 발도';
  if (weaponId === 'dagger') return '단검 찌르기 준비';
  return '공격 준비';
}

function getActiveLabel(weaponId) {
  if (weaponId === 'spear') return '창 찌르기';
  if (weaponId === 'western') return '서양검 베기';
  if (weaponId === 'eastern') return '동양검 베기';
  if (weaponId === 'dagger') return '단검 찌르기';
  return '타격 판정';
}

function getRecoveryLabel(weaponId) {
  if (weaponId === 'spear') return '창 회수';
  if (weaponId === 'western') return '서양검 후딜';
  if (weaponId === 'eastern') return '동양검 이탈';
  if (weaponId === 'dagger') return '단검 빠른 이탈';
  return '후딜';
}

function applyWindupDrift(attacker, weapon) {
  const baseAngle = attacker.attackAim ?? attacker.facing;
  const sideSign = attacker.orbitDir || 1;
  const sideAngle = baseAngle + Math.PI / 2 * sideSign;
  const backAngle = baseAngle + Math.PI;
  const forwardAngle = baseAngle;
  const phase = clamp(attacker.attackVisualPhase || 0, 0, 1);
  const driftScale = weapon.windupDriftScale || 0.5;

  let forwardPower = 0;
  let backPower = 0;
  let sidePower = 0;

  if (weapon.id === 'spear') {
    backPower = 0.028 * driftScale * (1 - phase * 0.35);
    sidePower = weapon.strafeWeight * 0.01 * driftScale;
  } else if (weapon.id === 'western') {
    forwardPower = 0.02 * driftScale * phase;
    backPower = 0.016 * driftScale * (1 - phase);
    sidePower = weapon.strafeWeight * 0.018 * driftScale;
  } else if (weapon.id === 'eastern') {
    forwardPower = 0.04 * driftScale * phase;
    sidePower = weapon.strafeWeight * 0.036 * driftScale;
  } else {
    const fakePhase = Math.sin(phase * Math.PI);
    backPower = 0.018 * driftScale * (1 - phase);
    forwardPower = 0.035 * driftScale * Math.max(0, phase - 0.45);
    sidePower = weapon.strafeWeight * 0.052 * driftScale * fakePhase;
  }

  attacker.vx +=
    Math.cos(forwardAngle) * forwardPower +
    Math.cos(backAngle) * backPower +
    Math.cos(sideAngle) * sidePower;
  attacker.vy +=
    Math.sin(forwardAngle) * forwardPower +
    Math.sin(backAngle) * backPower +
    Math.sin(sideAngle) * sidePower;

  const damping = weapon.id === 'dagger' ? 0.93 : weapon.id === 'eastern' ? 0.91 : 0.88;
  attacker.vx *= damping;
  attacker.vy *= damping;
  attacker.x += attacker.vx;
  attacker.y += attacker.vy;
}

function applyAttackLunge(attacker, weapon, scale = 1) {
  const forwardAngle = attacker.attackAim ?? attacker.facing;
  const sideSign = attacker.orbitDir || 1;
  const sideAngle = forwardAngle + Math.PI / 2 * sideSign;
  const lungeScale = weapon.activeLungeScale || 1;
  const entryForward = weapon.entryForward || 1;
  const entrySide = weapon.entrySide || 0.2;

  let baseForward = weapon.lungePower * lungeScale * entryForward;
  let baseSide = weapon.strafeWeight * entrySide;

  if (weapon.id === 'spear') {
    baseForward *= 3.45;
    baseSide *= 0.18;
  } else if (weapon.id === 'western') {
    baseForward *= 2.66;
    baseSide *= 0.26;
  } else if (weapon.id === 'eastern') {
    baseForward *= 2.94;
    baseSide *= 0.48;
  } else {
    baseForward *= 3.12;
    baseSide *= 0.78;
  }

  const forward = baseForward * scale;
  const side = baseSide * scale;
  attacker.vx += Math.cos(forwardAngle) * forward + Math.cos(sideAngle) * side;
  attacker.vy += Math.sin(forwardAngle) * forward + Math.sin(sideAngle) * side;

  const maxBurst = weapon.id === 'spear' ? 7.4 : weapon.id === 'dagger' ? 7.0 : weapon.id === 'eastern' ? 6.6 : 5.9;
  const speed = Math.hypot(attacker.vx, attacker.vy);
  if (speed > maxBurst) {
    attacker.vx = attacker.vx / speed * maxBurst;
    attacker.vy = attacker.vy / speed * maxBurst;
  }

  attacker.x += attacker.vx;
  attacker.y += attacker.vy;
}

function applyRecoveryStep(attacker, defender, weapon) {
  const awayAngle = angleTo(defender, attacker);
  const sideAngle = awayAngle + Math.PI / 2 * attacker.orbitDir;
  const scale = weapon.recoveryMoveScale || 1;
  let back = weapon.recoveryBackstep * 0.18 * scale;
  let side = weapon.strafeWeight * 0.04 * scale;

  if (weapon.id === 'spear') {
    back *= 1.08;
    side *= 0.45;
  } else if (weapon.id === 'western') {
    back *= 0.82;
    side *= 0.58;
  } else if (weapon.id === 'eastern') {
    back *= 0.74;
    side *= 0.92;
  } else {
    back *= 1.85;
    side *= 1.18;
  }

  attacker.vx += Math.cos(awayAngle) * back + Math.cos(sideAngle) * side;
  attacker.vy += Math.sin(awayAngle) * back + Math.sin(sideAngle) * side;

  const damping = weapon.id === 'dagger' ? 0.94 : weapon.id === 'eastern' ? 0.92 : 0.88;
  attacker.vx *= damping;
  attacker.vy *= damping;
  attacker.x += attacker.vx;
  attacker.y += attacker.vy;
}

function applyStaggerDrift(unit) {
  unit.vx *= 0.82;
  unit.vy *= 0.82;
  unit.x += unit.vx * POSTURE_RULES.staggerMoveScale;
  unit.y += unit.vy * POSTURE_RULES.staggerMoveScale;
}

function resolveAttack(attacker, defender, state) {
  if (defender.isDead) return true;

  const weapon = WEAPONS[attacker.weaponId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
  const daggerMirror = attacker.weaponId === 'dagger' && defender.weaponId === 'dagger';
  const hitArc = daggerMirror ? 1.22 : getHitArc(attacker, weapon);
  const reachBonus = getReachBonus(attacker, weapon);
  const hitQuality = getHitQuality(attacker, defender, weapon, dist, angleGap, hitArc);

  if (dist > getHitReach(attacker, defender, weapon) + reachBonus) return false;
  if (dist < weapon.minRange) return false;
  if (angleGap > hitArc) return false;

  if (resolveParry(defender, attacker, weapon)) return true;

  const evaded = defender.staggerTimer <= 0 && Math.random() < defender.evasion;
  if (evaded) {
    defender.lastAction = '회피';
    return true;
  }

  const crit = Math.random() < attacker.crit;
  const positionalBonus = getPositionalBonus(attacker, defender);
  const personality = PERSONALITIES[attacker.personalityId];
  const aggressionBonus = 1 + personality.aggression * 0.08;
  const lowHpAttackBonus = attacker.hp / attacker.maxHp < 0.35 && attacker.skills?.includes('survival') ? 1.06 : 1;
  const staggerDamageBonus = defender.staggerTimer > 0 ? POSTURE_RULES.staggerDamageTakenBonus : 1;
  const counterBonus = attacker.counterTimer > 0 ? POSTURE_RULES.counterDamageBonus : 1;
  const rawDamage = weapon.damage * attacker.attackScale * positionalBonus * aggressionBonus * lowHpAttackBonus * staggerDamageBonus * counterBonus * (crit ? attacker.critDamage : 1);
  const effectiveDefense = getEffectiveDefense(defender);
  const damage = Math.max(2, rawDamage * (1 - effectiveDefense));

  defender.hp = clamp(defender.hp - damage, 0, defender.maxHp);
  attacker.hits += 1;
  attacker.damageDealt += damage;
  attacker.lastAction = crit ? '치명타' : '명중';
  defender.lastAction = defender.staggerTimer > 0 ? '흐트러짐 피격' : '피격';

  const postureDamage = getPostureDamage(attacker, defender, weapon, positionalBonus, crit, hitQuality);
  applyPostureDamage(attacker, defender, postureDamage);
  applyWeaponHitReaction(attacker, defender, weapon, hitQuality);
  twistBodyOnImpact(defender, attacker, postureDamage, weapon);
  applyImpactStop(attacker, defender, weapon);
  attacker.counterTimer = 0;

  if (defender.hp <= 0) {
    defender.isDead = true;
    defender.lastAction = '전투 불능';
  }

  return true;
}


function applyImpactStop(attacker, defender, weapon) {
  const stop = weapon.impactStopFrames || 3;
  attacker.impactStopTimer = Math.max(attacker.impactStopTimer || 0, Math.max(1, stop - 1));
  defender.impactStopTimer = Math.max(defender.impactStopTimer || 0, stop + (defender.staggerTimer > 0 ? 2 : 0));
}

function resolveParry(defender, attacker, incomingWeapon) {
  if (!canTryParry(defender, attacker, incomingWeapon)) return false;

  const chance = getParryChance(defender, attacker, incomingWeapon);
  defender.parryCooldown = Math.max(defender.parryCooldown || 0, Math.floor(POSTURE_RULES.parryCooldownFrames * 0.55));

  if (Math.random() > chance) {
    defender.lastAction = '패링 실패';
    return false;
  }

  performParry(defender, attacker, incomingWeapon);
  return true;
}

function canTryParry(defender, attacker, incomingWeapon) {
  if (defender.isDead || attacker.isDead) return false;
  if (defender.staggerTimer > 0 || defender.parryCooldown > 0) return false;
  if (defender.posture < defender.maxPosture * 0.18) return false;
  if (attacker.weaponId === 'dagger' && getPositionalBonus(attacker, defender) > 1.05) return false;

  const incomingDirection = angleTo(defender, attacker);
  const frontGap = Math.abs(angleDiff(defender.facing, incomingDirection));
  if (frontGap > POSTURE_RULES.parryFrontArc) return false;

  const dist = distance(defender, attacker);
  const defenderWeapon = WEAPONS[defender.weaponId];
  const parryReach = Math.max(defender.radius + attacker.radius + 24, defenderWeapon.range * 0.72 + attacker.radius);
  if (dist > parryReach + getReachBonus(attacker, incomingWeapon)) return false;

  if (defender.attackState === 'recovery' && defender.attackTimer > 8) return false;
  return true;
}

function getParryChance(defender, attacker, incomingWeapon) {
  const defenderWeapon = WEAPONS[defender.weaponId];
  const personality = PERSONALITIES[defender.personalityId];
  const postureRatio = clamp(defender.posture / defender.maxPosture, 0, 1);
  const timingBonus = defender.attackState === 'windup'
    ? 0.07
    : defender.attackState === 'active'
      ? 0.04
      : defender.cooldownTimer <= 6
        ? 0.03
        : 0;
  const pressurePenalty = attacker.weaponId === 'spear' && distance(defender, attacker) > defenderWeapon.range * 0.72 ? 0.035 : 0;

  return clamp(
    POSTURE_RULES.parryBaseChance +
    (defenderWeapon.parryEfficiency || 0.3) * 0.52 +
    (personality.parryBonus || 0) +
    defender.stats.def * 0.005 +
    defender.stats.agi * 0.003 +
    defender.stats.luck * 0.0015 +
    postureRatio * 0.055 +
    timingBonus -
    (incomingWeapon.parryBreak || 0) -
    pressurePenalty,
    0,
    POSTURE_RULES.parryMaxChance
  );
}

function performParry(defender, attacker, incomingWeapon) {
  const defenderWeapon = WEAPONS[defender.weaponId];
  const parryPower = getParryPower(defender, defenderWeapon, incomingWeapon);
  const impactAngle = angleTo(defender, attacker);
  const sideAngle = impactAngle + Math.PI / 2 * defender.orbitDir;

  applyPostureDamage(defender, attacker, parryPower);
  twistBodyOnImpact(attacker, defender, parryPower, defenderWeapon);

  attacker.attackState = 'recovery';
  attacker.attackTimer = Math.max(attacker.attackTimer, incomingWeapon.recovery + POSTURE_RULES.parryRecoveryAddFrames);
  attacker.cooldownTimer = Math.max(attacker.cooldownTimer, Math.floor(incomingWeapon.cooldown * 0.32));
  const parryKnockback = getParryKnockback(attacker, incomingWeapon);
  attacker.vx += Math.cos(impactAngle) * parryKnockback + Math.cos(sideAngle) * 0.72;
  attacker.vy += Math.sin(impactAngle) * parryKnockback + Math.sin(sideAngle) * 0.72;

  defender.vx -= Math.cos(impactAngle) * 0.82;
  defender.vy -= Math.sin(impactAngle) * 0.82;
  defender.parryCooldown = POSTURE_RULES.parryCooldownFrames;
  defender.parryFlashTimer = POSTURE_RULES.parryFlashFrames;
  defender.counterTimer = POSTURE_RULES.counterWindowFrames;
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay, Math.floor(POSTURE_RULES.recoveryDelayFrames * 0.38));
  defender.impactStopTimer = Math.max(defender.impactStopTimer || 0, 3);
  attacker.impactStopTimer = Math.max(attacker.impactStopTimer || 0, incomingWeapon.impactStopFrames || 4);
  defender.lastAction = '패링 성공';
  attacker.lastAction = '패링당함';
}

function getParryKnockback(attacker, incomingWeapon) {
  const weaponScale = incomingWeapon.parryKnockbackTaken || 1;
  const postureScale = attacker.posture < attacker.maxPosture * 0.35 ? 1.18 : 1;
  return POSTURE_RULES.parryKnockback * weaponScale * postureScale;
}

function getParryPower(defender, defenderWeapon, incomingWeapon) {
  const weaponScale = 0.82 + (defenderWeapon.parryEfficiency || 0.3);
  const statScale = 1 + defender.stats.def * 0.018 + defender.stats.agi * 0.006 + defender.mastery * 0.035;
  const incomingScale = incomingWeapon.id === 'western'
    ? 1.08
    : incomingWeapon.id === 'spear'
      ? 1.02
      : incomingWeapon.id === 'dagger'
        ? 0.82
        : 0.94;
  return POSTURE_RULES.parryPostureDamage * weaponScale * statScale * incomingScale;
}

function getHitQuality(attacker, defender, weapon, dist, angleGap, hitArc) {
  const reach = getHitReach(attacker, defender, weapon);
  const idealDistance = Math.max(weapon.minRange + defender.radius + 12, weapon.idealRange + defender.radius * 0.6);
  const angleScore = clamp(1 - angleGap / Math.max(0.12, hitArc), 0, 1);
  const rangeScore = clamp(1 - Math.abs(dist - idealDistance) / Math.max(24, reach * 0.45), 0, 1);
  const activeScore = attacker.attackState === 'active' ? 1 : 0.65;
  return clamp(angleScore * 0.62 + rangeScore * 0.3 + activeScore * 0.08, 0, 1);
}

function getHitArc(attacker, weapon) {
  if (weapon.id === 'western') return weapon.arc * 1.02;
  if (weapon.id === 'eastern') return weapon.arc * 1.04;
  if (weapon.id === 'dagger') return weapon.arc * 1.1;
  return weapon.arc;
}

function getAttackStartReach(attacker, defender, weapon) {
  const startBuffer = weapon.attackStartBuffer || 0;
  return weapon.range + defender.radius + getReachBonus(attacker, weapon) + startBuffer;
}

function getHitReach(attacker, defender, weapon) {
  const hitReachBonus = weapon.hitReachBonus || 0;
  return weapon.range + defender.radius + hitReachBonus;
}

function getReachBonus(attacker, weapon) {
  if (weapon.id === 'western') return 5;
  if (weapon.id === 'eastern') return 4;
  if (weapon.id === 'dagger') return 3;
  return 0;
}

function hasDaggerAttackAngle(attacker, defender) {
  if (defender.staggerTimer > 0 || defender.attackState === 'recovery') return true;

  const dist = distance(attacker, defender);
  const attackerFromDefender = angleTo(defender, attacker);
  const frontGap = Math.abs(angleDiff(defender.facing, attackerFromDefender));
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const sideGap = Math.min(
    Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender)),
    Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender))
  );
  const defenderLowHp = defender.hp / defender.maxHp < 0.22;
  const committedBurst = isDaggerBurstLabel(attacker.lastAction) && dist < WEAPONS.dagger.range + defender.radius + 12;
  const defenderBusy = defender.attackState !== 'idle' || defender.cooldownTimer > 10 || defender.flankPressureTimer > 0;
  const daggerMirrorCommit = defender.weaponId === 'dagger' && dist < WEAPONS.dagger.range + defender.radius + 8 && frontGap < 1.62;

  return backGap < 1.32 || sideGap < 1.04 || defenderLowHp || committedBurst || (defenderBusy && sideGap < 1.22) || daggerMirrorCommit;
}

function isDirectlyInFrontOf(observer, target) {
  const observerToTarget = angleTo(observer, target);
  const frontGap = Math.abs(angleDiff(observer.facing, observerToTarget));
  return frontGap < 0.62;
}

function getEffectiveDefense(unit) {
  const lowHpBonus = unit.hp / unit.maxHp < 0.35 ? unit.lowHpDefenseBonus || 0 : 0;
  const staggerPenalty = unit.staggerTimer > 0 ? -0.05 : 0;
  return clamp(unit.defense + lowHpBonus + staggerPenalty, 0, 0.62);
}

function getPositionalBonus(attacker, defender) {
  const weapon = WEAPONS[attacker.weaponId];
  if (weapon.id !== 'dagger') return 1;

  const attackerFromDefender = angleTo(defender, attacker);
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const sideGap = Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender));
  const otherSideGap = Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender));
  const flankGap = Math.min(sideGap, otherSideGap);

  if (backGap < 1.12) return weapon.backBonus;
  if (flankGap < 1.02) return weapon.flankBonus;
  if (defender.flankPressureTimer > 0 && flankGap < 1.18) return (weapon.flankBonus + 1) / 2;
  return 1;
}

function getPostureDamage(attacker, defender, weapon, positionalBonus, crit, hitQuality = 0) {
  const attackStateBonus = defender.attackState === 'windup' || defender.attackState === 'active' ? 1.18 : 1;
  const critBonus = crit ? 1.22 : 1;
  const counterPostureBonus = attacker.counterTimer > 0 ? POSTURE_RULES.counterPostureBonus : 1;
  const weaponPostureScale = weapon.hitPostureScale || 1;
  const qualityBonus = 1 + hitQuality * 0.16;
  const daggerPostureBonus = weapon.id === 'dagger'
    ? getDaggerPostureBonus(attacker, defender, weapon)
    : 1;
  const defenseReduction = clamp(1 - defender.defense * 0.38, 0.72, 1);
  return Math.max(
    POSTURE_RULES.minPostureDamage,
    weapon.postureDamage * weaponPostureScale * positionalBonus * daggerPostureBonus * attackStateBonus * critBonus * counterPostureBonus * qualityBonus * defenseReduction
  );
}

function getDaggerPostureBonus(attacker, defender, weapon) {
  const attackerFromDefender = angleTo(defender, attacker);
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const sideGap = Math.min(
    Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender)),
    Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender))
  );

  if (backGap < 1.12) return weapon.backPostureBonus || 1;
  if (sideGap < 1.02) return weapon.flankPostureBonus || 1;
  if (defender.flankPressureTimer > 0 && sideGap < 1.18) return Math.max(1.18, (weapon.flankPostureBonus || 1));
  return 1;
}

function applyPostureDamage(attacker, defender, amount) {
  if (defender.isDead || defender.staggerTimer > 0) return;

  defender.posture = clamp(defender.posture - amount, 0, defender.maxPosture);
  defender.postureRecoveryDelay = POSTURE_RULES.recoveryDelayFrames;

  if (defender.posture <= 0) {
    triggerStagger(defender, attacker);
  }
}

function triggerStagger(unit, attacker) {
  const impactAngle = angleTo(attacker, unit);
  unit.staggerTimer = POSTURE_RULES.staggerFrames;
  unit.attackState = 'idle';
  unit.attackTimer = 0;
  unit.cooldownTimer = Math.max(unit.cooldownTimer, 22);
  unit.posture = Math.round(unit.maxPosture * POSTURE_RULES.staggerPostureRestoreRatio);
  unit.postureRecoveryDelay = POSTURE_RULES.recoveryDelayFrames;
  unit.retreatFrames = 0;
  unit.retreatLockout = Math.max(unit.retreatLockout || 0, 24);
  unit.facing = impactAngle + Math.PI + attacker.orbitDir * POSTURE_RULES.staggerFacingTwist;
  unit.vx += Math.cos(impactAngle) * 1.35;
  unit.vy += Math.sin(impactAngle) * 1.35;
  unit.lastAction = '스태미너 붕괴';
}

function twistBodyOnImpact(defender, attacker, postureDamage, weapon) {
  if (defender.isDead) return;

  const incoming = angleTo(attacker, defender);
  const side = Math.sign(angleDiff(defender.facing, incoming)) || attacker.orbitDir || 1;
  const weaponWeight = weapon.id === 'western' ? 1.08 : weapon.id === 'spear' ? 1.0 : weapon.id === 'dagger' ? 0.78 : 0.9;
  const twist = clamp(
    POSTURE_RULES.impactTurnMin + postureDamage * POSTURE_RULES.impactTurnPostureScale * weaponWeight,
    POSTURE_RULES.impactTurnMin,
    POSTURE_RULES.impactTurnMax
  );

  defender.facing += side * twist;
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay, Math.floor(POSTURE_RULES.recoveryDelayFrames * 0.55));
  if (defender.attackState === 'windup' || defender.attackState === 'active') {
    defender.attackTimer += 2;
  }
}

function applyWeaponHitReaction(attacker, defender, weapon, hitQuality = 0) {
  const attackAngle = angleTo(attacker, defender);
  const sideAngle = attackAngle + Math.PI / 2 * attacker.orbitDir;
  const qualityScale = 1 + hitQuality * (POSTURE_RULES.preciseHitKnockbackBonus || 0.28);
  const force = (weapon.hitKnockback || weapon.knockback || 8) * qualityScale;

  defender.vx += Math.cos(attackAngle) * force * 0.14 + Math.cos(sideAngle) * force * 0.018;
  defender.vy += Math.sin(attackAngle) * force * 0.14 + Math.sin(sideAngle) * force * 0.018;

  if (weapon.id === 'western') {
    defender.vx += Math.cos(sideAngle) * force * 0.035;
    defender.vy += Math.sin(sideAngle) * force * 0.035;
  }

  const selfRetreat = weapon.selfRetreatOnHit || 0;
  if (selfRetreat > 0) {
    const retreatScale = weapon.id === 'dagger' ? 1 + hitQuality * 0.42 : 0.35;
    attacker.vx -= Math.cos(attackAngle) * selfRetreat * retreatScale;
    attacker.vy -= Math.sin(attackAngle) * selfRetreat * retreatScale;
    if (weapon.id === 'dagger') {
      attacker.vx += Math.cos(sideAngle) * attacker.orbitDir * 0.45;
      attacker.vy += Math.sin(sideAngle) * attacker.orbitDir * 0.45;
      attacker.cooldownTimer = Math.max(attacker.cooldownTimer || 0, 4);
      attacker.lastAction = '단검 치고 빠지기';
    }
  }
}

function resolveWeaponClash(a, b) {
  if (a.isDead || b.isDead || a.clashCooldown > 0 || b.clashCooldown > 0) return;
  if (a.attackState !== 'active' || b.attackState !== 'active') return;
  if (!isWeaponThreatening(a, b) || !isWeaponThreatening(b, a)) return;

  const weaponA = WEAPONS[a.weaponId];
  const weaponB = WEAPONS[b.weaponId];
  const powerA = getClashPower(a, weaponA);
  const powerB = getClashPower(b, weaponB);
  const total = Math.max(1, powerA + powerB);
  const damageToA = POSTURE_RULES.weaponClashPostureDamage * (powerB / total) * 1.8;
  const damageToB = POSTURE_RULES.weaponClashPostureDamage * (powerA / total) * 1.8;
  const angleAB = angleTo(a, b);

  a.clashCooldown = POSTURE_RULES.weaponClashCooldown;
  b.clashCooldown = POSTURE_RULES.weaponClashCooldown;
  a.attackState = a.attackState === 'active' ? 'recovery' : a.attackState;
  b.attackState = b.attackState === 'active' ? 'recovery' : b.attackState;
  a.attackTimer = Math.max(a.attackTimer, 8);
  b.attackTimer = Math.max(b.attackTimer, 8);

  applyPostureDamage(b, a, damageToA);
  applyPostureDamage(a, b, damageToB);
  twistBodyOnImpact(a, b, damageToA, weaponB);
  twistBodyOnImpact(b, a, damageToB, weaponA);

  const clashKnockbackA = getClashKnockback(a, weaponA, powerB, total);
  const clashKnockbackB = getClashKnockback(b, weaponB, powerA, total);
  const sideAngle = angleAB + Math.PI / 2;
  a.vx -= Math.cos(angleAB) * clashKnockbackA + Math.cos(sideAngle) * a.orbitDir * 0.36;
  a.vy -= Math.sin(angleAB) * clashKnockbackA + Math.sin(sideAngle) * a.orbitDir * 0.36;
  b.vx += Math.cos(angleAB) * clashKnockbackB - Math.cos(sideAngle) * b.orbitDir * 0.36;
  b.vy += Math.sin(angleAB) * clashKnockbackB - Math.sin(sideAngle) * b.orbitDir * 0.36;
  a.impactStopTimer = Math.max(a.impactStopTimer || 0, 3);
  b.impactStopTimer = Math.max(b.impactStopTimer || 0, 3);
  a.lastAction = '무기 충돌';
  b.lastAction = '무기 충돌';
}

function isWeaponThreatening(attacker, defender) {
  if (attacker.attackState !== 'active') return false;

  const weapon = WEAPONS[attacker.weaponId];
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
  const rangePadding = defender.radius + getReachBonus(attacker, weapon) + 2;

  if (dist > weapon.range + rangePadding) return false;
  if (dist < Math.max(0, weapon.minRange - 6)) return false;
  return angleGap <= weapon.arc + 0.28;
}

function getClashKnockback(unit, weapon, opposingPower, totalPower) {
  const pressure = clamp(opposingPower / Math.max(1, totalPower), 0.25, 0.82);
  const weaponScale = weapon.clashKnockbackScale || 1;
  const postureScale = unit.posture < unit.maxPosture * 0.4 ? 1.12 : 1;
  return (POSTURE_RULES.weaponClashKnockback || 2.2) * weaponScale * postureScale * (0.78 + pressure);
}

function getClashPower(unit, weapon) {
  return weapon.postureDamage + unit.stats.str * 1.8 + unit.stats.def * 0.9 + unit.mastery * 1.4;
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
