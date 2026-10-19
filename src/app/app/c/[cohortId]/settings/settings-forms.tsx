"use client";

// 반 설정 입력 폼(클라이언트): 반 기본 정보, 출결 규칙 값(attendanceConfig), 휴일 지정.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { updateCohortInfoAction, updateAttendanceConfigAction, setHolidayAction } from "@/server/cohort";
import type { AttendanceConfig } from "@/lib/attendance/compute";
import type { PeriodInfo } from "@/server/attendance-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const DAY_LABELS: Record<string, string> = { "0": "일", "1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토" };
const selectCls = "h-10 w-full rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900 disabled:bg-neutral-100";

type Pending = { title: string; description: string; run: () => Promise<{ ok: boolean; error?: string }> } | null;

export function SettingsForms({
  cohortId,
  canEdit,
  info,
  schedule,
  periods,
  config,
}: {
  cohortId: number;
  canEdit: boolean;
  info: { name: string; trainingType: string; room: string; status: "ACTIVE" | "ENDED" };
  schedule: { startDate: string; endDate: string; weekly: Record<string, [string, string]>; holidays: string[]; trainingDayCount: number };
  periods: (PeriodInfo & { allowedAbsences: number })[];
  config: AttendanceConfig;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [holidayInput, setHolidayInput] = useState("");

  const ask = (p: NonNullable<Pending>) => {
    setError(null);
    setSaved(null);
    setConfirm(p);
  };
  const execute = () => {
    if (!confirm) return;
    startTransition(async () => {
      const res = await confirm.run();
      if (!res.ok) {
        setError(res.error ?? "저장하지 못했습니다.");
        return;
      }
      setSaved(`${confirm.title.replace(/할까요\?$/, "")}했습니다.`);
      setConfirm(null);
      router.refresh();
    });
  };

  const num = (fd: FormData, k: string) => parseInt((fd.get(k) as string) ?? "", 10);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {saved && (
        <Alert tone="success" className="lg:col-span-2">
          {saved}
        </Alert>
      )}

      <Card>
        <form
          action={(fd) =>
            ask({
              title: "기본 정보를 저장할까요?",
              description: "과정명·강의실·상태가 모든 화면에 반영됩니다.",
              run: () =>
                updateCohortInfoAction(cohortId, {
                  name: fd.get("name") as string,
                  trainingType: (fd.get("trainingType") as string) ?? "",
                  room: (fd.get("room") as string) ?? "",
                  status: fd.get("status") as "ACTIVE" | "ENDED",
                }),
            })
          }
        >
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <fieldset disabled={!canEdit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">과정명</Label>
                <Input id="s-name" name="name" defaultValue={info.name} required maxLength={200} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-type">훈련 직종</Label>
                  <Input id="s-type" name="trainingType" defaultValue={info.trainingType} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-room">강의실</Label>
                  <Input id="s-room" name="room" defaultValue={info.room} maxLength={100} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-status">상태</Label>
                <select id="s-status" name="status" defaultValue={info.status} className={selectCls}>
                  <option value="ACTIVE">진행 중</option>
                  <option value="ENDED">종료</option>
                </select>
              </div>
            </fieldset>
          </CardContent>
          {canEdit && (
            <CardFooter>
              <Button type="submit">저장</Button>
            </CardFooter>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>훈련 일정</CardTitle>
          <CardDescription>
            {schedule.startDate} ~ {schedule.endDate} · 훈련일 {schedule.trainingDayCount}일
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {Object.entries(schedule.weekly)
              .sort(([a], [b]) => ((+a || 7) - (+b || 7)))
              .map(([d, [s, e]]) => (
                <li key={d} className="tabular-nums text-neutral-700">
                  <span className="mr-1 font-medium text-neutral-900">{DAY_LABELS[d]}</span>
                  {s}~{e}
                </li>
              ))}
          </ul>
          <div className="space-y-2">
            <p className="text-caption font-medium text-neutral-700">휴강일</p>
            {schedule.holidays.length === 0 ? (
              <p className="text-sm text-neutral-500">지정된 휴강일이 없습니다.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {schedule.holidays.map((h) => (
                  <li key={h} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pr-1 pl-3 text-sm tabular-nums text-neutral-700">
                    {h}
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`${h} 휴강 해제`}
                        className="rounded-full p-0.5 hover:bg-neutral-200"
                        onClick={() =>
                          ask({
                            title: "휴강을 해제할까요?",
                            description: `${h}을(를) 다시 훈련일로 바꿉니다. 단위기간 훈련일수와 허용 결석일이 다시 계산됩니다.`,
                            run: () => setHolidayAction(cohortId, h, false),
                          })
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  aria-label="휴강일 추가"
                  className="max-w-48"
                  min={schedule.startDate}
                  max={schedule.endDate}
                  value={holidayInput}
                  onChange={(e) => setHolidayInput(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={!holidayInput}
                  onClick={() =>
                    ask({
                      title: "휴강일로 지정할까요?",
                      description: `${holidayInput}을(를) 휴강으로 바꿉니다. 단위기간 훈련일수와 허용 결석일이 다시 계산됩니다.`,
                      run: async () => {
                        const r = await setHolidayAction(cohortId, holidayInput, true);
                        if (r.ok) setHolidayInput("");
                        return r;
                      },
                    })
                  }
                >
                  휴강 추가
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>단위기간</CardTitle>
          <CardDescription>출석률 요건은 단위기간마다 따로 계산됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-sm text-neutral-500">단위기간이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-1.5 font-medium">이름</th>
                  <th className="py-1.5 font-medium">기간</th>
                  <th className="py-1.5 text-right font-medium">훈련일</th>
                  <th className="py-1.5 text-right font-medium">허용 결석</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5 font-medium text-neutral-900">{p.label}</td>
                    <td className="py-1.5 tabular-nums text-neutral-700">
                      {p.startDate} ~ {p.endDate}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{p.trainingDays}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.allowedAbsences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <form
          action={(fd) => {
            const limitRaw = (fd.get("excusedLimit") as string)?.trim();
            ask({
              title: "출결 규칙을 저장할까요?",
              description: "모든 수강생의 잔여 허용 결석일과 등급이 새 규칙으로 다시 계산됩니다.",
              run: () =>
                updateAttendanceConfigAction(cohortId, {
                  requiredPercent: num(fd, "requiredPercent"),
                  lateEarlyToAbsent: num(fd, "lateEarlyToAbsent"),
                  combineLateEarly: fd.get("combineLateEarly") === "true",
                  excusedLimit: limitRaw ? parseInt(limitRaw, 10) : null,
                  normalMinRemaining: num(fd, "normalMinRemaining"),
                  warnMinRemaining: num(fd, "warnMinRemaining"),
                }),
            });
          }}
        >
          <CardHeader>
            <CardTitle>출결 규칙</CardTitle>
            <CardDescription>* 표시는 학원 확인 전 기본값입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-3">
              <NumField id="requiredPercent" label="출석률 요건(%)" value={config.requiredPercent} min={1} max={100} />
              <NumField id="lateEarlyToAbsent" label="지각·조퇴 몇 회 = 결석 1일" value={config.lateEarlyToAbsent} min={1} max={10} />
              <div className="space-y-1.5">
                <Label htmlFor="combineLateEarly">지각·조퇴 환산 방식 *</Label>
                <select id="combineLateEarly" name="combineLateEarly" defaultValue={String(config.combineLateEarly)} className={selectCls}>
                  <option value="true">합산해서 환산</option>
                  <option value="false">각각 따로 환산</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="excusedLimit">병결·휴가 단위기간 제한 *</Label>
                <Input id="excusedLimit" name="excusedLimit" type="number" min={0} max={100} placeholder="제한 없음" defaultValue={config.excused.limit ?? ""} />
              </div>
              <NumField id="normalMinRemaining" label="정상: 잔여 ≥ *" value={config.grade.normalMinRemaining} min={0} max={30} />
              <NumField id="warnMinRemaining" label="주의: 잔여 ≥ *" value={config.grade.warnMinRemaining} min={0} max={30} />
            </fieldset>
            <p className="mt-3 text-xs text-neutral-500">외출은 계산에서 제외됩니다(학원 확인 전).</p>
          </CardContent>
          {canEdit && (
            <CardFooter>
              <Button type="submit">저장</Button>
            </CardFooter>
          )}
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>기능 사용 여부</CardTitle>
          <CardDescription>챗봇·서류·면접 등 후속 모듈이 연결되면 여기에서 켜고 끌 수 있습니다.</CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          {error && <Alert tone="danger">{error}</Alert>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button onClick={execute} disabled={pending}>
              {pending ? "저장 중…" : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NumField({ id, label, value, min, max }: { id: string; label: string; value: number; min: number; max: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="number" min={min} max={max} required defaultValue={value} />
    </div>
  );
}
