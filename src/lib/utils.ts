// 화면 공통 도구: CSS 클래스 합치기(cn).
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// globals.css의 커스텀 글자 크기(text-caption)를 색이 아닌 크기로 인식시켜야 text-neutral-* 와 함께 써도 지워지지 않는다.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["caption"] }] } },
});

/** CSS 클래스 이름을 합친다. 조건부 클래스와 Tailwind 충돌(예: p-2 vs p-4)을 정리한다. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** DB의 DateTime(UTC 자정 저장)을 YYYY-MM-DD 문자열로 표시한다. */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
