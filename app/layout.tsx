import { InitToast } from "@/components/init-toast";
import PaletteProvider from "@/providers/palette";
import ThemeProvider from "@/providers/theme";
import QueryProvider from "@/providers/query";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "My School Branding",
  description: "Customer Connect"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", "font-sans", inter.variable)}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col antialiased">
        <ThemeProvider>
          <PaletteProvider>
            <InitToast />
            <QueryProvider>{children}</QueryProvider>
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
