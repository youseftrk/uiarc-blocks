import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "../components/arc/foundation.css";
import "./globals.css";
import { ThemeScript } from "./theme-script";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UIarc Component Replica — 252 Components",
  description:
    "All 252 UIArc components (121 free MIT + 131 Pro) and blocks recreated from uiarc.dev",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
