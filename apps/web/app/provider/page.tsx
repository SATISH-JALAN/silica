import type { Metadata } from "next";
import { ProviderConsole } from "@/components/provider/ProviderConsole";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Provider console" };

export default function ProviderPage() {
  return (
    <>
      <main className="mx-auto min-h-screen max-w-[1400px] px-4 pb-24 pt-28 sm:px-6">
        <ProviderConsole />
      </main>
      <Footer />
    </>
  );
}
