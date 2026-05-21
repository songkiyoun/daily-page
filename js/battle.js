// battle.js
// 공격 판정, 피해 계산, 승패 판정만 담당합니다.
// 수정 원칙: 새 resolveAttack 패치 함수를 뒤에 추가하지 말고 기존 함수를 직접 수정합니다.

import { PERSONALITIES, POSTURE_RULES, SKILLS, WEAPONS } from './data.js';
import { decideMovement } from './ai.js';
import { angleDiff, angleTo, clamp, distance, moveToward } from './utils.js';

const COMBAT_STALL_FRAMES = 180;
const COMBAT_FORCE_FRAMES = 54;

const FORCED_CRIT_SKILLS = new Set([
  'daggerVitalStrike',
  'westernCaliburnCharge',
  'easternAnnihilation',
  'spearPierce',
  'daggerAssassinate'
]);

const CHARGE_GUARD_SKILLS = new Set([
  'westernCaliburnCharge',
  'westernExcaliburBeam'
]);

const WEAPON_ATTACK_SKILL_TYPES = new Set(['attack', 'evolutionAttack', 'evolutionFollowUp']);
const WEAPON_SKILL_CHAIN_LOCK_FRAMES = 42;
const PASS_STRIKE_SKILLS = new Set(['easternAnnihilation', 'daggerAssassinate']);
const SEQUENCE_SKILLS = new Set(['easternAnnihilation', 'daggerAssassinate', 'spearLuBu']);


function isWeaponAttackSkill(skillId) {
  const skill = SKILLS[skillId];
  return !!skill && (skill.source === 'weapon' || skill.source === 'weaponEvolution') && WEAPON_ATTACK_SKILL_TYPES.has(skill.type);
}

export function updateBattle(state) {
  if (!state.running || state.paused || state.result) return;

  state.frame += 1;
  state.elapsed += 1 / 60;
  updateCombatEffects(state);
  updateSummonedClones(state);
  updateCombatStallEngagement(state);

  updateUnit(state.player, state.enemy, state);
  updateUnit(state.enemy, state.player, state);

  resolveWeaponClash(state, state.player, state.enemy);
  resolveBodyCollision(state.player, state.enemy);
  clampToArena(state.player, state.arena);
  clampToArena(state.enemy, state.arena);
  checkResult(state);
}

function updateUnit(unit, enemy, state) {
  if (unit.isDead) return;

  const weapon = WEAPONS[unit.weaponId];
  tickTimers(unit);

  if (processActiveSkillSequence(unit, enemy, state)) return;

  if (unit.impactStopTimer > 0) {
    applyImpactStopDrift(unit);
    unit.impactStopTimer -= 1;
    unit.lastAction = unit.lastAction.includes('패링') ? unit.lastAction : '충격 정지';
    return;
  }

  if (unit.staggerTimer > 0) {
    applyStaggerDrift(unit);
    unit.lastAction = '자세 흐트러짐';
    return;
  }

  recoverPosture(unit);
  triggerPostureSkill(unit, enemy, state);

  const movement = decideMovement(unit, enemy, state);
  updateRetreatState(unit, movement);
  unit.lastAction = movement.label;
  unit.facing = moveToward(unit.facing, movement.faceAngle, getTurnSpeed(unit));

  updateOrbitDirection(unit, enemy);

  if (unit.attackState === 'idle') {
    applyMovement(unit, movement, weapon, enemy);
    if (tryStartPendingSkillAttack(unit, enemy, state)) return;
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
  if (unit.daggerSideCommitLock > 0) unit.daggerSideCommitLock -= 1;
  if (unit.daggerThreatStepCooldown > 0) unit.daggerThreatStepCooldown -= 1;
  if (unit.daggerBaitTimer > 0) unit.daggerBaitTimer -= 1;
  if (unit.daggerManeuverTimer > 0) unit.daggerManeuverTimer -= 1;
  if (unit.daggerResetTimer > 0) unit.daggerResetTimer -= 1;
  if (unit.parryCooldown > 0) unit.parryCooldown -= 1;
  if (unit.parryFlashTimer > 0) unit.parryFlashTimer -= 1;
  if (unit.counterTimer > 0) unit.counterTimer -= 1;
  if (unit.comboTimer > 0) unit.comboTimer -= 1;
  if (unit.comboTimer <= 0) unit.comboCount = 0;
  if (unit.riposteTimer > 0) unit.riposteTimer -= 1;
  if (unit.skillRuntime?.highSpeedTimer > 0) unit.skillRuntime.highSpeedTimer -= 1;
  if (unit.skillRuntime?.spearFocusTimer > 0) unit.skillRuntime.spearFocusTimer -= 1;
  if (unit.weaponSkillChainLockTimer > 0) unit.weaponSkillChainLockTimer -= 1;
  if (unit.closeResetGraceTimer > 0) unit.closeResetGraceTimer -= 1;
  Object.keys(unit.skillCooldowns || {}).forEach((skillId) => {
    if (unit.skillCooldowns[skillId] > 0) unit.skillCooldowns[skillId] -= 1;
  });
}

function applyImpactStopDrift(unit) {
  const movementScale = unit.weaponId === 'dagger' && unit.lastAction.includes('치고 빠지기') ? 0.92 : 0.46;
  unit.x += unit.vx * movementScale;
  unit.y += unit.vy * movementScale;
  const damping = unit.weaponId === 'dagger' && unit.lastAction.includes('치고 빠지기') ? 0.86 : 0.72;
  unit.vx *= damping;
  unit.vy *= damping;
}

function emitVisualEffect(state, effect) {
  if (!state) return;
  if (!state.visualEffects) state.visualEffects = [];
  state.visualEffects.push(effect);
  if (state.visualEffects.length > 46) {
    state.visualEffects.splice(0, state.visualEffects.length - 46);
  }
}

function addScreenShake(state, amount = 2) {
  if (!state) return;
  state.screenShake = Math.max(state.screenShake || 0, amount);
}

function emitHitSpark(state, attacker, defender, weapon, crit = false, skillId = '') {
  const angle = angleTo(attacker, defender);
  const x = defender.x - Math.cos(angle) * defender.radius * 0.45;
  const y = defender.y - Math.sin(angle) * defender.radius * 0.45;
  const color = crit ? '#ffd45a' : weapon.color;
  const isHeavy = weapon.id === 'western' || weapon.id === 'spear';
  const isSkill = !!skillId;

  const weaponImpactProfile = {
    western: { impactShape: 'slash', sparkShape: 'wide', trailWidth: 7.2, trailLife: 23, impactSize: 25, power: 1.46 },
    eastern: { impactShape: 'multiSlash', sparkShape: 'slice', trailWidth: 4.2, trailLife: 17, impactSize: 19, power: 1.18 },
    spear: { impactShape: 'thrust', sparkShape: 'pierce', trailWidth: 5.4, trailLife: 22, impactSize: 23, power: 1.38 },
    dagger: { impactShape: 'stab', sparkShape: 'needle', trailWidth: 3.4, trailLife: 15, impactSize: 17, power: 1.12 }
  }[weapon.id] || { impactShape: 'slash', sparkShape: 'wide', trailWidth: 4.8, trailLife: 18, impactSize: 20, power: 1.2 };

  emitVisualEffect(state, {
    type: 'spark',
    x,
    y,
    angle,
    color,
    life: crit ? 32 : isHeavy ? 24 : 20,
    maxLife: crit ? 32 : isHeavy ? 24 : 20,
    size: crit ? 34 : weaponImpactProfile.impactSize,
    power: crit ? 1.9 : weaponImpactProfile.power,
    weaponId: weapon.id,
    shape: weaponImpactProfile.sparkShape
  });

  emitVisualEffect(state, {
    type: 'trail',
    x1: attacker.x + Math.cos(angle) * attacker.radius,
    y1: attacker.y + Math.sin(angle) * attacker.radius,
    x2: defender.x,
    y2: defender.y,
    color,
    life: crit ? 26 : weaponImpactProfile.trailLife,
    maxLife: crit ? 26 : weaponImpactProfile.trailLife,
    width: crit ? 8 : weaponImpactProfile.trailWidth,
    weaponId: weapon.id,
    skillId
  });

  emitVisualEffect(state, {
    type: 'impact',
    x,
    y,
    angle,
    color: crit ? '#ffffff' : color,
    life: crit ? 18 : 13,
    maxLife: crit ? 18 : 13,
    size: crit ? 30 : weaponImpactProfile.impactSize,
    power: crit ? 1.6 : weaponImpactProfile.power,
    weaponId: weapon.id,
    shape: weaponImpactProfile.impactShape
  });

  if (weapon.id === 'western') {
    emitVisualEffect(state, {
      type: 'arc',
      x,
      y,
      angle,
      color,
      life: crit ? 20 : 14,
      maxLife: crit ? 20 : 14,
      radius: crit ? 46 : 36,
      arc: 0.95,
      width: crit ? 6 : 4.5
    });
  }

  if (weapon.id === 'eastern') {
    const side = angle + Math.PI / 2;
    [-1, 1].forEach((dir, index) => {
      emitVisualEffect(state, {
        type: 'trail',
        x1: attacker.x + Math.cos(angle) * attacker.radius + Math.cos(side) * dir * 8,
        y1: attacker.y + Math.sin(angle) * attacker.radius + Math.sin(side) * dir * 8,
        x2: defender.x + Math.cos(side) * dir * 10,
        y2: defender.y + Math.sin(side) * dir * 10,
        color,
        life: 10 + index * 2,
        maxLife: 10 + index * 2,
        width: 2.2,
        weaponId: weapon.id,
        skillId: 'easternAfterSlash'
      });
    });
  }

  if (skillId === 'easternIaiSlash') {
    emitVisualEffect(state, {
      type: 'shockline',
      x,
      y,
      angle,
      color,
      life: crit ? 22 : 17,
      maxLife: crit ? 22 : 17,
      length: crit ? 104 : 86,
      width: crit ? 4.6 : 3.4
    });
  }

  if (weapon.id === 'spear') {
    emitVisualEffect(state, {
      type: 'shockline',
      x,
      y,
      angle,
      color,
      life: crit ? 18 : 14,
      maxLife: crit ? 18 : 14,
      length: crit ? 92 : 72,
      width: crit ? 4.8 : 3.8
    });
  }

  if (weapon.id === 'dagger') {
    emitVisualEffect(state, {
      type: 'afterimage',
      x: attacker.x,
      y: attacker.y,
      color,
      life: 12,
      maxLife: 12,
      size: attacker.radius + 2
    });
  }

  if (isSkill || crit) {
    emitVisualEffect(state, {
      type: 'ring',
      x,
      y,
      color,
      life: crit ? 18 : 12,
      maxLife: crit ? 18 : 12,
      size: crit ? 24 : 16,
      power: crit ? 1.15 : 0.7
    });
  }

  addScreenShake(state, crit ? 12 : weapon.id === 'western' ? 8 : weapon.id === 'spear' ? 8 : weapon.id === 'eastern' ? 6 : 5);
}

function emitParryFlash(state, unit, attacker) {
  emitVisualEffect(state, {
    type: 'ring',
    x: unit.x,
    y: unit.y,
    color: '#5ae8ff',
    life: 18,
    maxLife: 18,
    size: unit.radius + 8,
    power: 1.15
  });
  const a = angleTo(unit, attacker);
  emitVisualEffect(state, {
    type: 'shockline',
    x: unit.x,
    y: unit.y,
    angle: a,
    color: '#5ae8ff',
    life: 14,
    maxLife: 14,
    length: 42,
    width: 3
  });
  addScreenShake(state, 11);
}

function emitBreakBurst(state, unit) {
  emitVisualEffect(state, {
    type: 'ring',
    x: unit.x,
    y: unit.y,
    color: '#ff5a6d',
    life: 24,
    maxLife: 24,
    size: unit.radius + 10,
    power: 1.35
  });
  emitVisualEffect(state, {
    type: 'burst',
    x: unit.x,
    y: unit.y,
    color: '#ff5a6d',
    life: 22,
    maxLife: 22,
    size: 28,
    power: 1.25
  });
  addScreenShake(state, 13);
}

function emitKnockbackLine(state, from, to, color = '#ffffff', power = 1) {
  const a = angleTo(from, to);
  emitVisualEffect(state, {
    type: 'shockline',
    x: to.x,
    y: to.y,
    angle: a,
    color,
    life: 12,
    maxLife: 12,
    length: 46 + power * 20,
    width: 3 + power * 1.3
  });
}


function updateCombatEffects(state) {
  if (!state.effects) state.effects = [];
  state.effects = state.effects
    .map((effect) => ({ ...effect, life: effect.life - 1, y: effect.y - 0.42 }))
    .filter((effect) => effect.life > 0);

  if (!state.visualEffects) state.visualEffects = [];
  state.visualEffects = state.visualEffects
    .map((effect) => ({ ...effect, life: effect.life - 1 }))
    .filter((effect) => effect.life > 0);

  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - 1);
}

function updateSummonedClones(state) {
  if (!state.summons?.length) return;
  const player = state.player;
  const enemy = state.enemy;

  state.summons = state.summons
    .map((clone) => {
      const owner = clone.ownerSide === 'player' ? player : enemy;
      const target = clone.targetSide === 'player' ? player : enemy;
      if (!owner || !target || owner.isDead || target.isDead || clone.hp <= 0) {
        return { ...clone, life: 0 };
      }

      const angle = angleTo(clone, target);
      const orbit = angle + Math.PI / 2 * (clone.orbitDir || 1);
      const desiredRadius = target.radius + clone.radius + 24;
      const desiredX = target.x - Math.cos(angle) * desiredRadius + Math.cos(orbit) * 18;
      const desiredY = target.y - Math.sin(angle) * desiredRadius + Math.sin(orbit) * 18;
      const dx = desiredX - clone.x;
      const dy = desiredY - clone.y;
      const distToPoint = Math.hypot(dx, dy) || 1;
      const speed = clone.moveSpeed || 3.2;
      clone.x += dx / distToPoint * Math.min(speed, distToPoint);
      clone.y += dy / distToPoint * Math.min(speed, distToPoint);
      clone.facing = angleTo(clone, target);
      clone.life -= 1;
      clone.attackTimer -= 1;
      if (clone.hitFlashTimer > 0) clone.hitFlashTimer -= 1;

      const distToTarget = distance(clone, target);
      if (clone.attackTimer <= 0 && distToTarget < target.radius + clone.radius + 58) {
        clone.attackTimer = clone.attackInterval || 38;
        const weapon = WEAPONS[owner.weaponId] || WEAPONS.dagger;
        const damage = Math.max(1, weapon.damage * (owner.attackScale || 1) * 0.1 * (1 - getEffectiveDefense(target)));
        target.hp = clamp(target.hp - damage, 0, target.maxHp);
        owner.damageDealt += damage;
        owner.hits += 1;
        emitCombatEvent(state, '분신 공격', target.x, target.y - 42, '#d7b9ff');
        emitVisualEffect(state, {
          type: 'trail',
          x1: clone.x,
          y1: clone.y,
          x2: target.x,
          y2: target.y,
          color: '#d7b9ff',
          source: '분신술',
          life: 14,
          maxLife: 14,
          width: 2.6,
          weaponId: 'dagger',
          skillId: 'cloneStrike'
        });
        emitHitSpark(state, owner, target, weapon, false, 'cloneStrike');
        if (target.hp <= 0) {
          target.isDead = true;
          target.lastAction = '전투 불능';
        }
      }
      return clone;
    })
    .filter((clone) => clone.life > 0);
}

function updateCombatStallEngagement(state) {
  const player = state.player;
  const enemy = state.enemy;
  if (!player || !enemy) return;

  if (!state.engagement) {
    state.engagement = {
      combatStallFrames: 0,
      combatForceFrames: 0,
      lastPlayerHits: player.hits || 0,
      lastEnemyHits: enemy.hits || 0
    };
  }

  const tracker = state.engagement;

  if (player.isDead || enemy.isDead) {
    tracker.combatStallFrames = 0;
    tracker.combatForceFrames = 0;
    tracker.lastPlayerHits = player.hits || 0;
    tracker.lastEnemyHits = enemy.hits || 0;
    return;
  }

  const hitChanged = tracker.lastPlayerHits !== (player.hits || 0) || tracker.lastEnemyHits !== (enemy.hits || 0);
  const combatMotion = player.attackState !== 'idle' || enemy.attackState !== 'idle' ||
    player.staggerTimer > 0 || enemy.staggerTimer > 0 ||
    player.impactStopTimer > 0 || enemy.impactStopTimer > 0 ||
    player.clashCooldown > 0 || enemy.clashCooldown > 0;

  tracker.lastPlayerHits = player.hits || 0;
  tracker.lastEnemyHits = enemy.hits || 0;

  if (hitChanged) {
    tracker.combatStallFrames = 0;
    tracker.combatForceFrames = 0;
    return;
  }

  if (combatMotion) {
    tracker.combatStallFrames = 0;
    return;
  }

  tracker.combatStallFrames += 1;
  if (tracker.combatStallFrames >= COMBAT_STALL_FRAMES) {
    tracker.combatStallFrames = 0;
    tracker.combatForceFrames = COMBAT_FORCE_FRAMES;
    emitCombatEvent(state, '교전 지연 해소', (player.x + enemy.x) / 2, (player.y + enemy.y) / 2 - 24, '#ffdf8a');
  }

  if (tracker.combatForceFrames > 0) {
    applyCombatStallEngagementForce(state, player, enemy);
    tracker.combatForceFrames -= 1;
  }
}

function applyCombatStallEngagementForce(state, player, enemy) {
  const weapon = WEAPONS[player.weaponId];
  const dist = distance(player, enemy) || 1;
  const targetDist = getCombatStallEngageDistance(player, enemy, weapon);
  const toEnemy = angleTo(player, enemy);

  player.facing = moveToward(player.facing, toEnemy, 0.24);
  enemy.facing = moveToward(enemy.facing, toEnemy + Math.PI, 0.24);
  player.orbitDir = 1;
  enemy.orbitDir = -1;
  player.orbitFlipTimer = Math.max(player.orbitFlipTimer || 0, 24);
  enemy.orbitFlipTimer = Math.max(enemy.orbitFlipTimer || 0, 24);
  player.cooldownTimer = Math.min(player.cooldownTimer || 0, 6);
  enemy.cooldownTimer = Math.min(enemy.cooldownTimer || 0, 6);

  if (dist <= targetDist) return;

  const pull = clamp((dist - targetDist) * 0.09, 0.4, 3.2);
  const nx = Math.cos(toEnemy);
  const ny = Math.sin(toEnemy);
  player.x += nx * pull;
  player.y += ny * pull;
  enemy.x -= nx * pull;
  enemy.y -= ny * pull;
  player.vx = player.vx * 0.46 + nx * pull * 0.38;
  player.vy = player.vy * 0.46 + ny * pull * 0.38;
  enemy.vx = enemy.vx * 0.46 - nx * pull * 0.38;
  enemy.vy = enemy.vy * 0.46 - ny * pull * 0.38;
}

function getCombatStallEngageDistance(player, enemy, weapon) {
  const bodySafeDistance = player.radius + enemy.radius + 8;
  const weaponDistance = weapon.id === 'dagger'
    ? WEAPONS.dagger.range + enemy.radius + 2
    : weapon.id === 'eastern'
      ? weapon.idealRange + enemy.radius * 0.55
      : weapon.idealRange + enemy.radius * 0.65;
  return Math.max(bodySafeDistance, weaponDistance, weapon.minRange + enemy.radius + 8);
}

function emitCombatEvent(state, label, x, y, color) {
  if (!state) return;
  if (!state.effects) state.effects = [];
  if (!state.eventLocks) state.eventLocks = {};

  const lastFrame = state.eventLocks[label] ?? -9999;
  if (state.frame - lastFrame < POSTURE_RULES.eventTextCooldownFrames) return;
  state.eventLocks[label] = state.frame;

  state.effects.push({
    label,
    x,
    y,
    color,
    life: POSTURE_RULES.eventTextFrames
  });

  if (state.effects.length > 6) {
    state.effects.splice(0, state.effects.length - 6);
  }
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

  const weapon = WEAPONS[unit.weaponId];
  const stateScale = unit.attackState === 'idle' ? 1 : 0.35;
  const recoveryScale = getPostureRecoveryScale(weapon);
  unit.posture = clamp(
    unit.posture + POSTURE_RULES.recoveryPerFrame * stateScale * recoveryScale,
    0,
    unit.maxPosture
  );
}


function getPostureRecoveryScale(weapon) {
  if (weapon.id === 'spear') return 0.72;
  if (weapon.id === 'western') return 0.88;
  if (weapon.id === 'eastern') return 1.02;
  if (weapon.id === 'dagger') return 1.18;
  return 1;
}

function getTurnSpeed(unit) {
  const weapon = WEAPONS[unit.weaponId];
  const personality = PERSONALITIES[unit.personalityId];
  let scale = unit.turnSpeedScale || 1;

  if (unit.attackState === 'windup') scale *= weapon.windupTurnScale;
  if (unit.attackState === 'active') scale *= weapon.activeTurnScale;
  if (unit.attackState === 'recovery') scale *= weapon.recoveryTurnScale;
  if (unit.postureRecoveryDelay > 0) scale *= weapon.shakenTurnScale || 0.78;
  if (unit.flankPressureTimer > 0) {
    scale *= (weapon.feintResponseTurnScale || 1) * POSTURE_RULES.daggerFlankTurnScale;
    if (unit.weaponId === 'spear') scale *= 0.86;
    if (unit.weaponId === 'western') scale *= 0.92;
  }
  if (unit.parryFlashTimer > 0) scale *= Math.min(0.74, weapon.shakenTurnScale || 0.72);
  if (unit.posture < unit.maxPosture * 0.35) scale *= Math.min(0.9, (weapon.shakenTurnScale || 0.86) + 0.12);
  if (unit.weaponId === 'spear' && unit.skillRuntime?.spearFocusTimer > 0) {
    const focusTurnBase = unit.personalityId === 'defensive' ? 1.12 : 1.28;
    const focusTurnPerLevel = unit.personalityId === 'defensive' ? 0.05 : 0.08;
    scale *= focusTurnBase + getUnitSkillLevel(unit, 'spearFocus') * focusTurnPerLevel;
  }
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
  const daggerBurst = unit.weaponId === 'dagger' && isDaggerBurstLabel(movement.label);
  const daggerFeint = unit.weaponId === 'dagger' && movement.label.includes('페이크');
  const burstScale = daggerBurst ? 1.92 : daggerFeint ? 1.52 : 1;
  const highSpeedScale = unit.skillRuntime?.highSpeedTimer > 0 ? 1.24 + getUnitSkillLevel(unit, 'daggerHighSpeed') * 0.08 : 1;
  const maxSpeed = weapon.moveSpeed * (unit.moveSpeedScale || 1) * burstScale * highSpeedScale;

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
  if (unit.weaponId === 'eastern') value = movement.label.includes('페이크') ? 0.29 : 0.25;
  if (unit.weaponId === 'dagger') value = isDaggerBurstLabel(movement.label) ? 0.76 : movement.label.includes('페이크') ? 0.62 : 0.33;
  if (personality.id === 'defensive' && movement.label.includes('후퇴')) value += 0.015;
  if (personality.id === 'defensive' && movement.label.includes('측면')) value += 0.045;
  if (personality.id === 'assassin' && movement.label.includes('측')) value += 0.035;
  return value;
}

function isDaggerBurstLabel(label = '') {
  return label.includes('순간') || label.includes('침투') || label.includes('후방') || label.includes('돌파') || label.includes('빠른') || label.includes('반대 꺾기') || label.includes('급반전') || label.includes('미러 짧은 교전');
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
  const westernCloseGuard = weapon.id === 'western' &&
    weapon.closeGuardVsDagger &&
    enemy.weaponId === 'dagger' &&
    (bodyClose || dist < unit.radius + enemy.radius + 34 || (enemy.attackState !== 'idle' && dist < weapon.range + enemy.radius * 0.4));

  if ((spearPinned || westernCloseGuard) && enemy.weaponId === 'dagger' && (
    unit.closeResetGraceTimer > 0 ||
    enemy.attackState !== 'idle' ||
    enemy.lastAction === '명중' ||
    enemy.lastAction === '치명타' ||
    enemy.lastAction.includes('급소')
  )) {
    return false;
  }

  if (!spearPinned && !defensivePinned && !westernCloseGuard) return false;

  const pushAngle = angleTo(unit, enemy);
  const sideAngle = pushAngle + Math.PI / 2 * unit.orbitDir;
  const enemyPersonality = PERSONALITIES[enemy.personalityId];
  const identityPush = (weapon.closePushScale || 1) * (personality.closePushScale || 1);
  const pushResistance = enemyPersonality.knockbackTakenScale || 1;
  const force = (spearPinned ? 7.2 : westernCloseGuard ? 4.8 : 4.2) * identityPush * pushResistance;
  const sideForce = (spearPinned ? 1.8 : westernCloseGuard ? 2.2 : 1.4) * identityPush * pushResistance;
  const selfSide = (spearPinned ? 2.35 : westernCloseGuard ? 1.28 : 1.6) * identityPush;

  enemy.vx += Math.cos(pushAngle) * force + Math.cos(sideAngle) * sideForce;
  enemy.vy += Math.sin(pushAngle) * force + Math.sin(sideAngle) * sideForce;
  unit.vx += -Math.cos(pushAngle) * 0.75 + Math.cos(sideAngle) * selfSide;
  unit.vy += -Math.sin(pushAngle) * 0.75 + Math.sin(sideAngle) * selfSide;
  unit.retreatFrames = 0;
  unit.retreatLockout = Math.max(unit.retreatLockout || 0, Math.floor(POSTURE_RULES.retreatLockoutFrames * 0.45));
  const daggerClosePenalty = spearPinned && enemy.weaponId === 'dagger';
  const westernDaggerPenalty = westernCloseGuard && enemy.weaponId === 'dagger';
  unit.resetMoveCooldown = spearPinned
    ? Math.round(POSTURE_RULES.closeResetCooldown * (daggerClosePenalty ? 2.35 : personality.id === 'defensive' ? 1.18 : 1.08))
    : westernDaggerPenalty
      ? Math.round(POSTURE_RULES.closeResetCooldown * 1.65)
      : POSTURE_RULES.closeResetCooldown;
  unit.cooldownTimer = Math.max(unit.cooldownTimer, spearPinned ? 10 : westernCloseGuard ? 16 : 14);
  enemy.cooldownTimer = Math.max(enemy.cooldownTimer || 0, spearPinned ? 12 : westernCloseGuard ? 11 : 9);

  let postureDamage = POSTURE_RULES.closeResetPostureDamage * (spearPinned ? (personality.id === 'defensive' ? 0.84 : 1.02) : westernCloseGuard ? (weapon.closeGuardPostureScale || 1.05) : 0.94);
  if (spearPinned && enemy.weaponId === 'dagger') {
    postureDamage *= personality.id === 'defensive' ? 0.26 : 0.34;
  }
  if (westernCloseGuard && enemy.weaponId === 'dagger') {
    postureDamage *= personality.id === 'defensive' ? 0.42 : 0.52;
  }
  applyPostureDamage(unit, enemy, postureDamage);
  twistBodyOnImpact(enemy, unit, postureDamage, weapon);

  unit.lastAction = spearPinned ? '창 밀어내기' : westernCloseGuard ? '서양검 근접 견제 베기' : '방어 견제 밀어내기';
  enemy.lastAction = westernCloseGuard ? '근접 견제당함' : '자세 밀림';
  return true;
}


function tryStartPendingSkillAttack(unit, enemy, state) {
  const pending = unit.skillRuntime?.pendingSpearDoubleThrust;
  if (!pending) return false;

  pending.timer -= 1;
  if (pending.timer > 0) {
    unit.lastAction = '연속 찌르기 준비';
    return true;
  }

  unit.skillRuntime.pendingSpearDoubleThrust = null;
  if (unit.isDead || enemy.isDead || unit.attackState !== 'idle') return false;

  unit.activeSkillAttack = 'spearDoubleThrust';
  unit.attackState = 'windup';
  unit.attackTimer = Math.max(4, Math.round(WEAPONS.spear.windup * 0.48));
  unit.attackWindupMax = unit.attackTimer;
  unit.attackActiveMax = getActiveFrames(unit);
  unit.attackRecoveryMax = Math.max(5, Math.round(WEAPONS.spear.recovery * 0.72));
  unit.attackResolved = false;
  unit.attackOutcome = '';
  unit.attackAim = angleTo(unit, enemy);
  unit.attackVisualPhase = 0;
  unit.cooldownTimer = Math.max(unit.cooldownTimer || 0, 8);
  unit.lastAction = '연속 찌르기 준비';
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
  attacker.attackAim = angleTo(attacker, defender);
  attacker.activeSkillAttack = chooseAttackSkill(attacker, defender);
  attacker.attackVisualSkill = attacker.activeSkillAttack || '';
  if (attacker.skillRuntime) attacker.skillRuntime.activeSequence = null;
  const focusWindupScale = attacker.weaponId === 'spear' && attacker.skillRuntime?.spearFocusTimer > 0
    ? Math.max(0.76, 0.92 - getUnitSkillLevel(attacker, 'spearFocus') * 0.04)
    : 1;
  attacker.attackTimer = Math.max(4, Math.round(weapon.windup * focusWindupScale * getSkillWindupScale(attacker.activeSkillAttack)));
  attacker.attackWindupMax = attacker.attackTimer;
  attacker.attackActiveMax = getActiveFrames(attacker);
  attacker.attackRecoveryMax = weapon.recovery;
  attacker.attackResolved = false;
  attacker.attackOutcome = '';
  attacker.attackVisualPhase = 0;
  attacker.attackSequenceId = (attacker.attackSequenceId || 0) + 1;
  attacker.vx *= getAttackEntryBrake(attacker.weaponId);
  attacker.vy *= getAttackEntryBrake(attacker.weaponId);
  if (attacker.weaponId === 'dagger') {
    attacker.daggerManeuverPhase = '';
    attacker.daggerManeuverTimer = 0;
  }
  attacker.lastAction = getSkillWindupLabel(attacker.activeSkillAttack) || getWindupLabel(attacker.weaponId);
}

function updateAttackState(attacker, defender, state) {
  const weapon = WEAPONS[attacker.weaponId];
  attacker.attackTimer -= 1;

  if (attacker.attackState === 'windup') {
    attacker.attackVisualPhase = 1 - attacker.attackTimer / Math.max(1, attacker.attackWindupMax || weapon.windup);
    applyWindupDrift(attacker, weapon);
    emitSkillWindupVisual(attacker, defender, state);
    if (attacker.attackTimer <= 0) {
      attacker.attackState = 'active';
      attacker.attackTimer = attacker.attackActiveMax || getActiveFrames(attacker);
      attacker.attackVisualPhase = 0;
      attacker.lastAction = getSkillActiveLabel(attacker.activeSkillAttack) || getActiveLabel(attacker.weaponId);
      if (attacker.activeSkillAttack) {
        emitCombatEvent(state, getSkillActiveLabel(attacker.activeSkillAttack) || SKILLS[attacker.activeSkillAttack]?.name || '스킬', attacker.x, attacker.y - 44, '#ffd45a');
      }
      emitSkillActiveStartVisual(attacker, defender, state);
      if (startEvolutionSkillSequence(attacker, defender, state)) {
        return;
      }
      if (attacker.activeSkillAttack === 'daggerCloneTechnique') {
        attacker.attackResolved = true;
        attacker.attackState = 'recovery';
        attacker.attackTimer = getAttackRecoveryDuration(attacker, weapon);
        attacker.attackRecoveryMax = attacker.attackTimer;
        attacker.lastAction = '분신 유지';
        return;
      }
      applyAttackLunge(attacker, weapon);
      attacker.attackResolved = resolveAttack(attacker, defender, state);
    }
    return;
  }

  if (attacker.attackState === 'skillSequence') {
    processActiveSkillSequence(attacker, defender, state);
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
      attacker.attackTimer = getAttackRecoveryDuration(attacker, weapon);
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
      attacker.cooldownTimer = getRecoveryCooldown(attacker, weapon);
      attacker.lastAction = '재정비';
      clearAttackSkillVisualState(attacker);
    }
  }
}

function getActiveFrames(attacker) {
  const weapon = WEAPONS[attacker.weaponId];
  if (attacker.activeSkillAttack === 'westernExcaliburBeam') return (weapon?.activeFrames || 5) + 8;
  if (attacker.activeSkillAttack === 'westernCaliburnCharge') return (weapon?.activeFrames || 5) + 3;
  if (attacker.activeSkillAttack === 'easternAnnihilation') return (weapon?.activeFrames || 5) + 4;
  if (attacker.activeSkillAttack === 'spearPierce') return (weapon?.activeFrames || 5) + 3;
  if (attacker.activeSkillAttack === 'spearLuBu') return (weapon?.activeFrames || 5) + 5;
  if (attacker.activeSkillAttack === 'daggerAssassinate') return (weapon?.activeFrames || 5) + 4;
  if (attacker.activeSkillAttack === 'daggerCloneTechnique') return (weapon?.activeFrames || 5) + 6;
  if (attacker.activeSkillAttack === 'westernBash') return (weapon?.activeFrames || 5) + 3;
  if (attacker.activeSkillAttack === 'spearDoubleThrust') return (weapon?.activeFrames || 5) + 2;
  if (attacker.activeSkillAttack === 'easternIaiSlash') return (weapon?.activeFrames || 5) + 2;
  if (attacker.activeSkillAttack === 'spearSweep') return (weapon?.activeFrames || 5) + 4;
  return weapon?.activeFrames || 5;
}

function getSkillWindupScale(skillId) {
  if (skillId === 'westernExcaliburBeam') return 4.0;
  if (skillId === 'westernCaliburnCharge') return 1.42;
  if (skillId === 'spearLuBu') return 1.2;
  if (skillId === 'daggerCloneTechnique') return 1.16;
  return 1;
}

function getAttackEntryBrake(weaponId) {
  if (weaponId === 'spear') return 0.3;
  if (weaponId === 'western') return 0.34;
  if (weaponId === 'eastern') return 0.46;
  if (weaponId === 'dagger') return 0.52;
  return 0.42;
}

function emitSkillWindupVisual(attacker, defender, state) {
  if (!attacker.activeSkillAttack || !state) return;
  if ((attacker.attackTimer || 0) % 10 !== 0) return;

  if (attacker.activeSkillAttack === 'westernExcaliburBeam') {
    const chargePhase = clamp(1 - (attacker.attackTimer || 0) / Math.max(1, attacker.attackWindupMax || 1), 0, 1);
    emitVisualEffect(state, {
      type: 'ring',
      x: attacker.x,
      y: attacker.y,
      color: '#fff5bd',
      life: 18,
      maxLife: 18,
      size: attacker.radius + 12 + chargePhase * 12,
      power: 1.2 + chargePhase * 0.45
    });
    emitVisualEffect(state, {
      type: 'burst',
      x: attacker.x,
      y: attacker.y,
      color: '#fff5bd',
      life: 12,
      maxLife: 12,
      size: 14 + chargePhase * 16
    });
    if (distance(attacker, defender) < attacker.radius + defender.radius + 78) {
      pushDefender(attacker, defender, 5.8 + chargePhase * 3.2);
      defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, 12);
      defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, 18);
      emitCombatEvent(state, '충전 반발', defender.x, defender.y - 42, '#fff5bd');
      emitKnockbackLine(state, attacker, defender, '#fff5bd', 1.35 + chargePhase);
    }
    attacker.vx *= 0.52;
    attacker.vy *= 0.52;
  }

  if (attacker.activeSkillAttack === 'westernCaliburnCharge') {
    emitVisualEffect(state, {
      type: 'shockline',
      x: attacker.x,
      y: attacker.y,
      angle: angleTo(attacker, defender),
      color: '#fff0a6',
      life: 12,
      maxLife: 12,
      length: 42,
      width: 2.4
    });
  }

  if (attacker.activeSkillAttack === 'daggerCloneTechnique') {
    emitVisualEffect(state, {
      type: 'afterimage',
      x: attacker.x,
      y: attacker.y,
      color: '#d7b9ff',
      life: 16,
      maxLife: 16,
      size: attacker.radius + 8
    });
  }
}

function emitSkillActiveStartVisual(attacker, defender, state) {
  if (!attacker.activeSkillAttack || !state) return;
  const angle = angleTo(attacker, defender);

  if (attacker.activeSkillAttack === 'westernExcaliburBeam') {
    emitExcaliburBeam(state, attacker, defender);
    emitVisualEffect(state, {
      type: 'projectile',
      x: attacker.x + Math.cos(angle) * (attacker.radius + 24),
      y: attacker.y + Math.sin(angle) * (attacker.radius + 24),
      x2: defender.x,
      y2: defender.y,
      angle,
      color: '#fff5bd',
      life: 16,
      maxLife: 16,
      size: 15,
      length: 46
    });
  }

  if (attacker.activeSkillAttack === 'daggerCloneTechnique') {
    summonDaggerCloneOnce(attacker, defender, state);
  }

  if (attacker.activeSkillAttack === 'westernCaliburnCharge') {
    emitVisualEffect(state, {
      type: 'shockline',
      x: attacker.x,
      y: attacker.y,
      angle,
      color: '#fff0a6',
      life: 22,
      maxLife: 22,
      length: 132,
      width: 5.2
    });
  }

  if (attacker.activeSkillAttack === 'spearPierce') {
    emitVisualEffect(state, {
      type: 'shockline',
      x: attacker.x,
      y: attacker.y,
      angle,
      color: '#d7b9ff',
      life: 20,
      maxLife: 20,
      length: 150,
      width: 5.8
    });
  }

  if (attacker.activeSkillAttack === 'spearLuBu') {
    for (let i = 0; i < 7; i += 1) {
      const sideOffset = (i - 3) * 4.2;
      const jabAngle = angle + (i - 3) * 0.018;
      const side = jabAngle + Math.PI / 2;
      emitVisualEffect(state, {
        type: 'shockline',
        x: attacker.x + Math.cos(side) * sideOffset,
        y: attacker.y + Math.sin(side) * sideOffset,
        angle: jabAngle,
        color: '#cda2ff',
        life: 12 + i,
        maxLife: 12 + i,
        length: 150 + i * 7,
        width: 3.1 + i * 0.18
      });
    }
    emitCombatEvent(state, '초고속 연속 찌르기', attacker.x, attacker.y - 52, '#cda2ff');
  }
}

function emitExcaliburBeam(state, attacker, defender) {
  const angle = angleTo(attacker, defender);
  const startX = attacker.x + Math.cos(angle) * attacker.radius;
  const startY = attacker.y + Math.sin(angle) * attacker.radius;
  const endX = startX + Math.cos(angle) * 240;
  const endY = startY + Math.sin(angle) * 240;
  emitVisualEffect(state, {
    type: 'beam',
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
    color: '#fff5bd',
    life: 26,
    maxLife: 26,
    width: 12
  });
  emitVisualEffect(state, {
    type: 'ring',
    x: attacker.x,
    y: attacker.y,
    color: '#fff5bd',
    life: 24,
    maxLife: 24,
    size: attacker.radius + 18,
    power: 1.4
  });
  addScreenShake(state, 7);
}


function getSkillWindupLabel(skillId) {
  if (skillId === 'westernCaliburnCharge') return '돌격자세 준비';
  if (skillId === 'westernExcaliburBeam') return '승리의 검 충전';
  if (skillId === 'easternAnnihilation') return '섬멸 준비';
  if (skillId === 'spearPierce') return '꿰뚫어라 준비';
  if (skillId === 'spearLuBu') return '여포강림 준비';
  if (skillId === 'daggerAssassinate') return '암살 준비';
  if (skillId === 'daggerCloneTechnique') return '분신술 준비';
  if (skillId === 'westernBash') return '베쉬 준비';
  if (skillId === 'daggerVitalStrike') return '급소 찌르기 준비';
  if (skillId === 'easternIaiSlash') return '발도술 준비';
  if (skillId === 'spearSweep') return '창 휘두르기 준비';
  return '';
}

function getSkillActiveLabel(skillId) {
  if (skillId === 'westernCaliburnCharge') return '돌격자세!';
  if (skillId === 'westernExcaliburBeam') return '승리의 검!';
  if (skillId === 'easternAnnihilation') return '섬멸!';
  if (skillId === 'spearPierce') return '꿰뚫어라!';
  if (skillId === 'spearLuBu') return '여포강림!';
  if (skillId === 'daggerAssassinate') return '암살!';
  if (skillId === 'daggerCloneTechnique') return '분신술!';
  if (skillId === 'westernBash') return '베쉬!';
  if (skillId === 'daggerVitalStrike') return '급소 찌르기!';
  if (skillId === 'easternIaiSlash') return '발도술!';
  if (skillId === 'spearDoubleThrust') return '연속 찌르기!';
  if (skillId === 'spearSweep') return '벤다!';
  return '';
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


function getAttackRecoveryDuration(attacker, weapon) {
  const outcome = attacker.attackResolved ? (attacker.attackOutcome || 'resolved') : 'miss';
  let scale = 1;
  let extra = 0;

  if (outcome === 'hit') {
    scale = weapon.hitRecoveryScale || 1;
  } else if (outcome === 'parried') {
    scale = Math.max(weapon.failRecoveryScale || 1.1, weapon.parryRecoveryPenalty || 1);
    extra = Math.round((POSTURE_RULES.parryRecoveryAddFrames || 0) * 0.45);
  } else if (outcome === 'evaded' || outcome === 'miss') {
    scale = weapon.failRecoveryScale || 1;
    extra = weapon.missRecoveryAdd || 0;
  }

  return Math.max(4, Math.round(weapon.recovery * scale + extra));
}

function getRecoveryCooldown(attacker, weapon) {
  let cooldown = Math.max(8, Math.round(weapon.cooldown * (attacker.cooldownScale || 1)));
  if (weapon.id === 'eastern' && attacker.comboTimer > 0 && (attacker.comboCount || 0) <= (POSTURE_RULES.easternComboMax || 2)) {
    const stageFlowScale = Math.max(0.86, 1 - (attacker.easternFlowBonus || 0));
    cooldown = Math.max(9, Math.round(cooldown * (weapon.comboCooldownScale || 0.58) * stageFlowScale));
  }
  if (attacker.riposteTimer > 0 && (weapon.riposteOnParry || false)) {
    cooldown = Math.max(4, Math.round(cooldown * (weapon.riposteCooldownScale || 0.55)));
  }
  return cooldown;
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

  if (attacker.activeSkillAttack === 'westernCaliburnCharge') {
    baseForward *= 5.35;
    baseSide *= 0.12;
  } else if (attacker.activeSkillAttack === 'westernExcaliburBeam') {
    baseForward *= 1.2;
    baseSide *= 0.05;
  } else if (attacker.activeSkillAttack === 'easternAnnihilation') {
    baseForward *= 6.1;
    baseSide *= 0.08;
  } else if (attacker.activeSkillAttack === 'spearPierce') {
    baseForward *= 6.15;
    baseSide *= 0.08;
  } else if (attacker.activeSkillAttack === 'spearLuBu') {
    baseForward *= 1.18;
    baseSide *= 0.05;
  } else if (attacker.activeSkillAttack === 'daggerAssassinate') {
    baseForward *= 4.9;
    baseSide *= 1.22;
  } else if (attacker.activeSkillAttack === 'daggerCloneTechnique') {
    baseForward *= 0.7;
    baseSide *= 0.2;
  } else if (attacker.activeSkillAttack === 'spearDoubleThrust') {
    baseForward *= 5.4;
    baseSide *= 0.12;
  } else if (attacker.activeSkillAttack === 'easternIaiSlash') {
    baseForward *= 5.35;
    baseSide *= 0.1;
  } else if (attacker.activeSkillAttack === 'spearSweep') {
    baseForward *= 1.9;
    baseSide *= 1.6;
  } else if (attacker.activeSkillAttack === 'westernBash') {
    baseForward *= 3.08;
    baseSide *= 0.46;
  } else if (weapon.id === 'spear') {
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

  const maxBurst = ['easternAnnihilation', 'spearPierce', 'westernCaliburnCharge'].includes(attacker.activeSkillAttack)
    ? 9.2
    : attacker.activeSkillAttack === 'spearLuBu'
      ? 5.4
      : attacker.activeSkillAttack === 'daggerAssassinate'
        ? 8.6
        : attacker.activeSkillAttack === 'spearDoubleThrust'
        ? 8.4
        : attacker.activeSkillAttack === 'easternIaiSlash'
          ? 8.2
          : attacker.activeSkillAttack === 'spearSweep'
          ? 6.6
          : weapon.id === 'spear' ? 7.4 : weapon.id === 'dagger' ? 7.0 : weapon.id === 'eastern' ? 6.6 : 5.9;
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


function chooseAttackSkill(attacker, defender) {
  if (attacker.weaponId === 'western') {
    if (hasReadySkill(attacker, 'westernExcaliburBeam')) {
      useSkill(attacker, 'westernExcaliburBeam');
      attacker.lastAction = '승리의 검 충전';
      return 'westernExcaliburBeam';
    }
    if (hasReadySkill(attacker, 'westernCaliburnCharge')) {
      useSkill(attacker, 'westernCaliburnCharge');
      attacker.lastAction = '돌격자세 준비';
      return 'westernCaliburnCharge';
    }
    if (hasReadySkill(attacker, 'westernBash')) {
      useSkill(attacker, 'westernBash');
      attacker.lastAction = '베쉬 준비';
      return 'westernBash';
    }
  }

  if (attacker.weaponId === 'eastern') {
    if (hasReadySkill(attacker, 'easternAnnihilation')) {
      useSkill(attacker, 'easternAnnihilation');
      attacker.lastAction = '섬멸 준비';
      return 'easternAnnihilation';
    }
    if (hasReadySkill(attacker, 'easternIaiSlash')) {
      useSkill(attacker, 'easternIaiSlash');
      attacker.lastAction = '발도술 준비';
      return 'easternIaiSlash';
    }
  }

  if (attacker.weaponId === 'spear') {
    if (hasReadySkill(attacker, 'spearLuBu')) {
      useSkill(attacker, 'spearLuBu');
      attacker.lastAction = '여포강림 준비';
      return 'spearLuBu';
    }
    if (hasReadySkill(attacker, 'spearPierce')) {
      useSkill(attacker, 'spearPierce');
      attacker.lastAction = '꿰뚫어라 준비';
      return 'spearPierce';
    }
  }

  if (attacker.weaponId === 'dagger') {
    if (hasReadySkill(attacker, 'daggerCloneTechnique')) {
      useSkill(attacker, 'daggerCloneTechnique');
      attacker.lastAction = '분신술 준비';
      return 'daggerCloneTechnique';
    }
    if (hasReadySkill(attacker, 'daggerAssassinate') && hasDaggerVitalStrikeAngle(attacker, defender)) {
      useSkill(attacker, 'daggerAssassinate');
      attacker.lastAction = '암살 준비';
      return 'daggerAssassinate';
    }
    if (hasReadySkill(attacker, 'daggerVitalStrike') && hasDaggerVitalStrikeAngle(attacker, defender)) {
      useSkill(attacker, 'daggerVitalStrike');
      attacker.lastAction = '급소 찌르기 준비';
      return 'daggerVitalStrike';
    }
  }

  return '';
}

function getSkillArcBonus(attacker) {
  if (attacker.activeSkillAttack === 'westernBash') return 0.18 + getUnitSkillLevel(attacker, 'westernBash') * 0.03;
  return 0;
}

function getSkillDamageBonus(attacker, defender, skillId) {
  if (skillId === 'westernExcaliburBeam') return 1.62;
  if (skillId === 'westernCaliburnCharge') return 1.28;
  if (skillId === 'easternAnnihilation') return 1.24;
  if (skillId === 'spearPierce') return 1.34;
  if (skillId === 'spearLuBu') return 1.12;
  if (skillId === 'daggerAssassinate') return 1.05;
  if (skillId === 'daggerCloneTechnique') return 0.12;
  if (skillId === 'westernBash') return 1.06 + getUnitSkillLevel(attacker, skillId) * 0.02;
  if (skillId === 'easternIaiSlash') return 1.04 + getUnitSkillLevel(attacker, skillId) * 0.02;
  if (skillId === 'daggerVitalStrike') return 1.0 + getUnitSkillLevel(attacker, skillId) * 0.025;
  if (skillId === 'spearDoubleThrust') return 0.42 + getUnitSkillLevel(attacker, skillId) * 0.04;
  if (skillId === 'spearSweep') return 0.28 + getUnitSkillLevel(attacker, skillId) * 0.035;
  return 1;
}

function getSkillPostureDamageScale(attacker, skillId) {
  if (skillId === 'westernExcaliburBeam') return 1.42;
  if (skillId === 'westernCaliburnCharge') return 1.36;
  if (skillId === 'easternAnnihilation') return 1.24;
  if (skillId === 'spearPierce') return 1.48;
  if (skillId === 'spearLuBu') return 1.36;
  if (skillId === 'daggerAssassinate') return 1.0;
  if (skillId === 'daggerCloneTechnique') return 0.18;
  if (skillId === 'westernBash') return 1.06 + getUnitSkillLevel(attacker, skillId) * 0.02;
  if (skillId === 'easternIaiSlash') return 1.1 + getUnitSkillLevel(attacker, skillId) * 0.025;
  if (skillId === 'daggerVitalStrike') return 0.94;
  if (skillId === 'spearDoubleThrust') return 0.56 + getUnitSkillLevel(attacker, skillId) * 0.04;
  if (skillId === 'spearSweep') return 0.72 + getUnitSkillLevel(attacker, skillId) * 0.045;
  return 1;
}

function applyOffensiveSkillFollowUp(attacker, defender, weapon, skillId, hitQuality, state) {
  if (defender.isDead || defender.hp <= 0) return;

  if (weapon.id === 'spear' && hasReadySkill(attacker, 'spearDoubleThrust')) {
    const level = getUnitSkillLevel(attacker, 'spearDoubleThrust');
    useSkill(attacker, 'spearDoubleThrust');
    attacker.skillRuntime.pendingSpearDoubleThrust = {
      timer: 5,
      level,
      targetSide: defender.side
    };
    attacker.lastAction = '연속 찌르기 준비';
    emitCombatEvent(state, '연속 찌르기!', attacker.x, attacker.y - 46, '#9fe8ff');
  }

  if (weapon.id === 'eastern' && skillId !== 'easternIaiSlash' && hasReadySkill(attacker, 'easternComboSlash')) {
    const level = getUnitSkillLevel(attacker, 'easternComboSlash');
    useSkill(attacker, 'easternComboSlash');
    const extra = Math.max(1, weapon.damage * attacker.attackScale * (0.06 + level * 0.012) * (1 - getEffectiveDefense(defender)));
    defender.hp = clamp(defender.hp - extra, 0, defender.maxHp);
    attacker.damageDealt += extra;
    attacker.hits += 1;
    attacker.comboTimer = Math.max(attacker.comboTimer || 0, 20 + level * 4);
    attacker.lastAction = '연속베기';
    emitCombatEvent(state, '연속베기', defender.x, defender.y - 42, '#ffe28a');
  }

  if (defender.hp <= 0) {
    defender.isDead = true;
    defender.lastAction = '전투 불능';
  }
}

function applyIncomingSkillMitigation(defender, attacker, damage, state) {
  let finalDamage = damage;

  if (defender.skillRuntime?.reactiveGuardMitigation) {
    finalDamage *= defender.skillRuntime.reactiveGuardMitigation;
    defender.skillRuntime.reactiveGuardMitigation = 0;
  }
  if (CHARGE_GUARD_SKILLS.has(defender.activeSkillAttack) && defender.attackState === 'windup') {
    finalDamage *= 0.8;
    defender.lastAction = '집중 방어';
  }

  if (hasReadySkill(defender, 'westernLastStand') && finalDamage >= defender.hp) {
    const level = getUnitSkillLevel(defender, 'westernLastStand');
    useSkill(defender, 'westernLastStand', 99999);
    defender.hp = Math.max(defender.hp, Math.round(defender.maxHp * (0.06 + level * 0.025)));
    finalDamage *= 0.62;
    defender.lastAction = '기사회생';
    emitCombatEvent(state, '기사회생', defender.x, defender.y - 46, '#ffe28a');
  }

  if (hasReadySkill(defender, 'daggerDecoyDoll') && (finalDamage > defender.maxHp * 0.12 || finalDamage >= defender.hp * 0.55)) {
    const level = getUnitSkillLevel(defender, 'daggerDecoyDoll');
    const isDefensiveDagger = defender.weaponId === 'dagger' && defender.personalityId === 'defensive';
    useSkill(defender, 'daggerDecoyDoll', isDefensiveDagger ? (SKILLS.daggerDecoyDoll.cooldown || 980) * 1.22 : null);
    finalDamage *= isDefensiveDagger
      ? Math.max(0.64, 0.8 - level * 0.04)
      : Math.max(0.52, 0.7 - level * 0.055);
    teleportNearRear(defender, attacker, isDefensiveDagger ? 32 + level * 2 : 38 + level * 4);
    defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, isDefensiveDagger ? 16 : 12);
    defender.posture = Math.min(defender.maxPosture, defender.posture + defender.maxPosture * (isDefensiveDagger ? 0.035 + level * 0.01 : 0.06 + level * 0.015));
    defender.lastAction = '분신 인형';
    emitVisualEffect(state, {
      type: 'afterimage',
      x: attacker.x,
      y: attacker.y,
      color: '#d7b9ff',
      life: 24,
      maxLife: 24,
      size: attacker.radius + 4
    });
    emitVisualEffect(state, {
      type: 'ring',
      x: defender.x,
      y: defender.y,
      color: '#d7b9ff',
      life: 18,
      maxLife: 18,
      size: defender.radius + 10,
      power: 1.1
    });
    emitCombatEvent(state, '분신 인형!', defender.x, defender.y - 46, '#d7b9ff');
  }

  if (hasReadySkill(defender, 'easternBambooStance')) {
    const level = getUnitSkillLevel(defender, 'easternBambooStance');
    if (Math.random() < 0.22 + level * 0.04) {
      useSkill(defender, 'easternBambooStance');
      finalDamage *= Math.max(0.62, 0.82 - level * 0.05);
      const a = angleTo(attacker, defender) + Math.PI / 2 * (defender.orbitDir || 1);
      defender.vx += Math.cos(a) * (1.2 + level * 0.18);
      defender.vy += Math.sin(a) * (1.2 + level * 0.18);
      defender.lastAction = '대나무의 자세';
      emitCombatEvent(state, '흘림', defender.x, defender.y - 42, '#b5ffcf');
    }
  }

  return finalDamage;
}


function triggerSpearSweepCounter(defender, attacker, state, level) {
  useSkill(defender, 'spearSweep');
  defender.facing = angleTo(defender, attacker);
  defender.activeSkillAttack = 'spearSweep';
  defender.attackState = 'active';
  defender.attackTimer = getActiveFrames(defender) + 3;
  defender.attackWindupMax = 1;
  defender.attackActiveMax = defender.attackTimer;
  defender.attackRecoveryMax = Math.max(8, Math.round(WEAPONS.spear.recovery * 0.92));
  defender.attackResolved = false;
  defender.attackOutcome = '';
  defender.attackAim = angleTo(defender, attacker);
  defender.attackVisualPhase = 0;
  defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, 14);
  defender.skillRuntime.reactiveGuardMitigation = Math.max(0.84, 0.94 - level * 0.025);

  const a = angleTo(defender, attacker);
  const push = 2.6 + level * 0.34;
  attacker.vx += Math.cos(a) * push;
  attacker.vy += Math.sin(a) * push;
  attacker.postureRecoveryDelay = Math.max(attacker.postureRecoveryDelay || 0, 8 + level * 2);
  defender.lastAction = '벤다!';
  emitVisualEffect(state, {
    type: 'arc',
    x: defender.x,
    y: defender.y,
    angle: defender.facing,
    color: '#9fe8ff',
    life: 28,
    maxLife: 28,
    radius: WEAPONS.spear.range * 0.86,
    arc: 1.95,
    width: 7
  });
  addScreenShake(state, 3);
  emitCombatEvent(state, '벤다!', defender.x, defender.y - 48, '#9fe8ff');
}

function resolveReactiveGuard(defender, attacker, state) {
  const sideOrBack = isFlankOrBack(attacker, defender);
  if (!sideOrBack) return false;

  if (defender.weaponId === 'spear' && defender.attackState === 'idle' && hasReadySkill(defender, 'spearSweep')) {
    const sweepLevel = getUnitSkillLevel(defender, 'spearSweep');
    const sweepChance = 0.12 + sweepLevel * 0.045;
    if (Math.random() < sweepChance) {
      triggerSpearSweepCounter(defender, attacker, state, sweepLevel);
      return true;
    }
  }

  const skillId = defender.weaponId === 'western'
    ? 'westernKnightInstinct'
    : '';

  if (!skillId || !hasReadySkill(defender, skillId)) return false;

  const level = getUnitSkillLevel(defender, skillId);
  if (Math.random() > 0.08 + level * 0.025) return false;

  useSkill(defender, skillId, (SKILLS[skillId]?.cooldown || 560) * 1.25);
  defender.facing = angleTo(defender, attacker);
  defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, 6);
  defender.skillRuntime.reactiveGuardMitigation = skillId === 'spearFocus' ? Math.max(0.88, 0.98 - level * 0.025) : Math.max(0.9, 0.98 - level * 0.025);
  const push = skillId === 'spearFocus' ? 0.65 + level * 0.12 : 0.55 + level * 0.1;
  const a = angleTo(defender, attacker);
  attacker.vx += Math.cos(a) * push;
  attacker.vy += Math.sin(a) * push;
  attacker.postureRecoveryDelay = Math.max(attacker.postureRecoveryDelay || 0, 5 + level);
  defender.lastAction = SKILLS[skillId].name;
  emitCombatEvent(state, SKILLS[skillId].name, defender.x, defender.y - 44, '#9fe8ff');
  return true;
}

function triggerPostureSkill(unit, enemy, state) {
  const spearFocusThreshold = unit.personalityId === 'defensive' ? 0.27 : 0.35;
  if (unit.weaponId === 'spear' && unit.posture / unit.maxPosture < spearFocusThreshold && hasReadySkill(unit, 'spearFocus')) {
    const level = getUnitSkillLevel(unit, 'spearFocus');
    const isDefensiveSpear = unit.personalityId === 'defensive';
    useSkill(unit, 'spearFocus', isDefensiveSpear ? (SKILLS.spearFocus.cooldown || 780) * 1.18 : null);
    unit.posture = Math.min(unit.maxPosture, unit.posture + unit.maxPosture * (isDefensiveSpear ? 0.12 + level * 0.025 : 0.18 + level * 0.035));
    unit.postureRecoveryDelay = Math.max(0, unit.postureRecoveryDelay - (isDefensiveSpear ? 9 + level * 2 : 14 + level * 3));
    unit.skillRuntime.spearFocusTimer = isDefensiveSpear ? 46 + level * 10 : 72 + level * 14;
    unit.facing = angleTo(unit, enemy);
    unit.cooldownTimer = Math.max(0, unit.cooldownTimer - (isDefensiveSpear ? 3 + level : 6 + level * 2));
    unit.lastAction = '집중';
    emitCombatEvent(state, '집중', unit.x, unit.y - 44, '#9fe8ff');
  }

  if (unit.posture / unit.maxPosture < 0.18 && hasReadySkill(unit, 'easternMindFocus')) {
    const level = getUnitSkillLevel(unit, 'easternMindFocus');
    useSkill(unit, 'easternMindFocus');
    unit.posture = Math.min(unit.maxPosture, unit.posture + unit.maxPosture * (0.16 + level * 0.04));
    unit.postureRecoveryDelay = Math.max(0, unit.postureRecoveryDelay - 12);
    unit.lastAction = '정신합일';
    emitCombatEvent(state, '정신합일', unit.x, unit.y - 42, '#ffe28a');
  }

  if (unit.posture / unit.maxPosture < 0.16 && hasReadySkill(unit, 'balancedCentering')) {
    const level = getUnitSkillLevel(unit, 'balancedCentering');
    useSkill(unit, 'balancedCentering');
    unit.posture = Math.min(unit.maxPosture, unit.posture + unit.maxPosture * (0.14 + level * 0.035));
    unit.lastAction = '중심잡기';
    emitCombatEvent(state, '중심잡기', unit.x, unit.y - 42, '#ffffff');
  }

  if (unit.posture / unit.maxPosture < 0.16 && hasReadySkill(unit, 'assassinShadowMove')) {
    const level = getUnitSkillLevel(unit, 'assassinShadowMove');
    useSkill(unit, 'assassinShadowMove');
    const away = angleTo(enemy, unit);
    unit.vx += Math.cos(away) * (3.4 + level * 0.45);
    unit.vy += Math.sin(away) * (3.4 + level * 0.45);
    unit.posture = Math.min(unit.maxPosture, unit.posture + unit.maxPosture * (0.1 + level * 0.03));
    unit.lastAction = '그림자이동';
    emitCombatEvent(state, '그림자이동', unit.x, unit.y - 42, '#d7b9ff');
  }

  if (unit.weaponId === 'dagger' && hasReadySkill(unit, 'daggerHighSpeed') && unit.skillRuntime?.highSpeedTimer <= 0) {
    const distToEnemy = distance(unit, enemy);
    if (distToEnemy < 128 && (unit.lastAction.includes('측') || unit.lastAction.includes('후') || enemy.attackState !== 'idle')) {
      const level = getUnitSkillLevel(unit, 'daggerHighSpeed');
      useSkill(unit, 'daggerHighSpeed');
      unit.skillRuntime.highSpeedTimer = 48 + level * 10;
      unit.lastAction = '고속이동';
      emitCombatEvent(state, '고속이동', unit.x, unit.y - 42, '#d7b9ff');
    }
  }

}

function applyReflectDamage(defender, attacker, damage, state) {
  if (!hasReadySkill(defender, 'defensiveReflect') || damage <= 0) return;
  if (damage < defender.maxHp * 0.08) return;
  const level = getUnitSkillLevel(defender, 'defensiveReflect');
  useSkill(defender, 'defensiveReflect', 1800);
  const reflected = Math.max(1, damage * (0.035 + level * 0.014));
  attacker.hp = clamp(attacker.hp - reflected, 0, attacker.maxHp);
  defender.lastAction = '피해반사';
  emitCombatEvent(state, '피해반사', attacker.x, attacker.y - 44, '#aee6ff');
  if (attacker.hp <= 0) attacker.isDead = true;
}

function hasSkill(unit, skillId) {
  return !!unit.skills?.includes(skillId);
}

function getUnitSkillLevel(unit, skillId) {
  return unit.skillLevels?.[skillId] || (hasSkill(unit, skillId) ? 1 : 0);
}

function hasReadySkill(unit, skillId) {
  if (!hasSkill(unit, skillId)) return false;
  if ((unit.skillCooldowns?.[skillId] || 0) > 0) return false;
  if (isWeaponAttackSkill(skillId) && (unit.weaponSkillChainLockTimer || 0) > 0) return false;
  return true;
}

function useSkill(unit, skillId, overrideCooldown = null) {
  if (!unit.skillCooldowns) unit.skillCooldowns = {};
  if (!unit.skillRuntime) unit.skillRuntime = {};
  const level = getUnitSkillLevel(unit, skillId);
  const skill = SKILLS[skillId];
  const baseCooldown = overrideCooldown ?? (skill?.cooldown || 300);
  const cooldownScale = Math.max(0.64, 1 - (level - 1) * 0.11);
  unit.skillCooldowns[skillId] = Math.round(baseCooldown * cooldownScale);

  if (isWeaponAttackSkill(skillId)) {
    unit.weaponSkillChainLockTimer = Math.max(unit.weaponSkillChainLockTimer || 0, WEAPON_SKILL_CHAIN_LOCK_FRAMES);
  }
}


function hasDaggerVitalStrikeAngle(attacker, defender) {
  const attackerFromDefender = angleTo(defender, attacker);
  const sideGap = Math.min(
    Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender)),
    Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender))
  );
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const clearSideOrBack = sideGap < 1.24 || backGap < 0.98;
  if (clearSideOrBack) return true;
  return attacker.lastAction.includes('측') || attacker.lastAction.includes('후');
}

function isFlankOrBack(attacker, defender) {
  const attackerFromDefender = angleTo(defender, attacker);
  const sideGap = Math.min(
    Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender)),
    Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender))
  );
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  return sideGap < 1.02 || backGap < 0.78;
}

function teleportNearRear(unit, enemy, radius = 38) {
  const side = unit.orbitDir || 1;
  const angle = enemy.facing + Math.PI + side * 0.32;
  unit.x = enemy.x + Math.cos(angle) * radius;
  unit.y = enemy.y + Math.sin(angle) * radius;
  unit.facing = angleTo(unit, enemy);
  unit.vx = 0;
  unit.vy = 0;
}

function resolveSummonHitByAttack(attacker, state, weapon) {
  if (!state?.summons?.length || !weapon) return false;

  const skillAttack = attacker.activeSkillAttack || '';
  const hitArc = getHitArc(attacker, weapon) + getSkillArcBonus(attacker);
  const reachBonus = getReachBonus(attacker, weapon);
  let hitAny = false;

  state.summons = state.summons
    .map((clone) => {
      if (!clone || clone.ownerSide === attacker.side || clone.hp <= 0 || clone.life <= 0) return clone;

      const dist = distance(attacker, clone);
      const targetAngle = angleTo(attacker, clone);
      const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
      if (dist > getHitReach(attacker, clone, weapon) + reachBonus) return clone;
      if (dist < (weapon.minRange || 0)) return clone;
      if (angleGap > hitArc) return clone;

      const forcedCrit = FORCED_CRIT_SKILLS.has(skillAttack);
      const crit = forcedCrit || Math.random() < (attacker.crit || 0);
      const skillDamageBonus = getSkillDamageBonus(attacker, clone, skillAttack);
      const rawDamage = weapon.damage * (attacker.attackScale || 1) * skillDamageBonus * (crit ? (attacker.critDamage || 1.5) : 1);
      const cloneDefense = clamp(clone.defense || 0.08, 0, 0.6);
      const damage = Math.max(1, rawDamage * (1 - cloneDefense));
      const nextHp = clamp((clone.hp || 0) - damage, 0, clone.maxHp || clone.hp || 1);

      hitAny = true;
      attacker.attackOutcome = 'hit';
      attacker.hits += 1;
      attacker.damageDealt += damage;
      attacker.lastAction = crit ? '분신 치명타' : '분신 적중';
      emitHitSpark(state, attacker, clone, weapon, crit, skillAttack || 'summonHit');
      emitCombatEvent(state, crit ? '분신 치명타' : '분신 피격', clone.x, clone.y - 34, crit ? '#ffd45a' : '#d7b9ff');
      emitVisualEffect(state, {
        type: 'ring',
        x: clone.x,
        y: clone.y,
        color: '#d7b9ff',
        life: 12,
        maxLife: 12,
        size: clone.radius + 7,
        power: 0.9
      });

      const nextClone = {
        ...clone,
        hp: nextHp,
        hitFlashTimer: 10
      };

      if (nextHp <= 0) {
        nextClone.life = 0;
        emitCombatEvent(state, '분신 파괴', clone.x, clone.y - 42, '#d7b9ff');
        emitVisualEffect(state, {
          type: 'burst',
          x: clone.x,
          y: clone.y,
          color: '#d7b9ff',
          life: 22,
          maxLife: 22,
          size: clone.radius + 18
        });
      }

      return nextClone;
    })
    .filter((clone) => clone.life > 0);

  return hitAny;
}


function resolveAttack(attacker, defender, state) {
  if (defender.isDead) return true;

  const weapon = WEAPONS[attacker.weaponId];
  const summonHit = resolveSummonHitByAttack(attacker, state, weapon);
  const dist = distance(attacker, defender);
  const targetAngle = angleTo(attacker, defender);
  const angleGap = Math.abs(angleDiff(attacker.facing, targetAngle));
  const daggerMirror = attacker.weaponId === 'dagger' && defender.weaponId === 'dagger';
  const hitArc = daggerMirror ? 1.22 : getHitArc(attacker, weapon);
  const reachBonus = getReachBonus(attacker, weapon);
  const hitQuality = getHitQuality(attacker, defender, weapon, dist, angleGap, hitArc);

  if (dist > getHitReach(attacker, defender, weapon) + reachBonus) return summonHit;
  if (dist < weapon.minRange) return summonHit;
  if (angleGap > hitArc + getSkillArcBonus(attacker)) return summonHit;

  resolveReactiveGuard(defender, attacker, state);

  if (resolveEasternGlancingSlip(defender, attacker, weapon, hitQuality, state)) {
    attacker.attackOutcome = 'glanced';
    return true;
  }

  if (resolveParry(defender, attacker, weapon, state)) {
    attacker.attackOutcome = 'parried';
    return true;
  }

  const evaded = defender.staggerTimer <= 0 && Math.random() < defender.evasion;
  if (evaded) {
    attacker.attackOutcome = 'evaded';
    defender.lastAction = '회피';
    return true;
  }

  const positionalBonus = getPositionalBonus(attacker, defender);
  const skillAttack = attacker.activeSkillAttack || '';
  const forcedCrit = FORCED_CRIT_SKILLS.has(skillAttack);
  const crit = forcedCrit || Math.random() < attacker.crit;
  const personality = PERSONALITIES[attacker.personalityId];
  const aggressionBonus = 1 + personality.aggression * 0.08;
  const lowHpAttackBonus = attacker.hp / attacker.maxHp < 0.35 ? 1 + (attacker.lowHpAttackBonus || 0) : 1;
  const staggerDamageBonus = defender.staggerTimer > 0 ? POSTURE_RULES.staggerDamageTakenBonus : 1;
  const counterBonus = attacker.counterTimer > 0 ? POSTURE_RULES.counterDamageBonus : 1;
  const comboDamageBonus = attacker.weaponId === 'eastern' && attacker.comboTimer > 0 ? 1.06 : 1;
  const skillDamageBonus = getSkillDamageBonus(attacker, defender, skillAttack);
  const matchupDamageScale = getMatchupDamageScale(attacker, defender, weapon);
  const rawDamage = weapon.damage * attacker.attackScale * positionalBonus * aggressionBonus * lowHpAttackBonus * staggerDamageBonus * counterBonus * comboDamageBonus * skillDamageBonus * matchupDamageScale * (crit ? attacker.critDamage : 1);
  const effectiveDefense = getEffectiveDefense(defender);
  let damage = Math.max(2, rawDamage * (1 - effectiveDefense));
  damage = applyIncomingSkillMitigation(defender, attacker, damage, state);

  defender.hp = clamp(defender.hp - damage, 0, defender.maxHp);
  attacker.attackOutcome = 'hit';
  attacker.hits += 1;
  attacker.damageDealt += damage;
  attacker.lastAction = crit ? '치명타' : '명중';
  emitHitSpark(state, attacker, defender, weapon, crit, skillAttack);
  if (crit) emitCombatEvent(state, 'CRITICAL', defender.x, defender.y - 34, '#ffd45a');
  defender.lastAction = defender.staggerTimer > 0 ? '흐트러짐 피격' : '피격';

  const postureDamage = getPostureDamage(attacker, defender, weapon, positionalBonus, crit, hitQuality) * getSkillPostureDamageScale(attacker, skillAttack);
  applyPostureDamage(attacker, defender, postureDamage, state);
  if (attacker.weaponId === 'dagger' && (defender.weaponId === 'spear' || defender.weaponId === 'western')) {
    defender.closeResetGraceTimer = Math.max(defender.closeResetGraceTimer || 0, 18);
  }
  applyWeaponHitReaction(attacker, defender, weapon, hitQuality);
  emitKnockbackLine(state, attacker, defender, weapon.color, hitQuality + 0.6);
  applyWeaponIdentityOnHit(attacker, defender, weapon, hitQuality);
  if (skillAttack === 'easternIaiSlash') applyEasternIaiPassThrough(attacker, defender, weapon, state, hitQuality);
  applyEvolutionSkillOnHit(attacker, defender, weapon, skillAttack, state, hitQuality);
  twistBodyOnImpact(defender, attacker, postureDamage, weapon);
  applyImpactStop(attacker, defender, weapon);
  applyReflectDamage(defender, attacker, damage, state);
  applyOffensiveSkillFollowUp(attacker, defender, weapon, skillAttack, hitQuality, state);
  attacker.counterTimer = 0;
  // activeSkillAttack is cleared after recovery so skill visuals do not get stuck or vanish mid-swing.

  if (defender.hp <= 0) {
    defender.isDead = true;
    defender.lastAction = '전투 불능';
  }

  return true;
}



function applyEvolutionSkillOnHit(attacker, defender, weapon, skillId, state, hitQuality = 0) {
  if (!skillId || defender.isDead || defender.hp <= 0) return;

  if (skillId === 'westernCaliburnCharge') {
    pushDefender(attacker, defender, 5.2 + hitQuality * 2.4);
    applyPostureDamage(attacker, defender, weapon.postureDamage * 0.5, state);
    emitVisualEffect(state, {
      type: 'shockline',
      x: defender.x,
      y: defender.y,
      angle: angleTo(attacker, defender),
      color: '#fff0a6',
      life: 20,
      maxLife: 20,
      length: 126,
      width: 5.4
    });
    emitCombatEvent(state, '돌격 찌르기', defender.x, defender.y - 50, '#fff0a6');
  }

  if (skillId === 'westernExcaliburBeam') {
    dealExtraSkillDamage(attacker, defender, weapon, state, '빛의 일격', 0.54, false);
    pushDefender(attacker, defender, 13.6 + hitQuality * 5.4);
    applyPostureDamage(attacker, defender, weapon.postureDamage * 0.85, state);
    emitExcaliburBeam(state, attacker, defender);
    emitVisualEffect(state, {
      type: 'burst',
      x: defender.x,
      y: defender.y,
      color: '#fff5bd',
      life: 20,
      maxLife: 20,
      size: 32
    });
    emitCombatEvent(state, '검기 적중', defender.x, defender.y - 58, '#fff5bd');
  }

  if (skillId === 'easternAnnihilation') {
    startPassStrikeSequence(attacker, defender, weapon, state, {
      hits: 3,
      label: '섬멸',
      scale: 0.3,
      forcedCrit: true,
      color: '#ffe28a',
      sideBias: 0.14,
      distanceOffset: 28,
      interval: 7
    });
  }

  if (skillId === 'spearPierce') {
    pushDefender(attacker, defender, 7.8 + hitQuality * 2.9);
    applyPostureDamage(attacker, defender, weapon.postureDamage * 0.58, state);
    emitVisualEffect(state, {
      type: 'arc',
      x: defender.x,
      y: defender.y,
      angle: angleTo(attacker, defender) + Math.PI / 2,
      color: '#d7b9ff',
      life: 18,
      maxLife: 18,
      radius: 42,
      arc: 1.15,
      width: 5
    });
    emitCombatEvent(state, '관통 후 휘두르기', defender.x, defender.y - 50, '#d7b9ff');
  }

  if (skillId === 'spearLuBu') {
    startSpearLuBuSequence(attacker, defender, weapon, state, hitQuality);
  }

  if (skillId === 'daggerAssassinate') {
    moveToAssassinationAngle(attacker, defender, state);
    startPassStrikeSequence(attacker, defender, weapon, state, {
      hits: 4,
      label: '암살',
      scale: 0.18,
      forcedCrit: true,
      color: '#b8ff8f',
      sideBias: 0.78,
      distanceOffset: 12,
      interval: 6
    });
  }

  if (skillId === 'daggerCloneTechnique') {
    summonDaggerCloneOnce(attacker, defender, state);
  }

  if (defender.hp <= 0) {
    defender.isDead = true;
    defender.lastAction = '전투 불능';
  }
}


function startEvolutionSkillSequence(attacker, defender, state) {
  const skillId = attacker.activeSkillAttack;
  if (!SEQUENCE_SKILLS.has(skillId)) return false;
  const weapon = WEAPONS[attacker.weaponId];

  if (skillId === 'spearLuBu') {
    startSpearLuBuSequence(attacker, defender, weapon, state, 0.75);
  } else if (skillId === 'easternAnnihilation') {
    startPassStrikeSequence(attacker, defender, weapon, state, {
      hits: 4,
      label: '섬멸',
      scale: 0.26,
      forcedCrit: true,
      color: '#ffe28a',
      sideBias: 0.12,
      distanceOffset: 30,
      interval: 7,
      passSpeed: 3.2
    });
  } else if (skillId === 'daggerAssassinate') {
    moveToAssassinationAngle(attacker, defender, state);
    startPassStrikeSequence(attacker, defender, weapon, state, {
      hits: 5,
      label: '암살',
      scale: 0.14,
      forcedCrit: true,
      color: '#b8ff8f',
      sideBias: 0.82,
      distanceOffset: 12,
      interval: 5,
      passSpeed: 3.8
    });
  }
  return true;
}

function processActiveSkillSequence(unit, enemy, state) {
  const sequence = unit.skillRuntime?.activeSequence;
  if (!sequence) return false;

  if (unit.isDead || !enemy || enemy.isDead) {
    finishSkillSequence(unit, enemy, state, true);
    return false;
  }

  unit.attackState = 'skillSequence';
  unit.attackVisualSkill = sequence.skillId;
  unit.activeSkillAttack = sequence.skillId;
  unit.attackAim = angleTo(unit, enemy);
  unit.facing = moveToward(unit.facing, unit.attackAim, 0.42);
  unit.vx *= 0.62;
  unit.vy *= 0.62;
  unit.attackVisualPhase = sequence.totalHits ? clamp(sequence.hitIndex / sequence.totalHits, 0, 1) : 0;
  unit.lastAction = sequence.label;

  sequence.timer -= 1;
  if (sequence.timer > 0) return true;

  if (sequence.kind === 'passStrikes') {
    performPassStrikeStep(unit, enemy, state, sequence);
  } else if (sequence.kind === 'spearRapidThrusts') {
    performSpearRapidThrustStep(unit, enemy, state, sequence);
  }

  if (enemy.hp <= 0) {
    enemy.isDead = true;
    enemy.lastAction = '전투 불능';
  }

  if (sequence.hitIndex >= sequence.totalHits || enemy.isDead) {
    finishSkillSequence(unit, enemy, state);
    return true;
  }

  sequence.timer = sequence.interval;
  return true;
}

function finishSkillSequence(unit, enemy, state, cancelled = false) {
  const weapon = WEAPONS[unit.weaponId];
  const sequence = unit.skillRuntime?.activeSequence;
  if (sequence && !cancelled && sequence.kind === 'spearRapidThrusts' && enemy && !enemy.isDead) {
    pushDefender(unit, enemy, 8.8 + (sequence.hitQuality || 0) * 3.4);
    emitEvolutionLine(state, unit, enemy, '#cda2ff', 156, 6.4);
    addScreenShake(state, 6);
  }
  if (unit.skillRuntime) unit.skillRuntime.activeSequence = null;
  unit.attackState = 'recovery';
  unit.attackTimer = Math.max(8, Math.round((weapon?.recovery || 18) * 0.82));
  unit.attackRecoveryMax = unit.attackTimer;
  unit.attackResolved = true;
  unit.attackOutcome = cancelled ? 'cancelled' : 'hit';
  unit.activeSkillAttack = '';
  unit.attackVisualSkill = '';
  unit.attackVisualPhase = 0;
  unit.cooldownTimer = Math.max(unit.cooldownTimer || 0, 12);
}

function clearAttackSkillVisualState(unit) {
  unit.activeSkillAttack = '';
  unit.attackVisualSkill = '';
  unit.attackSequenceId = 0;
  if (unit.skillRuntime) unit.skillRuntime.activeSequence = null;
}

function startPassStrikeSequence(attacker, defender, weapon, state, options) {
  attacker.skillRuntime ||= {};
  const seq = attacker.skillRuntime.activeSequence;
  if (seq && seq.skillId === attacker.activeSkillAttack) return;
  const skillId = attacker.activeSkillAttack || (weapon.id === 'dagger' ? 'daggerAssassinate' : 'easternAnnihilation');
  attacker.skillRuntime.activeSequence = {
    kind: 'passStrikes',
    skillId,
    label: options?.label || '연속 관통',
    totalHits: options?.hits || 3,
    hitIndex: 0,
    timer: 1,
    interval: options?.interval || 6,
    scale: options?.scale || 0.18,
    forcedCrit: options?.forcedCrit !== false,
    color: options?.color || weapon.color,
    sideBias: options?.sideBias || 0.3,
    distanceOffset: options?.distanceOffset || 16,
    passSpeed: options?.passSpeed || 3.2,
    orbitDir: attacker.orbitDir || 1
  };
  attacker.attackState = 'skillSequence';
  attacker.attackVisualSkill = skillId;
  attacker.activeSkillAttack = skillId;
  attacker.attackResolved = true;
  attacker.lastAction = options?.label || '연속 관통';
  emitCombatEvent(state, attacker.lastAction, attacker.x, attacker.y - 46, options?.color || weapon.color);
}

function performPassStrikeStep(attacker, defender, state, sequence) {
  const weapon = WEAPONS[attacker.weaponId];
  const i = sequence.hitIndex;
  const baseAngle = angleTo(attacker, defender);
  const direction = i % 2 === 0 ? baseAngle : baseAngle + Math.PI;
  const side = direction + Math.PI / 2;
  const passDistance = defender.radius + attacker.radius + sequence.distanceOffset + (weapon.id === 'dagger' ? 18 : 30);
  const sideSign = sequence.orbitDir * (i % 2 === 0 ? 1 : -1);
  const sideOffset = sideSign * sequence.sideBias * (weapon.id === 'dagger' ? 22 : 12);
  const fromX = defender.x - Math.cos(direction) * passDistance + Math.cos(side) * sideOffset;
  const fromY = defender.y - Math.sin(direction) * passDistance + Math.sin(side) * sideOffset;
  const toX = defender.x + Math.cos(direction) * passDistance + Math.cos(side) * sideOffset;
  const toY = defender.y + Math.sin(direction) * passDistance + Math.sin(side) * sideOffset;

  emitVisualEffect(state, {
    type: 'afterimage',
    x: attacker.x,
    y: attacker.y,
    color: sequence.color,
    life: 13,
    maxLife: 13,
    size: attacker.radius + 5
  });
  emitVisualEffect(state, {
    type: 'afterimage',
    x: fromX,
    y: fromY,
    color: sequence.color,
    life: 12,
    maxLife: 12,
    size: attacker.radius + 4
  });

  attacker.x = toX;
  attacker.y = toY;
  attacker.facing = direction;
  attacker.attackAim = direction;
  attacker.vx = Math.cos(direction) * sequence.passSpeed;
  attacker.vy = Math.sin(direction) * sequence.passSpeed;

  emitVisualEffect(state, {
    type: 'trail',
    x1: fromX,
    y1: fromY,
    x2: toX,
    y2: toY,
    color: sequence.color,
    life: weapon.id === 'dagger' ? 18 : 20,
    maxLife: weapon.id === 'dagger' ? 18 : 20,
    width: weapon.id === 'dagger' ? 3.2 : 5.6,
    weaponId: weapon.id,
    skillId: sequence.skillId
  });
  emitVisualEffect(state, {
    type: weapon.id === 'dagger' ? 'impact' : 'shockline',
    x: defender.x,
    y: defender.y,
    angle: direction,
    color: sequence.color,
    life: 14,
    maxLife: 14,
    length: weapon.id === 'dagger' ? 58 : 92,
    width: weapon.id === 'dagger' ? 2.4 : 4.2,
    size: weapon.id === 'dagger' ? 18 : 24,
    shape: weapon.id === 'dagger' ? 'stab' : 'slice'
  });

  dealExtraSkillDamage(attacker, defender, weapon, state, `${sequence.label} ${i + 1}타`, sequence.scale + i * 0.025, sequence.forcedCrit);
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, 8);
  sequence.hitIndex += 1;
}

function startSpearLuBuSequence(attacker, defender, weapon, state, hitQuality = 0) {
  attacker.skillRuntime ||= {};
  if (attacker.skillRuntime.activeSequence?.skillId === 'spearLuBu') return;
  attacker.skillRuntime.activeSequence = {
    kind: 'spearRapidThrusts',
    skillId: 'spearLuBu',
    label: '여포강림',
    totalHits: 8,
    hitIndex: 0,
    timer: 1,
    interval: 4,
    hitQuality,
    color: '#cda2ff'
  };
  attacker.attackState = 'skillSequence';
  attacker.attackVisualSkill = 'spearLuBu';
  attacker.activeSkillAttack = 'spearLuBu';
  attacker.attackResolved = true;
  attacker.lastAction = '여포강림';
  emitCombatEvent(state, '초고속 연속 찌르기', attacker.x, attacker.y - 52, '#cda2ff');
}

function performSpearRapidThrustStep(attacker, defender, state, sequence) {
  const weapon = WEAPONS[attacker.weaponId];
  const i = sequence.hitIndex;
  const angle = angleTo(attacker, defender);
  const side = angle + Math.PI / 2;
  const offset = (i - (sequence.totalHits - 1) / 2) * 3.7;
  const startX = attacker.x + Math.cos(side) * offset + Math.cos(angle) * (attacker.radius + 5);
  const startY = attacker.y + Math.sin(side) * offset + Math.sin(angle) * (attacker.radius + 5);
  const endX = defender.x + Math.cos(side) * offset * 0.45 + Math.cos(angle) * (8 + i * 3);
  const endY = defender.y + Math.sin(side) * offset * 0.45 + Math.sin(angle) * (8 + i * 3);

  attacker.facing = angle;
  attacker.attackAim = angle;
  attacker.vx *= 0.45;
  attacker.vy *= 0.45;

  emitVisualEffect(state, {
    type: 'trail',
    x1: startX,
    y1: startY,
    x2: endX,
    y2: endY,
    color: sequence.color,
    life: 11,
    maxLife: 11,
    width: 3.2,
    weaponId: 'spear',
    skillId: 'spearLuBu'
  });
  emitVisualEffect(state, {
    type: 'shockline',
    x: endX,
    y: endY,
    angle,
    color: sequence.color,
    life: 10,
    maxLife: 10,
    length: 70 + i * 7,
    width: 2.7 + i * 0.15
  });

  dealExtraSkillDamage(attacker, defender, weapon, state, `여포강림 ${i + 1}타`, 0.08 + i * 0.012, i >= sequence.totalHits - 3);
  applyPostureDamage(attacker, defender, weapon.postureDamage * (0.18 + i * 0.012), state);
  sequence.hitIndex += 1;
}

function performSpearRapidThrusts(attacker, defender, weapon, state, hitQuality = 0) {
  const angle = angleTo(attacker, defender);
  const side = angle + Math.PI / 2;
  for (let i = 0; i < 7; i += 1) {
    if (defender.isDead || defender.hp <= 0) break;
    const offset = (i - 3) * 4.2;
    const reachJitter = i * 4;
    emitVisualEffect(state, {
      type: 'trail',
      x1: attacker.x + Math.cos(side) * offset,
      y1: attacker.y + Math.sin(side) * offset,
      x2: defender.x + Math.cos(angle) * (20 + reachJitter) + Math.cos(side) * offset,
      y2: defender.y + Math.sin(angle) * (20 + reachJitter) + Math.sin(side) * offset,
      color: '#cda2ff',
      life: 10 + i,
      maxLife: 10 + i,
      width: 2.8,
      weaponId: 'spear',
      skillId: 'spearLuBu'
    });
    emitVisualEffect(state, {
      type: 'impact',
      x: defender.x + Math.cos(side) * offset * 0.35,
      y: defender.y + Math.sin(side) * offset * 0.35,
      angle,
      color: '#cda2ff',
      life: 12,
      maxLife: 12,
      size: 16 + i,
      shape: 'thrust'
    });
    dealExtraSkillDamage(attacker, defender, weapon, state, `여포강림 ${i + 2}타`, 0.09 + i * 0.018, i >= 4);
  }
}

function performRepeatedPassStrikes(attacker, defender, weapon, state, options) {
  if (defender.isDead || defender.hp <= 0) return;
  const {
    hits = 3,
    label = '연속 관통',
    scale = 0.18,
    forcedCrit = true,
    color = weapon.color,
    sideBias = 0.3,
    distanceOffset = 16
  } = options || {};

  const baseAngle = angleTo(attacker, defender);
  const passDistance = defender.radius + attacker.radius + distanceOffset + (weapon.id === 'dagger' ? 14 : 22);
  const sideSignBase = attacker.orbitDir || 1;

  for (let i = 0; i < hits; i += 1) {
    if (defender.isDead || defender.hp <= 0) break;
    const direction = baseAngle + (i % 2 === 0 ? 0 : Math.PI);
    const sideSign = sideSignBase * (i % 2 === 0 ? 1 : -1);
    const side = direction + Math.PI / 2;
    const sideOffset = sideSign * sideBias * (weapon.id === 'dagger' ? 18 : 10);
    const fromX = defender.x - Math.cos(direction) * passDistance + Math.cos(side) * sideOffset;
    const fromY = defender.y - Math.sin(direction) * passDistance + Math.sin(side) * sideOffset;
    const toX = defender.x + Math.cos(direction) * passDistance + Math.cos(side) * sideOffset;
    const toY = defender.y + Math.sin(direction) * passDistance + Math.sin(side) * sideOffset;

    attacker.x = fromX;
    attacker.y = fromY;
    attacker.facing = direction;

    emitVisualEffect(state, {
      type: 'afterimage',
      x: fromX,
      y: fromY,
      color,
      life: 10 + i,
      maxLife: 10 + i,
      size: attacker.radius + 4
    });

    attacker.x = toX;
    attacker.y = toY;
    attacker.facing = direction;
    attacker.vx += Math.cos(direction) * (2.2 + i * 0.22);
    attacker.vy += Math.sin(direction) * (2.2 + i * 0.22);

    emitVisualEffect(state, {
      type: 'trail',
      x1: fromX,
      y1: fromY,
      x2: toX,
      y2: toY,
      color,
      life: 14 + i * 2,
      maxLife: 14 + i * 2,
      width: weapon.id === 'dagger' ? 3.2 : 5.0,
      weaponId: weapon.id,
      skillId: label
    });
    emitVisualEffect(state, {
      type: weapon.id === 'dagger' ? 'impact' : 'shockline',
      x: defender.x,
      y: defender.y,
      angle: direction,
      color,
      life: 12 + i * 2,
      maxLife: 12 + i * 2,
      length: 72 + i * 10,
      width: weapon.id === 'dagger' ? 2.2 : 4.0,
      size: 17 + i * 2,
      shape: weapon.id === 'dagger' ? 'stab' : 'slice'
    });
    dealExtraSkillDamage(attacker, defender, weapon, state, `${label} ${i + 1}타`, scale + i * 0.025, forcedCrit);
  }
  attacker.lastAction = label;
  addScreenShake(state, weapon.id === 'dagger' ? 4 : 5);
}

function summonDaggerCloneOnce(attacker, defender, state) {
  attacker.skillRuntime ||= {};
  const seq = attacker.attackSequenceId || 0;
  if (attacker.skillRuntime.lastCloneAttackSeq === seq) return;
  attacker.skillRuntime.lastCloneAttackSeq = seq;
  summonDaggerClone(attacker, defender, state);
}

function summonDaggerClone(attacker, defender, state) {
  if (!state.summons) state.summons = [];
  state.summons = state.summons.filter((clone) => clone.ownerSide !== attacker.side);
  const side = attacker.orbitDir || 1;
  const angle = angleTo(defender, attacker) + side * 0.45;
  const clone = {
    id: `clone-${attacker.side}-${state.frame || 0}`,
    ownerSide: attacker.side,
    targetSide: defender.side,
    x: attacker.x - Math.cos(angle) * 24,
    y: attacker.y - Math.sin(angle) * 24,
    vx: 0,
    vy: 0,
    facing: angleTo(attacker, defender),
    radius: Math.max(10, Math.round(attacker.radius * 0.82)),
    maxHp: Math.max(1, Math.round(attacker.maxHp * 0.12)),
    hp: Math.max(1, Math.round(attacker.maxHp * 0.12)),
    defense: 0.08,
    weaponId: 'dagger',
    personalityId: attacker.personalityId,
    life: 520,
    maxLife: 520,
    attackTimer: 18,
    attackInterval: 36,
    moveSpeed: 4.15,
    orbitDir: -side,
    color: '#d7b9ff'
  };
  state.summons.push(clone);
  emitVisualEffect(state, {
    type: 'ring',
    x: clone.x,
    y: clone.y,
    color: '#d7b9ff',
    life: 24,
    maxLife: 24,
    size: clone.radius + 12,
    power: 1.15
  });
  emitVisualEffect(state, {
    type: 'afterimage',
    x: clone.x,
    y: clone.y,
    color: '#d7b9ff',
    life: 30,
    maxLife: 30,
    size: clone.radius + 10
  });
  emitCombatEvent(state, '분신 소환', clone.x, clone.y - 42, '#d7b9ff');
}

function dealExtraSkillDamage(attacker, defender, weapon, state, label, scale, forcedCrit = false) {
  if (defender.isDead || defender.hp <= 0) return 0;
  const critScale = forcedCrit ? attacker.critDamage : 1;
  const damage = Math.max(1, weapon.damage * attacker.attackScale * scale * critScale * (1 - getEffectiveDefense(defender)));
  defender.hp = clamp(defender.hp - damage, 0, defender.maxHp);
  attacker.damageDealt += damage;
  attacker.hits += 1;
  if (forcedCrit) emitCombatEvent(state, 'CRITICAL', defender.x, defender.y - 34, '#ffd45a');
  emitCombatEvent(state, label, defender.x, defender.y - 44, weapon.color);
  emitHitSpark(state, attacker, defender, weapon, forcedCrit, label);
  return damage;
}

function pushDefender(attacker, defender, amount) {
  const a = angleTo(attacker, defender);
  defender.vx += Math.cos(a) * amount;
  defender.vy += Math.sin(a) * amount;
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, 12);
}

function moveToAssassinationAngle(attacker, defender, state) {
  const rearAngle = defender.facing + Math.PI + (attacker.orbitDir || 1) * 0.72;
  const dist = defender.radius + attacker.radius + 14;
  const fromX = attacker.x;
  const fromY = attacker.y;
  attacker.x = defender.x + Math.cos(rearAngle) * dist;
  attacker.y = defender.y + Math.sin(rearAngle) * dist;
  attacker.facing = angleTo(attacker, defender);
  emitVisualEffect(state, {
    type: 'trail',
    x1: fromX,
    y1: fromY,
    x2: attacker.x,
    y2: attacker.y,
    color: '#b8ff8f',
    life: 18,
    maxLife: 18,
    width: 4.2,
    weaponId: 'dagger',
    skillId: 'daggerAssassinate'
  });
}

function emitEvolutionLine(state, attacker, defender, color, length, width) {
  emitVisualEffect(state, {
    type: 'shockline',
    x: defender.x,
    y: defender.y,
    angle: angleTo(attacker, defender),
    color,
    life: 22,
    maxLife: 22,
    length,
    width
  });
}

function applyEasternIaiPassThrough(attacker, defender, weapon, state, hitQuality = 0) {
  const passAngle = attacker.attackAim ?? angleTo(attacker, defender);
  const fromX = attacker.x;
  const fromY = attacker.y;
  const passDistance = defender.radius + attacker.radius + 16 + hitQuality * 8 + (attacker.easternFlowBonus || 0) * 20;

  attacker.x = defender.x + Math.cos(passAngle) * passDistance;
  attacker.y = defender.y + Math.sin(passAngle) * passDistance;
  attacker.vx += Math.cos(passAngle) * (2.6 + hitQuality * 1.15);
  attacker.vy += Math.sin(passAngle) * (2.6 + hitQuality * 1.15);
  attacker.attackTimer = Math.min(attacker.attackTimer || weapon.recovery, Math.max(6, Math.round(weapon.recovery * 0.52)));
  attacker.cooldownTimer = Math.max(attacker.cooldownTimer || 0, 6);
  attacker.lastAction = '발도 관통';

  emitVisualEffect(state, {
    type: 'trail',
    x1: fromX,
    y1: fromY,
    x2: attacker.x,
    y2: attacker.y,
    color: weapon.color,
    life: 18,
    maxLife: 18,
    width: 5.4,
    weaponId: weapon.id,
    skillId: 'easternIaiSlash'
  });
  emitCombatEvent(state, '관통', attacker.x, attacker.y - 38, '#ffe28a');
}


function resolveEasternGlancingSlip(defender, attacker, incomingWeapon, hitQuality, state) {
  if (defender.weaponId !== 'eastern') return false;
  if (incomingWeapon.id !== 'western') return false;
  if (!WEAPONS.eastern.glancingSlipVsHeavy) return false;
  if (defender.staggerTimer > 0 || defender.impactStopTimer > 0) return false;
  if (defender.posture < defender.maxPosture * 0.28) return false;
  if (defender.attackState === 'recovery' && defender.attackTimer > 6) return false;

  const incomingDirection = angleTo(defender, attacker);
  const frontGap = Math.abs(angleDiff(defender.facing, incomingDirection));
  const sideReadable = frontGap < 1.35 || defender.attackState === 'windup' || defender.attackState === 'active';
  if (!sideReadable) return false;

  const baseChance = WEAPONS.eastern.glancingSlipChance || 0.12;
  const postureRatio = clamp(defender.posture / defender.maxPosture, 0, 1);
  const activeBonus = defender.attackState === 'windup' || defender.attackState === 'active' ? 0.035 : 0;
  const qualityPenalty = hitQuality > 0.72 ? 0.035 : 0;
  const chance = clamp(baseChance + defender.stats.agi * 0.004 + postureRatio * 0.035 + activeBonus - qualityPenalty, 0.04, 0.24);

  if (Math.random() > chance) return false;

  const slipSide = defender.orbitDir || 1;
  const sideAngle = incomingDirection + Math.PI / 2 * slipSide;
  defender.vx += Math.cos(sideAngle) * 5.2 - Math.cos(incomingDirection) * 0.8;
  defender.vy += Math.sin(sideAngle) * 5.2 - Math.sin(incomingDirection) * 0.8;
  defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, 8);
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, getPostureRecoveryDelay(defender, 0.28));
  defender.lastAction = '동양검 흘리기';
  attacker.lastAction = '베기 흘려짐';
  emitCombatEvent(state, 'SLIP', defender.x, defender.y - 34, '#ffe18f');
  return true;
}


function applyImpactStop(attacker, defender, weapon) {
  const stop = weapon.impactStopFrames || 3;
  const heavyBonus = weapon.id === 'western' ? 2 : weapon.id === 'spear' ? 1 : 0;
  const critLikeBonus = attacker.lastAction === '치명타' ? 2 : 0;
  attacker.impactStopTimer = Math.max(attacker.impactStopTimer || 0, Math.max(1, stop + heavyBonus + critLikeBonus - 1));
  defender.impactStopTimer = Math.max(defender.impactStopTimer || 0, stop + heavyBonus + critLikeBonus + (defender.staggerTimer > 0 ? 3 : 1));
}

function resolveParry(defender, attacker, incomingWeapon, state) {
  if (!canTryParry(defender, attacker, incomingWeapon)) return false;

  const chance = getParryChance(defender, attacker, incomingWeapon);
  defender.parryCooldown = Math.max(defender.parryCooldown || 0, Math.floor(POSTURE_RULES.parryCooldownFrames * 0.55));

  if (Math.random() > chance) {
    defender.lastAction = '패링 실패';
    return false;
  }

  performParry(defender, attacker, incomingWeapon, state);
  emitParryFlash(state, defender, attacker);
  return true;
}

function canTryParry(defender, attacker, incomingWeapon) {
  if (defender.isDead || attacker.isDead) return false;
  if (defender.staggerTimer > 0 || defender.parryCooldown > 0) return false;
  if (defender.posture < defender.maxPosture * 0.18) return false;
  if (attacker.weaponId === 'dagger' && getPositionalBonus(attacker, defender) > 1.05) return false;

  const incomingDirection = angleTo(defender, attacker);
  const frontGap = Math.abs(angleDiff(defender.facing, incomingDirection));
  const defenderWeapon = WEAPONS[defender.weaponId];
  const frontArc = POSTURE_RULES.parryFrontArc * (defenderWeapon.parryFrontArcScale || 1);
  if (frontGap > frontArc) return false;

  const dist = distance(defender, attacker);
  const parryReach = Math.max(
    defender.radius + attacker.radius + 24,
    defenderWeapon.range * 0.72 * (defenderWeapon.parryReachScale || 1) + attacker.radius
  );
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

function performParry(defender, attacker, incomingWeapon, state) {
  const defenderWeapon = WEAPONS[defender.weaponId];
  const parryPower = getParryPower(defender, defenderWeapon, incomingWeapon);
  const impactAngle = angleTo(defender, attacker);
  const sideAngle = impactAngle + Math.PI / 2 * defender.orbitDir;

  applyPostureDamage(defender, attacker, parryPower);
  twistBodyOnImpact(attacker, defender, parryPower, defenderWeapon);

  attacker.attackOutcome = 'parried';
  attacker.attackState = 'recovery';
  attacker.attackTimer = Math.max(attacker.attackTimer, Math.round((incomingWeapon.recovery + POSTURE_RULES.parryRecoveryAddFrames) * (incomingWeapon.parryRecoveryPenalty || 1)));
  attacker.cooldownTimer = Math.max(attacker.cooldownTimer, Math.floor(incomingWeapon.cooldown * 0.32));
  const parryKnockback = getParryKnockback(attacker, incomingWeapon);
  attacker.vx += Math.cos(impactAngle) * parryKnockback + Math.cos(sideAngle) * 0.72;
  attacker.vy += Math.sin(impactAngle) * parryKnockback + Math.sin(sideAngle) * 0.72;

  defender.vx -= Math.cos(impactAngle) * 0.82;
  defender.vy -= Math.sin(impactAngle) * 0.82;
  defender.parryCooldown = POSTURE_RULES.parryCooldownFrames;
  defender.parryFlashTimer = POSTURE_RULES.parryFlashFrames;
  defender.counterTimer = Math.round(POSTURE_RULES.counterWindowFrames * ((PERSONALITIES[defender.personalityId].counterScale || 1)));
  defender.riposteTimer = defenderWeapon.riposteOnParry ? POSTURE_RULES.riposteWindowFrames : 0;
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay, getPostureRecoveryDelay(defender, 0.38));
  defender.impactStopTimer = Math.max(defender.impactStopTimer || 0, 3);
  attacker.impactStopTimer = Math.max(attacker.impactStopTimer || 0, incomingWeapon.impactStopFrames || 4);
  defender.lastAction = '패링 성공';
  attacker.lastAction = '패링당함';
  emitCombatEvent(state, 'PARRY', defender.x, defender.y - 38, '#5ae8ff');
}

function getParryKnockback(attacker, incomingWeapon) {
  const personality = PERSONALITIES[attacker.personalityId];
  const weaponScale = incomingWeapon.parryKnockbackTaken || 1;
  const postureScale = attacker.posture < attacker.maxPosture * 0.35 ? 1.18 : 1;
  return POSTURE_RULES.parryKnockback * weaponScale * postureScale * (personality.knockbackTakenScale || 1) * 1.16;
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
  if (attacker.activeSkillAttack === 'westernExcaliburBeam') return Math.max(weapon.arc * 0.42, 0.34);
  if (attacker.activeSkillAttack === 'westernCaliburnCharge') return Math.max(weapon.arc * 0.48, 0.42);
  if (attacker.activeSkillAttack === 'easternAnnihilation') return weapon.arc * 0.82;
  if (attacker.activeSkillAttack === 'spearPierce') return Math.max(weapon.arc * 0.68, 0.34);
  if (attacker.activeSkillAttack === 'spearLuBu') return Math.max(weapon.arc * 1.35, 0.72);
  if (attacker.activeSkillAttack === 'daggerAssassinate') return Math.max(weapon.arc * 1.35, 0.82);
  if (attacker.activeSkillAttack === 'daggerCloneTechnique') return Math.max(weapon.arc * 1.55, 0.92);
  if (attacker.activeSkillAttack === 'westernBash') return weapon.arc * 1.34;
  if (attacker.activeSkillAttack === 'easternIaiSlash') return weapon.arc * 0.76;
  if (attacker.activeSkillAttack === 'spearSweep') return Math.max(weapon.arc * 3.15, 1.28);
  if (weapon.id === 'western') return weapon.arc * 1.02;
  if (weapon.id === 'eastern') return weapon.arc * 1.04;
  if (weapon.id === 'dagger') return weapon.arc * 1.1;
  return weapon.arc;
}

function getAttackStartReach(attacker, defender, weapon) {
  const startBuffer = weapon.attackStartBuffer || 0;
  const readySkillReach = getReadyEvolutionStartReach(attacker);
  return weapon.range + defender.radius + getReachBonus(attacker, weapon) + startBuffer + readySkillReach;
}

function getReadyEvolutionStartReach(attacker) {
  if (attacker.weaponId === 'western' && hasReadySkill(attacker, 'westernExcaliburBeam')) return 220;
  if (attacker.weaponId === 'western' && hasReadySkill(attacker, 'westernCaliburnCharge')) return 24;
  if (attacker.weaponId === 'spear' && hasReadySkill(attacker, 'spearPierce')) return 28;
  if (attacker.weaponId === 'spear' && hasReadySkill(attacker, 'spearLuBu')) return 24;
  if (attacker.weaponId === 'eastern' && hasReadySkill(attacker, 'easternAnnihilation')) return 16;
  if (attacker.weaponId === 'dagger' && hasReadySkill(attacker, 'daggerCloneTechnique')) return 10;
  return 0;
}

function getHitReach(attacker, defender, weapon) {
  const hitReachBonus = weapon.hitReachBonus || 0;
  const skillReach = attacker.activeSkillAttack === 'westernExcaliburBeam'
    ? 220
    : attacker.activeSkillAttack === 'westernCaliburnCharge'
      ? 24
      : attacker.activeSkillAttack === 'easternAnnihilation'
        ? 18
        : attacker.activeSkillAttack === 'spearPierce'
          ? 36
          : attacker.activeSkillAttack === 'spearLuBu'
            ? 28
            : attacker.activeSkillAttack === 'daggerAssassinate'
              ? 12
              : attacker.activeSkillAttack === 'daggerCloneTechnique'
                ? 16
                : attacker.activeSkillAttack === 'westernBash'
                  ? 8
                  : attacker.activeSkillAttack === 'easternIaiSlash'
                    ? 12
                    : attacker.activeSkillAttack === 'spearSweep'
                      ? -Math.max(4, weapon.range * 0.22)
                      : 0;
  return weapon.range + defender.radius + hitReachBonus + skillReach;
}

function getReachBonus(attacker, weapon) {
  let base = 0;
  if (weapon.id === 'western') base = 5;
  if (weapon.id === 'eastern') base = 4;
  if (weapon.id === 'dagger') base = 3;
  return base + (attacker.stageReachBonus || 0);
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
  const spearWindow = defender.weaponId === 'spear' && (defender.flankPressureTimer > 0 || defender.attackState === 'recovery' || defender.postureRecoveryDelay > 0);
  const daggerMirrorCommit = defender.weaponId === 'dagger' && dist < WEAPONS.dagger.range + defender.radius + 8 && frontGap < 1.62;

  const sideAttackWindow = sideGap < 1.12 && frontGap > 0.42;
  const sideRearWindow = sideGap < 1.22 && backGap > 0.42;
  return sideAttackWindow || sideRearWindow || defenderLowHp || committedBurst || (defenderBusy && sideGap < 1.32) || (spearWindow && sideGap < 1.38) || daggerMirrorCommit;
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

  const stageFlankScale = 1 + (attacker.stageFlankDamageBonus || 0);

  if (defender.weaponId === 'spear') {
    if (flankGap < 1.08) return Math.min((weapon.flankBonus || 1) * stageFlankScale, 1.08 + (attacker.stageFlankDamageBonus || 0) * 0.5);
    if (backGap < 0.58) return Math.min((weapon.backBonus || 1.08) * stageFlankScale, 1.08 + (attacker.stageFlankDamageBonus || 0) * 0.5);
    if (defender.flankPressureTimer > 0 && flankGap < 1.28) return 1.06 * stageFlankScale;
  }

  if (flankGap < 1.08) return weapon.flankBonus * stageFlankScale;
  if (backGap < 0.58) return (weapon.backBonus || 1.12) * stageFlankScale;
  if (defender.flankPressureTimer > 0 && flankGap < 1.28) return ((weapon.flankBonus + 1) / 2) * stageFlankScale;
  return 1;
}


function getMatchupDamageScale(attacker, defender, weapon) {
  let scale = 1;

  if (weapon.id === 'dagger' && defender.weaponId === 'spear') {
    const spearPersonality = PERSONALITIES[defender.personalityId];
    scale *= spearPersonality.id === 'defensive' ? 0.52 : spearPersonality.id === 'aggressive' ? 0.58 : 0.55;
  }

  if (weapon.id === 'dagger' && attacker.personalityId === 'defensive') {
    scale *= 0.91;
  }

  return scale;
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
  const attackerPersonality = PERSONALITIES[attacker.personalityId];
  const defenderPersonality = PERSONALITIES[defender.personalityId];
  const personalityPostureScale = (attackerPersonality.postureDamageDealtScale || 1) * (defenderPersonality.postureDamageTakenScale || 1);
  const stagePostureScale = 1 + (attacker.stagePostureDamageBonus || 0);
  return Math.max(
    POSTURE_RULES.minPostureDamage,
    weapon.postureDamage * weaponPostureScale * positionalBonus * daggerPostureBonus * attackStateBonus * critBonus * counterPostureBonus * qualityBonus * defenseReduction * personalityPostureScale * stagePostureScale
  );
}

function getDaggerPostureBonus(attacker, defender, weapon) {
  const attackerFromDefender = angleTo(defender, attacker);
  const backGap = Math.abs(angleDiff(defender.facing + Math.PI, attackerFromDefender));
  const sideGap = Math.min(
    Math.abs(angleDiff(defender.facing + Math.PI / 2, attackerFromDefender)),
    Math.abs(angleDiff(defender.facing - Math.PI / 2, attackerFromDefender))
  );

  if (defender.weaponId === 'spear') {
    if (sideGap < 1.08) return Math.min(weapon.flankPostureBonus || 1, 0.94);
    if (backGap < 0.58) return Math.min(weapon.backPostureBonus || 1, 0.98);
    if (defender.flankPressureTimer > 0 && sideGap < 1.24) return 0.92;
  }

  if (sideGap < 1.08) return weapon.flankPostureBonus || 1;
  if (backGap < 0.58) return weapon.backPostureBonus || 1;
  if (defender.flankPressureTimer > 0 && sideGap < 1.24) return Math.max(1.18, (weapon.flankPostureBonus || 1));
  return 1;
}


function getPostureRecoveryDelay(unit, scale = 1) {
  const weapon = WEAPONS[unit.weaponId];
  const personality = PERSONALITIES[unit.personalityId];
  const weaponScale = weapon.id === 'spear'
    ? 1.2
    : weapon.id === 'western'
      ? 1.05
      : weapon.id === 'eastern'
        ? 0.92
        : 0.78;
  const personalityScale = personality.id === 'defensive'
    ? 0.88
    : personality.id === 'assassin'
      ? 1.08
      : personality.id === 'aggressive'
        ? 1.06
        : 1;
  return Math.round(POSTURE_RULES.recoveryDelayFrames * weaponScale * personalityScale * scale);
}

function applyPostureDamage(attacker, defender, amount, state = null) {
  if (defender.isDead || defender.staggerTimer > 0) return;

  const scaledAmount = amount * (defender.postureDamageTakenRewardScale || 1);
  defender.posture = clamp(defender.posture - scaledAmount, 0, defender.maxPosture);
  defender.postureRecoveryDelay = getPostureRecoveryDelay(defender);

  if (defender.posture <= 0) {
    triggerStagger(defender, attacker, state);
  }
}


function getStaggerDurationScale(unit, attacker) {
  const victimWeapon = WEAPONS[unit.weaponId];
  const attackerWeapon = WEAPONS[attacker.weaponId];
  const victimScale = victimWeapon.id === 'spear'
    ? 1.28
    : victimWeapon.id === 'western'
      ? 1.12
      : victimWeapon.id === 'eastern'
        ? 0.94
        : 0.62;
  const attackerScale = attackerWeapon?.staggerRecoveryPenalty || 1;
  return victimScale * attackerScale;
}

function triggerStagger(unit, attacker, state = null) {
  const impactAngle = angleTo(attacker, unit);
  unit.staggerTimer = Math.round(POSTURE_RULES.staggerFrames * getStaggerDurationScale(unit, attacker));
  unit.attackState = 'idle';
  unit.attackTimer = 0;
  unit.cooldownTimer = Math.max(unit.cooldownTimer, unit.weaponId === 'dagger' ? 14 : 22);
  unit.posture = Math.round(unit.maxPosture * POSTURE_RULES.staggerPostureRestoreRatio);
  unit.postureRecoveryDelay = getPostureRecoveryDelay(unit, 1.1);
  unit.retreatFrames = 0;
  unit.retreatLockout = Math.max(unit.retreatLockout || 0, 24);
  unit.facing = impactAngle + Math.PI + attacker.orbitDir * POSTURE_RULES.staggerFacingTwist;
  unit.vx += Math.cos(impactAngle) * 1.35;
  unit.vy += Math.sin(impactAngle) * 1.35;
  unit.lastAction = '스태미너 붕괴';
  emitBreakBurst(state, unit);
  emitCombatEvent(state, 'BREAK', unit.x, unit.y - 42, '#ff5a6d');
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
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay, getPostureRecoveryDelay(defender, 0.55));
  if (defender.attackState === 'windup' || defender.attackState === 'active') {
    defender.attackTimer += 2;
  }
}

function applyWeaponHitReaction(attacker, defender, weapon, hitQuality = 0) {
  const attackAngle = angleTo(attacker, defender);
  const sideAngle = attackAngle + Math.PI / 2 * attacker.orbitDir;
  const qualityScale = 1 + hitQuality * (POSTURE_RULES.preciseHitKnockbackBonus || 0.28);
  const attackerPersonality = PERSONALITIES[attacker.personalityId];
  const defenderPersonality = PERSONALITIES[defender.personalityId];
  const personalityKnockbackScale = (attackerPersonality.knockbackDealtScale || 1) * (defenderPersonality.knockbackTakenScale || 1);
  const force = (weapon.hitKnockback || weapon.knockback || 8) * qualityScale * personalityKnockbackScale;
  const forwardScale = getHitForwardKnockbackScale(weapon);
  const sideScale = getHitSideKnockbackScale(weapon);

  defender.vx += Math.cos(attackAngle) * force * forwardScale + Math.cos(sideAngle) * force * sideScale;
  defender.vy += Math.sin(attackAngle) * force * forwardScale + Math.sin(sideAngle) * force * sideScale;

  if (weapon.id === 'western') {
    defender.vx += Math.cos(sideAngle) * force * 0.052;
    defender.vy += Math.sin(sideAngle) * force * 0.052;
  }

  const selfRetreat = weapon.selfRetreatOnHit || 0;
  if (selfRetreat > 0) {
    const retreatScale = weapon.id === 'dagger' ? 1.04 + hitQuality * 0.32 : 0.42;
    attacker.vx -= Math.cos(attackAngle) * selfRetreat * retreatScale;
    attacker.vy -= Math.sin(attackAngle) * selfRetreat * retreatScale;
    if (weapon.id === 'dagger') {
      attacker.vx += Math.cos(sideAngle) * attacker.orbitDir * (1.08 + hitQuality * 0.12);
      attacker.vy += Math.sin(sideAngle) * attacker.orbitDir * (1.08 + hitQuality * 0.12);
      attacker.attackState = 'recovery';
      attacker.attackTimer = Math.max(attacker.attackTimer || 0, weapon.recovery + 6);
      attacker.cooldownTimer = Math.max(attacker.cooldownTimer || 0, 10);
      attacker.impactStopTimer = Math.max(attacker.impactStopTimer || 0, 1);
      if (defender.weaponId === 'spear') {
        attacker.attackTimer = Math.max(attacker.attackTimer || 0, weapon.recovery + 9);
        attacker.cooldownTimer = Math.max(attacker.cooldownTimer || 0, 14);
        attacker.daggerResetTimer = Math.max(attacker.daggerResetTimer || 0, Math.round((POSTURE_RULES.daggerResetFrames || 24) * 1.22));
      }
      attacker.daggerManeuverPhase = '';
      attacker.daggerManeuverTimer = 0;
      attacker.lastAction = '단검 짧은 사선 이탈';
    }
  }
}

function applyWeaponIdentityOnHit(attacker, defender, weapon, hitQuality = 0) {
  const personality = PERSONALITIES[attacker.personalityId];
  const identityScale = personality.weaponIdentityScale || 1;

  if (weapon.id === 'eastern') {
    const maxCombo = POSTURE_RULES.easternComboMax || 2;
    attacker.comboCount = Math.min(maxCombo, (attacker.comboCount || 0) + 1);
    attacker.comboTimer = Math.round((POSTURE_RULES.easternComboWindowFrames || 34) * (personality.comboScale || 1));
    const comboReturnScale = defender.weaponId === 'dagger' ? 0.96 : 0.76;
    attacker.attackTimer = Math.min(attacker.attackTimer || weapon.recovery, Math.max(7, Math.round(weapon.recovery * comboReturnScale)));
    defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, getPostureRecoveryDelay(defender, defender.weaponId === 'dagger' ? 0.28 : 0.5 * identityScale));

    if (defender.weaponId === 'dagger') {
      applyDaggerEscapeFromEastern(attacker, defender, weapon, hitQuality);
    }
  }

  if (weapon.id === 'dagger') {
    const positional = getPositionalBonus(attacker, defender);
    if (positional > 1.05) {
      const stun = Math.round((weapon.flankStunFrames || weapon.hitStunFrames || 4) * (0.72 + hitQuality * 0.35));
      defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, stun);
      defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, Math.round(stun * 1.6));
      defender.flankPressureTimer = Math.max(defender.flankPressureTimer || 0, stun);
    }

    if (defender.weaponId === 'eastern') {
      applyDaggerEasternFlowBreak(attacker, defender, weapon, positional, hitQuality);
    }
  }

  if (weapon.id === 'western') {
    defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, getPostureRecoveryDelay(defender, 0.92 * identityScale));
    if (hitQuality > 0.48) defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, weapon.hitStunFrames || 4);
  }

  if (weapon.id === 'spear' && hitQuality > 0.38) {
    defender.retreatLockout = Math.max(defender.retreatLockout || 0, 16);
    defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, getPostureRecoveryDelay(defender, 0.52 * identityScale));
    attacker.cooldownTimer = Math.min(attacker.cooldownTimer || weapon.cooldown, Math.max(12, Math.round(weapon.cooldown * 0.72)));
  }
}

function applyDaggerEscapeFromEastern(attacker, defender, weapon, hitQuality = 0) {
  const comboPressure = attacker.comboTimer > 0 || attacker.comboCount > 0 || attacker.attackState === 'active';
  const escapeChance = comboPressure ? 0.24 + hitQuality * 0.06 : 0.09 + hitQuality * 0.035;
  if (Math.random() > escapeChance) return;

  const escapeAngle = angleTo(attacker, defender);
  const sideAngle = escapeAngle + Math.PI / 2 * (defender.orbitDir || 1);
  const escapePower = 2.35 + hitQuality * 0.65;
  const backPower = 0.45 + hitQuality * 0.18;

  defender.vx += Math.cos(sideAngle) * escapePower + Math.cos(escapeAngle) * backPower;
  defender.vy += Math.sin(sideAngle) * escapePower + Math.sin(escapeAngle) * backPower;
  defender.daggerManeuverPhase = '';
  defender.daggerManeuverTimer = 0;
  defender.daggerResetTimer = Math.min(defender.daggerResetTimer || 0, 8);
  defender.daggerBurstCooldown = Math.min(defender.daggerBurstCooldown || 0, 9);
  defender.cooldownTimer = Math.min(Math.max(defender.cooldownTimer || 0, 6), 13);
  defender.flankPressureTimer = Math.max(defender.flankPressureTimer || 0, 8);

  attacker.attackTimer = Math.max(attacker.attackTimer || 0, Math.round(weapon.recovery * 0.46));
  attacker.cooldownTimer = Math.max(attacker.cooldownTimer || 0, 3);
  attacker.flankPressureTimer = Math.max(attacker.flankPressureTimer || 0, 6);
  defender.lastAction = '동양검 연격 탈출';
}

function applyDaggerEasternFlowBreak(attacker, defender, weapon, positional, hitQuality = 0) {
  const interruptWindow = defender.comboTimer > 0 ||
    defender.attackState === 'recovery' ||
    defender.attackState === 'windup' ||
    defender.attackState === 'active';

  if (!interruptWindow || positional <= 1.04) return;
  if (Math.random() > 0.24 + hitQuality * 0.1) return;

  const breakFrames = Math.round((weapon.flankStunFrames || 4) * (0.54 + hitQuality * 0.22));
  defender.comboTimer = Math.max(0, Math.round((defender.comboTimer || 0) * 0.25));
  defender.comboCount = Math.max(0, (defender.comboCount || 0) - 1);
  defender.cooldownTimer = Math.max(defender.cooldownTimer || 0, breakFrames + 1);
  defender.postureRecoveryDelay = Math.max(defender.postureRecoveryDelay || 0, Math.round(breakFrames * 1.08));
  defender.flankPressureTimer = Math.max(defender.flankPressureTimer || 0, breakFrames + 6);
  attacker.daggerBurstCooldown = Math.max(attacker.daggerBurstCooldown || 0, Math.round((POSTURE_RULES.daggerBurstCooldownFrames || 17) * 0.82));
  defender.lastAction = '연속공격 흐트러짐';
  attacker.lastAction = '연격 끊기 찌르기';
}


function getHitForwardKnockbackScale(weapon) {
  if (weapon.id === 'spear') return 0.58;
  if (weapon.id === 'western') return 0.24;
  if (weapon.id === 'eastern') return 0.22;
  if (weapon.id === 'dagger') return 0.08;
  return 0.22;
}

function getHitSideKnockbackScale(weapon) {
  if (weapon.id === 'western') return 0.026;
  if (weapon.id === 'eastern') return 0.02;
  if (weapon.id === 'dagger') return 0.012;
  return 0.018;
}

function getNonHitPostureScale(attacker, weapon) {
  const personality = PERSONALITIES[attacker.personalityId];
  let scale = 1;
  if (weapon.id === 'spear') scale *= 0.92;
  if (weapon.id === 'spear' && personality.id === 'defensive') scale *= 0.82;
  return scale;
}


function resolveWeaponClash(state, a, b) {
  if (a.isDead || b.isDead || a.clashCooldown > 0 || b.clashCooldown > 0) return;
  if (a.attackState !== 'active' || b.attackState !== 'active') return;
  if (!isWeaponThreatening(a, b) || !isWeaponThreatening(b, a)) return;

  const weaponA = WEAPONS[a.weaponId];
  const weaponB = WEAPONS[b.weaponId];
  const powerA = getClashPower(a, weaponA);
  const powerB = getClashPower(b, weaponB);
  const total = Math.max(1, powerA + powerB);
  let damageToA = POSTURE_RULES.weaponClashPostureDamage * (powerB / total) * 1.72;
  let damageToB = POSTURE_RULES.weaponClashPostureDamage * (powerA / total) * 1.72;
  damageToA *= getNonHitPostureScale(b, weaponB);
  damageToB *= getNonHitPostureScale(a, weaponA);
  const angleAB = angleTo(a, b);

  a.clashCooldown = POSTURE_RULES.weaponClashCooldown;
  b.clashCooldown = POSTURE_RULES.weaponClashCooldown;
  a.attackState = a.attackState === 'active' ? 'recovery' : a.attackState;
  b.attackState = b.attackState === 'active' ? 'recovery' : b.attackState;
  a.attackTimer = Math.max(a.attackTimer, 8);
  b.attackTimer = Math.max(b.attackTimer, 8);

  applyPostureDamage(b, a, damageToA, state);
  applyPostureDamage(a, b, damageToB, state);
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
  emitCombatEvent(state, 'CLASH', (a.x + b.x) / 2, (a.y + b.y) / 2 - 26, '#ffffff');
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
  const personality = PERSONALITIES[unit.personalityId];
  const pressure = clamp(opposingPower / Math.max(1, totalPower), 0.25, 0.82);
  const weaponScale = weapon.clashKnockbackScale || 1;
  const postureScale = unit.posture < unit.maxPosture * 0.4 ? 1.12 : 1;
  return (POSTURE_RULES.weaponClashKnockback || 2.2) * weaponScale * postureScale * (personality.knockbackTakenScale || 1) * (0.96 + pressure * 1.12);
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
