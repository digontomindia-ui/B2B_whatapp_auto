"use client";

import { Toaster, ToasterProps } from "sonner";
import { useTheme } from "next-themes";

export function InitToast(props: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Toaster richColors theme={theme as ToasterProps["theme"]} {...props} />
  );
}
