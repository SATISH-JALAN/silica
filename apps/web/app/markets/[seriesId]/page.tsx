import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradeView } from "@/components/trade/TradeView";
import { getSeriesBySlug, SERIES_LIST } from "@/lib/series";

export function generateStaticParams() {
  return SERIES_LIST.map((s) => ({ seriesId: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ seriesId: string }> }): Promise<Metadata> {
  const { seriesId } = await params;
  return { title: getSeriesBySlug(seriesId)?.code ?? "Market" };
}

export default async function SeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  if (!getSeriesBySlug(seriesId)) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 pb-16 pt-24 sm:px-6">
      <TradeView seriesId={seriesId} />
    </main>
  );
}
