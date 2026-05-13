# Circle Battle Tower Rebuild

1:1 자동 결투 기반 로그라이크 탑 등반 게임의 새 프로젝트 뼈대입니다.

기존 실험본은 참고용으로만 사용하고, 이 프로젝트는 패치 덧씌우기 없이 정해진 파일의 기존 함수를 직접 수정하는 방식으로 관리합니다.

## 현재 버전

v0.1.0 전투 샌드박스

## 핵심 방향

- 1:1 전투 전용
- 2:2, 3:3, 아군 시스템 없음
- 무기별 거리감과 타격 리듬 중심
- GitHub Pages 배포 기준
- ES Module 기반 파일 분리 구조
- 패치 블록 누적 금지

## 파일 구조

```text
circle-battle-rebuild/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ main.js
│  ├─ data.js
│  ├─ state.js
│  ├─ battle.js
│  ├─ ai.js
│  ├─ render.js
│  └─ utils.js
├─ CHANGELOG.md
├─ DEVELOPMENT_RULES.md
├─ README.md
└─ .gitignore
```

## 파일별 역할

### `index.html`

화면 뼈대와 DOM 구조만 담당합니다.

### `css/style.css`

디자인과 반응형 레이아웃만 담당합니다.

### `js/main.js`

앱 초기화, 버튼 연결, 단일 게임 루프를 담당합니다.

중요 원칙:

- `requestAnimationFrame`은 이 파일에서만 호출합니다.
- 다른 파일에서 게임 루프를 새로 만들지 않습니다.

### `js/data.js`

무기, 성격, 기본 스탯 데이터를 담당합니다.

무기 수치 수정은 이 파일에서 직접 합니다.

### `js/state.js`

게임 상태 생성과 초기화를 담당합니다.

1:1 전용 구조이므로 `mode`, `allies`, `enemies`를 만들지 않습니다.

### `js/battle.js`

공격 판정, 피해 계산, 승패 판정을 담당합니다.

명중률, 데미지, 넉백, 사거리 판정은 이 파일에서 직접 수정합니다.

### `js/ai.js`

자동 이동 판단을 담당합니다.

단검이 뒤를 못 잡거나, 창이 거리를 못 벌리면 이 파일을 수정합니다.

### `js/render.js`

캔버스 그리기만 담당합니다.

전투 계산을 이 파일에 넣지 않습니다.

### `js/utils.js`

거리, 각도, 랜덤, 보정 함수 같은 공통 유틸만 담당합니다.

## 실행 방법

### GitHub Pages 기준

1. GitHub에 새 저장소를 만듭니다.
2. 이 폴더 안의 파일을 그대로 업로드합니다.
3. Repository Settings → Pages에서 배포 브랜치를 설정합니다.
4. 배포 주소에서 `index.html`이 자동 실행됩니다.

### 로컬 테스트

ES Module 구조라서 브라우저에서 `index.html`을 파일로 직접 열면 환경에 따라 차단될 수 있습니다.

로컬에서는 아래 방식 중 하나를 사용합니다.

```bash
python -m http.server 8000
```

그 다음 브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:8000
```

## 버전 관리 방식

- `main`: 안정 버전
- `dev`: 개발 중인 버전
- `feature/weapon-balance`: 무기 밸런스 작업
- `feature/tower-system`: 탑 등반 시스템 작업
- `feature/reward-system`: 보상 시스템 작업

처음에는 `main`만 써도 됩니다. 기능이 늘어나면 브랜치를 나눕니다.

## 다음 작업 예정

- v0.1.1 창 기준 타격감 고정
- v0.1.2 서양검 명중감 개선
- v0.1.3 동양검 진입 리듬 개선
- v0.1.4 단검 측후방 판정 개선
- v0.2.0 캐릭터 생성 화면
- v0.3.0 1:1 탑 등반 구조
