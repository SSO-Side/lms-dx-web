"use client";

// 뒤로 가기 버튼(브라우저 기록 사용, 없으면 지정 경로로).
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** 브라우저 기록으로 한 단계 뒤로. 기록이 없으면 fallback 경로로 간다. */
export function HistoryBackButton({ fallback = "/app", className }: { fallback?: string; className?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      이전 페이지
    </Button>
  );
}
