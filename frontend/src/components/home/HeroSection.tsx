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
    <section className="relative isolate -mt-[var(--pa-nav-h)] min-h-dvh overflow-hidden bg-bg pt-[var(--pa-nav-h)]">
      {videoUrl ? (
        <video
          key={videoUrl}
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover object-center hero-video-fade ${
            frameReady ? "opacity-100" : "opacity-0"
          }`}
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

      <div aria-hidden="true" className="hero-edge-bottom pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-16 sm:h-20" />

      <Container className="relative flex min-h-[calc(100dvh-var(--pa-nav-h))] flex-col justify-center pt-4 pb-[calc(var(--pa-book-bar)+1rem)] lg:py-0">
        <Stagger immediate className="w-full max-w-3xl">
          <div className="relative">
            <div
              aria-hidden="true"
              className="hero-copy-glow pointer-events-none absolute -inset-y-4 -left-6 -right-10 -z-10 sm:-inset-y-8 sm:-left-10 sm:-right-16"
            />
            <StaggerItem>
              <h1 className="hero-copy font-hero max-w-3xl text-[1.75rem] leading-[1.15] text-white sm:text-6xl sm:leading-[1.12] md:text-7xl">
                {parts.length > 1 ? (
                  <>
                    {parts[0]}
                    <em className="italic font-light text-white">masterpiece</em>
                    {parts[1]}
                  </>
                ) : (
                  headline
                )}
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="hero-copy mt-3 max-w-xl text-base leading-relaxed text-white sm:mt-6 sm:text-lg">
                {subheadline}
              </p>
            </StaggerItem>
          </div>
          <StaggerItem>
            <div className="mt-5 flex flex-row flex-nowrap items-center gap-1.5 min-[380px]:gap-2 sm:mt-10 sm:gap-4">
              <Button
                to="/book"
                className="shrink-0 !px-3 text-xs tracking-normal min-[380px]:!px-4 min-[380px]:text-[13px] sm:!px-6 sm:text-sm sm:tracking-wide"
              >
                Book Your Session
                <ArrowRight className="hidden h-4 w-4 min-[380px]:inline" aria-hidden="true" />
              </Button>
              <Button
                to="/portfolio"
                variant="secondary"
                className="shrink-0 border-white/70 bg-black/45 !px-3 text-xs tracking-normal text-white hover:border-accent hover:text-accent min-[380px]:!px-4 min-[380px]:text-[13px] sm:!px-6 sm:text-sm sm:tracking-wide"
              >
                Explore Portfolio
              </Button>
            </div>
          </StaggerItem>
          <StaggerItem>
            <p className="hero-copy mt-4 pr-[calc(var(--pa-fab-size)+var(--pa-gutter)+0.5rem)] text-sm text-white sm:mt-8 sm:max-w-none sm:pr-0">
              <span className="sm:hidden">
                Mon–Sat {hoursWeekday}
                <br />
                Sunday {hoursSunday}
              </span>
              <span className="hidden sm:inline">
                Open daily · Mon–Sat {hoursWeekday} · Sunday {hoursSunday}
              </span>
            </p>
          </StaggerItem>
        </Stagger>
      </Container>
    </section>
  );
}
