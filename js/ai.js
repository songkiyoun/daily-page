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

  if (enemy.staggerTimer > 0) {
    return exploitStaggerMovement(self, enemy, desired, toEnemy, dist, relation, weapon, personality);
  }

  const lowHpRetreat = self.hp / self.maxHp < personality.retreatHpRatio;
  const retreatLimited = shouldLimitRetreat(self, state);
  const retreatStalled = (self.retreatFrames || 0) > 16 && dist < desired + 14;
  const alreadyAtFightRange = dist >= desired - 8;
  const spearMirrorHold = weapon.id === 'spear' && enemy.weaponId === 'spear' && dist >= weapon.minRange + 16;
  if (lowHpRetreat && personality.caution > 0.45) {
    if (retreatLimited || retreatStalled || alreadyAtFightRange || spearMirrorHold) {
      return resetAngleMovement(self, enemy, desired, toEnemy, dist, personality, '방어형 견제 재정렬');
    }
    return retreatMovement(self, enemy, desired + 10, toEnemy, fromEnemy, personality, '체력 관리 짧은 후퇴');
  }

  const threat = getIncomingThreat(self, enemy, relation);
  if (threat) {
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
    return vectorFromAngle(entryAngle, 0.82 + pressure * 0.2, toEnemy, '창 찌르기 거리 진입');
  }

  const orbit = sideAngle(toEnemy, self.orbitDir);
  return blendAngles(orbit, toEnemy, 0.18 + pressure * 0.22, 0.68 + pressure * 0.18, toEnemy, '창 간격 견제');
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
  if (enemy.weaponId === 'spear' && dist > Math.max(28, WEAPONS.spear.minRange - 20)) {
    const insideAngle = angleToRingPoint(self, enemy, Math.max(30, desired), self.orbitDir * 1.18);
    return vectorFromAngle(insideAngle, 1, toEnemy, '동양검 창 안쪽 진입');
  }

  if (dist > desired + 10) {
    const targetAngle = angleToRingPoint(self, enemy, desired, self.orbitDir * (weapon.approachOffset + personality.flankPreference * 0.1));
    return vectorFromAngle(targetAngle, 0.92 + personality.pressure * 0.14, toEnemy, '동양검 빠른 사선 진입');
  }

  if (dist < desired - 14) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.42, 0.74, toEnemy, '동양검 이탈 후 재진입');
  }

  const orbit = sideAngle(toEnemy, self.orbitDir);
  const strikeAngle = relation.isFront ? angleToRingPoint(self, enemy, desired, self.orbitDir * 0.95) : toEnemy;
  return blendAngles(orbit, strikeAngle, 0.34 + personality.pressure * 0.18, 0.9, toEnemy, '동양검 측면 압박');
}

function exploitStaggerMovement(self, enemy, desired, toEnemy, dist, relation, weapon, personality) {
  if (weapon.id === 'dagger' || personality.id === 'assassin') {
    const backRadius = Math.max(18, desired - 2);
    const backAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.28);
    return vectorFromAngle(backAngle, 1.42, toEnemy, '흐트러짐 측후방 순간 침투');
  }

  if (dist > desired + 8) {
    return vectorFromAngle(toEnemy, 0.96, toEnemy, '흐트러짐 추격');
  }

  return vectorFromAngle(sideAngle(toEnemy, self.orbitDir), 0.36, toEnemy, '흐트러짐 압박');
}

function flankMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality) {
  const flankPower = clamp((weapon.flankBias || 0.5) * 0.62 + personality.flankPreference * 0.58, 0.5, 1.55);
  const sideRadius = Math.max(24, desired + (relation.isFront ? 24 : 10));
  const backRadius = Math.max(20, desired - 1);
  const opportunity = getDaggerOpportunity(enemy);
  const burstReady = (self.daggerBurstCooldown || 0) <= 0;

  if (weapon.id === 'dagger' && enemy.weaponId === 'dagger') {
    return daggerMirrorMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower);
  }

  if (opportunity && burstReady) {
    const burstRadius = enemy.weaponId === 'spear' ? Math.max(22, desired - 4) : backRadius;
    const burstOffset = opportunity === 'hard' ? Math.PI + self.orbitDir * 0.22 : Math.PI * 0.72 * self.orbitDir;
    const burstAngle = angleToRingPointByFacing(self, enemy, burstRadius, burstOffset);
    return vectorFromAngle(burstAngle, 1.48 + flankPower * 0.1, toEnemy, '측후방 순간 돌파');
  }

  if (enemy.weaponId === 'spear' && dist > Math.max(22, WEAPONS.spear.minRange - 34)) {
    const targetRadius = opportunity ? 22 : 28;
    const facingOffset = opportunity ? Math.PI + self.orbitDir * 0.24 : self.orbitDir * Math.PI / 2;
    const antiSpearAngle = angleToRingPointByFacing(self, enemy, targetRadius, facingOffset);
    return vectorFromAngle(antiSpearAngle, opportunity ? 1.56 : 1.26, toEnemy, opportunity ? '창 빈틈 측후방 순간 침투' : '창 측면 빠른 진입');
  }

  if (relation.isFront) {
    const routeAngle = angleToRingPointByFacing(self, enemy, sideRadius, self.orbitDir * Math.PI / 2);
    return vectorFromAngle(routeAngle, 1.26 + flankPower * 0.12, toEnemy, '측면 돌파 준비');
  }

  if (!relation.isBack && (dist > desired - 2 || relation.isSide)) {
    const routeAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.28);
    return vectorFromAngle(routeAngle, 1.18 + flankPower * 0.1, toEnemy, '후방 각도 빠른 진입');
  }

  if (dist > desired + 4) {
    const backAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.18);
    return vectorFromAngle(backAngle, 1.12, toEnemy, '후방 거리 압축');
  }

  if (dist < Math.max(20, desired - 9)) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.58, 0.86, toEnemy, '짧은 이탈');
  }

  const holdAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.18);
  const orbit = sideAngle(toEnemy, self.orbitDir);
  return blendAngles(orbit, holdAngle, 0.56, 1.04, toEnemy, '측후방 유지');
}

function daggerMirrorMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, flankPower) {
  const close = dist < desired + 12;
  const tooClose = dist < Math.max(18, desired - 8);

  if (dist > desired + 12) {
    const entryAngle = angleToRingPoint(self, enemy, desired, self.orbitDir * 0.55);
    return vectorFromAngle(entryAngle, 1.12, toEnemy, '단검 미러 진입');
  }

  if (tooClose) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.34, 0.92, toEnemy, '단검 미러 짧은 이탈');
  }

  if (close && (self.cooldownTimer <= 8 || enemy.cooldownTimer <= 8 || enemy.attackState !== 'idle')) {
    return vectorFromAngle(toEnemy, 0.84 + flankPower * 0.04, toEnemy, '단검 미러 짧은 교전');
  }

  const sideEntry = angleToRingPointByFacing(self, enemy, desired + 4, self.orbitDir * Math.PI / 2);
  return vectorFromAngle(sideEntry, 1.04, toEnemy, '단검 미러 측면 재진입');
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
