import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700",
        outline: "border-neutral-300 bg-card text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
        secondary: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
        ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        destructive: "bg-status-danger-solid text-white hover:bg-status-danger-fg",
        "destructive-outline":
          "border-neutral-300 bg-card text-status-danger-fg hover:bg-status-danger-bg",
        link: "h-auto px-0 text-primary-500 underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-3 text-caption",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
