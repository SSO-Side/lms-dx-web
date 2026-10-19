// 마켓플레이스 목록(/market): 공개 승인된 팀 프로젝트 쇼케이스. 로그인 없이 볼 수 있다.
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { listPublicShowcases } from "@/server/showcase-queries";
import { cn } from "@/lib/utils";
import { StackChip } from "@/components/showcase/StackChip";

/** 요청마다 새로 그린다(공개·비공개 전환을 바로 반영) */
export const dynamic = "force-dynamic"; // 비공개 전환이 바로 반영되도록 매 요청 조회

interface Props {
  searchParams: Promise<{ tech?: string }>;
}

/** 공개 쇼케이스 목록 (PUBLISHED만, 최신순) + 기술 스택 필터 */
export default async function MarketPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tech = typeof sp.tech === "string" && sp.tech.length <= 40 ? sp.tech : undefined;
  const { items, stacks } = await listPublicShowcases(tech);

  return (
    <div className="space-y-8">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-primary-600">KDT 수강생 팀 프로젝트</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900 lg:text-3xl">직접 만들고 수치로 검증한 프로젝트</h1>
        <p className="mt-3 text-neutral-600">문제 정의부터 배포·성능 개선까지 마친 팀 프로젝트입니다. 채용 커피챗이나 프로젝트 도입 문의를 남길 수 있습니다.</p>
      </section>

      {stacks.length > 0 && (
        <nav aria-label="기술 스택 필터" className="flex flex-wrap gap-2">
          {[{ key: "", label: "전체" }, ...stacks.map((s) => ({ key: s, label: s }))].map((f) => {
            const active = (tech ?? "") === f.key;
            return (
              <Link
                key={f.key || "all"}
                href={f.key ? `/market?tech=${encodeURIComponent(f.key)}` : "/market"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
                  active ? "border-primary-500 bg-primary-50 font-medium text-primary-700" : "border-neutral-200 bg-card text-neutral-700 hover:bg-neutral-50"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-card px-4 py-16 text-center">
          <p className="text-neutral-700">{tech ? `${tech}를 쓴 공개 프로젝트가 아직 없습니다.` : "아직 공개된 프로젝트가 없습니다."}</p>
          {tech && (
            <Link href="/market" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary-500 hover:underline">
              전체 보기
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li key={s.slug}>
              <Link href={`/market/${s.slug}`} className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-card hover:border-primary-300">
                <div className="aspect-video bg-neutral-100">
                  {s.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 공개 승인된 이미지만 서버 라우트로 전달
                    <img src={s.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                      <ImageOff className="size-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <p className="text-xs text-neutral-500">
                    {s.courseName} · {s.teamName}
                  </p>
                  <h2 className="text-lg font-semibold text-neutral-900 group-hover:text-primary-700">{s.title}</h2>
                  {s.summary && <p className="line-clamp-2 text-sm text-neutral-600">{s.summary}</p>}
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {s.techStack.map((t) => (
                      <StackChip key={t} name={t} />
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
