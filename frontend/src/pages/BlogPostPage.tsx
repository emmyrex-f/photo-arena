import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Container } from "../components/ui/Container";
import { CameraSpinner } from "../components/ui/CameraSpinner";
import { Section } from "../components/ui/Section";
import { formatPublishDate } from "../lib/datetime";
import { fetchBlogPost, mediaUrl, type BlogPost } from "../lib/publicApi";
import { Seo } from "../lib/seo";

export function BlogPostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPost(undefined);
    setOffline(false);
    fetchBlogPost(slug)
      .then((result) => {
        if (!cancelled) setPost(result);
      })
      .catch(() => {
        if (!cancelled) {
          setOffline(true);
          setPost(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (post === undefined) {
    return (
      <Section>
        <Container>
          <CameraSpinner label="Loading article" caption="Loading…" />
        </Container>
      </Section>
    );
  }

  if (!post) {
    return (
      <>
        <Seo title="Post not found" noIndex />
        <Section>
          <Container className="max-w-xl text-center">
            <h1 className="font-display text-4xl">{offline ? "Journal unavailable" : "Post not found"}</h1>
            <p className="mt-stack text-text-secondary">
              {offline
                ? "We couldn’t reach the blog API. Please try again later."
                : "That article isn’t published (or the link is wrong)."}
            </p>
            <Link to="/blog" className="mt-stack-lg inline-block text-accent hover:text-accent-hover">
              Back to journal
            </Link>
          </Container>
        </Section>
      </>
    );
  }

  const coverSrc = mediaUrl(post.coverImageUrl) || mediaUrl(post.ogImageUrl) || undefined;
  const published = post.publishedAt ? formatPublishDate(post.publishedAt) : undefined;

  return (
    <>
      <Seo
        title={post.metaTitle?.trim() || post.title}
        description={post.metaDescription?.trim() || post.excerpt}
        path={`/blog/${post.slug}`}
        image={post.ogImageUrl?.trim() || post.coverImageUrl || undefined}
        type="article"
        publishedTime={post.publishedAt ?? undefined}
      />
      <article>
        {/* Feature/cover image only — never path-based gallery fallbacks from PageHeader. */}
        {coverSrc ? (
          <header className="relative w-full bg-ink shadow-[0_0_0_100vmax_var(--pa-ink)] [clip-path:inset(0_-100vmax)]">
            <div className="relative isolate min-h-[min(48vh,26rem)] w-full overflow-hidden sm:min-h-[min(52vh,30rem)]">
              <img
                src={coverSrc}
                alt=""
                decoding="async"
                className="pointer-events-none absolute inset-0 size-full object-cover"
                style={{ objectPosition: "center 30%" }}
              />
              <Container className="relative z-[1] flex min-h-[min(48vh,26rem)] max-w-none flex-col justify-end pb-10 pt-10 sm:min-h-[min(52vh,30rem)] sm:pb-14 sm:pt-12">
                <div className="pa-banner-copy">
                  <p className="font-subtitle mb-eyebrow text-xs uppercase tracking-[0.2em] text-accent">
                    Journal
                  </p>
                  <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl md:text-6xl">
                    {post.title}
                  </h1>
                  {published ? (
                    <p className="font-body mt-stack text-base leading-relaxed text-white/90 sm:text-lg">
                      {published}
                    </p>
                  ) : null}
                </div>
              </Container>
            </div>
          </header>
        ) : (
          <header className="border-b border-elevated bg-gradient-to-b from-surface to-bg py-header-y">
            <Container className="max-w-3xl">
              <p className="font-subtitle mb-eyebrow text-xs uppercase tracking-[0.18em] text-accent">
                Journal
              </p>
              <h1 className="font-display text-4xl text-text sm:text-5xl">{post.title}</h1>
              {published ? (
                <p className="font-body mt-stack max-w-xl text-base leading-relaxed text-text-secondary">
                  {published}
                </p>
              ) : null}
            </Container>
          </header>
        )}

        <Section className="pt-stack-xl">
          <Container className="max-w-3xl">
            <Link
              to="/blog"
              className="mb-stack-lg inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to journal
            </Link>
            {post.excerpt ? (
              <p className="mb-stack-xl border-b border-border pb-stack-lg text-lg leading-relaxed text-text-secondary">
                {post.excerpt}
              </p>
            ) : null}
            <div className="prose-pa prose-pa-article">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
            </div>
          </Container>
        </Section>
      </article>
    </>
  );
}
