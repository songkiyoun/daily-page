// saveSchema.js
// Google Spreadsheet 탭 구조와 저장 스키마 이름을 한곳에서 관리합니다.

export const SAVE_SCHEMA_VERSION = 2;

export const SPREADSHEET_TABS = [
  { id: 'Accounts', description: '계정 ID, 권한, 마지막 저장 시점' },
  { id: 'Characters', description: '프로필, 선택 캐릭터, 현재 세션 캐릭터 요약' },
  { id: 'Resources', description: '골드, 강화석, 보스의 영혼, 원한덩어리' },
  { id: 'Progress', description: '최고층, 누적 승리, 도전 횟수 등 진행 요약' },
  { id: 'Weapons', description: '현재 세션 무기 상태와 무기별 가보 상태' },
  { id: 'Heirlooms', description: '무기별 가보 등급, 진화, 강화 상태' },
  { id: 'SoulEngraving', description: '영혼의 각인 단계' },
  { id: 'Farm', description: '농장 슬롯과 작물 성장 상태' },
  { id: 'BossCodex', description: '보스 조우, 처치, 처치 횟수 기록' },
  { id: 'ClearRecords', description: '클리어 및 도전 누적 기록' },
  { id: 'Achievements', description: '업적 달성 및 보상 수령 확장 기록' },
  { id: 'Rivals', description: '활성 라이벌과 복수 완료 라이벌 기록' },
  { id: 'Nemeses', description: '활성 숙적과 봉인된 숙적 기록' },
  { id: 'Inventory', description: '특수 아이템, 재료, 향후 칭호/조각 확장 슬롯' },
  { id: 'SystemLog', description: '저장 사유, 버전, 관리자 지급, 오류 추적 로그' }
];

export const SPREADSHEET_TAB_NAMES = SPREADSHEET_TABS.map((tab) => tab.id);

export function createEmptySpreadsheetTabs() {
  return SPREADSHEET_TAB_NAMES.reduce((tabs, tabName) => {
    tabs[tabName] = [];
    return tabs;
  }, {});
}
