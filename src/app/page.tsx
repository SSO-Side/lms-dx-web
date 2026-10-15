import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-6">
      <h1 className="text-3xl font-bold tracking-tight">lms_kdt</h1>
      <div className="flex gap-4">
        <Link href="/login" className={buttonVariants()}>
          로그인
        </Link>
        <Link href="/market" className={buttonVariants({ variant: "outline" })}>
          마켓플레이스
        </Link>
      </div>
    </main>
  );
}
