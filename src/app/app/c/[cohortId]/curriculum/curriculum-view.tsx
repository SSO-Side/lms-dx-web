"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Download, ExternalLink, FileText, FolderGit2, Paperclip, Plus, Trash2, Compass, ClipboardList } from "lucide-react";
import type { MaterialType } from "@prisma/client";
import {
  createWeekAction,
  createLessonAction,
  createMaterialAction,
  deleteMaterialAction,
  createAssignmentAction,
  deleteAssignmentAction,
  submitAssignmentAction,
  getSubmissionStatusAction,
} from "@/server/curriculum";
import type { AssignmentItem, LessonItem, WeekItem } from "@/server/curriculum-queries";
import { formatYmdWithDow } from "@/lib/dates";
import { COURSE_FILE_ACCEPT, COURSE_FILE_HINT } from "@/lib/storage/validators";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const MATERIAL_LABELS: Record<MaterialType, string> = { DOC: "문서", FILE: "파일", REPO: "저장소", GUIDE: "가이드" };
const MATERIAL_ICONS = { DOC: FileText, FILE: Paperclip, REPO: FolderGit2, GUIDE: Compass } as const;
const fileInputCls =
  "block w-full text-sm text-neutral-600 file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:text-sm file:font-medium file:text-primary-700";
const fileHref = (cohortId: number, kind: "materials" | "submissions", id: number) => `/api/c/${cohortId}/${kind}/${id}/file`;
const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);
const selectCls = "h-10 w-full rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900";

type Panel =
  | { kind: "week" }
  | { kind: "lesson"; weekId: number }
  | { kind: "material"; lesson: LessonItem }
  | { kind: "assignment"; lesson: LessonItem }
  | { kind: "submit"; assignment: AssignmentItem }
  | { kind: "status"; assignment: AssignmentItem }
  | { kind: "delete"; target: "material" | "assignment"; id: number; title: string }
  | null;

export function CurriculumView({
  cohortId,
  weeks,
  selectedWeekId,
  canWrite,
  isStudent,
  enrolledCount,
  today,
}: {
  cohortId: number;
  weeks: WeekItem[];
  selectedWeekId: number | null;
  canWrite: boolean;
  isStudent: boolean;
  enrolledCount: number;
  today: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const week = weeks.find((w) => w.id === selectedWeekId) ?? null;
  const base = `/app/c/${cohortId}/curriculum`;
  const close = () => setPanel(null);

  if (weeks.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-card px-4 py-12 text-center">
          <BookOpen className="size-6 text-neutral-400" aria-hidden />
          <p className="text-sm text-neutral-500">아직 등록된 주차가 없습니다.</p>
          {canWrite && (
            <Button onClick={() => setPanel({ kind: "week" })}>
              <Plus /> 주차 추가
            </Button>
          )}
        </div>
        <Panels cohortId={cohortId} panel={panel} onClose={close} enrolledCount={enrolledCount} />
      </>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
      {/* 주차 트리 (데스크톱) / 주차 선택 (모바일) */}
      <aside className="md:sticky md:top-20 md:self-start">
        <select
          aria-label="주차 선택"
          className={cn(selectCls, "h-12 text-base md:hidden")}
          value={week?.id ?? ""}
          onChange={(e) => router.push(`${base}?week=${e.target.value}`)}
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.weekNo}주차 · {w.title}
            </option>
          ))}
        </select>
        <nav aria-label="주차" className="hidden space-y-0.5 md:block">
          {weeks.map((w) => (
            <Link
              key={w.id}
              href={`${base}?week=${w.id}`}
              aria-current={w.id === week?.id ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-2 text-sm",
                w.id === week?.id ? "bg-primary-50 font-medium text-primary-700" : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              <span className="tabular-nums">{w.weekNo}주차</span>
              <span className="block truncate text-xs text-neutral-500">{w.title}</span>
            </Link>
          ))}
          {canWrite && (
            <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => setPanel({ kind: "week" })}>
              <Plus /> 주차 추가
            </Button>
          )}
        </nav>
      </aside>

      <section className="min-w-0 space-y-3">
        {week && (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900">
              {week.weekNo}주차 · {week.title}
            </h2>
            {canWrite && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="md:hidden" onClick={() => setPanel({ kind: "week" })}>
                  주차 추가
                </Button>
                <Button size="sm" onClick={() => setPanel({ kind: "lesson", weekId: week.id })}>
                  <Plus /> 수업 추가
                </Button>
              </div>
            )}
          </div>
        )}

        {week && week.lessons.length === 0 && (
          <div className="rounded-xl border border-neutral-200 bg-card px-4 py-10 text-center text-sm text-neutral-500">
            아직 이 주차에 수업이 없습니다.
          </div>
        )}

        {week?.lessons.map((l) => (
          <article key={l.id} className={cn("rounded-xl border bg-card", l.date === today ? "border-primary-300" : "border-neutral-200")}>
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-neutral-500 tabular-nums">
                  {formatYmdWithDow(l.date)}
                  {l.date === today && <span className="ml-1.5 font-medium text-primary-700">오늘</span>}
                  {l.instructorName && ` · ${l.instructorName}`}
                </p>
                <h3 className="font-semibold text-neutral-900">{l.title}</h3>
              </div>
              {canWrite && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setPanel({ kind: "material", lesson: l })}>
                    <Plus /> 자료 추가
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPanel({ kind: "assignment", lesson: l })}>
                    <Plus /> 과제 추가
                  </Button>
                </div>
              )}
            </header>
            <div className="space-y-3 px-4 py-3">
              {l.materials.length === 0 && l.assignments.length === 0 && <p className="text-sm text-neutral-500">아직 자료·과제가 없습니다.</p>}
              {l.materials.length > 0 && (
                <ul className="space-y-1">
                  {l.materials.map((m) => {
                    const Icon = MATERIAL_ICONS[m.type];
                    const TrailIcon = m.file ? Download : ExternalLink;
                    return (
                      <li key={m.id} className="flex items-center gap-2">
                        <a
                          href={m.file ? fileHref(cohortId, "materials", m.id) : (m.url ?? "#")}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 hover:bg-neutral-50"
                        >
                          <Icon className="size-4 shrink-0 text-primary-500" aria-hidden />
                          <span className="truncate text-sm font-medium text-neutral-900">{m.title}</span>
                          <span className="shrink-0 text-xs text-neutral-500">{MATERIAL_LABELS[m.type]}</span>
                          {m.tags.map((t) => (
                            <span key={t} className="hidden shrink-0 rounded bg-neutral-100 px-1.5 text-xs text-neutral-600 sm:inline">
                              {t}
                            </span>
                          ))}
                          {m.file && <span className="shrink-0 text-xs text-neutral-500 tabular-nums">{formatSize(m.file.size)}</span>}
                          <TrailIcon className="ml-auto size-3.5 shrink-0 text-neutral-400" aria-hidden />
                        </a>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${m.title} 삭제`}
                            onClick={() => setPanel({ kind: "delete", target: "material", id: m.id, title: m.title })}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {l.assignments.map((a) => {
                const overdue = new Date(a.dueAtIso) < new Date();
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                    <ClipboardList className="size-4 shrink-0 text-neutral-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{a.title}</p>
                      <p className={cn("text-xs tabular-nums", overdue ? "text-neutral-500" : "text-neutral-600")}>마감 {a.dueAt}</p>
                    </div>
                    {isStudent ? (
                      <>
                        <StatusBadge domain="submission" value={a.mySubmission?.status ?? "NONE"} />
                        <Button size="sm" variant={a.mySubmission ? "outline" : "default"} className="min-h-11 sm:min-h-0" onClick={() => setPanel({ kind: "submit", assignment: a })}>
                          {a.mySubmission ? "다시 제출" : "제출"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setPanel({ kind: "status", assignment: a })}>
                          제출 {a.submittedCount}/{enrolledCount}
                        </Button>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${a.title} 삭제`}
                            onClick={() => setPanel({ kind: "delete", target: "assignment", id: a.id, title: a.title })}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <Panels cohortId={cohortId} panel={panel} onClose={close} enrolledCount={enrolledCount} />
    </div>
  );
}

function Panels({ cohortId, panel, onClose, enrolledCount }: { cohortId: number; panel: Panel; onClose: () => void; enrolledCount: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [materialSource, setMaterialSource] = useState<"link" | "file">("link");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "처리하지 못했습니다.");
      onClose();
      router.refresh();
    });
  };
  const closeAll = () => {
    setError(null);
    onClose();
  };
  const err = error && <Alert tone="danger">{error}</Alert>;
  const footer = (label: string) => (
    <SheetFooter>
      <Button variant="outline" onClick={closeAll}>
        취소
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : label}
      </Button>
    </SheetFooter>
  );

  return (
    <>
      {/* 주차 추가 */}
      <Dialog open={panel?.kind === "week"} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent>
          <form className="grid gap-4" action={(fd) => run(() => createWeekAction(cohortId, { title: (fd.get("title") as string) ?? "" }))}>
            <DialogHeader>
              <DialogTitle>주차 추가</DialogTitle>
              <DialogDescription>주차 번호는 자동으로 다음 번호가 붙습니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="w-title">주차 제목</Label>
              <Input id="w-title" name="title" required maxLength={200} placeholder="예: 2주차 파이썬 기초" autoFocus />
            </div>
            {err}
            <DialogFooter>
              <Button variant="outline" onClick={closeAll}>
                취소
              </Button>
              <Button type="submit" disabled={pending}>
                추가
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 수업 추가 */}
      <Sheet open={panel?.kind === "lesson"} onOpenChange={(o) => !o && closeAll()}>
        <SheetContent>
          {panel?.kind === "lesson" && (
            <form
              className="flex h-full flex-col"
              action={(fd) =>
                run(() =>
                  createLessonAction(cohortId, { weekId: panel.weekId, date: fd.get("date") as string, title: fd.get("title") as string })
                )
              }
            >
              <SheetHeader>
                <SheetTitle>수업 추가</SheetTitle>
              </SheetHeader>
              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="l-date">수업 날짜</Label>
                  <Input id="l-date" name="date" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-title">수업명</Label>
                  <Input id="l-title" name="title" required maxLength={200} />
                </div>
                {err}
              </SheetBody>
              {footer("추가")}
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* 자료 추가: 버튼 → 입력 → 저장 (3클릭 이내) */}
      <Sheet open={panel?.kind === "material"} onOpenChange={(o) => !o && closeAll()}>
        <SheetContent>
          {panel?.kind === "material" && (
            <form
              className="flex h-full flex-col"
              action={(fd) => {
                fd.set("lessonId", String(panel.lesson.id));
                fd.set("source", materialSource);
                run(() => createMaterialAction(cohortId, fd));
              }}
            >
              <SheetHeader>
                <SheetTitle>자료 추가</SheetTitle>
                <SheetDescription>
                  {formatYmdWithDow(panel.lesson.date)} · {panel.lesson.title}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-4">
                <div role="radiogroup" aria-label="자료 방식" className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
                  {(["link", "file"] as const).map((src) => (
                    <button
                      key={src}
                      type="button"
                      role="radio"
                      aria-checked={materialSource === src}
                      onClick={() => setMaterialSource(src)}
                      className={cn(
                        "h-9 rounded-md text-sm font-medium",
                        materialSource === src ? "bg-card text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                      )}
                    >
                      {src === "link" ? "링크" : "파일 올리기"}
                    </button>
                  ))}
                </div>
                {materialSource === "link" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="m-url">링크</Label>
                    <Input id="m-url" name="url" type="url" required placeholder="https://" autoFocus />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="m-file">파일</Label>
                    <input id="m-file" name="file" type="file" required accept={COURSE_FILE_ACCEPT} className={fileInputCls} />
                    <p className="text-xs text-neutral-500">{COURSE_FILE_HINT}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="m-title">제목</Label>
                  <Input id="m-title" name="title" required maxLength={200} />
                </div>
                <div className={cn("grid gap-3", materialSource === "link" && "grid-cols-2")}>
                  <div className={cn("space-y-1.5", materialSource === "file" && "hidden")}>
                    <Label htmlFor="m-type">종류</Label>
                    <select id="m-type" name="type" defaultValue="DOC" className={selectCls}>
                      {(Object.keys(MATERIAL_LABELS) as MaterialType[]).map((t) => (
                        <option key={t} value={t}>
                          {MATERIAL_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-tags">태그 (쉼표로 구분)</Label>
                    <Input id="m-tags" name="tags" placeholder="python, 실습" />
                  </div>
                </div>
                {err}
              </SheetBody>
              {footer("등록")}
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* 과제 추가 */}
      <Sheet open={panel?.kind === "assignment"} onOpenChange={(o) => !o && closeAll()}>
        <SheetContent>
          {panel?.kind === "assignment" && (
            <form
              className="flex h-full flex-col"
              action={(fd) =>
                run(() =>
                  createAssignmentAction(cohortId, {
                    lessonId: panel.lesson.id,
                    title: fd.get("title") as string,
                    description: (fd.get("description") as string) || undefined,
                    dueAt: fd.get("dueAt") as string,
                  })
                )
              }
            >
              <SheetHeader>
                <SheetTitle>과제 추가</SheetTitle>
                <SheetDescription>
                  {formatYmdWithDow(panel.lesson.date)} · {panel.lesson.title}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="a-title">제목</Label>
                  <Input id="a-title" name="title" required maxLength={200} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-due">마감 일시</Label>
                  <Input id="a-due" name="dueAt" type="datetime-local" required defaultValue={`${panel.lesson.date}T23:59`} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-desc">설명 (선택)</Label>
                  <Textarea id="a-desc" name="description" maxLength={5000} />
                </div>
                {err}
              </SheetBody>
              {footer("등록")}
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* 과제 제출 (수강생) */}
      <Sheet open={panel?.kind === "submit"} onOpenChange={(o) => !o && closeAll()}>
        <SheetContent>
          {panel?.kind === "submit" && (
            <form
              className="flex h-full flex-col"
              action={(fd) => {
                fd.set("assignmentId", String(panel.assignment.id));
                run(() => submitAssignmentAction(cohortId, fd));
              }}
            >
              <SheetHeader>
                <SheetTitle>{panel.assignment.title}</SheetTitle>
                <SheetDescription>마감 {panel.assignment.dueAt}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-4">
                {panel.assignment.description && (
                  <p className="rounded-lg bg-neutral-50 p-3 text-sm whitespace-pre-wrap text-neutral-800">{panel.assignment.description}</p>
                )}
                {panel.assignment.mySubmission && (
                  <Alert tone="info">
                    {panel.assignment.mySubmission.submittedAt}에 제출했습니다. 다시 제출하면 덮어씁니다.
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="s-file">파일</Label>
                  <input id="s-file" name="file" type="file" accept={COURSE_FILE_ACCEPT} className={fileInputCls} />
                  <p className="text-xs text-neutral-500">{COURSE_FILE_HINT}</p>
                  {panel.assignment.mySubmission?.fileName && (
                    <p className="text-xs text-neutral-600">
                      제출한 파일:{" "}
                      <a
                        href={fileHref(cohortId, "submissions", panel.assignment.mySubmission.id)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary-500 hover:underline"
                      >
                        {panel.assignment.mySubmission.fileName}
                      </a>{" "}
                      · 새 파일을 고르지 않으면 그대로 둡니다.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-link">링크 (GitHub, 드라이브 등 · 선택)</Label>
                  <Input
                    id="s-link"
                    name="linkUrl"
                    type="url"
                    className="h-12 text-base"
                    placeholder="https://"
                    defaultValue={panel.assignment.mySubmission?.linkUrl ?? ""}
                  />
                </div>
                {new Date(panel.assignment.dueAtIso) < new Date() && <Alert tone="warning">마감이 지나 지각 제출로 기록됩니다.</Alert>}
                {err}
              </SheetBody>
              <SheetFooter>
                <Button size="lg" variant="outline" onClick={closeAll}>
                  취소
                </Button>
                <Button size="lg" type="submit" disabled={pending}>
                  {pending ? "제출하는 중…" : "제출"}
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <SubmissionStatusSheet
        cohortId={cohortId}
        assignment={panel?.kind === "status" ? panel.assignment : null}
        enrolledCount={enrolledCount}
        onClose={closeAll}
      />

      {/* 삭제 확인 */}
      <Dialog open={panel?.kind === "delete"} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent>
          {panel?.kind === "delete" && (
            <>
              <DialogHeader>
                <DialogTitle>{panel.target === "material" ? "자료" : "과제"}를 삭제할까요?</DialogTitle>
                <DialogDescription>{panel.title}</DialogDescription>
              </DialogHeader>
              {err}
              <DialogFooter>
                <Button variant="outline" onClick={closeAll}>
                  취소
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(() => (panel.target === "material" ? deleteMaterialAction(cohortId, panel.id) : deleteAssignmentAction(cohortId, panel.id)))
                  }
                >
                  삭제
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type StatusRow = {
  studentId: number;
  name: string;
  loginId: string;
  status: "SUBMITTED" | "LATE" | "RETURNED" | null;
  linkUrl: string | null;
  file: { submissionId: number; name: string } | null;
  submittedAt: string | null;
};

function SubmissionStatusSheet({
  cohortId,
  assignment,
  enrolledCount,
  onClose,
}: {
  cohortId: number;
  assignment: AssignmentItem | null;
  enrolledCount: number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  if (assignment && loadedFor !== assignment.id) {
    setLoadedFor(assignment.id);
    setRows(null);
    setError(null);
    getSubmissionStatusAction(cohortId, assignment.id).then((res) => (res.ok ? setRows(res.rows) : setError(res.error)));
  }

  return (
    <Sheet
      open={assignment !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setLoadedFor(null);
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>제출 현황 · {assignment?.title}</SheetTitle>
          <SheetDescription>
            마감 {assignment?.dueAt} · 제출 {assignment?.submittedCount}/{enrolledCount}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {error && <Alert tone="danger">{error}</Alert>}
          {!rows && !error && <div className="h-40 animate-pulse rounded-lg bg-neutral-100" aria-busy="true" />}
          {rows && (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {rows.map((r) => (
                <li key={r.studentId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">{r.name}</p>
                    {r.submittedAt && <p className="text-xs text-neutral-500 tabular-nums">{r.submittedAt}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.file && (
                      <a
                        href={fileHref(cohortId, "submissions", r.file.submissionId)}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={r.file.name}
                        className="text-xs text-primary-500 hover:underline"
                      >
                        파일
                      </a>
                    )}
                    {r.linkUrl && (
                      <a href={r.linkUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-primary-500 hover:underline">
                        링크 열기
                      </a>
                    )}
                    <StatusBadge domain="submission" value={r.status ?? "NONE"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
