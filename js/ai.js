// ai.js
// 1:1 전용 자동 이동 판단을 담당합니다.
// 수정 원칙: AI가 이상하면 이 파일의 decideMovement를 직접 수정합니다.

import { PERSONALITIES, WEAPONS } from './data.js';
import { angleTo, distance } from './utils.js';

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

  if (personality.id === 'assassin') {
    return assassinMovement(self, enemy, desired, toEnemy);
  }

  if (weapon.id === 'spear' && dist < weapon.minRange + 14) {
    return vectorFromAngle(fromEnemy, 1, toEnemy, '최소 거리 확보');
  }

  if (dist > desired + 12) {
    return vectorFromAngle(toEnemy, 1, toEnemy, '접근');
  }

  if (dist < desired - 14 || (personality.id === 'defensive' && self.hp / self.maxHp < 0.42)) {
    return vectorFromAngle(fromEnemy, 1, toEnemy, '거리 확보');
  }

  const orbitPower = personality.orbit;
  const orbitAngle = toEnemy + Math.PI / 2 * self.orbitDir;
  return vectorFromAngle(orbitAngle, orbitPower, toEnemy, '간격 유지');
}

function assassinMovement(self, enemy, desired, toEnemy) {
  const dist = distance(self, enemy);
  const targetBehindAngle = enemy.facing + Math.PI;
  const targetX = enemy.x + Math.cos(targetBehindAngle) * desired;
  const targetY = enemy.y + Math.sin(targetBehindAngle) * desired;
  const targetAngle = Math.atan2(targetY - self.y, targetX - self.x);

  if (dist > desired + 8) {
    return vectorFromAngle(targetAngle, 1, toEnemy, '측후방 진입');
  }

  const orbitAngle = toEnemy + Math.PI / 2 * self.orbitDir;
  return vectorFromAngle(orbitAngle, 0.95, toEnemy, '측면 탐색');
}

function getDesiredRange(self, enemy) {
  const weapon = WEAPONS[self.weaponId];
  const personality = PERSONALITIES[self.personalityId];
  let desired = weapon.idealRange;

  if (personality.id === 'aggressive') desired *= 0.92;
  if (personality.id === 'defensive') desired *= 1.08;
  if (personality.id === 'assassin') desired *= 0.86;

  if (enemy.weaponId === 'spear' && (self.weaponId === 'dagger' || self.weaponId === 'eastern')) {
    desired = Math.max(24, WEAPONS.spear.minRange - 18);
  }

  return desired;
}

function vectorFromAngle(angle, power, faceAngle, label) {
  return {
    ax: Math.cos(angle) * power,
    ay: Math.sin(angle) * power,
    faceAngle,
    label
  };
}
