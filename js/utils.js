// utils.js
// 공통 수학 함수만 관리합니다. 게임 상태를 직접 바꾸지 않습니다.

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function angleDiff(a, b) {
  return normalizeAngle(a - b);
}

export function moveToward(current, target, maxDelta) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

export function sample(values) {
  return values[Math.floor(Math.random() * values.length)];
}
