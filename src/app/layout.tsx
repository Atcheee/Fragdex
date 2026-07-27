import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { fraunces, ibmPlexMono, plusJakarta } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AccountSyncProvider } from "@/components/auth/AccountSyncProvider";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://scent-games.vercel.app";

const title = "Scent Games";
const description =
  "Test your fragrance knowledge: ratings, prices, notes, accords, houses and more.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Scent Games",
  keywords: [
    "fragrance",
    "perfume",
    "scent games",
    "this or that",
    "scent quiz",
    "perfume game",
    "fragrance notes",
    "accords",
    "perfume houses",
    "find your fragrance",
    "perfume recommendation",
  ],
  authors: [{ name: "Scent Games" }],
  creator: "Scent Games",
  publisher: "Scent Games",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Scent Games",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${fraunces.variable} ${ibmPlexMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans font-medium">
        <ThemeProvider>
          <AuthProvider>
            <AccountSyncProvider>
              <SiteHeader />
              <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-12">
                {children}
              </main>
            </AccountSyncProvider>
          </AuthProvider>
        </ThemeProvider>
        <footer className="border-t border-border py-5 text-center text-xs text-muted">
          Fragrance data is approximate and for entertainment only.
        </footer>
      </body>
    </html>
  );
}
