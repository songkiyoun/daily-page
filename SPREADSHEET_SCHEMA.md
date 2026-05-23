# Circle Battle Tower Rebuild - Google Spreadsheet 저장 구조 v1.0.2

현재 게임은 `localStorage`를 임시 캐시로 사용하고, 로그인 계정 저장 요청에는 `saveData`와 함께 `sheetData`를 전송합니다. Apps Script가 `sheetData.tabs`를 처리하도록 확장되면 아래 탭 구조로 계정별 데이터가 분리 저장됩니다.

## 권장 탭명

1. `Accounts` - 계정 ID, 권한, 마지막 저장 시점
2. `Characters` - 프로필, 선택 캐릭터, 현재 세션 캐릭터 요약
3. `Resources` - 골드, 강화석, 보스의 영혼, 원한덩어리
4. `Progress` - 최고층, 누적 승리, 도전 횟수 등 진행 요약
5. `Weapons` - 현재 세션 무기 상태와 무기별 가보 상태
6. `Heirlooms` - 무기별 가보 등급, 진화, 강화 상태
7. `SoulEngraving` - 영혼의 각인 단계
8. `Farm` - 농장 슬롯과 작물 성장 상태
9. `BossCodex` - 보스 조우, 처치, 처치 횟수 기록
10. `ClearRecords` - 클리어 및 도전 누적 기록
11. `Achievements` - 업적 달성 및 보상 수령 확장 기록
12. `Rivals` - 활성 라이벌과 복수 완료 라이벌 기록
13. `Nemeses` - 활성 숙적과 봉인된 숙적 기록
14. `Inventory` - 특수 아이템, 재료, 향후 칭호/조각 확장 슬롯
15. `SystemLog` - 저장 사유, 버전, 관리자 지급, 오류 추적 로그

## 핵심 아이템 키

- 원한덩어리 내부 키: `grudgeMass`
- 원한덩어리 저장/아이템 키: `grudge_mass`
- 원한덩어리 아이콘: `icon/item_grudge_mass.png`

## 저장 요청 형태

프론트엔드는 기존 호환을 위해 `saveData`를 그대로 보내고, 추가로 아래 형태의 `sheetData`를 함께 보냅니다.

```json
{
  "action": "save",
  "app": "circle-battle-tower-rebuild",
  "version": "1.0.2",
  "id": "player01",
  "pw": "****",
  "saveData": {},
  "sheetData": {
    "schemaVersion": 2,
    "app": "circle-battle-tower-rebuild",
    "accountId": "player01",
    "savedAt": "2026-05-23T00:00:00.000Z",
    "tabs": {
      "Accounts": [],
      "Characters": [],
      "Resources": [],
      "Progress": [],
      "Weapons": [],
      "Heirlooms": [],
      "SoulEngraving": [],
      "Farm": [],
      "BossCodex": [],
      "ClearRecords": [],
      "Achievements": [],
      "Rivals": [],
      "Nemeses": [],
      "Inventory": [],
      "SystemLog": []
    }
  }
}
```

Apps Script가 아직 `sheetData`를 처리하지 않아도 기존 `saveData` 저장 방식은 유지됩니다.

## v1.0.2 Apps Script 저장 연동 메모

v1.0.2부터 `google-apps-script/Code.gs`가 포함됩니다.
사용자는 스프레드시트에 바인딩된 Apps Script에 해당 코드를 붙여넣고 웹 앱으로 배포한 뒤, 발급된 Web App URL을 `js/config.js`에 입력합니다.

### Accounts 탭 필수/자동 컬럼

Apps Script는 `Accounts` 탭에 아래 컬럼을 자동으로 생성하거나 보완합니다.

| 컬럼 | 설명 |
|---|---|
| accountId | 계정 ID |
| passwordHash | 비밀번호 해시값 |
| role | player 또는 admin |
| mode | cloud |
| version | 마지막 저장 버전 |
| schemaVersion | 저장 스키마 버전 |
| updatedAt | 마지막 저장 시각 |
| createdAt | 계정 생성 시각 |
| saveDataJson | 로그인 복원용 전체 저장 데이터 |

관리자 계정은 `Accounts` 탭에서 해당 계정의 `role` 값을 `admin`으로 수정한 뒤 다시 로그인하면 적용됩니다.
