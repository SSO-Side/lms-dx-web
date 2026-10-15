import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard } from "@/components/shell/AuthCard";

export default function MarketPage() {
  return (
    <AuthCard title="마켓플레이스" description="수료생 프로젝트 쇼케이스를 준비하고 있습니다.">
      <Link href="/" className={buttonVariants({ variant: "outline", className: "w-full" })}>
        처음으로
      </Link>
    </AuthCard>
  );
}
