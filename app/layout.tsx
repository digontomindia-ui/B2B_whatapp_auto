import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { InitToast } from "@/components/init-toast";
import PaletteProvider from "@/providers/palette";
import ThemeProvider from "@/providers/theme";
import QueryProvider from "@/providers/query";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

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
      className={cn(
        "h-full font-sans antialiased",
        sans.variable,
        mono.variable
      )}
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
