# Circle Battle Tower Rebuild

1:1 자동 결투 기반 로그라이크 탑 등반 게임입니다.
기존 실험본의 패치 누적 구조를 버리고, GitHub Pages에 올릴 수 있는 분리형 프로젝트로 다시 구성했습니다.

## 현재 버전

v0.3.0

## 핵심 방향

- 1:1 전투 전용
- 2:2, 3:3, 아군, 팀전 구조 제외
- 사각형 전장
- 매 층 랜덤 상대 생성
- 층이 오를수록 상대 체력, 공격, 방어, 스킬 구성 상승
- 플레이어 스탯, 경험치, 레벨, 무기 숙련, 기본 스킬 구조 추가
- 승리하면 보상 선택 후 다음 층으로 이동
- 패배하면 새 런 시작

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
├─ README.md
├─ CHANGELOG.md
├─ DEVELOPMENT_RULES.md
├─ .gitignore
└─ .nojekyll
```

## 파일별 역할

- `index.html`: 화면 구조
- `css/style.css`: 디자인
- `js/data.js`: 무기, 성격, 스탯, 스킬, 보상, 층 성장 규칙
- `js/state.js`: 런 생성, 층 이동, 유닛 생성, 랜덤 상대 생성, 보상 적용
- `js/battle.js`: 공격 판정, 피해 계산, 승패 판정, 사각형 경계 처리
- `js/ai.js`: 1:1 자동 이동 판단
- `js/render.js`: 캔버스 그리기
- `js/main.js`: UI 연결과 단일 게임 루프
- `js/utils.js`: 공통 수학 함수

## 로컬 실행

`type="module"`을 사용하므로 파일을 더블클릭하면 브라우저 보안 정책에 막힐 수 있습니다.
아래처럼 로컬 서버로 실행하세요.

```bash
python -m http.server 8000
```

브라우저에서 접속합니다.

```text
http://localhost:8000
```

## GitHub Pages

저장소에 파일을 올린 뒤 `Settings → Pages`에서 아래처럼 설정합니다.

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

## 개발 원칙

- 기존 파일 아래에 패치 블록을 추가하지 않습니다.
- 같은 이름의 함수를 다시 선언하지 않습니다.
- 수정은 담당 파일의 기존 함수를 직접 수정합니다.
- `requestAnimationFrame`은 `main.js`에서만 호출합니다.
- 전투 계산은 `battle.js`, 화면 그리기는 `render.js`에서만 처리합니다.
