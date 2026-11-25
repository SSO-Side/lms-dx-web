// 서류 > 작성 가이드(수강생): 이력서·자소서 작성 안내(정적 내용).
import { CheckCircle2 } from "lucide-react";

// 작성 가이드 (정적 콘텐츠). 학원 자료가 오면 문구만 교체한다.

const RESUME_TEMPLATE = [
  { title: "기본정보", body: "이름, 연락처, 이메일, GitHub·포트폴리오 링크. 사진·주소는 요구할 때만." },
  { title: "희망 직무", body: "지원 직무와 강점을 한 문장으로. 예) 데이터로 병목을 찾아 고치는 백엔드 개발자" },
  { title: "학력", body: "학교, 전공, 재학 기간, 졸업 여부." },
  { title: "교육 이수 (KDT)", body: "훈련 과정명과 기간, 배운 내용. 수료 예정이면 예정일을 적는다." },
  { title: "프로젝트", body: "기간·인원·내 역할 → 문제 → 해결 → 결과(수치). 가장 강한 프로젝트를 맨 위에." },
  { title: "기술 스택", body: "실제로 써 본 기술만, 숙련도 순으로. 프로젝트에서 쓴 기술과 일치시킨다." },
  { title: "자격·수상", body: "관련 자격증, 수상 경력, 어학 점수." },
];

const STAR = [
  { key: "S", name: "상황 (Situation)", body: "어떤 프로젝트·조건이었나", example: "4인 팀, 3주 안에 수강 신청 서비스를 만들어야 했다." },
  { key: "T", name: "과제 (Task)", body: "내가 맡은 문제는 무엇이었나", example: "신청 몰림 시 응답이 5초 넘게 걸리는 문제를 맡았다." },
  { key: "A", name: "행동 (Action)", body: "내가 직접 한 일, 왜 그렇게 했나", example: "쿼리를 분석해 인덱스를 추가하고 조회 결과를 캐시했다." },
  { key: "R", name: "결과 (Result)", body: "숫자로 보이는 변화, 배운 점", example: "평균 응답 5.2초 → 0.4초, 동시 접속 300명에서 오류 0건." },
];

const CHECKLIST = [
  "이력서의 모든 항목을 채웠고, 비워 둔 항목이 없는지 확인했다",
  "프로젝트마다 내 역할과 결과 수치가 있다",
  "맞춤법·띄어쓰기를 검사했다",
  "자기소개서는 4,000자 이내로 썼다",
  "주민등록번호 등 불필요한 개인정보를 넣지 않았다",
];

export function WritingGuide() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-card p-4">
        <h2 className="font-semibold text-neutral-900">이력서 기본 양식</h2>
        <p className="mt-1 text-sm text-neutral-500">내 서류 화면의 이력서 양식과 같은 항목입니다.</p>
        <ol className="mt-3 space-y-2">
          {RESUME_TEMPLATE.map((s, i) => (
            <li key={s.title} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-neutral-900">{s.title}</p>
                <p className="text-neutral-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-card p-4">
        <h2 className="font-semibold text-neutral-900">STAR 작성법</h2>
        <p className="mt-1 text-sm text-neutral-500">프로젝트 경험과 자기소개서 문항은 네 단계로 씁니다. 결과(R)는 숫자로.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {STAR.map((s) => (
            <li key={s.key} className="rounded-lg bg-neutral-50 p-3 text-sm">
              <p className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary-500 text-xs font-bold text-white">{s.key}</span>
                <span className="font-medium text-neutral-900">{s.name}</span>
              </p>
              <p className="mt-1.5 text-neutral-600">{s.body}</p>
              <p className="mt-1 text-neutral-800">예) {s.example}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-card p-4">
        <h2 className="font-semibold text-neutral-900">제출 전 확인</h2>
        <ul className="mt-3 space-y-2">
          {CHECKLIST.map((c) => (
            <li key={c} className="flex gap-2 text-sm text-neutral-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-500" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
