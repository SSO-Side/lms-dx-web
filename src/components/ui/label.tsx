// 기본 라벨 부품: 입력 칸 위 제목.
import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-caption font-medium text-neutral-700 select-none", className)}
      {...props}
    />
  );
}

export { Label };
