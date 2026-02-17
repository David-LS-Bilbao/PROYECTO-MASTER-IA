import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { QueryProvider } from "@/components/providers/query-provider";
import { BackendStatusProvider } from "@/hooks/useBackendStatus";
import { GlobalErrorBoundary } from "@/components/providers/global-error-boundary";
import { ThemeProvider } from "@/components/providers/theme-provider"; // Sprint 19.8: Theme support
import { Toaster } from "@/components/ui/sonner";
import { SentryProvider } from "@/components/providers/sentry-provider"; // Sprint 15: Sentry initialization
import Footer from "@/components/layout/footer";
import CookieBanner from "@/components/ui/cookie-banner";
import { ClientOnlyScrollToTop } from "@/components/ui/client-only-scroll-to-top";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Verity News",
  description: "Análisis de sesgo en noticias con IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: Prevents hydration mismatch errors caused by
    // browser extensions (like Dark Reader) that inject attributes into the HTML
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-zinc-950`}
      >
        <SentryProvider>
          <ThemeProvider>
            <QueryProvider>
              <BackendStatusProvider>
                <GlobalErrorBoundary>
                  <AuthProvider>
                   {children}
                   <Toaster />
                   <ClientOnlyScrollToTop />
                   {/* Footer global */}
                   <Footer />
                   {/* Cookie Banner */}
                   <CookieBanner />
                  </AuthProvider>
                </GlobalErrorBoundary>
              </BackendStatusProvider>
            </QueryProvider>
          </ThemeProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
