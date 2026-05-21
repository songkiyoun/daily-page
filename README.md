## v0.8.5 - 분신술 독립 유닛화와 아이콘 겹침 수정

- `분신술` 분신이 적 주변을 고정적으로 빙글빙글 도는 방식이 아니라, 별도 위치·속도·체력·공격 주기를 가진 독립 소환 유닛처럼 움직이도록 수정했습니다.
- 적이 분신을 실제 타겟 후보로 인식하고 접근·회전·공격할 수 있도록 기존 전투 타겟 선택과 공격 판정에 통합했습니다.
- 분신이 공격을 받으면 체력이 감소하고, 체력 0이 되면 파괴되도록 직접 피격 판정을 보강했습니다.
- 아이콘 이미지 로딩 성공 시 대체 텍스트 아이콘이 겹쳐 보이지 않도록 `icon-loaded` 상태 처리를 추가했습니다.
- `VERSION`과 캐시버스트 값을 v0.8.5로 갱신했습니다.
- `google-apps-script` 폴더는 포함하지 않습니다.

# icon 폴더 사용 안내

이 폴더에 아래 파일명 그대로 PNG 이미지를 넣으면 게임 UI에서 자동으로 표시됩니다.
실제 이미지 파일은 포함하지 않았으며, 파일이 없을 때는 기존 텍스트 아이콘이 대체 표시됩니다.

## 무기 단계 아이콘
- dagger_1.png
- dagger_2.png
- dagger_3.png
- dagger_4.png
- dagger_5.png
- eastern_sword_1.png
- eastern_sword_2.png
- eastern_sword_3.png
- eastern_sword_4.png
- eastern_sword_5.png
- western_sword_1.png
- western_sword_2.png
- western_sword_3.png
- western_sword_4.png
- western_sword_5.png
- spear_1.png
- spear_2.png
- spear_3.png
- spear_4.png
- spear_5.png

## 아이템 아이콘
- item_gold.png
- item_enhancement_stone.png
- item_boss_soul.png
