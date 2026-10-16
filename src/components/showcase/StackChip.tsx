import { cn } from "@/lib/utils";

/** 기술 스택 표시 (상태가 아니므로 StatusBadge 대신 단순 칩) */
export function StackChip({ name, className }: { name: string; className?: string }) {
  return <span className={cn("rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700", className)}>{name}</span>;
}
