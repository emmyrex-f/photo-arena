import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Stagger, StaggerItem } from "../../lib/motion";
import { useSetting, useSiteInfo } from "../../lib/settings";
import { site } from "../../lib/site";

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const headline = useSetting("hero.headline", site.hero.headline);
  const subheadline = useSetting("hero.subheadline", site.hero.subheadline);
  const videoUrl = useSetting("hero.videoUrl", site.hero.videoUrl);
  const { hoursWeekday, hoursSunday } = useSiteInfo();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduceMotion(media.matches);
      if (media.matches) {
        videoRef.current?.pause();
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function showFrame() {
    setFrameReady(true);
  }

  function startPlayback() {
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    showFrame();
    void video.play();
  }

  const parts = headline.split("masterpiece");

  return (
    <section className="relative isolate -mt-[var(--pa-nav-h)] min-h-dvh overflow-hidden bg-ink pt-[var(--pa-nav-h)]">
      {videoUrl ? (
        <video
          key={videoUrl}
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover object-center hero-video-fade ${
            frameReady ? "opacity-100" : "opacity-0"
          }`}
          poster="/media/hero-landscape.jpg"
          muted
          loop
          playsInline
          autoPlay={!reduceMotion}
          preload="auto"
          aria-hidden="true"
          onLoadedData={showFrame}
          onCanPlay={startPlayback}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : null}

      <Container className="relative z-[2] flex min-h-[calc(100dvh-var(--pa-nav-h))] flex-col justify-center pt-4 pb-[calc(var(--pa-book-bar)+1rem)] lg:py-0">
        <Stagger immediate>
          <StaggerItem className="w-fit max-w-full">
            <div className="pa-banner-copy">
              <h1 className="font-hero text-[2rem] leading-[1.1] text-white sm:text-6xl sm:leading-[1.08] md:text-7xl lg:text-8xl">
                {parts.length > 1 ? (
                  <>
                    {parts[0]}
                    <span className="text-accent">masterpiece</span>
                    {parts[1]}
                  </>
                ) : (
                  headline
                )}
              </h1>
              <p className="font-body mt-4 text-base leading-relaxed text-white/90 sm:mt-6 sm:text-lg">
                {subheadline}
              </p>
              <div className="mt-6 flex flex-row flex-wrap items-center gap-3 sm:mt-10">
                <Button
                  to="/book"
                  className="shrink-0 !px-5 text-sm sm:!px-7 sm:text-base"
                >
                  Book a Session
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  to="/portfolio"
                  variant="secondary"
                  className="shrink-0 border-white/35 bg-white/10 !px-5 text-sm text-white hover:border-accent hover:bg-white/15 hover:text-accent sm:!px-7 sm:text-base"
                >
                  View Gallery
                </Button>
              </div>
              <p className="font-subtitle mt-5 text-sm text-white/80 sm:mt-8">
                <span className="sm:hidden">
                  Mon–Sat {hoursWeekday}
                  <br />
                  Sunday {hoursSunday}
                </span>
                <span className="hidden sm:inline">
                  Open daily · Mon–Sat {hoursWeekday} · Sunday {hoursSunday}
                </span>
              </p>
            </div>
          </StaggerItem>
        </Stagger>
      </Container>
    </section>
  );
}
