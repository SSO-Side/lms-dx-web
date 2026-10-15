# 디자인 테마 (토큰)

메인 컬러 `#3F58D4`. 이 문서의 값이 **유일한 기준**이다. 컴포넌트에서 임의의 hex·Tailwind 임의값(`bg-[#...]`)을 쓰지 않고 아래 토큰(CSS 변수 → Tailwind 색 이름)만 쓴다.
단일 **라이트 테마**(다크모드 없음). 톤은 차분하고 신뢰감 있게, 정보가 먼저 보이게. 장식(그라데이션, 일러스트, 큰 그림자)은 쓰지 않는다.
모든 텍스트 대비는 WCAG AA(4.5:1) 이상으로 계산해 확인했다.

## 1. 색

**Primary** (메인 `#3F58D4` = 500)

| 토큰 | 값 | 용도 |
| :-- | :-- | :-- |
| primary-50 | `#F0F3FF` | 선택된 메뉴 배경, 은은한 강조 영역 |
| primary-100 | `#E2E7FD` | 선택 행, 뱃지 배경(진행 중) |
| primary-200 | `#C7D0F9` | 보조 테두리 |
| primary-300 | `#A7B4F1` | 비활성 강조 |
| primary-400 | `#7B8CE0` | 아이콘 보조, 차트 보조색 |
| **primary-500** | `#3F58D4` | 기본 버튼, 링크, 포커스 링 (흰 글자 대비 5.9) |
| primary-600 | `#354CC0` | 버튼 hover (흰 글자 대비 7.1) |
| primary-700 | `#293DA3` | 버튼 active, 강조 텍스트(`primary-100` 위에서 7.5) |
| primary-800 / 900 | `#1F3084` / `#172463` | 제목 강조, 드물게 사용 |

**Neutral** (살짝 푸른 슬레이트)

| 토큰 | 값 | 용도 |
| :-- | :-- | :-- |
| neutral-50 | `#F8F9FC` | 앱 배경 |
| neutral-100 | `#F1F3F9` | 표 헤더, 비활성 영역 |
| neutral-200 | `#E3E7F0` | 기본 테두리, 구분선 |
| neutral-300 | `#CBD1DF` | 입력창 테두리 |
| neutral-400 | `#9AA3B8` | 플레이스홀더, 비활성 아이콘 (텍스트로는 사용 금지) |
| neutral-500 | `#6B7490` | 보조 텍스트 (흰 배경 대비 4.6) |
| neutral-600 | `#4F5770` | 본문 보조 |
| neutral-700 / 800 | `#3A4157` / `#272D40` | 본문 강조 |
| neutral-900 | `#161A2B` | 기본 본문·제목 (대비 17) |

**상태색** — 글자(fg)·배경(bg)·점/막대(solid) 세트로만 쓴다.

| 의미 | fg (텍스트) | bg (뱃지·알림 배경) | solid (점·막대·아이콘) |
| :-- | :-- | :-- | :-- |
| success | `#22773A` | `#EBF9EF` | `#2E9E4D` |
| warning | `#915A08` | `#FEF5E7` | `#C2780A` |
| danger | `#AD1F1F` | `#FBE9E9` | `#D93636` |
| info(진행 중) | `#293DA3` | `#E2E7FD` | `#3F58D4` |
| neutral(대기·없음) | `#4F5770` | `#F1F3F9` | `#9AA3B8` |

**도메인 상태 → 색 매핑** (색만으로 구분하지 않고 항상 **텍스트 라벨 + 아이콘**을 같이 쓴다)

| 대상 | 값 | 색 | 라벨 |
| :-- | :-- | :-- | :-- |
| 출결 등급 | NORMAL | success | 정상 |
| | WARN | warning | 주의 |
| | DANGER | danger | 위험 |
| | NA | neutral | 계산 불가 |
| 티켓 | PENDING | neutral | 대기 |
| | IN_REVIEW | info | 검토 중 |
| | APPROVED | success | 승인 |
| | REJECTED | danger | 반려 |
| | NEEDS_REVISION | warning | 보완 요청 |
| | CANCELED | neutral | 취소 |
| 과제 제출 | SUBMITTED / LATE / RETURNED | success / warning / info | 제출 / 지각 제출 / 반환 |

## 2. shadcn 변수 매핑 (`src/app/globals.css`에 한 번만 반영)
`globals.css`가 쓰는 색 표기(oklch 또는 hsl)에 맞게 위 hex를 변환해 넣는다. 값의 기준은 이 문서다.

| shadcn 변수 | 토큰 |
| :-- | :-- |
| `--background` | neutral-50 |
| `--foreground` | neutral-900 |
| `--card`, `--popover` | `#FFFFFF` |
| `--card-foreground`, `--popover-foreground` | neutral-900 |
| `--primary` | primary-500 |
| `--primary-foreground` | `#FFFFFF` |
| `--secondary` | neutral-100 |
| `--secondary-foreground` | neutral-700 |
| `--muted` | neutral-100 |
| `--muted-foreground` | neutral-500 |
| `--accent` | primary-50 |
| `--accent-foreground` | primary-700 |
| `--destructive` | danger solid |
| `--border` | neutral-200 |
| `--input` | neutral-300 |
| `--ring` | primary-500 |
| `--radius` | `0.5rem` |
| `--sidebar` / `--sidebar-foreground` | `#FFFFFF` / neutral-700 |
| `--sidebar-primary` / `-foreground` | primary-500 / `#FFFFFF` |
| `--sidebar-accent` / `-foreground` | primary-50 / primary-700 |
| `--sidebar-border` | neutral-200 |

상태색(success/warning/danger/info/neutral의 fg·bg·solid)은 `--status-success-fg` 같은 **추가 변수**로 정의하고 Tailwind 테마에 `status-success` 등으로 노출한다.

## 3. 타이포그래피
- 폰트: 1차는 시스템 스택 `"Pretendard Variable", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`. Pretendard 파일·패키지 도입은 승인 후(의존성 규칙).
- 크기: 12 / 13 / 14 / 16 / 18 / 20 / 24 / 30px. 본문 기본은 **14px(관리자 화면)**, **16px(수강생 화면)**. 12px 미만은 쓰지 않는다.
- 굵기: 400(본문), 500(라벨·표 헤더), 600(제목). 700 이상은 쓰지 않는다.
- 줄 간격: 한글 본문 1.6, 제목 1.35. 숫자 열은 `tabular-nums`.

## 4. 간격·모양
- 간격은 4px 격자(4/8/12/16/24/32). 카드 안쪽 여백 16(관리자 12).
- 모서리: 컨트롤 8px, 카드 12px, 뱃지 전체 둥글게. 그림자는 사용하지 않고 **1px 테두리(neutral-200)**로 구분한다. 오버레이(드로어·모달)만 약한 그림자 허용.
- 아이콘은 shadcn 기본 `lucide-react`만, 크기 16/20px, 선 두께 기본.
- 모션은 150ms 이내 페이드·슬라이드만. 데이터 갱신에 애니메이션을 쓰지 않는다.

## 5. 밀도 (역할별)
| 역할 | 밀도 | 기준 |
| :-- | :-- | :-- |
| 매니저·슈퍼어드민·강사 | 촘촘함(compact) | 본문 14px, 표 행 높이 40px, 카드 패딩 12, 데스크톱 우선 |
| 수강생 | 여유(comfortable) | 본문 16px, 터치 영역 최소 44px, 카드 패딩 16, **모바일(360px) 우선** |

## 6. 레이아웃 규칙
- 데스크톱(≥1024px): 좌측 사이드바(접을 수 있음, 아이콘+라벨) + 상단 바(반 전환, 사용자 메뉴) + 콘텐츠 최대폭 1280px.
- 모바일(<768px): 수강생은 **하단 탭바**(홈·출결·티켓·자료), 상단 바는 반 이름과 사용자 메뉴. 교사·매니저도 모바일에서 깨지지 않게 하되 최적화 대상은 아니다.
- 그리드는 12열, 위젯은 `Widget` 카드 단위. 모바일은 1열 쌓기이고 순서는 `screens.md`를 따른다.
- **드로어**(shadcn Sheet): 상세·편집용. 데스크톱은 우측 480px, 모바일은 하단 전체 높이의 85%. **모달**(Dialog)은 확인·증빙 이미지 미리보기처럼 짧은 작업만.

## 7. 공용 컴포넌트 (`src/components/`, 새로 만들 것은 이 세 가지로 시작)
- `StatusBadge`: 위 매핑 표를 데이터로 갖고 `(domain, value)`를 받아 색+아이콘+라벨 렌더. 상태 표시는 반드시 이것을 쓴다.
- `Widget`: 제목, 선택적 우측 액션, 본문. **로딩(스켈레톤)·빈 상태·오류 상태를 필수로 지원**한다. 모든 대시보드 카드는 이것으로 감싼다.
- `DataTable`: shadcn Table 래퍼. compact/comfortable 밀도 옵션, 빈 상태 문구, 행 클릭 시 드로어 열기 콜백.

## 8. 접근성·문구
- 포커스 링은 primary-500 2px + 오프셋 2px. 키보드로 모든 동작이 가능해야 한다.
- 오류·성공 메시지는 색과 텍스트를 함께 쓴다. 문구는 짧은 한국어 존댓말 ("저장했습니다", "반려 사유를 입력해 주세요").
- 출결 화면에는 항상 "참고용"과 "최종 반영일"을 표시한다 (attendance.md §6).
