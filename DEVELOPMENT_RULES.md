# DEVELOPMENT RULES

이 프로젝트는 기존 실험본처럼 구버전 위에 신버전 패치를 계속 덧붙이는 방식을 금지합니다.
모든 수정은 담당 파일의 기존 함수를 직접 수정하는 방식으로 진행합니다.

## 1. 프로젝트 방향 고정

- 1:1 전투 전용 게임입니다.
- 2:2, 3:3, 아군, 팀전, 다수 타겟 구조를 만들지 않습니다.
- 전장은 원형이 아니라 사각형입니다.
- 게임 흐름은 로그라이크 탑 등반 구조입니다.
- 상대의 무기, 성격, 스탯, 스킬은 매 층 랜덤으로 생성됩니다.
- 층이 오를수록 상대는 점점 강해집니다.
- 플레이어 성장은 경험치, 레벨, 스탯, 스킬, 무기 숙련을 기준으로 관리합니다.

## 2. 패치 누적 금지

금지 예시:

```javascript
const oldUpdate = updateBattle;
updateBattle = function patchedUpdateBattle() {
  oldUpdate();
  // 추가 패치
};
```

금지 예시:

```javascript
function resolveAttack() {}
function resolveAttack() {}
```

수정이 필요하면 기존 함수 본문을 직접 정리합니다.

## 3. 파일별 책임

- `data.js`: 무기, 성격, 스탯, 스킬, 보상, 층 성장 규칙
- `state.js`: 런 생성, 층 이동, 유닛 생성, 랜덤 상대 생성, 보상 적용
- `battle.js`: 공격 판정, 피해 계산, 승패 판정, 사각형 경계 처리
- `ai.js`: 1:1 이동 판단
- `render.js`: 캔버스 그리기
- `main.js`: UI 연결과 단일 게임 루프
- `utils.js`: 공통 수학 함수

## 4. 절대 중복되면 안 되는 함수

- `updateBattle`
- `resolveAttack`
- `decideMovement`
- `render`
- `createRun`
- `createBattleState`
- `applyRewardAndAdvance`
- `loop`

## 5. 수정 절차

1. 수정 목표를 한 문장으로 적습니다.
2. 수정할 파일을 정합니다.
3. 기존 함수를 직접 수정합니다.
4. 새 패치 블록을 추가하지 않습니다.
5. 실행 테스트를 합니다.
6. `CHANGELOG.md`에 변경 내용을 남깁니다.
7. GitHub에는 수정된 파일만 커밋합니다.

## 6. 커밋 메시지 예시

```text
v0.2.1: adjust square arena bounds
v0.2.2: improve random enemy floor scaling
v0.3.0: add stats skills and rewards
v0.3.1: fix reward button render lifecycle
```


## v0.4.0 전술 이동 기준

- 이동 판단은 `js/ai.js`의 `decideMovement`에서만 수정합니다.
- 공격 중 전진, 후딜 중 이탈, 몸 충돌 완화는 `js/battle.js`의 기존 함수에서 직접 수정합니다.
- 일자 접근을 고치기 위해 별도 패치 스크립트를 추가하지 않습니다.
- 무기별 이동 성향 수치는 `js/data.js`의 각 무기 데이터에서만 관리합니다.


## v0.4.1 이동 리팩터링 기준

- 무기별 이동 수치는 `data.js`의 `WEAPONS` 객체에서만 관리합니다.
- 성격별 이동 성향은 `data.js`의 `PERSONALITIES` 객체에서만 관리합니다.
- 이동 판단은 `ai.js`의 기존 `decideMovement`와 하위 이동 함수들을 직접 수정합니다.
- 단검 공격 각도 제한은 `battle.js`의 기존 `canStartAttack`에서만 관리합니다.
- 별도 `v0.4.1 patch` 스크립트나 중복 함수를 추가하지 않습니다.


## v0.4.2 성장 기본값 기준

- 시작 스탯 포인트는 `data.js`의 `PLAYER_START_STAT_POINTS`에서만 관리합니다.
- 층 이동 시 완전 회복은 `state.js`의 `applyRewardAndAdvance` 흐름에서만 처리합니다.
- 보상 선택 이후 새 층 전투 시작 흐름은 `main.js`의 기존 보상 선택 핸들러를 직접 수정해 관리합니다.
- 회복 보상처럼 현재 규칙과 충돌하는 보상은 새 패치로 덮지 않고 기존 보상 생성 로직에서 직접 교체합니다.


## v0.4.3 전투 리듬 기준

- 무기별 회전 속도와 자세 피해량은 `data.js`의 `WEAPONS`와 `POSTURE_RULES`에서만 관리합니다.
- 방향 전환 제한, 공격 후딜, 자세 흐트러짐은 `battle.js`의 기존 `updateUnit`, `getTurnSpeed`, `resolveAttack` 흐름에서만 처리합니다.
- 자세 게이지 생성은 `state.js`의 유닛 생성 구조에서만 처리합니다.
- 자세 게이지 표시는 `render.js`와 `main.js`의 기존 표시 흐름에서 직접 관리합니다.
- 단검이 자세 흐트러짐을 이용하는 움직임은 `ai.js`의 기존 이동 판단 함수 안에서 처리합니다.
- 패링은 아직 별도 단계이며, 이 버전에서는 자세 흐트러짐과 회전 제한만 다룹니다.
- 별도 `v0.4.3 patch` 스크립트나 중복 함수를 추가하지 않습니다.



## v0.4.4 UI 구조 기준

- 캐릭터 세팅, 스탯 설정, 추후 상점 영역은 왼쪽 패널에서 관리합니다.
- 전투, 승리·패배 결과, 보상 선택은 중앙 전투 오버레이에서 처리합니다.
- 탑 정보와 상태 정보는 오른쪽 패널에서만 표시합니다.
- 클릭 가능한 UI는 매 프레임 새로 만들지 않고, 상태 변화가 있을 때만 기존 렌더링 함수를 통해 갱신합니다.
- 스탯 클릭은 `main.js`의 기존 이벤트 위임 흐름에서만 처리합니다.
- 보상 선택은 `main.js`의 중앙 오버레이 보상 처리 흐름에서만 관리합니다.
- 별도 `v0.4.4 patch` 스크립트나 중복 함수를 추가하지 않습니다.
