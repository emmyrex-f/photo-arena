import { useEffect, useState } from "react";
import { Reveal } from "../../lib/motion";
import { useSetting } from "../../lib/settings";
import { site } from "../../lib/site";
import { Button } from "../ui/Button";
import { Container } from "../ui/Container";
import { Heading } from "../ui/Heading";
import { Section } from "../ui/Section";

export function StudioTourSection() {
  const [available, setAvailable] = useState(false);

  const heading = useSetting("tour.heading", site.tour.heading);
  const body = useSetting("tour.body", site.tour.body);
  const videoUrl = useSetting("tour.videoUrl", site.tour.videoUrl);

  useEffect(() => {
    if (!videoUrl) {
      setAvailable(false);
      return;
    }
    let cancelled = false;
    fetch(videoUrl, { method: "HEAD" })
      .then((response) => {
        const type = response.headers.get("content-type") ?? "";
        if (!cancelled && response.ok && type.startsWith("video/")) setAvailable(true);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  return (
    <Section className="tone-deep relative overflow-hidden">
      <Container>
        <div className="grid items-center gap-grid-lg lg:grid-cols-2">
          <Reveal>
            <Heading as="h2">{heading}</Heading>
            <p className="mt-stack max-w-md leading-relaxed text-text-secondary">{body}</p>
            <div className="mt-stack-lg">
              <Button to="/book" variant="secondary">
                Book your session
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="relative">
            {available ? (
              <div className="relative overflow-hidden border border-border">
                <video
                  className="aspect-video w-full object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="metadata"
                >
                  <source src={videoUrl} type="video/mp4" />
                </video>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center border border-border bg-surface/40 text-sm text-text-secondary">
                Studio tour video coming soon.
              </div>
            )}
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
