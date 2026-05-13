// ai.js
// 1:1 전용 자동 이동 판단을 담당합니다.
// 수정 원칙: AI가 이상하면 이 파일의 decideMovement를 직접 수정합니다.

import { PERSONALITIES, WEAPONS } from './data.js';
import { angleDiff, angleTo, distance } from './utils.js';

export function decideMovement(self, enemy) {
  const weapon = WEAPONS[self.weaponId];
  const personality = PERSONALITIES[self.personalityId];
  const dist = distance(self, enemy);
  const desired = getDesiredRange(self, enemy);
  const toEnemy = angleTo(self, enemy);
  const fromEnemy = toEnemy + Math.PI;

  if (self.attackState !== 'idle') {
    return { ax: 0, ay: 0, faceAngle: toEnemy, label: '공격 동작' };
  }

  const threat = getIncomingThreat(self, enemy);
  if (threat) {
    const dodgeAngle = threat === 'inside'
      ? fromEnemy + self.orbitDir * 0.42
      : toEnemy + Math.PI / 2 * self.orbitDir;
    return vectorFromAngle(dodgeAngle, 1, toEnemy, threat === 'inside' ? '안쪽 거리 이탈' : '위협 회피');
  }

  if (personality.id === 'assassin' || weapon.id === 'dagger') {
    return daggerMovement(self, enemy, desired, toEnemy, dist);
  }

  if (weapon.id === 'spear') {
    return spearMovement(self, enemy, desired, toEnemy, fromEnemy, dist);
  }

  if (weapon.id === 'eastern') {
    return easternMovement(self, enemy, desired, toEnemy, fromEnemy, dist);
  }

  if (weapon.id === 'western') {
    return westernMovement(self, enemy, desired, toEnemy, fromEnemy, dist);
  }

  return standardMovement(self, enemy, desired, toEnemy, fromEnemy, dist);
}

function spearMovement(self, enemy, desired, toEnemy, fromEnemy, dist) {
  const weapon = WEAPONS[self.weaponId];

  if (dist < weapon.minRange + 18) {
    return blendAngles(fromEnemy, toEnemy + Math.PI / 2 * self.orbitDir, 0.32, 1, toEnemy, '창 최소거리 확보');
  }

  if (dist > desired + 18) {
    const targetAngle = angleToTacticalPoint(self, enemy, desired, self.orbitDir * weapon.approachOffset);
    return vectorFromAngle(targetAngle, 0.88, toEnemy, '창 사거리 진입');
  }

  const orbitAngle = toEnemy + Math.PI / 2 * self.orbitDir;
  return blendAngles(orbitAngle, fromEnemy, 0.18, 0.72, toEnemy, '창 간격 유지');
}

function westernMovement(self, enemy, desired, toEnemy, fromEnemy, dist) {
  const weapon = WEAPONS[self.weaponId];

  if (dist > desired + 12) {
    const targetAngle = angleToTacticalPoint(self, enemy, desired, self.orbitDir * weapon.approachOffset);
    return vectorFromAngle(targetAngle, 0.96, toEnemy, '대각 진입');
  }

  if (dist < desired - 18) {
    return blendAngles(fromEnemy, toEnemy + Math.PI / 2 * self.orbitDir, 0.22, 0.82, toEnemy, '베기 거리 재정렬');
  }

  const orbitAngle = toEnemy + Math.PI / 2 * self.orbitDir;
  const pressureAngle = toEnemy;
  return blendAngles(orbitAngle, pressureAngle, 0.28, 0.78, toEnemy, '넓은 베기 각도 잡기');
}

function easternMovement(self, enemy, desired, toEnemy, fromEnemy, dist) {
  const weapon = WEAPONS[self.weaponId];

  if (enemy.weaponId === 'spear' && dist > WEAPONS.spear.minRange - 20) {
    const targetAngle = angleToTacticalPoint(self, enemy, Math.max(28, desired), self.orbitDir * 1.12);
    return vectorFromAngle(targetAngle, 1, toEnemy, '창 안쪽 파고들기');
  }

  if (dist > desired + 10) {
    const targetAngle = angleToTacticalPoint(self, enemy, desired, self.orbitDir * weapon.approachOffset);
    return vectorFromAngle(targetAngle, 1, toEnemy, '빠른 사선 진입');
  }

  if (dist < desired - 16) {
    return blendAngles(fromEnemy, toEnemy + Math.PI / 2 * self.orbitDir, 0.36, 0.72, toEnemy, '연속베기 재진입 준비');
  }

  const orbitAngle = toEnemy + Math.PI / 2 * self.orbitDir;
  return blendAngles(orbitAngle, toEnemy, 0.34, 0.94, toEnemy, '측면 압박');
}

function daggerMovement(self, enemy, desired, toEnemy, dist) {
  const weapon = WEAPONS[self.weaponId];
  const behindAngle = enemy.facing + Math.PI + self.orbitDir * 0.34;
  const targetX = enemy.x + Math.cos(behindAngle) * desired;
  const targetY = enemy.y + Math.sin(behindAngle) * desired;
  const targetAngle = Math.atan2(targetY - self.y, targetX - self.x);

  if (enemy.weaponId === 'spear' && dist > Math.max(24, WEAPONS.spear.minRange - 22)) {
    const flankAngle = angleToTacticalPoint(self, enemy, Math.max(24, desired), self.orbitDir * 1.28);
    return vectorFromAngle(flankAngle, 1, toEnemy, '창 측후방 침투');
  }

  if (dist > desired + 7) {
    return vectorFromAngle(targetAngle, 1, toEnemy, '측후방 진입');
  }

  const orbitAngle = toEnemy + Math.PI / 2 * self.orbitDir;
  const backAngle = targetAngle;
  return blendAngles(orbitAngle, backAngle, 0.46, 0.98, toEnemy, '후방 각도 유지');
}

function standardMovement(self, enemy, desired, toEnemy, fromEnemy, dist) {
  if (dist > desired + 12) return vectorFromAngle(toEnemy, 1, toEnemy, '접근');
  if (dist < desired - 14) return vectorFromAngle(fromEnemy, 1, toEnemy, '거리 확보');
  return vectorFromAngle(toEnemy + Math.PI / 2 * self.orbitDir, 0.65, toEnemy, '간격 유지');
}

function getDesiredRange(self, enemy) {
  const weapon = WEAPONS[self.weaponId];
  const personality = PERSONALITIES[self.personalityId];
  let desired = weapon.idealRange;

  if (personality.id === 'aggressive') desired *= 0.92;
  if (personality.id === 'defensive') desired *= 1.1;
  if (personality.id === 'assassin') desired *= 0.82;

  if (enemy.weaponId === 'spear' && (self.weaponId === 'dagger' || self.weaponId === 'eastern')) {
    desired = Math.max(24, WEAPONS.spear.minRange - 20);
  }

  return desired;
}

function getIncomingThreat(self, enemy) {
  const enemyWeapon = WEAPONS[enemy.weaponId];
  const dist = distance(self, enemy);
  const enemyToSelf = angleTo(enemy, self);
  const angleGap = Math.abs(angleDiff(enemy.facing, enemyToSelf));

  if (self.weaponId === 'spear' && dist < WEAPONS.spear.minRange + 10) return 'inside';
  if (enemy.attackState !== 'windup' && enemy.attackState !== 'active') return '';
  if (dist > enemyWeapon.range + self.radius + 16) return '';
  if (dist < enemyWeapon.minRange) return '';
  if (angleGap > enemyWeapon.arc + 0.34) return '';
  return 'swing';
}

function angleToTacticalPoint(self, enemy, desired, offset) {
  const enemyToSelf = angleTo(enemy, self);
  const targetAngle = enemyToSelf + offset;
  const targetX = enemy.x + Math.cos(targetAngle) * desired;
  const targetY = enemy.y + Math.sin(targetAngle) * desired;
  return Math.atan2(targetY - self.y, targetX - self.x);
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
