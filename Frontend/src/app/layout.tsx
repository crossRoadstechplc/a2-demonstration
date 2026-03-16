import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A2 E-Corridor Platform",
  description:
    "A2 Access Africa — Real-time operations command for the Ethiopia–Djibouti battery-electric freight corridor. Monitor battery swaps, energy flows, fleet health and station activity.",
  applicationName: "A2 E-Corridor Platform",
  keywords: [
    "A2 Access Africa",
    "E-Corridor",
    "Ethiopia Djibouti",
    "battery swap",
    "electric freight",
    "logistics dashboard",
  ],
  authors: [{ name: "A2 Access Africa" }],
  creator: "A2 Access Africa",
  publisher: "A2 Access Africa",

  openGraph: {
    type: "website",
    title: "A2 E-Corridor Platform",
    description:
      "Real-time operations command for the Ethiopia–Djibouti battery-electric freight corridor.",
    siteName: "A2 E-Corridor Platform",
    images: [{ url: "/android-chrome-512x512.png", width: 512, height: 512, alt: "A2 E-Corridor" }],
  },
  twitter: {
    card: "summary",
    title: "A2 E-Corridor Platform",
    description: "Real-time operations command for the Ethiopia–Djibouti battery-electric freight corridor.",
    images: ["/android-chrome-192x192.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
