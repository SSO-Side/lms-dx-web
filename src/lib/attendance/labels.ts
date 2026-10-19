/** 출결 이벤트 종류 이름 */
export const EV_TYPE_LABELS = { ABSENT: "결석", LATE: "지각", EARLY_LEAVE: "조퇴", OUT: "외출" } as const;
/** 공결 사유 이름 */
export const EXCUSED_LABELS = { SICK: "병결", LEAVE: "휴가" } as const;
/** 화면에 보여 줄 이벤트 종류 순서 */
export const EV_TYPE_ORDER = ["ABSENT", "LATE", "EARLY_LEAVE", "OUT"] as const;
