"use client";

import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function ToggleTheme() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      aria-label="Toggle theme"
      title="Toggle theme"
      size="icon"
      className="h-8 w-8 cursor-pointer"
      onClick={() => {
        const isDark = resolvedTheme
          ? resolvedTheme === "dark"
          : typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <Sun className="hidden size-3.5 dark:block" />
      <Moon className="block size-3.5 dark:hidden" />
    </Button>
  );
}
