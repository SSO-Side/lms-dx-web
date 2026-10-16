import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, GitBranch, PlayCircle } from "lucide-react";
import { getPublicShowcase } from "@/server/showcase-queries";
import { StackChip } from "@/components/showcase/StackChip";
import { buttonVariants } from "@/components/ui/button";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic"; // 비공개 전환이 바로 반영되도록 매 요청 조회

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicShowcase(slug);
  return { title: s ? s.title : "찾을 수 없는 프로젝트" };
}

/** 공개 상세: PUBLISHED가 아니면 존재 여부를 알리지 않고 404 */
export default async function ShowcasePage({ params }: Props) {
  const { slug } = await params;
  const s = slug.length <= 40 ? await getPublicShowcase(slug) : null;
  if (!s) notFound();

  return (
    <article className="space-y-8">
      <Link href="/market" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
        <ChevronLeft className="size-4" aria-hidden />
        프로젝트 목록
      </Link>

      <header className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">
            {s.courseName} · {s.teamName}
          </p>
          <h1 className="text-2xl font-semibold text-neutral-900 lg:text-3xl">{s.title}</h1>
          {s.summary && <p className="text-neutral-700">{s.summary}</p>}
          <div className="flex flex-wrap gap-1.5">
            {s.techStack.map((t) => (
              <StackChip key={t} name={t} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {s.demoUrl && (
              <a href={s.demoUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonVariants({ size: "lg" })}>
                <PlayCircle aria-hidden /> 시연 보기 <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            {s.repoUrl && (
              <a href={s.repoUrl} target="_blank" rel="noopener noreferrer nofollow" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <GitBranch aria-hidden /> 저장소 <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
        {s.coverUrl && (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- 공개 승인된 이미지만 서버 라우트로 전달 */}
            <img src={s.coverUrl} alt={`${s.title} 대표 이미지`} className="aspect-video w-full object-cover" />
          </div>
        )}
      </header>

      {s.metrics.length > 0 && (
        <section aria-labelledby="metrics" className="space-y-3">
          <h2 id="metrics" className="text-lg font-semibold text-neutral-900">핵심 성과</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.metrics.map((m, i) => (
              <li key={i} className="rounded-xl border border-neutral-200 bg-card p-5">
                <p className="text-sm text-neutral-500">{m.label}</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900">{m.value}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.problem && (
        <section aria-labelledby="problem" className="space-y-3">
          <h2 id="problem" className="text-lg font-semibold text-neutral-900">문제 정의</h2>
          <p className="max-w-3xl whitespace-pre-wrap text-neutral-700">{s.problem}</p>
        </section>
      )}

      {s.architectureUrl && (
        <section aria-labelledby="arch" className="space-y-3">
          <h2 id="arch" className="text-lg font-semibold text-neutral-900">아키텍처</h2>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- 공개 승인된 이미지만 서버 라우트로 전달 */}
            <img src={s.architectureUrl} alt={`${s.title} 아키텍처 다이어그램`} className="w-full object-contain" />
          </div>
        </section>
      )}

      {s.members.length > 0 && (
        <section aria-labelledby="team" className="space-y-3">
          <h2 id="team" className="text-lg font-semibold text-neutral-900">팀원</h2>
          <ul className="flex flex-wrap gap-3">
            {s.members.map((m, i) => (
              <li key={i} className="rounded-xl border border-neutral-200 bg-card px-4 py-3">
                <p className="font-medium text-neutral-900">{m.name}</p>
                {m.role && <p className="text-sm text-neutral-500">{m.role}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">공개에 동의한 팀원만 표시합니다.</p>
        </section>
      )}

      <section aria-labelledby="contact" className="space-y-3 rounded-xl border border-neutral-200 bg-card p-5 lg:p-6">
        <h2 id="contact" className="text-lg font-semibold text-neutral-900">이 팀에 문의하기</h2>
        <p className="text-sm text-neutral-600">학원 취업지원 담당자가 확인 후 남겨 주신 연락처로 회신합니다. 팀원 개인 연락처는 공개하지 않습니다.</p>
        <LeadForm slug={s.slug} />
      </section>
    </article>
  );
}
