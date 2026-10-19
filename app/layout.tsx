import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Fonts are bundled locally through the `geist` package so builds work
// offline and in CI without reaching Google Fonts.

export const metadata: Metadata = {
  title: "JARVIS OS",
  description:
    "Just A Rather Very Intelligent System — a voice-first AI operating environment for your desktop.",
  applicationName: "JARVIS OS",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="h-screen w-screen overflow-hidden bg-jarvis-bg-secondary text-jarvis-text">
        {children}
      </body>
    </html>
  );
}
