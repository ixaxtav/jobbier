import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  axes: ["opsz", "wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Jobbier", template: "%s · Jobbier" },
  description: "A calm place to run your job search — every application, interview and follow-up in one line.",
  applicationName: "Jobbier",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme} className={bricolage.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
