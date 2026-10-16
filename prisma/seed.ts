/**
 * 가상 데이터 시드. 실제 수강생·교사 정보는 넣지 않는다.
 * 실행: ALLOW_SEED=true SEED_PASSWORD=... npx prisma db seed
 * 개발 DB에서만 실행한다. 이미 시드된 DB에서는 빠진 모듈 데이터(M7 서류)만 보충한다.
 */
import { PrismaClient, Role, StaffRole, AttendanceType, ExcusedType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── 날짜 유틸 (YYYY-MM-DD 문자열 기준, UTC로 변환해 @db.Date에 저장) ──
const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
};

// 예시 휴강일 (공휴일 등). 실제 값은 학원 확인 후 반 설정에서 수정한다.
const HOLIDAYS = [
  "2026-08-17", "2026-09-24", "2026-09-25", "2026-10-05",
  "2026-10-09", "2026-12-25", "2027-01-01",
];

const START = "2026-07-20";
const END = "2027-01-27";

// 단위기간: 시작일 기준 1개월 단위 (월 20일 시작). 마지막은 종료일까지.
const PERIOD_STARTS = ["2026-07-20", "2026-08-20", "2026-09-20", "2026-10-20", "2026-11-20", "2026-12-20", "2027-01-20"];

const ATTENDANCE_CONFIG = {
  requiredPercent: 80,
  lateEarlyToAbsent: 3,
  combineLateEarly: true,
  outCounts: "IGNORE",
  excused: { limit: null, scope: "PERIOD", overflow: "COUNT_AS_ABSENT" },
  grade: { normalMinRemaining: 2, warnMinRemaining: 1 },
};

async function main() {
  if (process.env.ALLOW_SEED !== "true") throw new Error("ALLOW_SEED=true 가 아니므로 시드를 실행하지 않습니다.");
  const pw = process.env.SEED_PASSWORD;
  if (!pw || pw.length < 8) throw new Error("SEED_PASSWORD(8자 이상)가 필요합니다.");

  if (await prisma.academy.findFirst({ where: { name: "가상학원" } })) {
    console.log("이미 시드되어 있어 기본 데이터는 건너뜁니다.");
    await seedDocuments();
    return;
  }
  const passwordHash = await bcrypt.hash(pw, 10);
  const mkUser = (academyId: number | null, role: Role, loginId: string, name: string, mustChangePassword = false) =>
    prisma.user.create({ data: { academyId, role, loginId, name, passwordHash, mustChangePassword } });

  await mkUser(null, Role.ADMIN, "dev_admin", "개발팀 관리자");
  const academy = await prisma.academy.create({ data: { name: "가상학원" } });
  const a = academy.id;
  await mkUser(a, Role.ACADEMY_ADMIN, "acad_admin", "가상 슈퍼어드민");

  // ── 반 A: 이 반 형식(과정명·직종·강의실·요일별 시간)을 따른 가상 반 ──
  const weeklySchedule = {
    "1": ["09:00", "17:40"], "2": ["09:00", "17:40"], "3": ["09:00", "17:40"],
    "4": ["09:00", "17:40"], "5": ["09:00", "16:40"],
  };
  const cohortA = await prisma.cohort.create({
    data: {
      academyId: a,
      name: "가상 과정 A (자율주행·협동로봇 개발자 과정 형식)",
      trainingType: "K-Digital Training",
      room: "6층 000호",
      startDate: toDate(START),
      endDate: toDate(END),
      weeklySchedule,
      holidays: HOLIDAYS,
      attendanceConfig: ATTENDANCE_CONFIG,
      featureFlags: { teamProject: true, resume: true, chatbot: true },
    },
  });
  const cohortB = await prisma.cohort.create({
    data: {
      academyId: a,
      name: "가상 과정 B (2개월 과정 형식)",
      trainingType: "K-Digital Training",
      room: "5층 000호",
      startDate: toDate("2026-09-01"),
      endDate: toDate("2026-10-30"),
      weeklySchedule,
      holidays: HOLIDAYS,
      attendanceConfig: ATTENDANCE_CONFIG,
      featureFlags: { teamProject: false, resume: true, chatbot: true },
    },
  });

  // ── 교사·수강생 ──
  const mgrA = await mkUser(a, Role.MANAGER, "mgr_a", "가상 담임A");
  const instA = await mkUser(a, Role.INSTRUCTOR, "inst_a", "가상 수업교사A");
  const mgrB = await mkUser(a, Role.MANAGER, "mgr_b", "가상 담임B");
  await prisma.cohortStaff.createMany({
    data: [
      { cohortId: cohortA.id, userId: mgrA.id, staffRole: StaffRole.MANAGER, title: "담임교사", isPrimary: true },
      { cohortId: cohortA.id, userId: instA.id, staffRole: StaffRole.INSTRUCTOR, title: "수업교사" },
      { cohortId: cohortB.id, userId: mgrB.id, staffRole: StaffRole.MANAGER, title: "담임교사", isPrimary: true },
    ],
  });

  const studentsA = [];
  for (let i = 1; i <= 8; i++) {
    const id = String(i).padStart(2, "0");
    // s08은 최초 로그인 비밀번호 변경 강제 흐름 확인용
    studentsA.push(await mkUser(a, Role.STUDENT, `s${id}`, `가상 수강생${id}`, i === 8));
  }
  const studentsB = [await mkUser(a, Role.STUDENT, "b01", "가상 수강생B01"), await mkUser(a, Role.STUDENT, "b02", "가상 수강생B02")];
  await prisma.enrollment.createMany({
    data: [
      ...studentsA.map((s) => ({ cohortId: cohortA.id, studentId: s.id })),
      ...studentsB.map((s) => ({ cohortId: cohortB.id, studentId: s.id })),
    ],
  });

  // ── 훈련일·단위기간 (반 A) ──
  const holidaySet = new Set(HOLIDAYS);
  const trainingDays: { cohortId: number; date: Date; isTraining: boolean; note?: string }[] = [];
  const trainingYmd: string[] = [];
  for (let d = START; d <= END; d = addDays(d, 1)) {
    const dow = toDate(d).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const off = holidaySet.has(d);
    trainingDays.push({ cohortId: cohortA.id, date: toDate(d), isTraining: !off, note: off ? "휴강(예시)" : undefined });
    if (!off) trainingYmd.push(d);
  }
  await prisma.trainingDay.createMany({ data: trainingDays });

  const periods = [];
  for (let i = 0; i < PERIOD_STARTS.length; i++) {
    const end = i + 1 < PERIOD_STARTS.length ? addDays(PERIOD_STARTS[i + 1], -1) : END;
    periods.push(
      await prisma.attendancePeriod.create({
        data: { cohortId: cohortA.id, label: `${i + 1}단위기간`, startDate: toDate(PERIOD_STARTS[i]), endDate: toDate(end) },
      }),
    );
  }

  // ── 출결 샘플 (3단위기간: 09-20 ~ 10-19) ──
  const ev = (student: number, date: string, type: AttendanceType, excusedType?: ExcusedType) => ({
    cohortId: cohortA.id, studentId: student, date: toDate(date), type,
    excused: !!excusedType, excusedType: excusedType ?? null, recordedById: mgrA.id,
  });
  await prisma.attendanceEvent.createMany({
    data: [
      ev(studentsA[0].id, "2026-09-22", AttendanceType.ABSENT),
      ev(studentsA[0].id, "2026-09-30", AttendanceType.LATE),
      ev(studentsA[0].id, "2026-10-06", AttendanceType.LATE),
      ev(studentsA[1].id, "2026-10-07", AttendanceType.ABSENT, ExcusedType.SICK),
      ev(studentsA[2].id, "2026-10-13", AttendanceType.EARLY_LEAVE),
      ev(studentsA[3].id, "2026-10-14", AttendanceType.ABSENT),
    ],
  });
  // 확인 완료: 3단위기간 시작일부터 어제(2026-10-14)까지
  await prisma.attendanceDayClose.createMany({
    data: trainingYmd
      .filter((d) => d >= "2026-09-20" && d <= "2026-10-14")
      .map((d) => ({ cohortId: cohortA.id, date: toDate(d), closedById: mgrA.id })),
  });

  // ── 커리큘럼 최소 샘플 (반 A) ──
  const week = await prisma.week.create({ data: { cohortId: cohortA.id, weekNo: 1, title: "1주차 오리엔테이션" } });
  const lesson = await prisma.lesson.create({
    data: { cohortId: cohortA.id, weekId: week.id, date: toDate("2026-07-20"), title: "과정 소개", instructorId: instA.id },
  });
  await prisma.material.create({
    data: { cohortId: cohortA.id, lessonId: lesson.id, type: "DOC", title: "예시 자료", url: "https://example.com", createdById: instA.id },
  });
  await prisma.assignment.create({
    data: { cohortId: cohortA.id, lessonId: lesson.id, title: "예시 과제", dueAt: new Date("2026-07-27T14:59:00Z") },
  });

  await seedDocuments();
  console.log(`시드 완료: 학원 1, 반 2 (A=${cohortA.id}, B=${cohortB.id}), 수강생 ${studentsA.length + studentsB.length}명, 단위기간 ${periods.length}개`);
}

// ── M7 서류 (반 A). PDF는 만들지 않고 모든 버전이 샘플 경로 1개를 공유한다.
// STORAGE_DIR/seed/sample-resume.pdf 에 가상 PDF를 직접 두면 열람되고, 없으면 "파일을 찾을 수 없습니다"로 표시된다.
const SAMPLE_PDF = "seed/sample-resume.pdf";

async function seedDocuments() {
  if ((await prisma.document.count()) > 0) {
    console.log("서류 데이터가 이미 있어 건너뜁니다.");
    return;
  }
  const inst = await prisma.user.findUnique({ where: { loginId: "inst_a" } });
  const staff = inst && (await prisma.cohortStaff.findFirst({ where: { userId: inst.id }, select: { cohortId: true } }));
  if (!inst || !staff) return;
  const cohortId = staff.cohortId;
  const student = (loginId: string) => prisma.user.findUniqueOrThrow({ where: { loginId } });
  const at = (ymd: string, hm = "10:00") => new Date(`${ymd}T${hm}:00+09:00`);

  type Spec = {
    owner: string;
    type: "RESUME" | "COVER_LETTER" | "PORTFOLIO";
    title: string;
    status: "DRAFT" | "IN_REVIEW" | "DONE";
    versions: string[]; // 버전별 업로드 일자 (빈 배열이면 파일 없는 초안)
    notes?: string[];
  };
  const specs: Spec[] = [
    { owner: "s01", type: "RESUME", title: "백엔드 개발자 지원 이력서", status: "DONE", versions: ["2026-10-05", "2026-10-12"], notes: ["프로젝트 결과가 수치로 잘 정리됐습니다. 이대로 제출해도 좋습니다."] },
    { owner: "s01", type: "COVER_LETTER", title: "자기소개서 (공통 문항)", status: "IN_REVIEW", versions: ["2026-10-14"] },
    { owner: "s02", type: "RESUME", title: "웹 서비스 개발 이력서", status: "IN_REVIEW", versions: ["2026-10-10", "2026-10-15"] },
    { owner: "s03", type: "RESUME", title: "데이터 분석 직무 이력서", status: "DRAFT", versions: ["2026-10-08"], notes: ["팀 프로젝트에서 본인이 맡은 역할을 STAR의 A(행동) 중심으로 다시 써 주세요."] },
    { owner: "s04", type: "RESUME", title: "이력서 초안", status: "DRAFT", versions: [] },
    { owner: "s05", type: "PORTFOLIO", title: "팀 프로젝트 포트폴리오", status: "DONE", versions: ["2026-10-11"] },
    { owner: "s05", type: "RESUME", title: "프론트엔드 개발자 이력서", status: "IN_REVIEW", versions: ["2026-10-13"] },
  ];

  for (const sp of specs) {
    const owner = await student(sp.owner);
    const last = sp.versions[sp.versions.length - 1] ?? "2026-10-15";
    const doc = await prisma.document.create({
      data: { cohortId, ownerId: owner.id, type: sp.type, title: sp.title, status: sp.status, createdAt: at(sp.versions[0] ?? last), updatedAt: at(last) },
    });
    let currentVersionId: number | null = null;
    for (const [i, ymd] of sp.versions.entries()) {
      const v = await prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          cohortId,
          versionNo: i + 1,
          fileName: `${sp.owner}_${sp.title.replace(/\s+/g, "_")}_v${i + 1}.pdf`,
          storagePath: SAMPLE_PDF,
          size: 180_000 + i * 12_000,
          aiConsentAt: at(ymd),
          createdAt: at(ymd),
        },
      });
      currentVersionId = v.id;
    }
    for (const comment of sp.notes ?? []) {
      await prisma.documentReviewNote.create({ data: { documentId: doc.id, cohortId, reviewerId: inst.id, comment, createdAt: at(last, "15:00") } });
    }
    // updatedAt은 @updatedAt이라 마지막 갱신에서 날짜를 다시 지정한다
    await prisma.document.update({ where: { id: doc.id }, data: { currentVersionId, updatedAt: at(last) } });
  }
  console.log(`서류 시드: ${specs.length}건 (반 ${cohortId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
