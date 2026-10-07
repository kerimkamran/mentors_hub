import type { Metadata } from "next";
import { getLocale } from "@/lib/auth/http";
import { t } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mentorship Hub",
  description: "Mentoring programmes for Azerconnect Group",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale(); // sets the <html lang> attribute (AC-TEN-02.2)
  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2 focus:text-black">
          {t(locale, "nav.home")}
        </a>
        {children}
      </body>
    </html>
  );
}
