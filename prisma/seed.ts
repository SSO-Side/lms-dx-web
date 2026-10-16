/**
 * 가상 데이터 시드. 실제 수강생·교사 정보는 넣지 않는다.
 * 실행: ALLOW_SEED=true SEED_PASSWORD=... npx prisma db seed
 * 개발 DB에서만 실행한다. 이미 시드된 DB에서는 빠진 모듈 데이터(M7 서류, M5 팀 프로젝트, M10 쇼케이스)만 보충한다.
 */
import { PrismaClient, Role, StaffRole, AttendanceType, ExcusedType } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import zlib from "zlib";
import { promises as fs } from "fs";

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
    await seedTeams();
    await seedShowcases();
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
  await seedTeams();
  await seedShowcases();
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

// ── M5 팀 프로젝트 (반 A). 3팀: 목표보다 앞선 팀, 목표대로인 팀, 지연 팀 (가상 프로젝트)
async function seedTeams() {
  if ((await prisma.team.count()) > 0) {
    console.log("팀 데이터가 이미 있어 건너뜁니다.");
    return;
  }
  const inst = await prisma.user.findUnique({ where: { loginId: "inst_a" } });
  const staff = inst && (await prisma.cohortStaff.findFirst({ where: { userId: inst.id }, select: { cohortId: true } }));
  if (!inst || !staff) return;
  const cohortId = staff.cohortId;
  const at = (ymd: string, hm = "18:00") => new Date(`${ymd}T${hm}:00+09:00`);
  const user = (loginId: string) => prisma.user.findUniqueOrThrow({ where: { loginId } });

  // 단계별 체크포인트 키 (src/lib/team/guide.ts 와 같은 값)
  const STAGE_KEYS: Record<number, string[]> = {
    1: ["s1_problem", "s1_features", "s1_stack", "s1_repo"],
    2: ["s2_core", "s2_deploy", "s2_readme"],
    3: ["s3_metric", "s3_trouble"],
    4: ["s4_resume", "s4_showcase"],
  };

  type Spec = {
    name: string;
    leader: string;
    members: Array<[string, string]>; // [loginId, 역할]
    title: string;
    summary: string;
    problem: string;
    features: string[];
    stack: string[];
    repoUrl?: string;
    deployUrl?: string;
    stage: number;
    doneKeys: string[]; // 현재 단계에서 완료한 체크포인트 + 완료 체크리스트
    logs: Array<{ user: string; week: string; progress: string; blocker?: string; resolution?: string; metric?: string }>;
    feedbacks: Array<{ stage: number; date: string; comment: string }>;
  };
  const specs: Spec[] = [
    {
      name: "1팀 냉장고털이",
      leader: "s01",
      members: [["s01", "팀장·백엔드"], ["s02", "프론트엔드"], ["s03", "데이터·추천"]],
      title: "냉장고 재료 기반 레시피 추천 서비스",
      summary: "자취생이 냉장고에 남은 재료를 입력하면 만들 수 있는 레시피를 추천하고, 부족한 재료를 장보기 목록으로 정리해 주는 웹 서비스입니다.",
      problem: "자취생은 남은 재료로 만들 수 있는 메뉴를 고르기 어려워 재료를 버리게 된다.",
      features: ["재료 입력·자동완성", "보유 재료 일치율 기반 레시피 추천", "부족 재료 장보기 목록"],
      stack: ["Next.js", "Spring Boot", "MySQL", "Docker"],
      repoUrl: "https://example.com/repo/fridge-recipe",
      deployUrl: "https://example.com/demo/fridge-recipe",
      stage: 3,
      doneKeys: ["s3_metric", "c_explain", "c_roles", "c_demo", "c_readme"],
      logs: [
        { user: "s01", week: "2026-10-05", progress: "레시피 검색 API 페이지네이션 적용", blocker: "목록 조회가 2초 이상 걸림", resolution: "재료-레시피 조인 인덱스 추가 → 실행 계획 확인", metric: "목록 API 응답 2.1초 → 0.4초" },
        { user: "s02", week: "2026-10-05", progress: "재료 입력 자동완성 UI 구현" },
        { user: "s01", week: "2026-10-12", progress: "추천 결과 캐시 적용", metric: "추천 API p95 0.6초" },
        { user: "s03", week: "2026-10-12", progress: "일치율 계산 로직 테스트 작성", blocker: "단위가 다른 재료(g, 개) 비교", resolution: "재료별 기본 단위 표를 두고 환산" },
      ],
      feedbacks: [
        { stage: 2, date: "2026-09-25", comment: "배포 URL과 README 확인했습니다. 3단계로 진행하세요." },
        { stage: 3, date: "2026-10-13", comment: "응답 시간 개선 수치가 좋습니다. 트러블슈팅 기록을 원인 → 해결 → 결과 형식으로 2건 이상 남겨 주세요." },
      ],
    },
    {
      name: "2팀 스터디메이트",
      leader: "s04",
      members: [["s04", "팀장·풀스택"], ["s05", "프론트엔드"], ["s06", "백엔드"]],
      title: "온라인 스터디 출석·과제 인증 앱",
      summary: "스터디원이 매일 공부 인증을 올리고 출석률을 확인하는 모바일 우선 웹 앱입니다.",
      problem: "온라인 스터디는 출석과 과제 인증이 메신저에 흩어져 누가 참여했는지 알기 어렵다.",
      features: ["스터디 개설·초대 링크", "일일 공부 인증 업로드", "주간 출석률 대시보드"],
      stack: ["React", "Node.js", "PostgreSQL"],
      repoUrl: "https://example.com/repo/study-mate",
      stage: 2,
      doneKeys: ["s2_core", "c_explain"],
      logs: [
        { user: "s04", week: "2026-10-12", progress: "인증 업로드 API와 이미지 저장 구현", blocker: "배포 환경에서 이미지 경로 깨짐", resolution: "아직 해결 중" },
        { user: "s05", week: "2026-10-12", progress: "출석률 대시보드 화면 초안" },
      ],
      feedbacks: [{ stage: 2, date: "2026-10-08", comment: "핵심 기능은 동작합니다. 이번 주 안에 배포 URL과 README 초안을 등록해 주세요." }],
    },
    {
      name: "3팀 동네책방",
      leader: "s07",
      members: [["s07", "팀장·백엔드"], ["s08", "프론트엔드"]],
      title: "동네 독립서점 재고 검색 지도",
      summary: "",
      problem: "",
      features: [],
      stack: [],
      stage: 1,
      doneKeys: ["s1_problem"],
      logs: [{ user: "s07", week: "2026-09-28", progress: "주제 후보 3개 조사, 독립서점 지도로 결정" }],
      feedbacks: [{ stage: 1, date: "2026-10-06", comment: "반 일정상 지금은 MVP 단계여야 합니다. 핵심 기능 3개와 스택을 이번 주에 정하고 면담을 잡읍시다." }],
    },
  ];

  for (const sp of specs) {
    const leader = await user(sp.leader);
    const team = await prisma.team.create({ data: { cohortId, name: sp.name, leaderId: leader.id, status: "CONFIRMED", createdAt: at("2026-09-01", "10:00") } });
    for (const [loginId, role] of sp.members) {
      const u = await user(loginId);
      await prisma.teamMember.create({ data: { teamId: team.id, cohortId, userId: u.id, role, joinedAt: at("2026-09-01", "10:00") } });
    }
    const roles = await Promise.all(sp.members.map(async ([loginId, part]) => ({ name: (await user(loginId)).name, part })));
    const project = await prisma.teamProject.create({
      data: {
        teamId: team.id,
        cohortId,
        title: sp.title,
        summary: sp.summary || null,
        plan: { problem: sp.problem, features: sp.features, roles: sp.problem ? roles : [] },
        techStack: sp.stack,
        repoUrl: sp.repoUrl ?? null,
        deployUrl: sp.deployUrl ?? null,
        stage: sp.stage,
        stageUpdatedAt: at("2026-09-25", "10:00"),
      },
    });
    // 이전 단계 체크포인트는 모두 완료(현황 등록), 현재 단계·완료 체크리스트는 doneKeys만
    const keys = [...Object.entries(STAGE_KEYS).filter(([st]) => Number(st) < sp.stage).flatMap(([st, ks]) => ks.map((k) => [Number(st), k] as const))];
    for (const k of sp.doneKeys) keys.push([k.startsWith("c_") ? 0 : sp.stage, k] as const);
    await prisma.projectMilestone.createMany({
      data: keys.map(([stage, checkKey]) => ({ projectId: project.id, cohortId, stage, checkKey, done: true, doneAt: at("2026-10-10"), doneById: leader.id })),
    });
    for (const l of sp.logs) {
      const u = await user(l.user);
      await prisma.projectLog.create({
        data: {
          projectId: project.id,
          cohortId,
          userId: u.id,
          weekOf: toDate(l.week),
          progress: l.progress,
          blocker: l.blocker ?? null,
          resolution: l.resolution ?? null,
          metric: l.metric ?? null,
          createdAt: at(addDays(l.week, 4)),
          updatedAt: at(addDays(l.week, 4)),
        },
      });
    }
    for (const f of sp.feedbacks) {
      await prisma.projectFeedback.create({ data: { projectId: project.id, cohortId, instructorId: inst.id, stage: f.stage, comment: f.comment, createdAt: at(f.date, "16:00") } });
    }
  }
  console.log(`팀 시드: ${specs.length}팀 (반 ${cohortId})`);
}

// ── M10 쇼케이스·기업 문의 (반 A). 이미지는 저작권 문제가 없도록 여기서 단색 PNG를 직접 만든다.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** 단색 배경 + 가운데 띠 하나인 PNG (RGB, 640×360) */
function solidPng([r, g, b]: number[], [br, bg, bb]: number[], w = 640, h = 360) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    const band = y > h * 0.42 && y < h * 0.58;
    for (let x = 0; x < w; x++) {
      const inBand = band && x > w * 0.15 && x < w * 0.85;
      row[1 + x * 3] = inBand ? br : r;
      row[2 + x * 3] = inBand ? bg : g;
      row[3 + x * 3] = inBand ? bb : b;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function seedShowcases() {
  if ((await prisma.showcase.count()) > 0) {
    console.log("쇼케이스 데이터가 이미 있어 건너뜁니다.");
    return;
  }
  const inst = await prisma.user.findUnique({ where: { loginId: "inst_a" } });
  const mgr = await prisma.user.findUnique({ where: { loginId: "mgr_a" } });
  const teams = await prisma.team.findMany({
    where: { name: { in: ["1팀 냉장고털이", "2팀 스터디메이트", "3팀 동네책방"] } },
    include: { members: { select: { userId: true } }, project: true },
  });
  if (!inst || !mgr || teams.length === 0) return;
  const byName = (n: string) => teams.find((t) => t.name === n);

  const root = path.resolve(process.cwd(), process.env.STORAGE_DIR || ".storage");
  const writeImage = async (name: string, bg: number[], band: number[]) => {
    const rel = `seed/${name}.png`;
    await fs.mkdir(path.join(root, "seed"), { recursive: true });
    await fs.writeFile(path.join(root, rel), solidPng(bg, band));
    return rel;
  };
  const slug = () => Array.from(crypto.randomBytes(12), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  const at = (ymd: string, hm = "10:00") => new Date(`${ymd}T${hm}:00+09:00`);
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  type Spec = {
    team: string;
    status: "PUBLISHED" | "IN_REVIEW";
    problem: string;
    metrics: Array<{ label: string; value: string }>;
    colors: [number[], number[]];
    consentAll: boolean;
    reviewed: boolean;
    publishedOn?: string;
  };
  const specs: Spec[] = [
    {
      team: "1팀 냉장고털이",
      status: "PUBLISHED",
      problem: "자취생은 냉장고에 남은 재료로 무엇을 만들 수 있는지 몰라 재료를 버리게 된다. 재료를 입력하면 바로 만들 수 있는 레시피와 부족한 재료를 알려 준다.",
      metrics: [
        { label: "레시피 목록 API 응답", value: "2.1초 → 0.4초" },
        { label: "추천 API p95", value: "0.6초" },
        { label: "사용자 테스트 만족도", value: "4.3 / 5 (12명)" },
      ],
      colors: [[63, 88, 212], [232, 236, 252]],
      consentAll: true,
      reviewed: true,
      publishedOn: "2026-10-14",
    },
    {
      team: "2팀 스터디메이트",
      status: "PUBLISHED",
      problem: "온라인 스터디의 출석과 과제 인증이 메신저에 흩어져 누가 참여했는지 알기 어렵다. 인증과 출석률을 한 화면에 모은다.",
      metrics: [
        { label: "인증 업로드 성공률", value: "99.2%" },
        { label: "주간 출석률 확인 시간", value: "5분 → 10초" },
      ],
      colors: [[22, 128, 96], [220, 245, 236]],
      consentAll: true,
      reviewed: true,
      publishedOn: "2026-10-15",
    },
    {
      team: "3팀 동네책방",
      status: "IN_REVIEW",
      problem: "동네 독립서점은 재고를 온라인에 공개하지 않아, 찾는 책이 근처에 있어도 알기 어렵다. 지도에서 서점별 재고를 검색한다.",
      metrics: [{ label: "등록 서점(시범)", value: "5곳" }],
      colors: [[180, 96, 24], [252, 238, 220]],
      consentAll: false,
      reviewed: false,
    },
  ];

  for (const sp of specs) {
    const team = byName(sp.team);
    if (!team?.project) continue;
    const cover = await writeImage(`showcase-${team.id}-cover`, sp.colors[0], sp.colors[1]);
    const arch = await writeImage(`showcase-${team.id}-architecture`, sp.colors[1], sp.colors[0]);
    const published = sp.publishedOn ? at(sp.publishedOn, "16:00") : null;
    const sc = await prisma.showcase.create({
      data: {
        projectId: team.project.id,
        cohortId: team.cohortId,
        slug: slug(),
        status: sp.status,
        problem: sp.problem,
        metrics: sp.metrics,
        demoUrl: team.project.deployUrl,
        repoUrl: team.project.repoUrl,
        coverImagePath: cover,
        architectureImagePath: arch,
        instructorReviewedBy: sp.reviewed ? inst.id : null,
        instructorReviewedAt: sp.reviewed && published ? at(sp.publishedOn!, "11:00") : null,
        approvedBy: published ? mgr.id : null,
        approvedAt: published,
        publishedAt: published,
      },
    });
    // 전원 동의(공개) 또는 팀장만 동의(심사 중)
    const consenting = sp.consentAll ? team.members : team.members.filter((m) => m.userId === team.leaderId);
    for (const m of consenting) {
      await prisma.showcaseConsent.create({ data: { showcaseId: sc.id, userId: m.userId, consentedAt: published ?? daysAgo(1) } });
    }
  }

  const first = await prisma.showcase.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "asc" } });
  const second = await prisma.showcase.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
  if (first && second) {
    await prisma.inboundLead.createMany({
      data: [
        {
          showcaseId: first.id,
          cohortId: first.cohortId,
          type: "COFFEE_CHAT",
          company: "가상푸드테크(주)",
          contactName: "가상 채용담당",
          contact: "recruit@example.com",
          message: "레시피 추천 프로젝트의 성능 개선 과정이 인상적입니다. 백엔드 신입 채용 관련해 팀원분과 30분 정도 이야기 나누고 싶습니다.",
          createdAt: daysAgo(1),
        },
        {
          showcaseId: second.id,
          cohortId: second.cohortId,
          type: "POC",
          company: "가상에듀랩",
          contactName: "가상 기획팀장",
          contact: "010-0000-0000",
          message: "사내 스터디 인증에 써 보고 싶습니다. 2주 정도 PoC가 가능한지 문의드립니다.",
          createdAt: daysAgo(3),
        },
      ],
    });
  }
  console.log(`쇼케이스 시드: ${specs.length}건, 기업 문의 2건`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
