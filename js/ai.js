// ai.js
// 1:1 전용 자동 이동 판단을 담당합니다.
// 수정 원칙: AI가 이상하면 이 파일의 decideMovement를 직접 수정합니다.

import { PERSONALITIES, WEAPONS } from './data.js';
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

  const lowHpRetreat = self.hp / self.maxHp < personality.retreatHpRatio;
  if (lowHpRetreat && personality.caution > 0.45) {
    return retreatMovement(self, enemy, desired + 28, toEnemy, fromEnemy, personality, '체력 관리 후퇴');
  }

  const threat = getIncomingThreat(self, enemy, relation);
  if (threat) {
    return threatMovement(self, enemy, toEnemy, fromEnemy, threat, personality);
  }

  if (weapon.id === 'dagger' || personality.id === 'assassin') {
    return flankMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality);
  }

  if (weapon.id === 'spear') {
    return spearMovement(self, enemy, desired, toEnemy, fromEnemy, dist, weapon, personality);
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

function spearMovement(self, enemy, desired, toEnemy, fromEnemy, dist, weapon, personality) {
  const pressure = personality.pressure;

  if (dist < weapon.minRange + 20) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.42 + personality.caution * 0.18, 1, toEnemy, '창 최소거리 확보');
  }

  if (dist > desired + 20) {
    const entryAngle = angleToRingPoint(self, enemy, desired, self.orbitDir * weapon.approachOffset);
    return vectorFromAngle(entryAngle, 0.78 + pressure * 0.22, toEnemy, '창 찌르기 거리 진입');
  }

  const orbit = sideAngle(toEnemy, self.orbitDir);
  return blendAngles(orbit, fromEnemy, 0.2 + personality.caution * 0.2, 0.68 + pressure * 0.16, toEnemy, '창 간격 유지');
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

function flankMovement(self, enemy, desired, toEnemy, fromEnemy, dist, relation, weapon, personality) {
  const flankPower = clamp((weapon.flankBias || 0.5) * 0.62 + personality.flankPreference * 0.58, 0.5, 1.35);
  const sideRadius = desired + (relation.isFront ? 18 : 8);
  const backRadius = Math.max(22, desired);

  if (enemy.weaponId === 'spear' && dist > Math.max(26, WEAPONS.spear.minRange - 24)) {
    const antiSpearAngle = angleToRingPoint(self, enemy, Math.max(28, desired), self.orbitDir * 1.35);
    return vectorFromAngle(antiSpearAngle, 1, toEnemy, '측후방 침투');
  }

  if (relation.isFront) {
    const routeAngle = angleToRingPointByFacing(self, enemy, sideRadius, self.orbitDir * Math.PI / 2);
    return vectorFromAngle(routeAngle, 0.92 + flankPower * 0.08, toEnemy, '정면 회피 측면 이동');
  }

  if (!relation.isBack && (dist > desired + 4 || relation.isSide)) {
    const routeAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.34);
    return vectorFromAngle(routeAngle, 0.9 + flankPower * 0.08, toEnemy, '후방 각도 진입');
  }

  if (dist > desired + 6) {
    const backAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.22);
    return vectorFromAngle(backAngle, 1, toEnemy, '후방 거리 압축');
  }

  if (dist < Math.max(20, desired - 10)) {
    return blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.58, 0.78, toEnemy, '짧은 이탈');
  }

  const holdAngle = angleToRingPointByFacing(self, enemy, backRadius, Math.PI + self.orbitDir * 0.18);
  const orbit = sideAngle(toEnemy, self.orbitDir);
  return blendAngles(orbit, holdAngle, 0.62, 0.92, toEnemy, '측후방 유지');
}

function standardMovement(self, enemy, desired, toEnemy, fromEnemy, dist, personality) {
  if (dist > desired + 12) return vectorFromAngle(toEnemy, 0.82 + personality.pressure * 0.16, toEnemy, '접근');
  if (dist < desired - 14) return vectorFromAngle(fromEnemy, 0.9, toEnemy, '거리 확보');
  return vectorFromAngle(sideAngle(toEnemy, self.orbitDir), 0.58 + personality.orbit * 0.18, toEnemy, '간격 유지');
}

function retreatMovement(self, enemy, desired, toEnemy, fromEnemy, personality, label) {
  const route = blendAngles(fromEnemy, sideAngle(toEnemy, self.orbitDir), 0.44 + personality.orbit * 0.2, 0.94, toEnemy, label);
  if (distance(self, enemy) > desired) route.label = '체력 관리 거리 유지';
  return route;
}

function threatMovement(self, enemy, toEnemy, fromEnemy, threat, personality) {
  const side = sideAngle(toEnemy, self.orbitDir);
  if (threat === 'inside') return blendAngles(fromEnemy, side, 0.48, 1, toEnemy, '안쪽 거리 이탈');
  if (threat === 'frontSwing') return blendAngles(side, fromEnemy, personality.caution * 0.34, 0.92, toEnemy, '공격 궤도 회피');
  return blendAngles(side, fromEnemy, 0.22, 0.84, toEnemy, '위협 회피');
}

function getDesiredRange(self, enemy, weapon, personality) {
  let desired = weapon.idealRange * (personality.rangeScale || 1);

  if (enemy.weaponId === 'spear' && (weapon.id === 'dagger' || weapon.id === 'eastern')) {
    desired = Math.max(24, WEAPONS.spear.minRange - 22);
  }

  if (weapon.id === 'spear' && enemy.weaponId === 'dagger') {
    desired += 10;
  }

  return clamp(desired, weapon.minRange + 12, weapon.range - 4);
}

function getIncomingThreat(self, enemy, relation) {
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
