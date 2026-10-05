import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md font-medium",
        "transition-colors duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cf-orange/40",
        "disabled:pointer-events-none disabled:opacity-50",

        // Sizes
        size === "sm" && "h-8 px-2.5 text-xs",
        size === "md" && "h-9 px-4 text-sm leading-5",
        size === "lg" && "h-10 px-5 text-base",
        size === "icon" && "h-8 w-8 p-0",

        // Variants
        variant === "primary" &&
          "bg-cf-orange text-white hover:bg-[#e87516] active:bg-[#d96b13]",
        variant === "secondary" &&
          "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 active:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
        variant === "outline" &&
          "border border-border bg-transparent text-foreground hover:bg-muted active:bg-muted/80",
        variant === "danger" &&
          "border border-red-300 bg-white text-red-600 hover:bg-red-50 active:bg-red-100 dark:border-red-800 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/40",
        variant === "ghost" &&
          "bg-transparent text-foreground/80 hover:bg-muted hover:text-foreground active:bg-muted/80",

        className
      )}
      {...props}
    />
  );
}
