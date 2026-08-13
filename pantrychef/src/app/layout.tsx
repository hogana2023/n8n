import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PantryChef — Dinner, from what you already have",
    template: "%s · PantryChef",
  },
  description:
    "Tell PantryChef what's in your kitchen. It tells you what to cook tonight — no shopping trip, no wasted food.",
  openGraph: {
    type: "website",
    siteName: "PantryChef",
    url: siteUrl,
    title: "PantryChef — Dinner, from what you already have",
    description:
      "Tell PantryChef what's in your kitchen. It tells you what to cook tonight.",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
