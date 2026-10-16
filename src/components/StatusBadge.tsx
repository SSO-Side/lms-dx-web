import { CheckCircle2, AlertTriangle, AlertCircle, Clock, MinusCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusDomain = "attendance" | "attendanceEvent" | "enrollment" | "ticket" | "submission" | "userStatus" | "cohortStatus" | "document" | "teamStage" | "teamPace" | "showcase" | "lead";
type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// theme.md §1 도메인 상태 → 색 매핑
const STATUS_MAP: Record<StatusDomain, Record<string, { tone: Tone; label: string }>> = {
  attendance: {
    NORMAL: { tone: "success", label: "정상" },
    WARN: { tone: "warning", label: "주의" },
    DANGER: { tone: "danger", label: "위험" },
    NA: { tone: "neutral", label: "계산 불가" },
  },
  attendanceEvent: {
    ABSENT: { tone: "danger", label: "결석" },
    LATE: { tone: "warning", label: "지각" },
    EARLY_LEAVE: { tone: "warning", label: "조퇴" },
    OUT: { tone: "neutral", label: "외출" },
    EXCUSED: { tone: "info", label: "공결" },
  },
  ticket: {
    PENDING: { tone: "neutral", label: "대기" },
    IN_REVIEW: { tone: "info", label: "검토 중" },
    APPROVED: { tone: "success", label: "승인" },
    REJECTED: { tone: "danger", label: "반려" },
    NEEDS_REVISION: { tone: "warning", label: "보완 요청" },
    CANCELED: { tone: "neutral", label: "취소" },
  },
  submission: {
    SUBMITTED: { tone: "success", label: "제출" },
    LATE: { tone: "warning", label: "지각 제출" },
    RETURNED: { tone: "info", label: "반환" },
    NONE: { tone: "neutral", label: "미제출" },
  },
  enrollment: {
    ENROLLED: { tone: "success", label: "재적" },
    DROPPED: { tone: "danger", label: "이탈" },
    COMPLETED: { tone: "info", label: "수료" },
  },
  userStatus: {
    ACTIVE: { tone: "success", label: "활성" },
    INACTIVE: { tone: "neutral", label: "비활성" },
  },
  cohortStatus: {
    ACTIVE: { tone: "info", label: "진행 중" },
    ENDED: { tone: "neutral", label: "종료" },
  },
  document: {
    NONE: { tone: "neutral", label: "미등록" },
    DRAFT: { tone: "warning", label: "초안" },
    IN_REVIEW: { tone: "info", label: "첨삭 중" },
    DONE: { tone: "success", label: "완성" },
  },
  // M5 팀 프로젝트: 단계(라벨에 단계 번호) · 목표 대비 진행
  teamStage: {
    "1": { tone: "neutral", label: "1 착수" },
    "2": { tone: "info", label: "2 MVP" },
    "3": { tone: "info", label: "3 고도화" },
    "4": { tone: "success", label: "4 서류 반영" },
  },
  teamPace: {
    ON_TRACK: { tone: "success", label: "정상" },
    BEHIND: { tone: "warning", label: "지연" },
  },
  showcase: {
    NONE: { tone: "neutral", label: "미작성" },
    DRAFT: { tone: "neutral", label: "초안·비공개" },
    IN_REVIEW: { tone: "info", label: "공개 심사 중" },
    PUBLISHED: { tone: "success", label: "공개 중" },
    UNPUBLISHED: { tone: "warning", label: "비공개 전환" },
  },
  lead: {
    COFFEE_CHAT: { tone: "info", label: "채용 커피챗" },
    POC: { tone: "success", label: "도입·PoC" },
    NEW: { tone: "warning", label: "신규" },
  },
};

const TONE_CLASSES: Record<Tone, { box: string; icon: string }> = {
  success: { box: "bg-status-success-bg text-status-success-fg", icon: "text-status-success-solid" },
  warning: { box: "bg-status-warning-bg text-status-warning-fg", icon: "text-status-warning-solid" },
  danger: { box: "bg-status-danger-bg text-status-danger-fg", icon: "text-status-danger-solid" },
  info: { box: "bg-status-info-bg text-status-info-fg", icon: "text-status-info-solid" },
  neutral: { box: "bg-status-neutral-bg text-status-neutral-fg", icon: "text-status-neutral-solid" },
};

const TONE_ICONS: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Clock,
  neutral: MinusCircle,
};

export interface StatusBadgeProps {
  domain: StatusDomain;
  value: string;
  /** 기본 라벨 대신 표시할 문구 (예: "공결·병결") */
  label?: string;
  className?: string;
}

/** 상태 표시는 항상 이것으로: 색 + 아이콘 + 라벨. */
export function StatusBadge({ domain, value, label, className }: StatusBadgeProps) {
  const config = STATUS_MAP[domain]?.[value] ?? { tone: "neutral" as const, label: value };
  const Icon = TONE_ICONS[config.tone];
  const tone = TONE_CLASSES[config.tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone.box,
        className
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", tone.icon)} aria-hidden />
      {label ?? config.label}
    </span>
  );
}
