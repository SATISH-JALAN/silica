import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Michroma } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

const michroma = Michroma({ weight: "400", subsets: ["latin"], variable: "--font-michroma", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Silica — Real compute. Real possibilities.", template: "%s · Silica" },
  description:
    "An onchain market for deliverable GPU compute on Monad. Providers mint bond-backed GPU-hour tokens, traders trade them on an order book, holders redeem them for real GPU time.",
};

export const viewport: Viewport = { themeColor: "#060504" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${michroma.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body className="grain min-h-screen" suppressHydrationWarning>
        <WalletProvider>
          <Nav />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
