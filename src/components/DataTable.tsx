// 공용 표 컴포넌트: 데스크톱은 표, 모바일은 카드 목록. 행을 누르면 상세 드로어를 연다.
import * as React from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  density?: "compact" | "comfortable";
  emptyMessage?: string;
  /** 행 클릭 시 드로어를 여는 콜백 (theme.md §7). */
  onRowClick?: (item: T, index: number) => void;
  getRowKey?: (item: T, index: number) => React.Key;
  className?: string;
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

export function DataTable<T>({
  columns,
  data,
  density = "compact",
  emptyMessage = "아직 데이터가 없습니다.",
  onRowClick,
  getRowKey,
  className,
}: DataTableProps<T>) {
  const compact = density === "compact";

  return (
    <div className={cn("overflow-hidden rounded-xl border border-neutral-200 bg-card", className)}>
      <Table className={compact ? "text-sm" : "text-base"}>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={cn(ALIGN[col.align ?? "left"], col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-neutral-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, rowIdx) => (
              <TableRow
                key={getRowKey ? getRowKey(item, rowIdx) : rowIdx}
                onClick={onRowClick ? () => onRowClick(item, rowIdx) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(item, rowIdx);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(compact ? "h-10" : "h-12", onRowClick && "cursor-pointer hover:bg-primary-50")}
              >
                {columns.map((col, colIdx) => (
                  <TableCell key={colIdx} className={cn(ALIGN[col.align ?? "left"], col.className)}>
                    {col.cell ? col.cell(item, rowIdx) : col.accessorKey ? String(item[col.accessorKey] ?? "") : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
