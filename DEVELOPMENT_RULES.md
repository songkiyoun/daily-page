# DEVELOPMENT RULES

이 프로젝트는 기존 실험본처럼 구버전 위에 신버전 패치를 계속 덧붙이는 방식을 금지합니다.
모든 수정은 담당 파일의 기존 함수를 직접 수정하는 방식으로 진행합니다.

## 1. 프로젝트 방향 고정

- 1:1 전투 전용 게임입니다.
- 2:2, 3:3, 아군, 팀전, 다수 타겟 구조를 만들지 않습니다.
- 전장은 원형이 아니라 사각형입니다.
- 게임 흐름은 로그라이크 탑 등반 구조입니다.
- 상대의 무기와 성격은 매 층 랜덤으로 생성됩니다.
- 층이 오를수록 상대는 점점 강해집니다.

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

- `data.js`: 무기, 성격, 기본 스탯, 층 성장 규칙
- `state.js`: 런 생성, 층 이동, 유닛 생성, 랜덤 상대 생성
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
- `advanceRunFloor`
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
v0.3.0: add tower reward choices
```
