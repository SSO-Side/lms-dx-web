# 티켓 상태 전이 명세 (M2)

구현 위치: `src/lib/tickets/transitions.ts` (순수 함수 `canTransition(from, to, actorRole, ctx)`)
테스트: 허용 전이는 아래 표에서, **불허 전이는 모든 (from, to, role) 조합을 반복문으로 자동 생성**해 "표에 없으면 거부"를 검증한다. 손으로 하나씩 쓰지 않는다.

## 전이표 (이 표가 유일한 기준)

| from | to | 가능 주체 | 조건 |
| :-- | :-- | :-- | :-- |
| PENDING | IN_REVIEW | INSTRUCTOR, MANAGER, ACADEMY_ADMIN | — |
| IN_REVIEW | APPROVED | INSTRUCTOR, MANAGER, ACADEMY_ADMIN | ABSENCE 티켓이면 승인 시 출결 이벤트 연동 (attendance.md §6) |
| IN_REVIEW | REJECTED | INSTRUCTOR, MANAGER, ACADEMY_ADMIN | `comment` 필수 (반려 사유) |
| IN_REVIEW | NEEDS_REVISION | INSTRUCTOR, MANAGER, ACADEMY_ADMIN | `comment` 필수 (보완 요청) |
| NEEDS_REVISION | PENDING | STUDENT (요청자 본인) | 재제출 |
| PENDING | CANCELED | STUDENT (요청자 본인) | 검토 시작 전만 |

- 위 6개 외 모든 전이는 거부한다. 종료 상태(APPROVED, REJECTED, CANCELED)에서는 나갈 수 없다.
- ADMIN(개발팀)은 시스템 관리 목적으로 모든 전이를 수행할 수 있다 (조건은 동일 적용).
- 모든 전이는 `TicketEvent`(actor, from, to, comment, 시각)를 같은 트랜잭션에서 기록한다.
- 티켓 생성은 STUDENT만, 생성 시 `assigneeId`는 해당 반의 주담당 매니저(`CohortStaff.isPrimary`)로 자동 지정한다. 주담당이 없으면 null로 두고 슈퍼어드민이 처리한다.
- 처리 주체의 반 접근 권한은 `requireCohortAccess`가 먼저 검사한다. 전이 함수는 역할과 조건만 본다.

## 병결·휴가 신청 (ABSENCE)
- 수강생은 서류가 필요한 병결·휴가만 신청한다. 지각·조퇴·일반 결석은 수강생이 담당자에게 연락하고 매니저가 출결 화면에서 체크한다.
- 입력: 날짜(하루 단위), 구분(SICK/LEAVE), 증빙 서류 **필수 1개 이상**. OTHER는 신규 접수 불가(기존 데이터 표시만).
- 입원 등 연속 결석은 수강생 신청 대신 매니저가 명부 카운터에서 기간 일괄 공결 처리한다(증빙 확인 후, 변경 이력 기록).
- 증빙은 `TicketAttachment`로 저장하고 `src/lib/storage`를 거친다. 열람은 본인과 반의 MANAGER·ACADEMY_ADMIN만.
- 허용 파일: 이미지(jpg, png, heic)와 pdf, 파일당 10MB 이하 (초과 시 거부).
