import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { User } from "@supabase/supabase-js";

import { AuthProvider } from "@/components/providers/auth-provider";
import { isSupabaseConfigured } from "@/lib/supabase/credentials";
import { createClient } from "@/lib/supabase/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultSiteUrl = "http://localhost:3000"
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl

const siteTitle = "AI 할 일 관리 서비스"
const siteDescription = "AI가 도와주는 똑똑한 할 일 관리 서비스"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "TaskAI",
  keywords: ["할 일", "TODO", "AI", "생산성", "일정 관리"],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "TaskAI",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user: User | null = null

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      user = data.user ?? null
    } catch {
      user = null
    }
  }

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </body>
    </html>
  );
}
