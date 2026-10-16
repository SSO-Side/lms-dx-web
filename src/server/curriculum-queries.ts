import { EnrollmentStatus, type MaterialType, type Role, type SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dateToYmd, formatDateTime, ymdToDate } from "@/lib/dates";

// 호출 측이 먼저 requireCohortAccess로 권한을 확인하고 ctx.cohortId만 넘긴다.

/** 링크 자료면 url, 파일 자료면 file (다운로드는 /api/c/[cohortId]/materials/[id]/file) */
export type MaterialItem = { id: number; type: MaterialType; title: string; url: string | null; file: { name: string; size: number } | null; tags: string[] };
export type AssignmentItem = {
  id: number;
  title: string;
  description: string | null;
  dueAt: string;
  dueAtIso: string;
  /** 수강생: 본인 제출 */
  mySubmission: { id: number; status: SubmissionStatus; linkUrl: string | null; fileName: string | null; submittedAt: string } | null;
  /** 교사: 제출 수 */
  submittedCount: number;
};
export type LessonItem = {
  id: number;
  date: string;
  title: string;
  instructorName: string | null;
  materials: MaterialItem[];
  assignments: AssignmentItem[];
};
export type WeekItem = { id: number; weekNo: number; title: string; lessons: LessonItem[] };

export async function getCurriculum(cohortId: number, viewer: { id: number; role: Role }) {
  const isStudent = viewer.role === "STUDENT";
  const [weeks, enrolledCount] = await Promise.all([
    db.week.findMany({
      where: { cohortId },
      orderBy: { weekNo: "asc" },
      include: {
        lessons: {
          orderBy: [{ date: "asc" }, { id: "asc" }],
          include: {
            instructor: { select: { name: true } },
            materials: { orderBy: { id: "asc" } },
            assignments: {
              orderBy: { dueAt: "asc" },
              include: {
                submissions: isStudent
                  ? { where: { studentId: viewer.id } }
                  : { where: { student: { enrollments: { some: { cohortId, status: EnrollmentStatus.ENROLLED } } } }, select: { id: true } },
                _count: { select: { submissions: true } },
              },
            },
          },
        },
      },
    }),
    db.enrollment.count({ where: { cohortId, status: EnrollmentStatus.ENROLLED } }),
  ]);

  const result: WeekItem[] = weeks.map((w) => ({
    id: w.id,
    weekNo: w.weekNo,
    title: w.title,
    lessons: w.lessons.map((l) => ({
      id: l.id,
      date: dateToYmd(l.date),
      title: l.title,
      instructorName: l.instructor?.name ?? null,
      materials: l.materials.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        url: m.url,
        file: m.filePath ? { name: m.fileName ?? m.title, size: m.fileSize ?? 0 } : null,
        tags: Array.isArray(m.tags) ? (m.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
      })),
      assignments: l.assignments.map((a) => {
        const mine = isStudent
          ? (a.submissions[0] as { id: number; status: SubmissionStatus; linkUrl: string | null; filePath: string | null; fileName: string | null; submittedAt: Date } | undefined)
          : undefined;
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          dueAt: formatDateTime(a.dueAt),
          dueAtIso: a.dueAt.toISOString(),
          mySubmission: mine
            ? {
                id: mine.id,
                status: mine.status,
                linkUrl: mine.linkUrl,
                fileName: mine.filePath ? (mine.fileName ?? "제출 파일") : null,
                submittedAt: formatDateTime(mine.submittedAt),
              }
            : null,
          submittedCount: isStudent ? 0 : a.submissions.length,
        };
      }),
    })),
  }));

  return { weeks: result, enrolledCount };
}

/** 오늘 수업 (홈 위젯) */
export async function getTodayLessons(cohortId: number, today: string) {
  const lessons = await db.lesson.findMany({
    where: { cohortId, date: ymdToDate(today) },
    include: { _count: { select: { materials: true, assignments: true } }, week: { select: { id: true } } },
    orderBy: { id: "asc" },
  });
  return lessons.map((l) => ({ id: l.id, weekId: l.week.id, title: l.title, materialCount: l._count.materials, assignmentCount: l._count.assignments }));
}

/** 마감 임박 과제 (수강생 홈 위젯): 아직 마감 전이거나 미제출인 최근 과제 */
export async function getDueAssignments(cohortId: number, studentId: number, now: Date, take = 3) {
  const items = await db.assignment.findMany({
    where: { cohortId, dueAt: { gte: now } },
    orderBy: { dueAt: "asc" },
    take,
    include: { submissions: { where: { studentId }, select: { status: true } }, lesson: { select: { weekId: true } } },
  });
  return items.map((a) => ({
    id: a.id,
    weekId: a.lesson.weekId,
    title: a.title,
    dueAt: a.dueAt,
    status: a.submissions[0]?.status ?? null,
  }));
}

/** 최근 과제 제출 (강사 홈 위젯) */
export async function getRecentSubmissions(cohortId: number, take = 5) {
  const subs = await db.submission.findMany({
    where: { cohortId },
    orderBy: { submittedAt: "desc" },
    take,
    include: { student: { select: { name: true } }, assignment: { select: { title: true, lesson: { select: { weekId: true } } } } },
  });
  return subs.map((s) => ({
    id: s.id,
    studentName: s.student.name,
    assignmentTitle: s.assignment.title,
    weekId: s.assignment.lesson.weekId,
    status: s.status,
    submittedAt: formatDateTime(s.submittedAt),
  }));
}
