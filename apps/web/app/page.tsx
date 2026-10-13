import { SmoothScroll } from "@/components/ui/motion";
import { Cursor } from "@/components/ui/pointer";
import { Intro } from "@/components/landing/Intro";
import { Hero } from "@/components/landing/Hero";
import { Manifesto } from "@/components/landing/Manifesto";
import { KineticBand } from "@/components/landing/KineticBand";
import { LifecycleStory } from "@/components/landing/LifecycleStory";
import { WorkedExample } from "@/components/landing/WorkedExample";
import { CurveSection } from "@/components/landing/CurveSection";
import { WhyMonad } from "@/components/landing/WhyMonad";
import { BuiltOn, Closing } from "@/components/landing/Closing";
import { ChapterRail } from "@/components/landing/ChapterRail";
import { DustField } from "@/components/landing/DustField";
import { GiantMark } from "@/components/landing/GiantMark";
import { Footer } from "@/components/layout/Footer";

const CHAPTERS = ["The gap", "Lifecycle", "Worked example", "Forward curve", "Why Monad"];

export default function Home() {
  return (
    <>
      <DustField />
      <SmoothScroll>
        <main>
          <Hero />
          <Manifesto />
          <KineticBand />
          <LifecycleStory />
          <WorkedExample />
          <CurveSection />
          <WhyMonad />
          <BuiltOn />
          <Closing />
          <GiantMark />
        </main>
        <Footer />
      </SmoothScroll>
      {/* fixed layers live outside the smoothed (transformed) content */}
      <ChapterRail chapters={CHAPTERS} />
      <Cursor />
      <Intro />
    </>
  );
}
