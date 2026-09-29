import { Noto_Sans, Playfair_Display } from "next/font/google";
import { InitToast } from "@/components/init-toast";
import PaletteProvider from "@/providers/palette";
import ThemeProvider from "@/providers/theme";
import QueryProvider from "@/providers/query";
import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import "./globals.css";

const playfairDisplayHeading = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading"
});

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

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
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        notoSans.variable,
        playfairDisplayHeading.variable
      )}
    >
      <body className="flex min-h-full flex-col">
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
