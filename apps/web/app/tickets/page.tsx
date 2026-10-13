import type { Metadata } from "next";
import { TicketsView } from "@/components/tickets/TicketsView";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-[1400px] px-4 pb-24 pt-28 sm:px-6">
        <TicketsView />
      </main>
      <Footer />
    </>
  );
}
