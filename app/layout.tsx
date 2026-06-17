import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Elan",
  description: "AI-powered recursive learning tree",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get('elan-theme')?.value ?? 'light'

  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased${theme === 'dark' ? ' dark' : ''}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
