// render.js
// 캔버스 그리기만 담당합니다. 전투 계산을 이 파일에 넣지 않습니다.

import { TOWER_RULES, WEAPONS } from './data.js';
import { clamp } from './utils.js';

const unitImageCache = new Map();

export function render(ctx, state) {
  clear(ctx, state.arena);

  updateCamera(state);

  ctx.save();
  applyCameraTransform(ctx, state);
  applyScreenShake(ctx, state);

  drawArena(ctx, state.arena);
  drawVisualEffects(ctx, state.visualEffects || [], 'behind');
  drawWeaponArc(ctx, state.player);
  drawWeaponArc(ctx, state.enemy);
  drawAttackSpeedLines(ctx, state.player);
  drawAttackSpeedLines(ctx, state.enemy);
  drawSummons(ctx, state.summons || []);
  drawUnit(ctx, state.player);
  drawUnit(ctx, state.enemy);
  drawVisualEffects(ctx, state.visualEffects || [], 'front');
  drawCombatEffects(ctx, state.effects || []);

  ctx.restore();

  drawTopText(ctx, state);
  drawBossCinematic(ctx, state);
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

  if (isLinearSkillVisual((unit.attackVisualSkill || unit.activeSkillAttack))) {
    drawLinearAttackZone(ctx, unit, weapon, visual, alpha);
    return;
  }

  const arc = (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearSweep' && unit.attackState === 'active'
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

function isLinearSkillVisual(skillId) {
  return ['westernCaliburnCharge', 'westernExcaliburBeam', 'spearPierce', 'spearLuBu'].includes(skillId);
}

function drawLinearAttackZone(ctx, unit, weapon, visual, alpha) {
  const phase = Math.max(0, Math.min(1, unit.attackVisualPhase || 0));
  const length = (unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam'
    ? 238
    : (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearLuBu'
      ? 164
      : (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearPierce'
        ? 154
        : 126;
  const width = (unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam'
    ? 18
    : (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearLuBu'
      ? 14
      : 10;
  const start = unit.radius + 4;
  const x1 = unit.x + Math.cos(visual.angle) * start;
  const y1 = unit.y + Math.sin(visual.angle) * start;
  const x2 = unit.x + Math.cos(visual.angle) * (start + length * (unit.attackState === 'windup' ? 0.55 + phase * 0.25 : 1));
  const y2 = unit.y + Math.sin(visual.angle) * (start + length * (unit.attackState === 'windup' ? 0.55 + phase * 0.25 : 1));

  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = hexToRgba((unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam' ? '#fff5bd' : weapon.color, unit.attackState === 'active' ? 0.36 : alpha * 1.2);
  ctx.lineWidth = width;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = hexToRgba('#ffffff', unit.attackState === 'active' ? 0.55 : 0.22);
  ctx.lineWidth = Math.max(2, width * 0.32);
  ctx.stroke();
  ctx.restore();
}

function drawAttackSpeedLines(ctx, unit) {
  if (unit.isDead || unit.attackState === 'idle') return;

  const weapon = WEAPONS[unit.weaponId];
  const visual = getWeaponVisual(unit, weapon);
  const phase = Math.max(0, Math.min(1, unit.attackVisualPhase || 0));
  const alpha = unit.attackState === 'active'
    ? 0.42
    : unit.attackState === 'windup'
      ? 0.22
      : 0.16;

  const reach = Math.min(weapon.range * visual.reachScale, visual.maxDrawLength);
  const side = unit.orbitDir || 1;
  const baseAngle = visual.angle;
  const lineCount = weapon.id === 'eastern' ? 3 : weapon.id === 'dagger' ? 2 : 1;

  ctx.save();
  ctx.lineCap = 'round';

  for (let i = 0; i < lineCount; i++) {
    const offsetAngle = baseAngle - side * (0.08 + i * 0.055);
    const start = unit.radius + 10 + i * 3;
    const end = reach + unit.radius - i * 5;
    const sx = unit.x + Math.cos(offsetAngle) * start;
    const sy = unit.y + Math.sin(offsetAngle) * start;
    const ex = unit.x + Math.cos(offsetAngle) * end;
    const ey = unit.y + Math.sin(offsetAngle) * end;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = hexToRgba(i === 0 ? weapon.color : '#ffffff', alpha * (1 - i * 0.22));
    ctx.lineWidth = weapon.id === 'spear'
      ? 3.2
      : weapon.id === 'western'
        ? 3
        : weapon.id === 'eastern'
          ? 2
          : 1.8;
    ctx.stroke();
  }

  if (weapon.id === 'spear' && unit.attackState === 'active') {
    ctx.beginPath();
    const tipX = unit.x + Math.cos(baseAngle) * (unit.radius + reach);
    const tipY = unit.y + Math.sin(baseAngle) * (unit.radius + reach);
    ctx.arc(tipX, tipY, 4 + Math.sin(phase * Math.PI) * 4, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba('#ffffff', 0.35);
    ctx.fill();
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

  drawUnitBody(ctx, unit, weapon);

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

  if (unit.attackState === 'active') {
    ctx.beginPath();
    const offset = weapon.id === 'spear' ? 0 : -3;
    ctx.moveTo(unit.radius + 8, offset);
    ctx.lineTo(unit.radius + Math.min(weapon.range * (weapon.id === 'spear' ? 1.08 : 0.82), visual.maxDrawLength - 8), offset);
    ctx.strokeStyle = hexToRgba('#ffffff', weapon.id === 'spear' ? 0.3 : 0.38);
    ctx.lineWidth = weapon.id === 'spear' ? 2 : 1.5;
    ctx.stroke();
  }

  ctx.restore();

  drawHealthBar(ctx, unit);
  drawPostureBar(ctx, unit);
  drawUnitLabel(ctx, unit);
}



function drawSummons(ctx, summons) {
  if (!summons.length) return;
  ctx.save();
  summons.forEach((clone) => {
    const lifeRatio = clamp(clone.life / (clone.maxLife || clone.life || 1), 0, 1);
    ctx.save();
    const hpRatio = clamp((clone.hp || 0) / (clone.maxHp || clone.hp || 1), 0, 1);
    const hitFlash = (clone.hitFlashTimer || 0) > 0;
    ctx.globalAlpha = 0.38 + lifeRatio * 0.34;
    ctx.translate(clone.x, clone.y);
    ctx.beginPath();
    ctx.arc(0, 0, clone.radius + (hitFlash ? 7 : 4), 0, Math.PI * 2);
    ctx.fillStyle = hitFlash ? 'rgba(255,212,90,0.18)' : 'rgba(215,185,255,0.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, clone.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#d7b9ff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.rotate(clone.facing || 0);
    ctx.beginPath();
    ctx.moveTo(clone.radius + 3, 0);
    ctx.lineTo(clone.radius + 26, 0);
    ctx.strokeStyle = '#d7b9ff';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.rotate(-(clone.facing || 0));
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(-clone.radius - 4, clone.radius + 8, (clone.radius + 4) * 2, 3);
    ctx.fillStyle = '#d7b9ff';
    ctx.fillRect(-clone.radius - 4, clone.radius + 8, (clone.radius + 4) * 2 * hpRatio, 3);
    ctx.restore();
  });
  ctx.restore();
}

function drawUnitBody(ctx, unit, weapon) {
  const imageUrl = unit.side === 'player' ? String(unit.profileImageUrl || '').trim() : '';
  const imageRecord = imageUrl ? getCachedUnitImage(imageUrl) : null;
  const image = imageRecord?.image || null;
  const imageReady = unit.side === 'player'
    && imageRecord?.status === 'loaded'
    && image?.naturalWidth > 0
    && image?.naturalHeight > 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, unit.radius, 0, Math.PI * 2);
  ctx.closePath();

  if (imageReady) {
    ctx.clip();
    drawCoverImage(ctx, image, -unit.radius, -unit.radius, unit.radius * 2, unit.radius * 2);
  } else {
    drawDefaultUnitFill(ctx, unit);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, unit.radius, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = unit.staggerTimer > 0 ? '#ffd45a' : weapon.color;
  ctx.stroke();
}

function drawDefaultUnitFill(ctx, unit) {
  ctx.fillStyle = unit.side === 'player' ? '#67e59d' : '#ff6577';
  ctx.fill();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (imageRatio > boxRatio) {
    sw = image.naturalHeight * boxRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / boxRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function getCachedUnitImage(url) {
  if (!url) return null;
  const normalizedUrl = normalizeUnitImageUrl(url);
  if (unitImageCache.has(normalizedUrl)) return unitImageCache.get(normalizedUrl);

  const image = new Image();
  const record = { image, status: 'loading', url: normalizedUrl };
  image.referrerPolicy = 'no-referrer';
  image.onload = () => { record.status = 'loaded'; };
  image.onerror = () => { record.status = 'error'; };
  image.src = normalizedUrl;
  unitImageCache.set(normalizedUrl, record);
  return record;
}

function normalizeUnitImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const googleDriveMatch = value.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (googleDriveMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${googleDriveMatch[1]}`;
  }

  const googleOpenMatch = value.match(/[?&]id=([^&]+)/);
  if (value.includes('drive.google.com/open') && googleOpenMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${googleOpenMatch[1]}`;
  }

  const dropboxMatch = value.match(/dropbox\.com\/(.+)/);
  if (dropboxMatch) {
    return value.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
  }

  return value;
}


function getWeaponVisual(unit, weapon) {
  const phase = Math.max(0, Math.min(1, unit.attackVisualPhase || 0));
  const base = unit.attackAim ?? unit.facing;
  const side = unit.orbitDir || 1;
  let angle = unit.facing;
  let reachScale = weapon.id === 'spear' ? 0.42 : weapon.id === 'dagger' ? 0.7 : 0.76;

  if (unit.attackState === 'windup') {
    if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'westernCaliburnCharge') {
      angle = base;
      reachScale = 1.05 + phase * 0.38;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam') {
      angle = base;
      reachScale = 1.18 + phase * 0.3;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'spearPierce' || (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearLuBu') {
      angle = base;
      reachScale = 1.08 + phase * 0.36;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'spearSweep') {
      angle = base - side * 0.92;
      reachScale = 0.72 + phase * 0.2;
    } else if (weapon.id === 'spear') {
      angle = base - side * 0.045;
      reachScale = 0.42 + phase * 0.18;
    } else if (weapon.id === 'dagger') {
      angle = base - side * (weapon.swingVisualArc || 0.54) * (0.42 + phase * 0.16);
      reachScale = 0.66 + phase * 0.16;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'easternIaiSlash') {
      angle = base - side * 0.12 * (1 - phase);
      reachScale = 0.62 + phase * 0.22;
    } else if (weapon.id === 'eastern') {
      angle = base - side * (weapon.swingVisualArc || weapon.arc) * (0.42 - phase * 0.1);
      reachScale = 0.72 + phase * 0.12;
    } else {
      angle = base - side * (weapon.swingVisualArc || weapon.arc) * 0.5;
      reachScale = 0.74 + phase * 0.08;
    }
  } else if (unit.attackState === 'active') {
    if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'westernCaliburnCharge') {
      angle = base;
      reachScale = 1.45 + Math.sin(phase * Math.PI) * 0.32;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam') {
      angle = base;
      reachScale = 2.4;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'spearPierce') {
      angle = base;
      reachScale = 1.55 + Math.sin(phase * Math.PI) * 0.4;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'spearLuBu') {
      angle = base + side * Math.sin(phase * Math.PI * 3) * 0.06;
      reachScale = 1.45 + Math.sin(phase * Math.PI) * 0.48;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'spearSweep') {
      angle = base + side * ((phase - 0.5) * 1.95);
      reachScale = 0.96 + Math.sin(phase * Math.PI) * 0.36;
    } else if (weapon.id === 'spear') {
      angle = base + side * Math.sin(phase * Math.PI) * 0.055;
      reachScale = 1.08 + Math.sin(phase * Math.PI) * 0.68;
    } else if (weapon.id === 'dagger') {
      angle = base + side * ((phase - 0.5) * (weapon.swingVisualArc || 0.54) * 0.92);
      reachScale = 1.02 + Math.sin(phase * Math.PI) * 0.22;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'easternIaiSlash') {
      angle = base + side * ((phase - 0.5) * 0.18);
      reachScale = 1.12 + Math.sin(phase * Math.PI) * 0.24;
    } else if (weapon.id === 'eastern') {
      angle = base + side * ((phase - 0.5) * (weapon.swingVisualArc || weapon.arc) * 1.08);
      reachScale = 1.0 + Math.sin(phase * Math.PI) * 0.18;
    } else {
      angle = base + side * ((phase - 0.5) * (weapon.swingVisualArc || weapon.arc) * 1.02);
      reachScale = 0.98 + Math.sin(phase * Math.PI) * 0.15;
    }
  } else if (unit.attackState === 'recovery') {
    if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'westernCaliburnCharge' || (unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam' || (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearPierce' || (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearLuBu') {
      angle = base;
      reachScale = weapon.id === 'spear' ? 0.68 : 0.82;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'spearSweep') {
      angle = base + side * 0.82;
      reachScale = 0.72;
    } else if ((unit.attackVisualSkill || unit.activeSkillAttack) === 'easternIaiSlash') {
      angle = base + side * 0.14;
      reachScale = 0.72;
    } else {
      angle = base + side * (weapon.swingVisualArc || weapon.arc) * (weapon.id === 'spear' ? -0.06 : weapon.id === 'dagger' ? 0.18 : 0.34);
      reachScale = weapon.id === 'spear' ? 0.48 : weapon.id === 'dagger' ? 0.68 : weapon.id === 'eastern' ? 0.78 : 0.8;
    }
  }

  return {
    angle,
    reachScale,
    maxDrawLength: (unit.attackVisualSkill || unit.activeSkillAttack) === 'westernExcaliburBeam' ? 240 : (unit.attackVisualSkill || unit.activeSkillAttack) === 'westernCaliburnCharge' ? 118 : (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearPierce' || (unit.attackVisualSkill || unit.activeSkillAttack) === 'spearLuBu' ? 170 : weapon.id === 'spear' ? 152 : weapon.id === 'western' ? 76 : (unit.attackVisualSkill || unit.activeSkillAttack) === 'easternIaiSlash' ? 82 : weapon.id === 'eastern' ? 68 : 52
  };
}

function getWeaponLineWidth(weapon, attackState) {
  const activeBonus = attackState === 'active' ? 1.4 : 0;
  if (weapon.id === 'spear') return 3 + activeBonus;
  if (weapon.id === 'dagger') return 4 + activeBonus;
  return 5 + activeBonus;
}


function updateCamera(state) {
  const arena = state.arena;
  const player = state.player;
  const enemy = state.enemy;
  if (!arena || !player || !enemy) return;

  if (!state.camera) state.camera = { x: 0, y: 0 };

  const midX = (player.x + enemy.x) / 2;
  const midY = (player.y + enemy.y) / 2;
  const dx = midX - arena.centerX;
  const dy = midY - arena.centerY;

  const distanceX = Math.abs(player.x - enemy.x);
  const distanceY = Math.abs(player.y - enemy.y);
  const closeCombatBias = Math.max(0, 1 - Math.hypot(distanceX, distanceY) / 520);

  const targetX = clamp(dx * (0.18 + closeCombatBias * 0.08), -34, 34);
  const targetY = clamp(dy * (0.16 + closeCombatBias * 0.06), -26, 26);

  state.camera.x += (targetX - state.camera.x) * 0.08;
  state.camera.y += (targetY - state.camera.y) * 0.08;
}

function applyCameraTransform(ctx, state) {
  const camera = state.camera || { x: 0, y: 0 };
  ctx.translate(-camera.x, -camera.y);
}


function applyScreenShake(ctx, state) {
  const amount = state.screenShake || 0;
  if (amount <= 0) return;
  const shake = Math.min(amount, 13);
  const ox = (Math.random() - 0.5) * shake;
  const oy = (Math.random() - 0.5) * shake;
  ctx.translate(ox, oy);
}

function drawVisualEffects(ctx, effects, layer = 'front') {
  if (!effects.length) return;

  ctx.save();
  effects.forEach((effect) => {
    const progress = effect.life / (effect.maxLife || effect.life || 1);
    const alpha = clamp(progress, 0, 1);
    const inv = 1 - alpha;

    if (layer === 'behind' && !['afterimage', 'trail', 'arc'].includes(effect.type)) return;
    if (layer === 'front' && ['afterimage'].includes(effect.type)) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (effect.type === 'warningCircle') {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius || 80, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(effect.color || '#ff4d5f', 0.16 + inv * 0.14);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(effect.color || '#ff4d5f', 0.72);
      ctx.lineWidth = 3 + inv * 2;
      ctx.setLineDash([10, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (effect.type === 'warningLine') {
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.strokeStyle = hexToRgba(effect.color || '#ff4d5f', 0.16 + inv * 0.18);
      ctx.lineWidth = effect.width || 46;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.strokeStyle = hexToRgba(effect.color || '#ff4d5f', 0.78);
      ctx.lineWidth = 3 + inv * 2;
      ctx.setLineDash([14, 9]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (effect.type === 'deathMark') {
      const pulse = 0.78 + Math.sin(inv * Math.PI * 6) * 0.14;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (effect.radius || 72) * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(effect.color || '#a56cff', 0.78);
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hexToRgba(effect.color || '#a56cff', 0.9);
      ctx.fillText('✦', effect.x, effect.y - 2);
    }

    if (effect.type === 'afterimage') {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (effect.size || 20) + inv * 6, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(effect.color || '#ffffff', 0.16 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.36 * alpha);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (effect.type === 'trail') {
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.68 * alpha);
      ctx.lineWidth = Math.max(1, (effect.width || 3) * alpha);
      ctx.lineCap = 'round';
      ctx.stroke();

      if (effect.weaponId === 'dagger' || effect.skillId === 'daggerVitalStrike') {
        ctx.beginPath();
        ctx.moveTo(effect.x1, effect.y1 - 3);
        ctx.lineTo(effect.x2, effect.y2 - 3);
        ctx.strokeStyle = hexToRgba('#ffffff', 0.38 * alpha);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    if (effect.type === 'spark') {
      ctx.translate(effect.x, effect.y);
      ctx.rotate(effect.angle || 0);
      const size = (effect.size || 14) * (0.7 + inv * 0.55);
      const shape = effect.shape || 'wide';
      const rays = shape === 'needle' ? 4 : shape === 'pierce' ? 5 : effect.power > 1.5 ? 10 : 8;

      for (let i = 0; i < rays; i++) {
        const a = shape === 'pierce'
          ? (i - 2) * 0.28
          : shape === 'needle'
            ? (i - 1.5) * 0.18
            : (Math.PI * 2 / rays) * i;
        const lengthScale = shape === 'needle' ? 1.35 : shape === 'pierce' ? 1.55 : shape === 'slice' ? 1.12 : 1;
        const widthScale = shape === 'needle' ? 0.55 : shape === 'pierce' ? 0.7 : shape === 'slice' ? 0.8 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size * 0.16, Math.sin(a) * size * 0.16);
        ctx.lineTo(Math.cos(a) * size * lengthScale, Math.sin(a) * size * lengthScale);
        ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.82 * alpha);
        ctx.lineWidth = Math.max(1.1, 3.4 * alpha * (effect.power || 1) * widthScale);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (shape === 'slice') {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, -0.75, 0.75);
        ctx.strokeStyle = hexToRgba('#ffffff', 0.38 * alpha);
        ctx.lineWidth = Math.max(1, 2.2 * alpha);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, size * (shape === 'needle' ? 0.16 : 0.25), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba('#ffffff', 0.72 * alpha);
      ctx.fill();
    }

    if (effect.type === 'impact') {
      ctx.translate(effect.x, effect.y);
      ctx.rotate(effect.angle || 0);
      const size = (effect.size || 20) * (0.82 + inv * 0.42);
      const shape = effect.shape || 'slash';

      if (shape === 'thrust') {
        ctx.beginPath();
        ctx.ellipse(size * 0.18, 0, size * 1.55, size * 0.24, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(effect.color || '#ffffff', 0.24 * alpha);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-size * 1.35, 0);
        ctx.lineTo(size * 1.65, 0);
        ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.82 * alpha);
        ctx.lineWidth = Math.max(1.4, 2.6 * alpha);
        ctx.lineCap = 'round';
        ctx.stroke();
      } else if (shape === 'stab') {
        ctx.beginPath();
        ctx.moveTo(-size * 0.72, 0);
        ctx.lineTo(size * 1.25, 0);
        ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.84 * alpha);
        ctx.lineWidth = Math.max(1.2, 2.4 * alpha);
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(size * 0.32, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#ffffff', 0.46 * alpha);
        ctx.fill();
      } else if (shape === 'multiSlash') {
        [-1, 0, 1].forEach((offset) => {
          ctx.beginPath();
          ctx.moveTo(-size * 0.9, offset * 5);
          ctx.lineTo(size * 1.18, offset * 5 - 4);
          ctx.strokeStyle = hexToRgba(offset === 0 ? effect.color || '#ffffff' : '#ffffff', (offset === 0 ? 0.62 : 0.26) * alpha);
          ctx.lineWidth = Math.max(1, (offset === 0 ? 2.5 : 1.4) * alpha);
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.35, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(effect.color || '#ffffff', 0.28 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba('#ffffff', 0.52 * alpha);
        ctx.lineWidth = Math.max(1, 2.4 * alpha);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-size * 1.0, 0);
        ctx.lineTo(size * 1.28, 0);
        ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.7 * alpha);
        ctx.lineWidth = Math.max(1.5, 3.2 * alpha);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    if (effect.type === 'projectile') {
      const a = effect.angle || Math.atan2((effect.y2 || effect.y) - effect.y, (effect.x2 || effect.x) - effect.x);
      const travel = 1 - alpha;
      const px = effect.x + ((effect.x2 || effect.x) - effect.x) * travel;
      const py = effect.y + ((effect.y2 || effect.y) - effect.y) * travel;
      ctx.translate(px, py);
      ctx.rotate(a);
      const size = (effect.size || 12) * (0.85 + travel * 0.25);
      const length = (effect.length || 34) * (0.75 + travel * 0.3);
      ctx.beginPath();
      ctx.ellipse(-length * 0.12, 0, length, size * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(effect.color || '#fff5bd', 0.36 * alpha);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-length * 0.92, 0);
      ctx.lineTo(length * 0.95, 0);
      ctx.strokeStyle = hexToRgba('#ffffff', 0.82 * alpha);
      ctx.lineWidth = Math.max(2, size * 0.3 * alpha);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (effect.type === 'beam') {
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.strokeStyle = hexToRgba(effect.color || '#fff5bd', 0.24 * alpha);
      ctx.lineWidth = Math.max(3, (effect.width || 10) * 1.7 * alpha);
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.strokeStyle = hexToRgba('#ffffff', 0.72 * alpha);
      ctx.lineWidth = Math.max(2, (effect.width || 10) * 0.52 * alpha);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (effect.type === 'ring') {
      const radius = (effect.size || 24) + inv * 18 * (effect.power || 1);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.72 * alpha);
      ctx.lineWidth = Math.max(1.5, 5.5 * alpha);
      ctx.stroke();
    }

    if (effect.type === 'burst') {
      const size = (effect.size || 28) * (0.7 + inv * 0.75);
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 / 10) * i;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x + Math.cos(a) * size, effect.y + Math.sin(a) * size);
        ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.58 * alpha);
        ctx.lineWidth = Math.max(1, 2 * alpha);
        ctx.stroke();
      }
    }

    if (effect.type === 'shockline') {
      const len = (effect.length || 42) * (0.55 + inv * 0.45);
      const a = effect.angle || 0;
      const side = a + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(effect.x - Math.cos(a) * len * 0.2, effect.y - Math.sin(a) * len * 0.2);
      ctx.lineTo(effect.x + Math.cos(a) * len, effect.y + Math.sin(a) * len);
      ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.48 * alpha);
      ctx.lineWidth = Math.max(1, (effect.width || 3) * alpha);
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(side) * 5, effect.y + Math.sin(side) * 5);
      ctx.lineTo(effect.x + Math.cos(a) * len * 0.72 + Math.cos(side) * 8, effect.y + Math.sin(a) * len * 0.72 + Math.sin(side) * 8);
      ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.28 * alpha);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (effect.type === 'arc') {
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (effect.radius || 70) * (0.95 + inv * 0.12), (effect.angle || 0) - (effect.arc || 1), (effect.angle || 0) + (effect.arc || 1));
      ctx.strokeStyle = hexToRgba(effect.color || '#ffffff', 0.74 * alpha);
      ctx.lineWidth = Math.max(1, (effect.width || 4) * alpha);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
  });
  ctx.restore();
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


function drawBossCinematic(ctx, state) {
  const encounter = state.bossEncounter;
  if (!encounter || !encounter.phase || encounter.phase === 'combat') return;
  const phase = encounter.phase;
  const progress = encounter.timer / Math.max(1, encounter.maxTimer || encounter.timer || 1);
  const inv = 1 - progress;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(0, 0, state.arena.width, state.arena.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (phase === 'intro') {
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,212,90,0.94)';
    ctx.fillText(encounter.bossName || 'BOSS', state.arena.centerX, state.arena.centerY - 48);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(238,234,248,0.92)';
    ctx.fillText(encounter.introLine || '침입자를 확인했다.', state.arena.centerX, state.arena.centerY + 2);
  } else if (phase === 'warning') {
    ctx.font = `900 ${Math.round(44 + inv * 20)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,77,95,0.96)';
    ctx.fillText('B.O.S.S', state.arena.centerX, state.arena.centerY - 20);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,220,226,0.9)';
    ctx.fillText('보스 전용 패턴을 주의하세요', state.arena.centerX, state.arena.centerY + 34);
  }

  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
