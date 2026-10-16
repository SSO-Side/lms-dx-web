"use client";

import { useState, useTransition } from "react";
import { Coffee, Handshake, Send } from "lucide-react";
import { submitLeadAction } from "@/server/leads";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type LeadType = "COFFEE_CHAT" | "POC";
const TITLES: Record<LeadType, { title: string; desc: string; placeholder: string }> = {
  COFFEE_CHAT: {
    title: "채용 커피챗 신청",
    desc: "팀원과 가볍게 이야기를 나누고 싶은 직무와 일정을 적어 주세요.",
    placeholder: "예: 백엔드 신입 채용 관련으로 30분 정도 이야기 나누고 싶습니다. 가능한 요일은…",
  },
  POC: {
    title: "프로젝트 도입·PoC 문의",
    desc: "도입하려는 목적과 범위, 일정을 적어 주세요.",
    placeholder: "예: 사내 식단 추천에 활용해 보고 싶습니다. 2주 PoC를 검토 중입니다.",
  },
};

/** 기업 문의 버튼 2개 + 리드 폼 (모달). 길이 제한·검증은 서버가 다시 한다. 허니팟 칸(website)은 사람에게 보이지 않는다. */
export function LeadForm({ slug }: { slug: string }) {
  const [type, setType] = useState<LeadType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (fd: FormData) => {
    if (!type) return;
    fd.set("type", type);
    setError(null);
    startTransition(async () => {
      const res = await submitLeadAction(slug, fd);
      if (!res.ok) return setError(res.error);
      setDone(true);
    });
  };

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={() => { setDone(false); setType("COFFEE_CHAT"); }}>
          <Coffee /> 채용 커피챗 신청
        </Button>
        <Button size="lg" variant="outline" onClick={() => { setDone(false); setType("POC"); }}>
          <Handshake /> 프로젝트 도입·PoC 문의
        </Button>
      </div>

      <Dialog open={type !== null} onOpenChange={(o) => { if (!o) { setType(null); setError(null); } }}>
        <DialogContent>
          {type && done ? (
            <>
              <DialogHeader>
                <DialogTitle>문의를 접수했습니다</DialogTitle>
                <DialogDescription>학원 담당자가 확인 후 남겨 주신 연락처로 회신합니다. 감사합니다.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setType(null)}>닫기</Button>
              </DialogFooter>
            </>
          ) : type ? (
            <form action={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{TITLES[type].title}</DialogTitle>
                <DialogDescription>{TITLES[type].desc}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-company">기업명</Label>
                  <Input id="lead-company" name="company" required maxLength={100} autoComplete="organization" className="h-11 text-base" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name">담당자</Label>
                  <Input id="lead-name" name="contactName" required maxLength={50} autoComplete="name" className="h-11 text-base" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-contact">연락처 (이메일 또는 전화)</Label>
                <Input id="lead-contact" name="contact" required minLength={5} maxLength={100} autoComplete="email" className="h-11 text-base" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-message">문의 내용</Label>
                <Textarea id="lead-message" name="message" required minLength={10} maxLength={2000} className="min-h-32 text-base" placeholder={TITLES[type].placeholder} />
              </div>
              {/* 허니팟: 화면·스크린리더·탭 이동에서 모두 숨김. 봇이 채우면 서버가 조용히 버린다 */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="lead-website">웹사이트</label>
                <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>
              <p className="text-xs text-neutral-500">입력한 정보는 문의 응대에만 쓰며 학원 담당자만 열람합니다.</p>
              {error && <Alert tone="danger">{error}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setType(null)}>
                  취소
                </Button>
                <Button type="submit" disabled={pending}>
                  <Send /> {pending ? "보내는 중…" : "문의 보내기"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
