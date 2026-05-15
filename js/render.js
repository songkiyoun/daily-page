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
  drawCombatEffects(ctx, state.effects || []);
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
  const visual = getWeaponVisual(unit, weapon);
  const alpha = unit.attackState === 'active'
    ? 0.3
    : unit.attackState === 'windup'
      ? 0.11
      : unit.attackState === 'recovery'
        ? 0.07
        : 0.045;
  const arc = unit.activeSkillAttack === 'spearSweep' && unit.attackState === 'active'
    ? Math.max(weapon.arc * 3.0, 1.2)
    : unit.attackState === 'active'
      ? Math.max(weapon.arc, (weapon.swingVisualArc || weapon.arc) * 0.52)
      : weapon.arc * 0.78;
  const start = visual.angle - arc;
  const end = visual.angle + arc;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(unit.x, unit.y);
  ctx.arc(unit.x, unit.y, weapon.range * visual.reachScale, start, end);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(weapon.color, alpha);
  ctx.fill();

  if (unit.attackState === 'active') {
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, weapon.range * visual.reachScale, start, end);
    ctx.strokeStyle = hexToRgba(weapon.color, 0.52);
    ctx.lineWidth = weapon.id === 'spear' ? 3 : 2;
    ctx.stroke();
  }

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
  ctx.strokeStyle = unit.staggerTimer > 0 ? '#ffd45a' : weapon.color;
  ctx.stroke();

  if (unit.staggerTimer > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, unit.radius + 9, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,212,90,0.72)';
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (unit.parryFlashTimer > 0) {
    const pulse = unit.radius + 12 + (unit.parryFlashTimer % 4);
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(90,232,255,0.82)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const visual = getWeaponVisual(unit, weapon);
  ctx.rotate(visual.angle);
  ctx.beginPath();
  ctx.moveTo(unit.radius + 3, 0);
  ctx.lineTo(unit.radius + Math.min(weapon.range * visual.reachScale, visual.maxDrawLength), 0);
  ctx.strokeStyle = weapon.color;
  ctx.lineWidth = getWeaponLineWidth(weapon, unit.attackState);
  ctx.lineCap = 'round';
  ctx.stroke();

  if (unit.attackState === 'active' && weapon.id !== 'spear') {
    ctx.beginPath();
    ctx.moveTo(unit.radius + 8, -3);
    ctx.lineTo(unit.radius + Math.min(weapon.range * 0.82, visual.maxDrawLength - 8), -3);
    ctx.strokeStyle = hexToRgba('#ffffff', 0.38);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();

  drawHealthBar(ctx, unit);
  drawPostureBar(ctx, unit);
  drawUnitLabel(ctx, unit);
}


function getWeaponVisual(unit, weapon) {
  const phase = Math.max(0, Math.min(1, unit.attackVisualPhase || 0));
  const base = unit.attackAim ?? unit.facing;
  const side = unit.orbitDir || 1;
  let angle = unit.facing;
  let reachScale = weapon.id === 'spear' ? 0.42 : weapon.id === 'dagger' ? 0.7 : 0.76;

  if (unit.attackState === 'windup') {
    if (unit.activeSkillAttack === 'spearSweep') {
      angle = base - side * 0.92;
      reachScale = 0.72 + phase * 0.2;
    } else if (weapon.id === 'spear') {
      angle = base - side * 0.045;
      reachScale = 0.42 + phase * 0.18;
    } else if (weapon.id === 'dagger') {
      angle = base - side * (weapon.swingVisualArc || 0.54) * (0.42 + phase * 0.16);
      reachScale = 0.66 + phase * 0.16;
    } else if (weapon.id === 'eastern') {
      angle = base - side * (weapon.swingVisualArc || weapon.arc) * (0.42 - phase * 0.1);
      reachScale = 0.72 + phase * 0.12;
    } else {
      angle = base - side * (weapon.swingVisualArc || weapon.arc) * 0.5;
      reachScale = 0.74 + phase * 0.08;
    }
  } else if (unit.attackState === 'active') {
    if (unit.activeSkillAttack === 'spearSweep') {
      angle = base + side * ((phase - 0.5) * 1.95);
      reachScale = 0.96 + Math.sin(phase * Math.PI) * 0.36;
    } else if (weapon.id === 'spear') {
      angle = base + side * Math.sin(phase * Math.PI) * 0.045;
      reachScale = 1.02 + Math.sin(phase * Math.PI) * 0.62;
    } else if (weapon.id === 'dagger') {
      angle = base + side * ((phase - 0.5) * (weapon.swingVisualArc || 0.54) * 0.78);
      reachScale = 0.98 + Math.sin(phase * Math.PI) * 0.18;
    } else if (weapon.id === 'eastern') {
      angle = base + side * ((phase - 0.5) * (weapon.swingVisualArc || weapon.arc));
      reachScale = 0.98 + Math.sin(phase * Math.PI) * 0.14;
    } else {
      angle = base + side * ((phase - 0.5) * (weapon.swingVisualArc || weapon.arc) * 0.92);
      reachScale = 0.94 + Math.sin(phase * Math.PI) * 0.12;
    }
  } else if (unit.attackState === 'recovery') {
    if (unit.activeSkillAttack === 'spearSweep') {
      angle = base + side * 0.82;
      reachScale = 0.72;
    } else {
      angle = base + side * (weapon.swingVisualArc || weapon.arc) * (weapon.id === 'spear' ? -0.06 : weapon.id === 'dagger' ? 0.18 : 0.34);
      reachScale = weapon.id === 'spear' ? 0.48 : weapon.id === 'dagger' ? 0.68 : weapon.id === 'eastern' ? 0.78 : 0.8;
    }
  }

  return {
    angle,
    reachScale,
    maxDrawLength: weapon.id === 'spear' ? 152 : weapon.id === 'western' ? 76 : weapon.id === 'eastern' ? 68 : 52
  };
}

function getWeaponLineWidth(weapon, attackState) {
  const activeBonus = attackState === 'active' ? 1.4 : 0;
  if (weapon.id === 'spear') return 3 + activeBonus;
  if (weapon.id === 'dagger') return 4 + activeBonus;
  return 5 + activeBonus;
}


function drawCombatEffects(ctx, effects) {
  if (!effects.length) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  effects.forEach((effect) => {
    const progress = effect.life / 42;
    const alpha = clamp(progress, 0, 1);
    const scale = 1 + (1 - alpha) * 0.22;
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.scale(scale, scale);
    ctx.font = '700 16px Orbitron, system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.45 * alpha})`;
    ctx.strokeText(effect.label, 0, 0);
    ctx.fillStyle = hexToRgba(effect.color || '#ffffff', 0.88 * alpha);
    ctx.fillText(effect.label, 0, 0);
    ctx.restore();
  });
  ctx.restore();
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

function drawPostureBar(ctx, unit) {
  const width = 72;
  const height = 5;
  const ratio = clamp(unit.posture / unit.maxPosture, 0, 1);
  const x = unit.x - width / 2;
  const y = unit.y - unit.radius - 13;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = unit.staggerTimer > 0 ? '#ffd45a' : '#a888ff';
  ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
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
