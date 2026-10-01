import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "../../lib/motion";
import { useSetting } from "../../lib/settings";
import { site } from "../../lib/site";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

export function StudioTourSection() {
  const [available, setAvailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const heading = useSetting("tour.heading", site.tour.heading);
  const body = useSetting("tour.body", site.tour.body);
  const videoUrl = useSetting("tour.videoUrl", site.tour.videoUrl);

  useEffect(() => {
    if (!videoUrl) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !available) return;

    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;

    const playVideo = () => {
      video.play().catch(() => {
        // Browser autoplay policy handling
      });
    };

    playVideo();

    video.addEventListener("loadeddata", playVideo);
    video.addEventListener("canplay", playVideo);
    video.addEventListener("canplaythrough", playVideo);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            playVideo();
          }
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener("loadeddata", playVideo);
      video.removeEventListener("canplay", playVideo);
      video.removeEventListener("canplaythrough", playVideo);
    };
  }, [available, videoUrl]);

  return (
    <Section className="relative overflow-hidden bg-[#0a0a0c] text-white py-20 sm:py-24 border-t border-white/10">
      {/* Cinematic subtle background glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-orange-600/10 blur-3xl" />

      <Container className="relative z-10">
        <div className="grid items-center gap-grid-lg lg:grid-cols-2">
          <Reveal>
            <Heading as="h2" className="text-white drop-shadow-sm font-display text-3xl sm:text-4xl md:text-5xl">
              {heading}
            </Heading>
            <p className="mt-stack max-w-md leading-relaxed text-stone-300 text-sm sm:text-base">
              {body}
            </p>
            <div className="mt-stack-lg">
              <Button
                to="/book"
                className="!bg-white !text-stone-950 hover:!bg-stone-100 border-2 !border-white shadow-xl hover:shadow-[0_0_25px_rgba(255,255,255,0.35)] hover:scale-105 active:scale-95 transition-all duration-300 px-8 py-3.5 text-sm sm:text-base font-bold tracking-wider rounded-full group ring-4 ring-white/15"
              >
                <span>Book your session</span>
                <ArrowRight className="h-4 w-4 text-stone-900 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative">
            {available && videoUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9),0_0_30px_rgba(223,158,24,0.1)] ring-1 ring-white/10 bg-black">
                <video
                  key={videoUrl}
                  ref={videoRef}
                  className="aspect-video w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  src={videoUrl}
                  onEnded={(e) => {
                    const v = e.currentTarget;
                    v.currentTime = 0;
                    void v.play();
                  }}
                >
                  <source src={videoUrl} />
                </video>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-stone-400">
                Studio tour video coming soon.
              </div>
            )}
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}


