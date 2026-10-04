import type { Metadata } from "next";
import localFont from "next/font/local";
import { Bricolage_Grotesque } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { SkyBackdrop } from "@/components/ui/SkyBackdrop";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  axes: ["opsz", "wdth"],
});

// CSP nonce (middleware.ts) on igal päringul uus — staatiliselt eelrenderdatud HTML-is seda poleks
// ja brauser blokeeriks Next'i skriptid. Seepärast renderdatakse iga päringu peale.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Personal dashboard aggregating Finance, Tasks, FocusLoop, EstHoop and GitHub data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}
      >
        <SkyBackdrop />
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
