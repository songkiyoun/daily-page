// skillConstants.js
// 전투 중 사용하는 스킬 판정용 상수만 관리합니다.

export const FORCED_CRIT_SKILLS = new Set([
  'daggerVitalStrike',
  'westernCaliburnCharge',
  'easternAnnihilation',
  'spearPierce',
  'daggerAssassinate'
]);

export const CHARGE_GUARD_SKILLS = new Set([
  'westernCaliburnCharge',
  'westernExcaliburBeam'
]);

export const WEAPON_ATTACK_SKILL_TYPES = new Set(['attack', 'evolutionAttack', 'evolutionFollowUp']);
export const WEAPON_SKILL_CHAIN_LOCK_FRAMES = 42;
export const PASS_STRIKE_SKILLS = new Set(['easternAnnihilation', 'daggerAssassinate']);
export const SEQUENCE_SKILLS = new Set(['easternAnnihilation', 'daggerAssassinate', 'spearLuBu']);
