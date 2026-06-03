# v1.0.6

## 업데이트 요약

- Google Spreadsheet 탭별 저장 안정화를 반영했습니다.
- 모든 권장 탭의 기준 헤더를 Apps Script에서 자동 생성/보정합니다.
- `Accounts`를 제외한 데이터 탭은 같은 계정의 기존 행을 삭제하고 최신 스냅샷으로 교체 저장합니다.
- `SystemLog`는 누적 로그로 유지합니다.
- `Resources`, `Progress`, `Weapons`, `BossCodex`, `Rivals`, `Nemeses`, `Inventory` 등 탭 저장 구조를 v1.0.6 기준으로 정리했습니다.

## 확인 포인트

1. Apps Script의 `Code.gs`를 v1.0.6 코드로 교체하고 배포를 업데이트하세요.
2. 저장 후 각 탭의 헤더가 자동으로 생성/보정되는지 확인하세요.
3. 같은 계정으로 여러 번 저장해도 `Resources`, `Rivals`, `Nemeses` 등에 중복 행이 계속 쌓이지 않는지 확인하세요.
4. `SystemLog`는 누적되는 것이 정상입니다.
5. 로그인 복원은 여전히 `Accounts.saveDataJson`을 기준으로 작동합니다.
