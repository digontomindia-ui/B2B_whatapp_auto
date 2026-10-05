import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-9 w-full rounded-md border px-3",
          "bg-white text-sm text-gray-900",
          "placeholder:text-gray-500",
          "outline-none",
          "transition-[border-color,box-shadow] duration-150",

          "dark:bg-gray-900",
          "dark:text-gray-100",
          "dark:placeholder:text-gray-500",

          error
            ? [
                "border-red-600",
                "focus:border-red-600",
                "focus:ring-2 focus:ring-red-600/15",
                "dark:border-red-500"
              ]
            : [
                "border-gray-300",
                "hover:border-gray-400",
                "focus:border-cf-orange",
                "focus:ring-cf-orange/15 focus:ring-2",

                "dark:border-gray-700",
                "dark:hover:border-gray-600",
                "dark:focus:border-cf-orange"
              ],

          "disabled:cursor-not-allowed",
          "disabled:bg-gray-100",
          "disabled:text-gray-400",
          "dark:disabled:bg-gray-800",
          "dark:disabled:text-gray-600",
          "disabled:opacity-70",

          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
