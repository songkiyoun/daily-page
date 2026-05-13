# DEVELOPMENT RULES

이 프로젝트는 기존 실험본처럼 구버전 코드 위에 신버전 패치를 덧씌우는 방식을 사용하지 않습니다.

## 1. 절대 금지

아래 방식은 금지합니다.

```javascript
const oldUpdate = update;
update = function () {
  oldUpdate();
  // 새 패치
};
```

아래 방식도 금지합니다.

```javascript
// v0.1 함수
function resolveAttack() {}

// v0.2 patch
function resolveAttack() {}

// v0.3 patch
function resolveAttack() {}
```

## 2. 수정 원칙

수정은 반드시 기존 담당 파일의 기존 함수를 직접 고칩니다.

예시:

- 무기 수치 수정 → `js/data.js`
- 명중 판정 수정 → `js/battle.js`
- 이동 판단 수정 → `js/ai.js`
- 화면 출력 수정 → `js/render.js`
- 게임 루프 수정 → `js/main.js`

## 3. 중복 금지 함수

아래 함수는 프로젝트 안에 하나만 존재해야 합니다.

- `updateBattle`
- `resolveAttack`
- `decideMovement`
- `render`
- `createInitialState`
- `loop`

같은 이름의 새 함수를 뒤에 추가하지 않습니다.

## 4. requestAnimationFrame 규칙

`requestAnimationFrame`은 `js/main.js`에서만 호출합니다.

다른 파일에서 루프를 만들면 중복 실행과 끊김의 원인이 됩니다.

## 5. 1:1 전용 규칙

이 프로젝트는 1:1 전투 전용입니다.

아래 변수와 구조는 만들지 않습니다.

- `mode`
- `allies`
- `enemies`
- team battle
- 2:2
- 3:3

전투 상태는 항상 아래 구조를 기준으로 합니다.

```javascript
state = {
  player: {},
  enemy: {},
  result: null
};
```

## 6. 커밋 메시지 규칙

GitHub에 올릴 때 커밋 메시지는 아래처럼 씁니다.

```text
feat: add 1v1 combat sandbox
fix: adjust western sword hit arc
balance: tune spear minimum range
refactor: simplify battle state
```

## 7. 버전 업데이트 규칙

작업이 끝나면 `CHANGELOG.md`에 변경 내용을 기록합니다.

작은 수정은 `v0.1.1`, `v0.1.2`처럼 올립니다.

큰 기능 추가는 `v0.2.0`, `v0.3.0`처럼 올립니다.
