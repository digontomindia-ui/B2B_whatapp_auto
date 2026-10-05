import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4",
        "text-sm leading-5 font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none",
        "focus-visible:ring-cf-orange/40 focus-visible:ring-2",
        "disabled:pointer-events-none disabled:opacity-50",

        {
          "bg-cf-orange text-white hover:bg-[#e87516] active:bg-[#d96b13]":
            variant === "primary",

          "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 active:bg-gray-100":
            variant === "secondary",

          "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100":
            variant === "secondary",

          "border border-red-300 bg-white text-red-600 hover:bg-red-50 active:bg-red-100":
            variant === "danger",

          "dark:border-red-800 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/40":
            variant === "danger",

          "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200":
            variant === "ghost",

          "dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700":
            variant === "ghost"
        },

        className
      )}
      {...props}
    />
  );
}
