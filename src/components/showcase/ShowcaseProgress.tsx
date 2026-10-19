// 쇼케이스 공개 절차 진행 표시(초안 → 신청 → 동의 → 검토 → 공개).
import { Check } from "lucide-react";
import type { ShowcaseDetail } from "@/server/showcase-queries";
import { cn } from "@/lib/utils";

/** 공개 절차 진행: 초안 → 공개 신청 → 팀원 동의 → 강사 검토 → 공개 승인. 완료 단계는 체크 아이콘(색만으로 구분하지 않음). */
export function ShowcaseProgress({ detail, className }: { detail: ShowcaseDetail; className?: string }) {
  const sc = detail.showcase;
  const status = sc?.status ?? "DRAFT";
  const applied = status === "IN_REVIEW" || status === "PUBLISHED";
  const steps = [
    { label: "초안 작성", done: !!sc?.problem },
    { label: "공개 신청", done: applied },
    { label: `팀원 동의 ${sc && applied ? `${sc.consentCount}/${detail.members.length}` : ""}`.trim(), done: applied && !!sc?.allConsented },
    { label: "강사 검토", done: applied && !!sc?.reviewedAt },
    { label: "공개 승인", done: status === "PUBLISHED" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <ol className={cn("grid grid-cols-5 gap-1", className)} aria-label="공개 절차">
      {steps.map((s, i) => (
        <li key={s.label} className="min-w-0">
          <div className={cn("h-1.5 rounded-full", s.done ? "bg-primary-500" : i === current ? "bg-primary-200" : "bg-neutral-200")} aria-hidden />
          <p
            className={cn(
              "mt-1 flex items-center gap-0.5 text-xs leading-tight",
              s.done ? "text-neutral-700" : i === current ? "font-semibold text-primary-700" : "text-neutral-400"
            )}
            aria-current={i === current ? "step" : undefined}
          >
            {s.done && <Check className="size-3 shrink-0" aria-hidden />}
            <span className="truncate">{s.label}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

/** 쇼케이스 본문 미리보기 (수강생 읽기 전용·교직원 검토 드로어 공용). 이미지는 권한 확인 라우트로만 연다. */
export function ShowcasePreview({ detail }: { detail: ShowcaseDetail }) {
  const sc = detail.showcase;
  if (!sc) return <p className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">아직 작성한 쇼케이스가 없습니다.</p>;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {[
          { url: sc.coverUrl, label: "대표 이미지" },
          { url: sc.architectureUrl, label: "아키텍처" },
        ].map((img) => (
          <figure key={img.label} className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- 권한 확인 후 서버가 전달하는 비공개 이미지
              <img src={img.url} alt={img.label} className="aspect-video w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center text-xs text-neutral-400">없음</div>
            )}
            <figcaption className="border-t border-neutral-200 px-2 py-1 text-xs text-neutral-500">{img.label}</figcaption>
          </figure>
        ))}
      </div>
      <section>
        <h4 className="font-medium text-neutral-900">문제 정의</h4>
        <p className="mt-1 whitespace-pre-wrap text-neutral-700">{sc.problem || "—"}</p>
      </section>
      <section>
        <h4 className="font-medium text-neutral-900">정량 성과</h4>
        {sc.metrics.length === 0 ? (
          <p className="mt-1 text-neutral-500">—</p>
        ) : (
          <ul className="mt-1 grid grid-cols-2 gap-2">
            {sc.metrics.map((m, i) => (
              <li key={i} className="rounded-lg bg-neutral-50 p-2">
                <p className="text-xs text-neutral-500">{m.label}</p>
                <p className="font-semibold text-neutral-900">{m.value}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-neutral-500">시연</dt>
        <dd className="truncate text-neutral-800">{sc.demoUrl ?? "—"}</dd>
        <dt className="text-neutral-500">저장소</dt>
        <dd className="truncate text-neutral-800">{sc.repoUrl ?? "—"}</dd>
        <dt className="text-neutral-500">기술 스택</dt>
        <dd className="text-neutral-800">{detail.project.techStack.join(", ") || "—"}</dd>
      </dl>
    </div>
  );
}

/** 팀원별 공개 동의 현황 */
export function ConsentList({ detail }: { detail: ShowcaseDetail }) {
  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
      {detail.members.map((m) => (
        <li key={m.userId} className="flex min-h-11 items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="font-medium text-neutral-900">{m.name}</span>
            <span className="ml-1.5 text-xs text-neutral-500">{m.role ?? (m.isLeader ? "팀장" : "팀원")}</span>
          </span>
          {m.consentedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-status-success-fg">
              <Check className="size-3.5" aria-hidden /> 동의 <span className="text-neutral-500 tabular-nums">{m.consentedAt}</span>
            </span>
          ) : (
            <span className="text-xs text-neutral-500">미동의</span>
          )}
        </li>
      ))}
    </ul>
  );
}
