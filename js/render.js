// render.js
// 캔버스 그리기만 담당합니다. 전투 계산을 이 파일에 넣지 않습니다.

import { TOWER_RULES, WEAPONS } from './data.js';
import { clamp } from './utils.js';

export function render(ctx, state) {
  clear(ctx, state.arena);
  drawArena(ctx, state.arena);
  drawWeaponArc(ctx, state.player);
  drawWeaponArc(ctx, state.enemy);
  drawUnit(ctx, state.player);
  drawUnit(ctx, state.enemy);
  drawTopText(ctx, state);
}

function clear(ctx, arena) {
  const gradient = ctx.createLinearGradient(0, 0, arena.width, arena.height);
  gradient.addColorStop(0, '#101329');
  gradient.addColorStop(0.52, '#080914');
  gradient.addColorStop(1, '#050611');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, arena.width, arena.height);
}

function drawArena(ctx, arena) {
  const width = arena.right - arena.left;
  const height = arena.bottom - arena.top;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(arena.left, arena.top, width, height);
  ctx.strokeStyle = 'rgba(168,136,255,0.34)';
  ctx.lineWidth = 2;
  ctx.strokeRect(arena.left, arena.top, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let x = arena.left + width / 6; x < arena.right; x += width / 6) {
    ctx.beginPath();
    ctx.moveTo(x, arena.top);
    ctx.lineTo(x, arena.bottom);
    ctx.stroke();
  }
  for (let y = arena.top + height / 4; y < arena.bottom; y += height / 4) {
    ctx.beginPath();
    ctx.moveTo(arena.left, y);
    ctx.lineTo(arena.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(arena.centerX, arena.top);
  ctx.lineTo(arena.centerX, arena.bottom);
  ctx.moveTo(arena.left, arena.centerY);
  ctx.lineTo(arena.right, arena.centerY);
  ctx.strokeStyle = 'rgba(255,212,90,0.08)';
  ctx.stroke();
  ctx.restore();
}

function drawWeaponArc(ctx, unit) {
  if (unit.isDead) return;
  const weapon = WEAPONS[unit.weaponId];
  const alpha = unit.attackState === 'active' ? 0.24 : 0.08;
  const start = unit.facing - weapon.arc;
  const end = unit.facing + weapon.arc;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(unit.x, unit.y);
  ctx.arc(unit.x, unit.y, weapon.range, start, end);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(weapon.color, alpha);
  ctx.fill();

  if (weapon.minRange > 0) {
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, weapon.minRange, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(weapon.color, 0.16);
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawUnit(ctx, unit) {
  const weapon = WEAPONS[unit.weaponId];

  ctx.save();
  ctx.translate(unit.x, unit.y);

  ctx.beginPath();
  ctx.arc(0, 0, unit.radius + 5, 0, Math.PI * 2);
  ctx.fillStyle = unit.side === 'player' ? 'rgba(103,229,157,0.12)' : 'rgba(255,101,119,0.12)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, unit.radius, 0, Math.PI * 2);
  ctx.fillStyle = unit.side === 'player' ? '#67e59d' : '#ff6577';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = weapon.color;
  ctx.stroke();

  ctx.rotate(unit.facing);
  ctx.beginPath();
  ctx.moveTo(unit.radius + 3, 0);
  ctx.lineTo(unit.radius + Math.min(weapon.range, 62), 0);
  ctx.strokeStyle = weapon.color;
  ctx.lineWidth = weapon.id === 'spear' ? 3 : 5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();

  drawHealthBar(ctx, unit);
  drawUnitLabel(ctx, unit);
}

function drawHealthBar(ctx, unit) {
  const width = 72;
  const height = 7;
  const ratio = clamp(unit.hp / unit.maxHp, 0, 1);
  const x = unit.x - width / 2;
  const y = unit.y - unit.radius - 22;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = unit.side === 'player' ? '#67e59d' : '#ff6577';
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawUnitLabel(ctx, unit) {
  const weapon = WEAPONS[unit.weaponId];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(238,234,248,0.9)';
  ctx.fillText(`${unit.name} · ${weapon.name}`, unit.x, unit.y + unit.radius + 20);
  ctx.restore();
}

function drawTopText(ctx, state) {
  ctx.save();
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(238,234,248,0.82)';
  const elapsed = state.elapsed.toFixed(1);
  const bossText = state.run.floor % TOWER_RULES.bossInterval === 0 ? ' · BOSS FLOOR' : '';
  ctx.fillText(`FLOOR ${state.run.floor}${bossText}`, 18, 24);
  ctx.fillText(`TIME ${elapsed}s`, 18, 44);
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
