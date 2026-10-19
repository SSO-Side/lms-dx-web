"use client";

// 기본 드로어(Sheet) 부품: 데스크톱은 오른쪽, 모바일은 아래에서 올라오는 패널.
import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

/** theme.md §6: 데스크톱은 우측 480px, 모바일은 하단 85% 높이. */
function SheetContent({ className, children, ...props }: SheetPrimitive.Popup.Props) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop className="fixed inset-0 z-50 bg-neutral-900/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-popover text-popover-foreground shadow-lg transition duration-150 ease-out",
          "inset-x-0 bottom-0 h-[85dvh] rounded-t-xl border-t border-neutral-200 data-ending-style:translate-y-8 data-ending-style:opacity-0 data-starting-style:translate-y-8 data-starting-style:opacity-0",
          "md:inset-x-auto md:inset-y-0 md:right-0 md:h-full md:w-120 md:rounded-none md:border-t-0 md:border-l md:data-ending-style:translate-x-8 md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-8 md:data-starting-style:translate-y-0",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label="닫기"
          className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <XIcon className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1 border-b border-neutral-200 px-5 py-4 pr-14", className)} {...props} />;
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

/** 처리 버튼은 드로어 하단에 고정한다 (ia.md §3). */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return <SheetPrimitive.Title className={cn("text-base font-semibold text-neutral-900", className)} {...props} />;
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return <SheetPrimitive.Description className={cn("text-sm text-neutral-500", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription };
