// 기본 알림 부품: 오류·경고·안내·성공 메시지 상자.
import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  danger: { box: "bg-status-danger-bg text-status-danger-fg", icon: AlertCircle, iconColor: "text-status-danger-solid" },
  warning: { box: "bg-status-warning-bg text-status-warning-fg", icon: AlertTriangle, iconColor: "text-status-warning-solid" },
  success: { box: "bg-status-success-bg text-status-success-fg", icon: CheckCircle2, iconColor: "text-status-success-solid" },
  info: { box: "bg-status-info-bg text-status-info-fg", icon: Info, iconColor: "text-status-info-solid" },
} as const;

/** 오류·성공 메시지는 색과 아이콘, 텍스트를 함께 쓴다 (theme.md §8). */
function Alert({
  tone = "info",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { tone?: keyof typeof TONES }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-md px-3 py-2.5 text-sm", t.box, className)}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export { Alert };
