// data.js
// 순수 데이터 모듈을 한곳에서 다시 내보내는 관문 파일입니다.
// 기존 import 경로를 유지하기 위해 이 파일은 re-export만 담당합니다.

export { VERSION } from './data/version.js';
export { WEAPONS, WEAPON_GRADES, WEAPON_EVOLUTIONS } from './data/weapons.js';
export { PERSONALITIES, STAT_KEYS, STAT_LABELS, STAT_DESCRIPTIONS, PLAYER_START_STATS, PLAYER_START_STAT_POINTS, BASE_STATS, POSTURE_RULES } from './data/characters.js';
export { SKILLS, WEAPON_SKILL_LOADOUTS, WEAPON_EVOLUTION_SKILL_LOADOUTS, PERSONALITY_SKILL_LOADOUTS } from './data/skills.js';
export { SHOP_RULES, REWARD_RULES, REWARD_RARITIES, REWARD_TRAITS } from './data/economy.js';
export { TOWER_RULES, BOSS_PROFILES, ENEMY_NAMES } from './data/tower.js';
