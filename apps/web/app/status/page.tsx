import type { Metadata } from "next";
import { StatusView } from "@/components/status/StatusView";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-[1400px] px-4 pb-24 pt-28 sm:px-6">
        <StatusView />
      </main>
      <Footer />
    </>
  );
}
