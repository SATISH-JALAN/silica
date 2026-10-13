import type { Metadata } from "next";
import { MarketsView } from "@/components/markets/MarketsView";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Markets" };

export default function MarketsPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-[1400px] px-4 pb-24 pt-28 sm:px-6">
        <MarketsView />
      </main>
      <Footer />
    </>
  );
}
