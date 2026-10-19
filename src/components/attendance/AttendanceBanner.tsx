// 출결 안내 배너: "참고용" 문구, 최종 반영일, 미확인 일 경고.
import { Alert } from "@/components/ui/alert";

/** ia.md §4 출결 배너: 참고용 · 최종 반영일, 미확인 일 경고. */
export function AttendanceBanner({ lastClosedDate, unclosedDates }: { lastClosedDate: string | null; unclosedDates: string[] }) {
  return (
    <div className="mb-4 space-y-2">
      <Alert tone="info">
        참고용 · 최종 반영일: <span className="font-medium tabular-nums">{lastClosedDate ?? "아직 없음"}</span>
        <span className="ml-1 text-xs">(학원 공식 출결과 다를 수 있습니다)</span>
      </Alert>
      {unclosedDates.length > 0 && (
        <Alert tone="warning">
          이번 단위기간에 출결 확인이 끝나지 않은 훈련일이 {unclosedDates.length}일 있습니다
          <span className="tabular-nums"> ({unclosedDates.slice(0, 3).join(", ")}{unclosedDates.length > 3 ? " 외" : ""})</span>.
        </Alert>
      )}
    </div>
  );
}
