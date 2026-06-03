# Circle Battle Tower Rebuild - Google Spreadsheet 저장 구조 v1.0.6

현재 게임은 `localStorage`를 임시 캐시로 사용하고, 클라우드 저장 시 `saveData`와 함께 `sheetData.tabs`를 Apps Script로 전송합니다. v1.0.6부터 Apps Script는 각 탭의 기준 헤더를 자동으로 생성/보정하고, `Accounts`를 제외한 데이터 탭은 계정 기준 스냅샷으로 교체 저장합니다.

## 권장 탭명

1. `Accounts` - 계정 ID, 권한, 로그인 복원용 전체 저장 데이터
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

- 원한덩어리 내부 리소스 키: `grudgeMass`
- 원한덩어리 저장/아이템 키: `grudge_mass`
- 원한덩어리 아이콘: `icon/item_grudge_mass.png`

## Accounts 탭 기준 헤더

```txt
accountId | username | passwordHash | role | mode | version | schemaVersion | createdAt | updatedAt | lastLoginAt | saveDataJson
```

비밀번호 원문은 저장하지 않고 `passwordHash`로 저장합니다. 기존에 `id`, `pw` 헤더를 만들어둔 경우에도 Apps Script가 `accountId`, `username`, `passwordHash` 기준으로 자동 보정합니다.

## 탭별 저장 방식

- `Accounts`: 계정별 1행 유지, 로그인 복원용 `saveDataJson` 저장
- `SystemLog`: 로그인/저장/오류 이벤트 누적 기록
- 그 외 탭: 저장 시 같은 계정의 기존 행을 삭제하고 최신 스냅샷 행으로 교체

이 방식은 같은 계정의 `Resources`, `Rivals`, `Nemeses`, `Inventory` 등이 저장할 때마다 중복으로 계속 쌓이지 않도록 하기 위한 구조입니다.

## 저장 요청 형태

```json
{
  "action": "save",
  "app": "circle-battle-tower-rebuild",
  "version": "1.0.6",
  "id": "player01",
  "pw": "****",
  "saveData": {},
  "sheetData": {
    "schemaVersion": 3,
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

## v1.0.6 Apps Script 메모

`google-apps-script/Code.gs`를 v1.0.6 코드로 교체한 뒤 웹 앱 배포를 업데이트해야 탭별 헤더 자동 보정과 중복 방지 저장이 반영됩니다.
