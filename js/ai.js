// ai.js
// 1:1 전용 자동 이동 판단을 담당합니다.
// 수정 원칙: AI가 이상하면 이 파일의 decideMovement를 직접 수정합니다.

import { PERSONALITIES, POSTURE_RULES, WEAPONS } from './data.js';
import { angleDiff, angleTo, clamp, distance } from './utils.js';

export function decideMovement(self, enemy, state = null) {
  const weapon = WEAPONS[self.weaponId];
  const basePersonality = PERSONALITIES[self.personalityId];
  const urgency = getBattleUrgency(state);
  const personality = applyBattleUrgency(basePersonality, urgency);
  const dist = distance(self, enemy);
  const desired = getDesiredRange(self, enemy, weapon, personality);
  const toEnemy = angleTo(self, enemy);
  const fromEnemy = toEnemy + Math.PI;
  const relation = getPositionRelation(self, enemy);

  if (self.attackState !== 'idle') {
    return { ax: 0, ay: 0, faceAngle: toEnemy, label: '공격 동작' };
  }

  if (weapon.id === 'dagger' && enemy.weaponId !== 'western') {
    const flankPower = clamp((weapon.flankBias || 0.5) * 0.62 + personality.flankPreference * 0.58, 0.5, 1.55);
    const immediateSideCommit = daggerSideCommitMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower, getDaggerOpportunity(enemy), true);
    if (immediateSideCommit) return immediateSideCommit;
  }

  if (enemy.staggerTimer > 0) {
    return exploitStaggerMovement(self, enemy, desired, toEnemy, dist, relation, weapon, personality);
  }

  const lowHpRetreat = self.hp / self.maxHp < personality.retreatHpRatio;
  const retreatLimited = shouldLimitRetreat(self, state);
  const retreatStalled = (self.retreatFrames || 0) > 16 && dist < desired + 14;
  const alreadyAtFightRange = dist >= desired - 8;
  const spearMirrorHold = weapon.id === 'spear' && enemy.weaponId === 'spear' && dist >= weapon.minRange + 16;
  if (lowHpRetreat && personality.caution > 0.45) {
    if (self.weaponId === 'dagger') {
      return daggerLowHpEvasion(self, enemy, desired, toEnemy, fromEnemy, dist, relation, personality);
    }
    if (retreatLimited || retreatStalled || alreadyAtFightRange || spearMirrorHold) {
      return resetAngleMovement(self, enemy, desired, toEnemy, dist, personality, '방어형 견제 재정렬');
    }
    return retreatMovement(self, enemy, desired + 10, toEnemy, fromEnemy, personality, '체력 관리 짧은 후퇴');
  }

  const threat = getIncomingThreat(self, enemy, relation);
  if (threat) {
    if (self.weaponId === 'dagger') {
      const shortStep = daggerThreatShortStep(self, enemy, toEnemy, fromEnemy, dist, relation);
      if (shortStep) return shortStep;
    }
    if (self.weaponId === 'dagger' && enemy.weaponId === 'eastern') {
      return daggerVsEasternThreatMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, threat, personality);
    }
    return threatMovement(self, enemy, toEnemy, fromEnemy, threat, personality);
  }

  if (weapon.id === 'dagger' || personality.id === 'assassin') {
    return flankMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality);
  }

  if (weapon.id === 'spear') {
    return spearMovement(self, enemy, desired, toEnemy, fromEnemy, dist, weapon, personality, state);
  }

  if (weapon.id === 'eastern') {
    return easternMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality);
  }

  if (weapon.id === 'western') {
    return westernMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality);
  }

  return standardMovement(self, enemy, desired, toEnemy, fromEnemy, dist, personality);
}


function getBattleUrgency(state) {
  if (!state) return 0;
  if (state.frame > 3000) return 0.42;
  if (state.frame > 2100) return 0.26;
  if (state.frame > 1500) return 0.14;
  return 0;
}

function applyBattleUrgency(personality, urgency) {
  if (!urgency) return personality;
  return {
    ...personality,
    pressure: clamp((personality.pressure || 0.5) + urgency, 0, 1),
    caution: clamp((personality.caution || 0.5) - urgency * 0.38, 0.12, 1),
    rangeScale: clamp((personality.rangeScale || 1) * (1 - urgency * 0.14), 0.82, 1.16),
    retreatHpRatio: clamp((personality.retreatHpRatio || 0.3) - urgency * 0.22, 0.12, 0.48)
  };
}

function spearMovement(self, enemy, desired, toEnemy, fromEnemy, dist, weapon, personality, state) {
  const pressure = personality.pressure;
  const retreatLimited = shouldLimitRetreat(self, state);
  const mirrorSpear = enemy.weaponId === 'spear';
  const defensiveMirror = mirrorSpear && self.personalityId === 'defensive' && enemy.personalityId === 'defensive';

  if (dist < weapon.minRange + 14) {
    if (retreatLimited || (self.retreatFrames || 0) > 10 || dist < weapon.minRange + 2) {
      return resetAngleMovement(self, enemy, desired, toEnemy, dist, personality, '창 측면 재정렬');
    }
    return blendAngles(sideAngle(toEnemy, self.orbitDir), fromEnemy, 0.18, 0.84, toEnemy, '창 짧은 거리 확보');
  }

  if (mirrorSpear) {
    const fightBand = weapon.idealRange - (defensiveMirror ? 12 : 8);
    if (dist > fightBand) {
      return blendAngles(toEnemy, sideAngle(toEnemy, self.orbitDir), 0.16, defensiveMirror ? 0.92 : 0.84 + pressure * 0.14, toEnemy, '창 미러 교전 압축');
    }
    if (dist <= weapon.range + 8) {
      const orbit = sideAngle(toEnemy, self.orbitDir);
      return blendAngles(orbit, toEnemy, 0.38 + pressure * 0.22, 0.76 + pressure * 0.14, toEnemy, '창 미러 찌르기 각도');
    }
  }

  if (dist > desired + 10) {
    const entryAngle = angleToRingPoint(self, enemy, desired, self.orbitDir * weapon.approachOffset);
    return vectorFromAngle(entryAngle, 0.94 + pressure * 0.24, toEnemy, '창 찌르기 거리 진입');
  }

  const orbit = sideAngle(toEnemy, self.orbitDir);
  return blendAngles(orbit, toEnemy, 0.24 + pressure * 0.26, 0.76 + pressure * 0.2, toEnemy, '창 간격 견제');
}

function westernMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality) {
  if (dist > desired + 13) {
    const entryOffset = self.orbitDir * (weapon.approachOffset + personality.flankPreference * 0.12);
    const targetAngle = angleToRingPoint(self, enemy, desired, entryOffset);
    return vectorFromAngle(targetAngle, 0.82 + personality.pressure * 0.22, toEnemy, '서양검 대각 진입');
  }

  if (dist < desired - 18) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.28 + personality.caution * 0.1, 0.78, toEnemy, '서양검 베기 거리 재정렬');
  }

  const orbit = sideAngle(toEnemy, self.orbitDir);
  const pressureAngle = relation.isSide || relation.isBack ? toEnemy : angleToRingPoint(self, enemy, desired, self.orbitDir * 0.65);
  return blendAngles(orbit, pressureAngle, 0.26 + personality.pressure * 0.26, 0.76 + personality.orbit * 0.14, toEnemy, '서양검 넓은 베기 각도');
}

function easternMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality) {
  const feintScale = (weapon.feintStrength || 0.4) * (personality.feintScale || 1);
  if (enemy.weaponId === 'spear' && dist > Math.max(28, WEAPONS.spear.minRange - 20)) {
    const insideAngle = angleToRingPoint(self, enemy, Math.max(30, desired), self.orbitDir * (1.18 + feintScale * 0.18));
    return vectorFromAngle(insideAngle, 1.02 + personality.pressure * 0.08, toEnemy, '동양검 창 안쪽 페이크 진입');
  }

  if (dist > desired + 10) {
    const targetAngle = angleToRingPoint(self, enemy, desired, self.orbitDir * (weapon.approachOffset + personality.flankPreference * 0.12 + feintScale * 0.22));
    return vectorFromAngle(targetAngle, 0.96 + personality.pressure * 0.16, toEnemy, '동양검 빠른 페이크 사선 진입');
  }

  if (dist < desired - 14) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.48 + feintScale * 0.08, 0.78, toEnemy, '동양검 살짝 밀고 이탈');
  }

  const orbit = sideAngle(toEnemy, self.orbitDir);
  const strikeAngle = relation.isFront
    ? angleToRingPoint(self, enemy, desired, self.orbitDir * (1.02 + feintScale * 0.22))
    : toEnemy;
  return blendAngles(orbit, strikeAngle, 0.38 + personality.pressure * 0.18 + feintScale * 0.08, 0.94, toEnemy, '동양검 페이크 측면 압박');
}

function exploitStaggerMovement(self, enemy, desired, toEnemy, dist, relation, weapon, personality) {
  if (weapon.id === 'dagger' || personality.id === 'assassin') {
    const flankRadius = Math.max(20, desired + 2);
    const flankAngle = angleToRingPointByFacing(self, enemy, flankRadius, self.orbitDir * Math.PI * 0.72);
    return vectorFromAngle(flankAngle, 1.58, toEnemy, '흐트러짐 측후면 순간 침투');
  }

  if (dist > desired + 8) {
    return vectorFromAngle(toEnemy, 0.96, toEnemy, '흐트러짐 추격');
  }

  return vectorFromAngle(sideAngle(toEnemy, self.orbitDir), 0.36, toEnemy, '흐트러짐 압박');
}


function daggerLowHpEvasion(self, enemy, desired, toEnemy, fromEnemy, dist, relation, personality) {
  const side = self.orbitDir || 1;
  if (relation.isFront || dist < desired + 4) {
    const wideSide = angleToRingPointByFacing(self, enemy, Math.max(48, desired + 18), side * Math.PI / 2);
    return blendAngles(wideSide, fromEnemy, 0.18, 1.46 + personality.orbit * 0.12, toEnemy, '단검 저체력 측면 회피');
  }
  const flankAngle = angleToRingPointByFacing(self, enemy, Math.max(34, desired + 6), side * Math.PI * 0.72);
  return vectorFromAngle(flankAngle, 1.26, toEnemy, '단검 저체력 측후면 재정렬');
}

function flankMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality) {
  const flankPower = clamp((weapon.flankBias || 0.5) * 0.62 + personality.flankPreference * 0.58, 0.5, 1.55);
  const sideRadius = Math.max(26, desired + (relation.isFront ? 26 : 12));
  const flankRadius = Math.max(24, desired + 3);
  let opportunity = getDaggerOpportunity(enemy);
  if (weapon.id === 'dagger' && enemy.weaponId === 'spear' && !relation.isFront && dist < desired + 94) {
    opportunity = relation.isBack || enemy.attackState === 'recovery' || enemy.postureRecoveryDelay > 0 ? 'hard' : (opportunity || 'soft');
  }
  const burstReady = (self.daggerBurstCooldown || 0) <= 0;

  if (weapon.id === 'dagger') {
    const mirrorOpportunity = enemy.weaponId === 'dagger'
      ? getDaggerMirrorOpportunity(self, enemy, dist)
      : opportunity;

    const sideCommit = daggerSideCommitMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower, mirrorOpportunity);
    if (sideCommit) return sideCommit;

    const maneuver = daggerFeintMovement(self, enemy, desired, toEnemy, dist, relation, mirrorOpportunity, burstReady, flankPower);
    if (maneuver) return maneuver;
    if (enemy.weaponId === 'dagger') {
      return daggerMirrorMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower);
    }
  }

  if (enemy.weaponId === 'spear' && dist > Math.max(22, WEAPONS.spear.minRange - 34)) {
    const targetRadius = opportunity ? 24 : 30;
    const facingOffset = opportunity ? self.orbitDir * Math.PI * 0.72 : self.orbitDir * Math.PI / 2;
    const antiSpearAngle = angleToRingPointByFacing(self, enemy, targetRadius, facingOffset);
    return vectorFromAngle(antiSpearAngle, opportunity ? 1.72 : 1.34, toEnemy, opportunity ? '창 빈틈 측후면 고속 침투' : '창 측면 빠른 진입');
  }

  if (relation.isFront) {
    const routeAngle = angleToRingPointByFacing(self, enemy, sideRadius, self.orbitDir * Math.PI / 2);
    return vectorFromAngle(routeAngle, 1.26 + flankPower * 0.12, toEnemy, '측면 돌파 준비');
  }

  if (!relation.isSide && (dist > desired - 2 || relation.isFront)) {
    const routeAngle = angleToRingPointByFacing(self, enemy, flankRadius, self.orbitDir * Math.PI * 0.72);
    return vectorFromAngle(routeAngle, 1.34 + flankPower * 0.14, toEnemy, '측후면 고속 진입');
  }

  if (dist > desired + 4) {
    const flankAngle = angleToRingPointByFacing(self, enemy, flankRadius, self.orbitDir * Math.PI * 0.7);
    return vectorFromAngle(flankAngle, 1.24, toEnemy, '측후면 거리 압축');
  }

  if (dist < Math.max(20, desired - 9)) {
    if (weapon.id === 'dagger' && relation.isSide && dist > self.radius + enemy.radius + 4) {
      enemy.flankPressureTimer = Math.max(enemy.flankPressureTimer || 0, POSTURE_RULES.daggerCutTurnLagFrames || 22);
      return blendAngles(toEnemy, sideAngle(toEnemy, self.orbitDir), 0.06, 1.42 + flankPower * 0.12, toEnemy, '단검 측면 근접 찌르기');
    }
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.58, 0.86, toEnemy, '짧은 이탈');
  }

  const holdAngle = angleToRingPointByFacing(self, enemy, flankRadius, self.orbitDir * Math.PI * 0.68);
  const orbit = sideAngle(toEnemy, self.orbitDir);
  return blendAngles(orbit, holdAngle, 0.46, 1.08, toEnemy, '측후면 유지');
}

function daggerFeintMovement(self, enemy, desired, toEnemy, dist, relation, opportunity, burstReady, flankPower) {
  const personality = PERSONALITIES[self.personalityId];
  const weapon = WEAPONS[self.weaponId];
  const feintBoost = clamp((weapon.feintStrength || 1) * (personality.feintScale || 1), 0.9, 2.45);
  const sideRadius = Math.max(enemy.weaponId === 'western' ? 74 : 58, desired + 50 + feintBoost * 13);
  const burstRadius = enemy.weaponId === 'spear' ? Math.max(18, desired - 12) : enemy.weaponId === 'western' ? Math.max(19, desired - 4) : Math.max(17, desired - 7);

  if ((self.daggerResetTimer || 0) > 0) {
    self.daggerManeuverPhase = '';
    const resetSide = self.daggerFeintSide || self.orbitDir || 1;
    const resetAngle = enemy.facing + resetSide * Math.PI / 2;
    return blendAngles(resetAngle, fromEnemyAngle(self, enemy), 0.26, 1.34 + flankPower * 0.14, toEnemy, '단검 측면 재정렬');
  }

  const hasManeuver = self.daggerManeuverPhase && self.daggerManeuverTimer > 0;
  const frontOrBadAngle = relation.isFront || (!relation.isBack && dist > desired - 10);
  const hardWindow = opportunity === 'hard' && !relation.isFront && dist < desired + 78;
  const openWindow = !!opportunity && !relation.isFront && dist < desired + 70;
  const shouldStart = !hasManeuver && burstReady && (hardWindow || openWindow || frontOrBadAngle) && dist < desired + 92;

  if (shouldStart) {
    self.daggerFeintSide = self.orbitDir || 1;
    if (hardWindow && (relation.isSide || enemy.staggerTimer > 0 || enemy.attackState === 'recovery')) {
      self.daggerManeuverPhase = 'burst';
      self.daggerManeuverTimer = 8;
    } else {
      self.daggerManeuverPhase = 'feint';
      self.daggerManeuverTimer = Math.round((POSTURE_RULES.daggerFeintFrames || 20) * (personality.id === 'defensive' ? 0.95 : 0.84));
    }
  }

  if (!self.daggerManeuverPhase) return null;

  if (self.daggerManeuverPhase === 'feint' && self.daggerManeuverTimer <= 0) {
    self.daggerManeuverPhase = 'cut';
    self.daggerManeuverTimer = POSTURE_RULES.daggerCutFrames || 11;
  }

  if (self.daggerManeuverPhase === 'cut' && self.daggerManeuverTimer <= 0) {
    self.daggerManeuverPhase = 'burst';
    self.daggerManeuverTimer = 8;
  }

  if (self.daggerManeuverPhase === 'burst' && self.daggerManeuverTimer <= 0) {
    self.daggerManeuverPhase = '';
    return null;
  }

  if (self.daggerManeuverPhase === 'feint') {
    const feintSide = self.daggerFeintSide || 1;
    const lateralAngle = enemy.facing + feintSide * Math.PI / 2;
    const holdRadiusAngle = angleToRingPointByFacing(self, enemy, sideRadius, feintSide * Math.PI / 2);
    const feintPower = 2.72 + flankPower * 0.2 + feintBoost * 0.18;
    return blendAngles(lateralAngle, holdRadiusAngle, 0.42, feintPower, toEnemy, feintSide > 0 ? '단검 우측 미끼 페이크' : '단검 좌측 미끼 페이크');
  }

  if (self.daggerManeuverPhase === 'cut') {
    const cutSide = -(self.daggerFeintSide || 1);
    const cutLateral = enemy.facing + cutSide * Math.PI / 2;
    const cutTarget = angleToRingPointByFacing(self, enemy, sideRadius * 0.7, cutSide * (Math.PI * 0.82));
    enemy.flankPressureTimer = Math.max(enemy.flankPressureTimer || 0, POSTURE_RULES.daggerCutTurnLagFrames || 22);
    return blendAngles(cutLateral, cutTarget, 0.9, 3.42 + flankPower * 0.24 + feintBoost * 0.18, toEnemy, cutSide > 0 ? '단검 우측 급반전' : '단검 좌측 급반전');
  }

  if (self.daggerManeuverPhase === 'burst') {
    const burstSide = -(self.daggerFeintSide || self.orbitDir || 1);
    const offsetBase = burstSide * Math.PI * (opportunity === 'hard' ? 0.68 : 0.76);
    const burstAngle = angleToRingPointByFacing(self, enemy, burstRadius, offsetBase);
    enemy.flankPressureTimer = Math.max(enemy.flankPressureTimer || 0, POSTURE_RULES.daggerCutTurnLagFrames || 22);
    return vectorFromAngle(burstAngle, 3.52 + flankPower * 0.34 + feintBoost * 0.18, toEnemy, opportunity ? '단검 빈틈 측후면 고속대시' : '단검 페이크 후 측후면 고속대시');
  }

  return null;
}


function daggerThreatShortStep(self, enemy, toEnemy, fromEnemy, dist, relation) {
  if (self.daggerThreatStepCooldown > 0) return null;
  if (enemy.weaponId !== 'spear') return null;
  if (enemy.attackState !== 'windup') return null;
  if (!relation.isFront) return null;
  if (self.cooldownTimer > 2) return null;

  const enemyWeapon = WEAPONS[enemy.weaponId];
  const enemyToSelf = angleTo(enemy, self);
  const angleGap = Math.abs(angleDiff(enemy.facing, enemyToSelf));
  if (angleGap > enemyWeapon.arc + 0.14) return null;
  if (dist > enemyWeapon.range + self.radius + 6) return null;

  self.daggerThreatStepCooldown = POSTURE_RULES.daggerThreatStepCooldownFrames || 48;
  const lateral = sideAngle(toEnemy, self.orbitDir || 1);
  return blendAngles(lateral, fromEnemy, 0.38, 0.72, toEnemy, '단검 짧은 회피');
}


function daggerSideCommitMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower, opportunity, forceCheck = false) {
  const westernTarget = enemy.weaponId === 'western';
  if (westernTarget && forceCheck) return null;

  const sideLimit = westernTarget ? 0.76 : (forceCheck ? 0.96 : 1.08);
  const wideSide = relation.sideGap < sideLimit && relation.frontGap > 0.42;
  const locked = (self.daggerSideCommitLock || 0) > 0;
  const allowSpear = enemy.weaponId === 'spear' ? locked : true;
  if ((!wideSide && !locked) || !allowSpear) return null;

  const bodyOverlap = dist < self.radius + enemy.radius - 1;
  if (bodyOverlap) {
    self.daggerSideCommitLock = Math.max(self.daggerSideCommitLock || 0, 8);
    return blendAngles(sideAngle(toEnemy, self.orbitDir), fromEnemy, 0.18, 0.86, toEnemy, '단검 몸겹침 짧은 측면 이탈');
  }

  const attackLane = WEAPONS.dagger.range + enemy.radius + 20;
  const commitLane = attackLane + (westernTarget ? 8 : (forceCheck ? 16 : 20));
  if (dist > commitLane) return null;

  self.daggerSideCommitLock = Math.max(self.daggerSideCommitLock || 0, POSTURE_RULES.daggerSideCommitLockFrames || 18);
  self.daggerManeuverPhase = '';
  self.daggerManeuverTimer = 0;
  enemy.flankPressureTimer = Math.max(enemy.flankPressureTimer || 0, POSTURE_RULES.daggerCutTurnLagFrames || 22);

  const pressureSide = sideAngle(toEnemy, self.orbitDir);
  const readySoon = westernTarget ? (self.cooldownTimer <= 4 || !!opportunity || locked) : (self.cooldownTimer <= 12 || opportunity || enemy.attackState !== 'idle' || enemy.cooldownTimer > 8 || locked);

  if (dist > attackLane) {
    const laneAngle = angleToRingPointByFacing(self, enemy, Math.max(20, WEAPONS.dagger.range + enemy.radius - 3), self.orbitDir * Math.PI / 2);
    const lanePower = enemy.weaponId === 'western' ? 0.92 + flankPower * 0.04 : 1.18 + flankPower * 0.1;
    return blendAngles(laneAngle, toEnemy, 0.18, lanePower, toEnemy, '단검 측면 공격고정 진입');
  }

  if (!readySoon) {
    if (westernTarget) return null;
    const holdPower = 0.96;
    return blendAngles(toEnemy, pressureSide, 0.34, holdPower, toEnemy, '단검 측면 공격고정 대기');
  }

  const commitPower = westernTarget ? 0.82 + flankPower * 0.035 : 1.28 + flankPower * 0.12;
  const sideWeight = westernTarget ? 0.22 : 0.04;
  return blendAngles(toEnemy, pressureSide, sideWeight, commitPower, toEnemy, '단검 측면 찌르기');
}

function daggerVsEasternThreatMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, threat, personality) {
  const side = self.orbitDir || 1;
  const lateral = sideAngle(toEnemy, side);
  const enemyBusy = enemy.attackState === 'windup' || enemy.attackState === 'active' || enemy.comboTimer > 0;
  const closeEnough = dist < desired + 18;

  if (relation.sideGap < 1.08 && closeEnough && self.cooldownTimer <= 14) {
    self.daggerSideCommitLock = Math.max(self.daggerSideCommitLock || 0, POSTURE_RULES.daggerSideCommitLockFrames || 18);
    enemy.flankPressureTimer = Math.max(enemy.flankPressureTimer || 0, POSTURE_RULES.daggerCutTurnLagFrames || 22);
    const power = self.cooldownTimer <= 0 ? 1.24 + personality.pressure * 0.1 : 0.84 + personality.pressure * 0.06;
    return blendAngles(toEnemy, lateral, self.cooldownTimer <= 0 ? 0.08 : 0.32, power, toEnemy, self.cooldownTimer <= 0 ? '동양검 연격 사이 측면 찌르기' : '동양검 연격 사이 공격대기');
  }

  if (enemyBusy) {
    const escapeAngle = angleToRingPointByFacing(self, enemy, Math.max(42, desired + 8), side * Math.PI / 2);
    return blendAngles(escapeAngle, lateral, 0.22, 1.44 + personality.orbit * 0.14, toEnemy, '동양검 연격 측면 이탈');
  }

  return threatMovement(self, enemy, toEnemy, fromEnemy, threat, personality);
}


function getDaggerMirrorOpportunity(self, enemy, dist) {
  if (enemy.staggerTimer > 0 || enemy.attackState === 'recovery') return 'hard';
  if (enemy.attackState === 'windup' || enemy.attackState === 'active') return 'soft';
  if (enemy.cooldownTimer > 8 || self.cooldownTimer <= 6) return 'soft';
  if (dist < WEAPONS.dagger.range + enemy.radius + 18) return 'mirror';
  return '';
}

function daggerMirrorMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower) {
  const close = dist < desired + 12;
  const tooClose = dist < Math.max(18, desired - 8);
  const mirrorDir = self.side === 'player' ? 1 : -1;
  if (self.orbitDir === enemy.orbitDir && (self.orbitFlipTimer || 0) > 18) {
    self.orbitDir = mirrorDir;
    self.orbitFlipTimer = 26;
  }
  const selfSide = self.orbitDir === enemy.orbitDir ? mirrorDir : self.orbitDir;

  if (dist > desired + 16) {
    const entryAngle = angleToRingPoint(self, enemy, desired + 4, selfSide * 0.96);
    return vectorFromAngle(entryAngle, 1.26, toEnemy, '단검 미러 사선 진입');
  }

  if (tooClose) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, -selfSide), 0.72, 1.28, toEnemy, '단검 미러 교차 이탈');
  }

  if (close && (self.cooldownTimer <= 5 || enemy.attackState !== 'idle') && !relation.isFront) {
    return blendAngles(toEnemy, sideAngle(toEnemy, selfSide), 0.16, 0.88 + flankPower * 0.05, toEnemy, '단검 미러 짧은 교전');
  }

  const sideEntry = angleToRingPointByFacing(self, enemy, desired + 14, selfSide * Math.PI / 2);
  return vectorFromAngle(sideEntry, 1.34, toEnemy, '단검 미러 교차 페이크 재진입');
}

function getDaggerOpportunity(enemy) {
  if (enemy.staggerTimer > 0) return 'hard';
  if (enemy.attackState === 'recovery') return 'hard';
  if (enemy.attackState === 'windup' || enemy.attackState === 'active') return 'soft';
  if (enemy.postureRecoveryDelay > 0 && enemy.posture < enemy.maxPosture * 0.72) return 'soft';
  if (enemy.cooldownTimer > 12) return 'soft';
  return '';
}

function standardMovement(self, enemy, desired, toEnemy, fromEnemy, dist, personality) {
  if (dist > desired + 12) return vectorFromAngle(toEnemy, 0.82 + personality.pressure * 0.16, toEnemy, '접근');
  if (dist < desired - 14) return vectorFromAngle(fromEnemy, 0.9, toEnemy, '거리 확보');
  return vectorFromAngle(sideAngle(toEnemy, self.orbitDir), 0.58 + personality.orbit * 0.18, toEnemy, '간격 유지');
}

function shouldLimitRetreat(self, state) {
  const limit = POSTURE_RULES.retreatMaxFrames || 56;
  if (self.retreatLockout > 0) return true;
  if ((self.retreatFrames || 0) > limit) return true;
  if (!state?.arena) return false;

  const margin = 54;
  return (
    self.x < state.arena.left + margin ||
    self.x > state.arena.right - margin ||
    self.y < state.arena.top + margin ||
    self.y > state.arena.bottom - margin
  );
}

function resetAngleMovement(self, enemy, desired, toEnemy, dist, personality, label) {
  const side = sideAngle(toEnemy, self.orbitDir);
  const forwardWeight = dist < desired ? 0.24 + (personality.pressure || 0.5) * 0.1 : 0.08;
  const power = label.includes('창') ? 1.02 : 0.98;
  return blendAngles(side, toEnemy, forwardWeight, power, toEnemy, label);
}

function retreatMovement(self, enemy, desired, toEnemy, fromEnemy, personality, label) {
  if (shouldLimitRetreat(self, null)) {
    return resetAngleMovement(self, enemy, desired, toEnemy, distance(self, enemy), personality, '후퇴 제한 측면 전환');
  }
  const route = blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.56 + personality.orbit * 0.18, 0.88, toEnemy, label);
  if (distance(self, enemy) > desired) route.label = '체력 관리 거리 유지';
  return route;
}

function threatMovement(self, enemy, toEnemy, fromEnemy, threat, personality) {
  const side = sideAngle(toEnemy, self.orbitDir);
  if (threat === 'inside') return blendAngles(side, fromEnemy, 0.2, 1, toEnemy, '안쪽 측면 전환');
  if (threat === 'frontSwing') return blendAngles(side, fromEnemy, personality.caution * 0.34, 0.92, toEnemy, '공격 궤도 회피');
  return blendAngles(side, fromEnemy, 0.22, 0.84, toEnemy, '위협 회피');
}

function getDesiredRange(self, enemy, weapon, personality) {
  const enemyRadius = enemy?.radius || 17;
  const outsideBuffer = weapon.neutralBuffer ?? 10;
  const personalityRangeShift = ((personality.rangeScale || 1) - 1) * 26;
  let desired = weapon.range + enemyRadius + outsideBuffer + personalityRangeShift;

  if (personality.id === 'aggressive') desired -= 6;
  if (personality.id === 'defensive') desired += 6;
  if (personality.id === 'assassin' && weapon.id !== 'spear') desired -= 4;

  if (enemy.weaponId === 'spear' && (weapon.id === 'dagger' || weapon.id === 'eastern')) {
    desired = Math.min(desired, WEAPONS.spear.minRange + enemyRadius + 4);
  }

  if (weapon.id === 'spear' && enemy.weaponId === 'dagger') {
    desired += 8;
  }

  const minDesired = weapon.minRange + enemyRadius + 8;
  const maxDesired = weapon.range + enemyRadius + outsideBuffer + 24;
  return clamp(desired, minDesired, maxDesired);
}

function getIncomingThreat(self, enemy, relation) {
  if (enemy.staggerTimer > 0) return '';

  const enemyWeapon = WEAPONS[enemy.weaponId];
  const dist = distance(self, enemy);
  const enemyToSelf = angleTo(enemy, self);
  const angleGap = Math.abs(angleDiff(enemy.facing, enemyToSelf));

  if (self.weaponId === 'spear' && dist < WEAPONS.spear.minRange + 10) return 'inside';
  if (enemy.attackState !== 'windup' && enemy.attackState !== 'active') return '';
  if (dist > enemyWeapon.range + self.radius + 18) return '';
  if (dist < enemyWeapon.minRange) return '';
  if (angleGap > enemyWeapon.arc + 0.36) return '';
  return relation.isFront ? 'frontSwing' : 'swing';
}

function getPositionRelation(self, enemy) {
  const enemyToSelf = angleTo(enemy, self);
  const frontGap = Math.abs(angleDiff(enemy.facing, enemyToSelf));
  const backGap = Math.abs(angleDiff(enemy.facing + Math.PI, enemyToSelf));
  const leftGap = Math.abs(angleDiff(enemy.facing + Math.PI / 2, enemyToSelf));
  const rightGap = Math.abs(angleDiff(enemy.facing - Math.PI / 2, enemyToSelf));
  const sideGap = Math.min(leftGap, rightGap);

  return {
    frontGap,
    backGap,
    sideGap,
    isFront: frontGap < 1.08,
    isSide: sideGap < 0.78,
    isBack: backGap < 0.92
  };
}

function angleToRingPoint(self, enemy, radius, offset) {
  const enemyToSelf = angleTo(enemy, self);
  const targetAngle = enemyToSelf + offset;
  const targetX = enemy.x + Math.cos(targetAngle) * radius;
  const targetY = enemy.y + Math.sin(targetAngle) * radius;
  return Math.atan2(targetY - self.y, targetX - self.x);
}

function angleToRingPointByFacing(self, enemy, radius, facingOffset) {
  const targetAngle = enemy.facing + facingOffset;
  const targetX = enemy.x + Math.cos(targetAngle) * radius;
  const targetY = enemy.y + Math.sin(targetAngle) * radius;
  return Math.atan2(targetY - self.y, targetX - self.x);
}

function fromEnemyAngle(self, enemy) {
  return angleTo(enemy, self);
}

function sideAngle(baseAngle, orbitDir) {
  return baseAngle + Math.PI / 2 * orbitDir;
}

function blendAngles(primaryAngle, secondaryAngle, secondaryWeight, power, faceAngle, label) {
  const ax = Math.cos(primaryAngle) + Math.cos(secondaryAngle) * secondaryWeight;
  const ay = Math.sin(primaryAngle) + Math.sin(secondaryAngle) * secondaryWeight;
  const length = Math.hypot(ax, ay) || 1;

  return {
    ax: (ax / length) * power,
    ay: (ay / length) * power,
    faceAngle,
    label
  };
}

function vectorFromAngle(angle, power, faceAngle, label) {
  return {
    ax: Math.cos(angle) * power,
    ay: Math.sin(angle) * power,
    faceAngle,
    label
  };
}
