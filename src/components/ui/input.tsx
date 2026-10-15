import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900 transition-colors duration-150 placeholder:text-neutral-400 focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500/30 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 aria-invalid:border-status-danger-solid",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm text-neutral-900 transition-colors duration-150 placeholder:text-neutral-400 focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-500/30 disabled:cursor-not-allowed disabled:bg-neutral-100",
        className
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
